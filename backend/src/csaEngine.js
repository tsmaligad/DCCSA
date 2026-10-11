const { minsToTimeStr } = require('./routesLoader');

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;

  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const aBounded = Math.min(1, Math.max(0, a));

  const c = 2 * Math.atan2(
    Math.sqrt(aBounded),
    Math.sqrt(1 - aBounded)
  );

  return Math.round(R * c);
}

function findNearbyStops(lat, lng, stopsMap, maxDistMeters = 1500) {
  const nearby = [];

  for (const [id, stop] of stopsMap.entries()) {
    const dist = calculateDistanceMeters(
      lat,
      lng,
      stop.lat,
      stop.lng
    );

    if (dist <= maxDistMeters) {
      const walkTimeMins = Math.max(
        1,
        Math.ceil(dist / 80)
      );

      nearby.push({
        ...stop,
        distanceMeters: dist,
        walkTimeMins
      });
    }
  }

  return nearby.sort(
    (a, b) => a.distanceMeters - b.distanceMeters
  );
}

function buildConnections(routes) {
  const connections = [];

  for (const route of routes) {
    for (const trip of route.trips) {
      for (let i = 0; i < route.stops.length - 1; i++) {
        const depStop = route.stops[i];
        const arrStop = route.stops[i + 1];

        const depTime =
          trip.departureTimeMins + i * 3;

        const arrTime =
          trip.departureTimeMins + (i + 1) * 3;

        connections.push({
          depStopId: depStop.id,
          arrStopId: arrStop.id,
          depTime,
          arrTime,
          tripId: `${route.id}_${trip.departureTimeMins}`,
          routeId: route.id,
          routeName: route.name,
          routeColor: route.color || '#ff8300',
          route
        });
      }
    }
  }

  connections.sort(
    (a, b) => a.depTime - b.depTime
  );

  return connections;
}

function runCSA({
  origin,
  destination,
  departureTimeMins,
  routes,
  stopsMap
}) {
  console.log('CSA IS RUNNING');

  const originStops = findNearbyStops(
    origin.lat,
    origin.lng,
    stopsMap,
    1500
  );

  const destinationStops = findNearbyStops(
    destination.lat,
    destination.lng,
    stopsMap,
    1500
  );

  if (
    originStops.length === 0 ||
    destinationStops.length === 0
  ) {
    return { options: [] };
  }

  const connections = buildConnections(routes);

  console.log('Connections:', connections.length);

  const options = [];

  /*
    Run a separate CSA scan for each route.

    This lets the frontend receive multiple choices,
    similar to your friend's current RAPTOR version,
    while the route computation still uses a
    departure-time-sorted connection scan.
  */
  for (const route of routes) {
    const routeConnections =
      connections.filter(
        connection =>
          connection.routeId === route.id
      );

    if (routeConnections.length === 0) {
      continue;
    }

    const originStopsOnRoute =
      originStops.filter(stop =>
        route.stops.some(
          routeStop => routeStop.id === stop.id
        )
      );

    const destinationStopsOnRoute =
      destinationStops.filter(stop =>
        route.stops.some(
          routeStop => routeStop.id === stop.id
        )
      );

    if (
      originStopsOnRoute.length === 0 ||
      destinationStopsOnRoute.length === 0
    ) {
      continue;
    }

    const arrivalTimes = new Map();
    const reachedTrips = new Map();
    const predecessor = new Map();

    for (const stop of route.stops) {
      arrivalTimes.set(stop.id, Infinity);
    }

    for (const connection of routeConnections) {
      reachedTrips.set(
        connection.tripId,
        false
      );
    }

    /*
      Initialize reachable origin-side stops.
    */
    for (const stop of originStopsOnRoute) {
      const arrival =
        departureTimeMins +
        stop.walkTimeMins;

      if (
        arrival <
        arrivalTimes.get(stop.id)
      ) {
        arrivalTimes.set(
          stop.id,
          arrival
        );

        predecessor.set(
          stop.id,
          {
            type: 'ORIGIN_WALK',
            stop
          }
        );
      }
    }

    const destinationStopIds =
      new Set(
        destinationStopsOnRoute.map(
          stop => stop.id
        )
      );

    let bestDestinationArrival =
      Infinity;

    let bestDestinationStop = null;

    /*
      CSA CONNECTION SCAN
    */
    for (const connection of routeConnections) {
      if (
        connection.depTime <
        departureTimeMins
      ) {
        continue;
      }

      if (
        bestDestinationArrival !== Infinity &&
        connection.depTime >=
          bestDestinationArrival
      ) {
        break;
      }

      const tripAlreadyReached =
        reachedTrips.get(
          connection.tripId
        );

      const canReachDeparture =
        arrivalTimes.get(
          connection.depStopId
        ) <= connection.depTime;

      if (
        !tripAlreadyReached &&
        !canReachDeparture
      ) {
        continue;
      }

      reachedTrips.set(
        connection.tripId,
        true
      );

      if (
        connection.arrTime <
        arrivalTimes.get(
          connection.arrStopId
        )
      ) {
        arrivalTimes.set(
          connection.arrStopId,
          connection.arrTime
        );

        predecessor.set(
          connection.arrStopId,
          connection
        );

        if (
          destinationStopIds.has(
            connection.arrStopId
          )
        ) {
          const destinationStop =
            destinationStopsOnRoute.find(
              stop =>
                stop.id ===
                connection.arrStopId
            );

          const finalArrival =
            connection.arrTime +
            destinationStop.walkTimeMins;

          if (
            finalArrival <
            bestDestinationArrival
          ) {
            bestDestinationArrival =
              finalArrival;

            bestDestinationStop =
              destinationStop;
          }
        }
      }
    }

    if (
      bestDestinationArrival === Infinity ||
      !bestDestinationStop
    ) {
      continue;
    }

    /*
      Reconstruct the connection sequence.
    */
    const transitConnections = [];

    let currentStopId =
      bestDestinationStop.id;

    while (
      predecessor.has(currentStopId)
    ) {
      const previous =
        predecessor.get(
          currentStopId
        );

      if (
        previous.type ===
        'ORIGIN_WALK'
      ) {
        break;
      }

      transitConnections.unshift(
        previous
      );

      currentStopId =
        previous.depStopId;
    }

    if (
      transitConnections.length === 0
    ) {
      continue;
    }

    const firstConnection =
      transitConnections[0];

    const lastConnection =
      transitConnections[
        transitConnections.length - 1
      ];

    const boardStop =
      stopsMap.get(
        firstConnection.depStopId
      );

    const alightStop =
      stopsMap.get(
        lastConnection.arrStopId
      );

    if (!boardStop || !alightStop) {
      continue;
    }

    const originStop =
      originStopsOnRoute.find(
        stop =>
          stop.id ===
          boardStop.id
      );

    if (!originStop) {
      continue;
    }

    const walkToStopMins =
      originStop.walkTimeMins;

    const walkToDestMins =
      bestDestinationStop.walkTimeMins;

    const firstDeparture =
      firstConnection.depTime;

    const lastArrival =
      lastConnection.arrTime;

    const rideDuration =
      lastArrival -
      firstDeparture;

    const totalDuration =
      bestDestinationArrival -
      departureTimeMins;

    const isActiveNow =
      departureTimeMins >=
        route.startMins &&
      departureTimeMins <=
        route.endMins;

    options.push({
      primaryRouteNumber:
        route.id,

      primaryRouteName:
        route.name,

      primaryColor:
        route.color ||
        '#ff8300',

      totalDuration,

      isActiveNow,

      operatingHours:
        `${minsToTimeStr(
          route.startMins
        )} - ${minsToTimeStr(
          route.endMins
        )}`,

      nextDepartureStr:
        minsToTimeStr(
          firstDeparture
        ),

      arrivalTimeStr:
        minsToTimeStr(
          bestDestinationArrival
        ),

      boardStopId:
        boardStop.id,

      alightStopId:
        alightStop.id,

      allRouteStops:
        route.stops,

      allPathPoints:
        route.allPathPoints,

      transfers: 0,

      legs: [
        {
          type: 'WALK',
          from:
            origin.label ||
            'Starting Location',
          to:
            boardStop.name,
          duration:
            walkToStopMins,
          dist:
            originStop.distanceMeters
        },

        {
          type: 'TRANSIT',
          routeNumber:
            route.id,
          routeName:
            route.name,
          color:
            route.color ||
            '#ff8300',
          fromStop:
            boardStop.name,
          toStop:
            alightStop.name,
          boardTimeStr:
            minsToTimeStr(
              firstDeparture
            ),
          alightTimeStr:
            minsToTimeStr(
              lastArrival
            ),
          duration:
            rideDuration,
          pathPoints:
            route.allPathPoints
        },

        {
          type: 'WALK',
          from:
            alightStop.name,
          to:
            destination.label ||
            'Destination Location',
          duration:
            walkToDestMins,
          dist:
            bestDestinationStop
              .distanceMeters
        }
      ]
    });
  }

  /*
    Same behavior as your friend's version:
    one option per unique route.
  */
  const uniqueOptionsMap =
    new Map();

  for (const option of options) {
    const key =
      option.primaryRouteNumber;

    if (
      !uniqueOptionsMap.has(key)
    ) {
      uniqueOptionsMap.set(
        key,
        option
      );

      continue;
    }

    const existing =
      uniqueOptionsMap.get(key);

    if (
      !existing.isActiveNow &&
      option.isActiveNow
    ) {
      uniqueOptionsMap.set(
        key,
        option
      );
    } else if (
      existing.isActiveNow ===
        option.isActiveNow &&
      option.totalDuration <
        existing.totalDuration
    ) {
      uniqueOptionsMap.set(
        key,
        option
      );
    }
  }

  /*
    Same sorting behavior as RAPTOR version:
    active routes first,
    then shortest total duration.
  */
  const sortedOptions =
    Array.from(
      uniqueOptionsMap.values()
    ).sort(
      (a, b) =>
        (b.isActiveNow -
          a.isActiveNow) ||
        (a.totalDuration -
          b.totalDuration)
    );

  console.log(
    'CSA options:',
    sortedOptions.length
  );

  return {
    options: sortedOptions
  };
}

module.exports = {
  findNearbyStops,
  buildConnections,
  runCSA
};