const { minsToTimeStr } = require('./routesLoader');

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const aBounded = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(aBounded), Math.sqrt(1 - aBounded));
  return Math.round(R * c);
}

function findNearbyStops(lat, lng, stopsMap, maxDistMeters = 1500) {
  const nearby = [];
  for (const [id, stop] of stopsMap.entries()) {
    const dist = calculateDistanceMeters(lat, lng, stop.lat, stop.lng);
    if (dist <= maxDistMeters) {
      const walkTimeMins = Math.max(1, Math.ceil(dist / 80));
      nearby.push({ ...stop, distanceMeters: dist, walkTimeMins });
    }
  }
  return nearby.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function runRaptor({ origin, destination, departureTimeMins, routes, stopsMap }) {
  const originStops = findNearbyStops(origin.lat, origin.lng, stopsMap, 1500);
  const destStops = findNearbyStops(destination.lat, destination.lng, stopsMap, 1500);

  if (originStops.length === 0 || destStops.length === 0) {
    return { options: [] };
  }

  const options = [];

  for (const origStop of originStops) {
    for (const route of routes) {
      const origIdx = route.stops.findIndex(s => s.id === origStop.id);
      if (origIdx === -1) continue;

      for (const destStop of destStops) {
        const destIdx = route.stops.findIndex(s => s.id === destStop.id);
        if (destIdx === -1 || destIdx <= origIdx) continue;

        const isActiveNow = (departureTimeMins >= route.startMins && departureTimeMins <= route.endMins);

        let activeTrip = route.trips.find(t => t.departureTimeMins >= departureTimeMins);
        if (!activeTrip) {
          activeTrip = route.trips[0] || { departureTimeMins: route.startMins };
        }

        const walkToStopMins = origStop.walkTimeMins;
        const boardTimeMins = activeTrip.departureTimeMins;
        const stopsTraversed = destIdx - origIdx;
        const rideDurationMins = stopsTraversed * 3;
        const alightTimeMins = boardTimeMins + rideDurationMins;
        const walkToDestMins = destStop.walkTimeMins;
        const totalDurationMins = rideDurationMins + walkToStopMins + walkToDestMins;

        options.push({
          primaryRouteNumber: route.id,
          primaryRouteName: route.name,
          primaryColor: route.color || '#ff8300',
          totalDuration: totalDurationMins,
          isActiveNow,
          operatingHours: `${minsToTimeStr(route.startMins)} - ${minsToTimeStr(route.endMins)}`,
          nextDepartureStr: minsToTimeStr(boardTimeMins),
          arrivalTimeStr: minsToTimeStr(alightTimeMins + walkToDestMins),
          boardStopId: origStop.id,
          alightStopId: destStop.id,
          allRouteStops: route.stops, // Bus stops (kind === 'stop')
          allPathPoints: route.allPathPoints, // Bus trajectory path points for polyline
          legs: [
            {
              type: 'WALK',
              from: origin.label || 'Starting Location',
              to: origStop.name,
              duration: walkToStopMins,
              dist: origStop.distanceMeters
            },
            {
              type: 'TRANSIT',
              routeNumber: route.id,
              routeName: route.name,
              color: route.color || '#ff8300',
              fromStop: origStop.name,
              toStop: destStop.name,
              boardTimeStr: minsToTimeStr(boardTimeMins),
              alightTimeStr: minsToTimeStr(alightTimeMins),
              duration: rideDurationMins,
              pathPoints: route.allPathPoints
            },
            {
              type: 'WALK',
              from: destStop.name,
              to: destination.label || 'Destination Location',
              duration: walkToDestMins,
              dist: destStop.distanceMeters
            }
          ]
        });
      }
    }
  }

  const uniqueOptionsMap = new Map();
  options.forEach(opt => {
    const key = opt.primaryRouteNumber;
    if (!uniqueOptionsMap.has(key)) {
      uniqueOptionsMap.set(key, opt);
    } else {
      const existing = uniqueOptionsMap.get(key);
      if (!existing.isActiveNow && opt.isActiveNow) {
        uniqueOptionsMap.set(key, opt);
      } else if (existing.isActiveNow === opt.isActiveNow && opt.totalDuration < existing.totalDuration) {
        uniqueOptionsMap.set(key, opt);
      }
    }
  });

  const sortedOptions = Array.from(uniqueOptionsMap.values())
    .sort((a, b) => (b.isActiveNow - a.isActiveNow) || (a.totalDuration - b.totalDuration));

  return { options: sortedOptions };
}

module.exports = { findNearbyStops, runRaptor };