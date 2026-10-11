const express = require('express');
const cors = require('cors');
const { loadRoutesData, timeToMins } = require('./routesLoader');
const { findNearbyStops, runCSA } = require('./csaEngine');

const app = express();
app.use(cors());
app.use(express.json());

const { routes, stopsMap } = loadRoutesData();

// GET all routes for "All Bus Routes" tab (Deduplicated by route code)
app.get('/api/routes', (req, res) => {
  const uniqueRoutesMap = new Map();

  routes.forEach(r => {
    const routeCode = String(r.code || r.id);

    if (!uniqueRoutesMap.has(routeCode)) {
      const matches = routes.filter(m => String(m.code || m.id) === routeCode);
      const amVariant = matches.find(m => m.direction === 'AM' || m.shift === 'AM') || matches[0];
      const pmVariant = matches.find(m => m.direction === 'PM' || m.shift === 'PM') || matches[1] || matches[0];

      uniqueRoutesMap.set(routeCode, {
        id: r.id,
        code: routeCode,
        name: r.name || `Route ${routeCode}`,
        color: r.color || '#2563eb',
        isActiveNow: r.isActiveNow !== undefined ? r.isActiveNow : true,
        // Separate default schedules for AM and PM shifts
        startTimeAM: amVariant.startTime || amVariant.startTimeAM || '06:00',
        endTimeAM: amVariant.endTime || amVariant.endTimeAM || '10:00',
        startTimePM: pmVariant.startTime || pmVariant.startTimePM || '16:00',
        endTimePM: pmVariant.endTime || pmVariant.endTimePM || '21:00',
        totalDuration: r.totalDuration || 35,
        nextDepartureStr: r.nextDepartureStr || '10-15 mins',
        stopsCount: r.stops ? r.stops.length : 0,
        stops: r.stops || [],
        pathPoints: r.pathPoints || []
      });
    }
  });

  res.json(Array.from(uniqueRoutesMap.values()));
});

// GET route details by ID/code (supports ?direction=AM or ?direction=PM)
app.get('/api/routes/:id', (req, res) => {
  const { id } = req.params;
  const { direction } = req.query; // 'AM' or 'PM'

  const matchingRoutes = routes.filter(r => String(r.id) === id || String(r.code) === id);

  if (matchingRoutes.length === 0) {
    return res.status(404).json({ error: 'Route not found' });
  }

  // Find explicit directional variant if available
  let selectedRoute = matchingRoutes[0];
  const explicitMatch = matchingRoutes.find(r => 
    (r.direction && r.direction.toUpperCase() === direction) ||
    (r.shift && r.shift.toUpperCase() === direction)
  );

  if (explicitMatch) {
    selectedRoute = explicitMatch;
  } else if (direction === 'PM' && matchingRoutes.length > 1) {
    selectedRoute = matchingRoutes[1];
  }

  const responseData = {
    ...selectedRoute,
    startTime: selectedRoute.startTime || (direction === 'PM' ? '16:00' : '06:00'),
    endTime: selectedRoute.endTime || (direction === 'PM' ? '21:00' : '10:00')
  };

  res.json(responseData);
});

app.post('/api/nearby-stops', (req, res) => {
  const { lat, lng, radiusMeters } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'Latitude and Longitude are required.' });
  }

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  if (isNaN(parsedLat) || isNaN(parsedLng)) {
    return res.status(400).json({ error: 'Invalid coordinate format.' });
  }

  const nearbyStops = findNearbyStops(parsedLat, parsedLng, stopsMap, radiusMeters || 1000).map(s => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    distanceMeters: s.distanceMeters,
    walkTimeMins: s.walkTimeMins,
    routesServing: routes.filter(r => r.stops.some(st => st.id === s.id)).map(r => r.id)
  }));

  res.json({ nearbyStops });
});

app.post('/api/plan-trip', (req, res) => {
  const { origin, destination, departureTime } = req.body;

  if (!origin || origin.lat == null || origin.lng == null || !destination || destination.lat == null || destination.lng == null) {
    return res.status(400).json({ error: 'Origin and Destination coordinates (lat, lng) are required.' });
  }

  const currentMins = departureTime ? timeToMins(departureTime) : 480;
  const result = runCSA({
    origin,
    destination,
    departureTimeMins: currentMins,
    routes,
    stopsMap
  });
  res.json(result);
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Node Transit Backend running on http://localhost:${PORT}`);
});