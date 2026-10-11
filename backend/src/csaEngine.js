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

  const arrivalTimes = new Map();
  const reachedTrips = new Map();
  const predecessor = new Map();

  for (const stopId of stopsMap.keys()) {
    arrivalTimes.set(stopId, Infinity);
  }

  for (const connection of connections) {
    reachedTrips.set(connection.tripId, false);
  }

  for (const stop of originStops) {
    const arrival =
      departureTimeMins + stop.walkTimeMins;

    if (arrival < arrivalTimes.get(stop.id)) {
      arrivalTimes.set(stop.id, arrival);

      predecessor.set(stop.id, {
        type: 'ORIGIN_WALK',
        stop
      });
    }
  }

  const destinationStopIds =
    new Set(destinationStops.map(stop => stop.id));

  let bestDestinationArrival = Infinity;
  let bestDestinationStop = null;

  for (const connection of connections) {
    if (connection.depTime < departureTimeMins) {
      continue;
    }

    if (
      bestDestinationArrival !== Infinity &&
      connection.depTime >= bestDestinationArrival
    ) {
      break;
    }

    const tripAlreadyReached =
      reachedTrips.get(connection.tripId);

    const canReachDeparture =
      arrivalTimes.get(connection.depStopId) <=
      connection.depTime;

    if (!tripAlreadyReached && !canReachDeparture) {
      continue;
    }

    reachedTrips.set(connection.tripId, true);

    if (
      connection.arrTime <
      arrivalTimes.get(connection.arrStopId)
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
          destinationStops.find(
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
    return { options: [] };
  }

  const transitConnections = [];

  let currentStopId =
    bestDestinationStop.id;

  while (predecessor.has(currentStopId)) {
    const prev =
      predecessor.get(currentStopId);

    if (prev.type === 'ORIGIN_WALK') {
      break;
    }

    transitConnections.unshift(prev);

    currentStopId = prev.depStopId;
  }

  if (transitConnections.length === 0) {
    return { options: [] };
  }

  const firstConnection =
    transitConnections[0];

  const lastConnection =
    transitConnections[
      transitConnections.length - 1
    ];

  const boardStop =
    stopsMap.get(firstConnection.depStopId);

  const alightStop =
    stopsMap.get(lastConnection.arrStopId);

  const originStop =
    originStops.find(
      stop => stop.id === boardStop.id
    );

  const firstDeparture =
    firstConnection.depTime;

  const transitArrival =
    lastConnection.arrTime;

  const walkToStopMins =
    originStop?.walkTimeMins || 0;

  const walkToDestMins =
    bestDestinationStop.walkTimeMins;

  const totalDuration =
    bestDestinationArrival -
    departureTimeMins;

  const usedRouteIds = [
    ...new Set(
      transitConnections.map(c => c.routeId)
    )
  ];

  const transitLegs = [];

  let currentLeg = null;

  for (const connection of transitConnections) {
    if (
      !currentLeg ||
      currentLeg.tripId !== connection.tripId
    ) {
      if (currentLeg) {
        transitLegs.push(currentLeg);
      }

      currentLeg = {
        type: 'TRANSIT',
        tripId: connection.tripId,
        routeNumber: connection.routeId,
        routeName: connection.routeName,
        color: connection.routeColor,
        fromStop:
          stopsMap.get(connection.depStopId)?.name,
        toStop:
          stopsMap.get(connection.arrStopId)?.name,
        boardTimeStr:
          minsToTimeStr(connection.depTime),
        alightTimeStr:
          minsToTimeStr(connection.arrTime),
        duration:
          connection.arrTime -
          connection.depTime,
        pathPoints:
          connection.route.allPathPoints
      };
    } else {
      currentLeg.toStop =
        stopsMap.get(connection.arrStopId)?.name;

      currentLeg.alightTimeStr =
        minsToTimeStr(connection.arrTime);

      currentLeg.duration =
        connection.arrTime -
        firstConnection.depTime;
    }
  }

  if (currentLeg) {
    transitLegs.push(currentLeg);
  }

  const legs = [
    {
      type: 'WALK',
      from:
        origin.label ||
        'Starting Location',
      to: boardStop.name,
      duration: walkToStopMins,
      dist:
        originStop?.distanceMeters || 0
    },
    ...transitLegs,
    {
      type: 'WALK',
      from: alightStop.name,
      to:
        destination.label ||
        'Destination Location',
      duration: walkToDestMins,
      dist:
        bestDestinationStop.distanceMeters
    }
  ];

  const mainRoute =
    routes.find(
      route =>
        route.id === firstConnection.routeId
    );

  return {
    options: [
      {
        primaryRouteNumber:
          usedRouteIds.join(' → '),

        primaryRouteName:
          mainRoute?.name ||
          firstConnection.routeName,

        primaryColor:
          mainRoute?.color ||
          '#ff8300',

        totalDuration,

        isActiveNow: true,

        operatingHours:
          mainRoute?.operatingHours || '',

        nextDepartureStr:
          minsToTimeStr(firstDeparture),

        arrivalTimeStr:
          minsToTimeStr(
            bestDestinationArrival
          ),

        boardStopId:
          boardStop.id,

        alightStopId:
          alightStop.id,

        allRouteStops:
          mainRoute?.stops || [],

        allPathPoints:
          mainRoute?.allPathPoints || [],

        transfers:
          Math.max(
            0,
            usedRouteIds.length - 1
          ),

        legs
      }
    ]
  };
}

module.exports = {
  findNearbyStops,
  buildConnections,
  runCSA
};