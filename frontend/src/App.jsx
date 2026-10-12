import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// SVG Icons
const BusIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6v6" /><path d="M16 6v6" /><path d="M4 12h16" />
    <rect width="18" height="14" x="3" y="3" rx="2" />
    <path d="M4 17v2" /><path d="M20 17v2" />
  </svg>
);

const MapPinIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-10a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ClockIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const NavigationIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
);

const SearchIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const CrosshairIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="22" x2="18" y1="12" y2="12" />
    <line x1="6" x2="2" y1="12" y2="12" />
    <line x1="12" x2="12" y1="2" y2="6" />
    <line x1="12" x2="12" y1="18" y2="22" />
  </svg>
);

// 12-Hour Converter
const formatTo12Hour = (timeVal) => {
  if (timeVal === undefined || timeVal === null || timeVal === '') return 'N/A';

  let hours = 0;
  let minutes = 0;

  if (typeof timeVal === 'number' && !isNaN(timeVal)) {
    if (timeVal <= 24) {
      hours = timeVal;
      minutes = 0;
    } else {
      hours = Math.floor(timeVal / 60) % 24;
      minutes = timeVal % 60;
    }
  } else if (typeof timeVal === 'string') {
    const trimmed = timeVal.trim();
    if (/am|pm/i.test(trimmed)) return trimmed;

    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10) || 0;
    } else {
      hours = parseInt(trimmed, 10);
      minutes = 0;
    }
  }

  if (isNaN(hours)) return String(timeVal);

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = String(minutes).padStart(2, '0');

  return `${displayHours}:${displayMinutes} ${period}`;
};

// Leaflet Pins
const originIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const destIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const boardStopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const alightStopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const createCircleStopIcon = (color = '#2563eb') => {
  return L.divIcon({
    className: 'custom-circle-stop-marker',
    html: `<div style="
      width: 12px;
      height: 12px;
      background-color: #ffffff;
      border: 3.5px solid ${color};
      border-radius: 50%;
      box-shadow: 0 2px 5px rgba(15, 23, 42, 0.25);
      cursor: pointer;
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

const createHighlightedStopIcon = (color = '#ef4444') => {
  return L.divIcon({
    className: 'custom-highlight-stop-marker',
    html: `<div style="
      width: 22px;
      height: 22px;
      background-color: ${color};
      border: 4px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.35), 0 4px 10px rgba(0,0,0,0.3);
      cursor: pointer;
      animation: pulse-ring 1.5s infinite;
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

function MapController({ origin, destination, activeOption, selectedRouteDetails, activeTab, selectedStop }) {
  const map = useMap();

  useEffect(() => {
    if (selectedStop && selectedStop.lat && selectedStop.lng) {
      map.flyTo([selectedStop.lat, selectedStop.lng], 16, { animate: true, duration: 1 });
      return;
    }

    const points = [];

    if (activeTab === 'routes' && selectedRouteDetails) {
      if (selectedRouteDetails.pathPoints?.length > 0) {
        selectedRouteDetails.pathPoints.forEach(p => {
          if (Array.isArray(p)) points.push(p);
          else if (p.lat && p.lng) points.push([p.lat, p.lng]);
        });
      } else if (selectedRouteDetails.stops?.length > 0) {
        selectedRouteDetails.stops.forEach(s => {
          if (s.lat && s.lng) points.push([s.lat, s.lng]);
        });
      }
    } else if (activeTab === 'planner') {
      if (origin?.lat && origin?.lng) points.push([origin.lat, origin.lng]);
      if (destination?.lat && destination?.lng) points.push([destination.lat, destination.lng]);

      if (activeOption?.allPathPoints?.length > 0) {
        activeOption.allPathPoints.forEach(p => {
          if (p.lat && p.lng) points.push([p.lat, p.lng]);
        });
      } else if (activeOption?.allRouteStops) {
        activeOption.allRouteStops.forEach(s => {
          if (s.lat && s.lng) points.push([s.lat, s.lng]);
        });
      }
    }

    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (points.length === 1) {
      map.flyTo(points[0], 14);
    }
  }, [map, origin, destination, activeOption, selectedRouteDetails, activeTab, selectedStop]);

  return null;
}

function MapClickHandler({ mapPickMode, onMapClick }) {
  useMapEvents({
    click(e) {
      if (mapPickMode) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    }
  });
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('planner');

  // Trip Planner Location States
  const [origin, setOrigin] = useState({
    lat: 7.0185,
    lng: 125.4971,
    label: 'Toril District Hall',
    address: 'Toril, Davao City, Davao del Sur'
  });
  const [destination, setDestination] = useState({
    lat: 7.0673,
    lng: 125.6120,
    label: 'Roxas Avenue',
    address: 'Poblacion District, Davao City, Davao del Sur'
  });

  const [activeInput, setActiveInput] = useState(null);
  const [mapPickMode, setMapPickMode] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchTimeoutRef = useRef(null);

  const [journeyOptions, setJourneyOptions] = useState([]);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(null);
  const [loading, setLoading] = useState(false);

  // Directory Bus Routes State
  const [routesList, setRoutesList] = useState([]);
  const [routesFilter, setRoutesFilter] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [selectedDirection, setSelectedDirection] = useState('AM');
  const [selectedRouteDetails, setSelectedRouteDetails] = useState(null);
  const [selectedStop, setSelectedStop] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routesFetchError, setRoutesFetchError] = useState(false);

  // Walking Paths
  const [walkToBoardPath, setWalkToBoardPath] = useState([]);
  const [walkToDestPath, setWalkToDestPath] = useState([]);

  const activeOption = selectedOptionIdx !== null ? journeyOptions[selectedOptionIdx] : null;

  useEffect(() => {
    const fetchAllRoutes = async () => {
      try {
        setRoutesFetchError(false);
        const res = await axios.get('http://localhost:5001/api/routes');
        if (res.data && Array.isArray(res.data)) {
          setRoutesList(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch routes:', err);
        setRoutesFetchError(true);
      }
    };
    fetchAllRoutes();
  }, []);

  useEffect(() => {
    if (!activeOption || activeTab !== 'planner') {
      setWalkToBoardPath([]);
      setWalkToDestPath([]);
      return;
    }

    const fetchStreetWalkPaths = async () => {
      const boardStop = activeOption.allRouteStops?.find(s => s.id === activeOption.boardStopId);
      const alightStop = activeOption.allRouteStops?.find(s => s.id === activeOption.alightStopId);

      if (boardStop && origin?.lat && origin?.lng) {
        try {
          const url = `https://router.project-osrm.org/route/v1/foot/${origin.lng},${origin.lat};${boardStop.lng},${boardStop.lat}?overview=full&geometries=geojson`;
          const res = await axios.get(url);
          if (res.data?.routes?.[0]?.geometry?.coordinates) {
            const coords = res.data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            setWalkToBoardPath(coords);
          } else {
            setWalkToBoardPath([[origin.lat, origin.lng], [boardStop.lat, boardStop.lng]]);
          }
        } catch {
          setWalkToBoardPath([[origin.lat, origin.lng], [boardStop.lat, boardStop.lng]]);
        }
      }

      if (alightStop && destination?.lat && destination?.lng) {
        try {
          const url = `https://router.project-osrm.org/route/v1/foot/${alightStop.lng},${alightStop.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
          const res = await axios.get(url);
          if (res.data?.routes?.[0]?.geometry?.coordinates) {
            const coords = res.data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            setWalkToDestPath(coords);
          } else {
            setWalkToDestPath([[alightStop.lat, alightStop.lng], [destination.lat, destination.lng]]);
          }
        } catch {
          setWalkToDestPath([[alightStop.lat, alightStop.lng], [destination.lat, destination.lng]]);
        }
      }
    };

    fetchStreetWalkPaths();
  }, [activeOption, origin, destination, activeTab]);

  const handleSearchInputChange = (text) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!text || text.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: { q: text, format: 'json', addressdetails: 1, limit: 6 }
        });
        setSearchResults(res.data || []);
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 350);
  };

  const handleSelectEstablishment = (place, target) => {
    const rawParts = place.display_name ? place.display_name.split(',') : [];
    const title = rawParts[0]?.trim() || 'Selected Place';
    const fullAddress = rawParts.length > 1 ? rawParts.slice(1).join(',').trim() : place.display_name;

    const coords = {
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      label: title,
      address: fullAddress
    };

    if (target === 'start') setOrigin(coords);
    else setDestination(coords);

    setSearchQuery('');
    setSearchResults([]);
    setActiveInput(null);
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            label: 'Current Location',
            address: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
          };
          if (activeInput === 'dest') setDestination(coords);
          else setOrigin(coords);
          setActiveInput(null);
        },
        () => alert('Unable to retrieve current location.')
      );
    }
  };

  const handleMapClick = (coords) => {
    const pinnedLoc = {
      ...coords,
      label: 'Pinned Location',
      address: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
    };

    if (mapPickMode === 'start') setOrigin(pinnedLoc);
    else if (mapPickMode === 'dest') setDestination(pinnedLoc);

    setMapPickMode(null);
  };

  const handleSearchRoutes = async () => {
    setLoading(true);
    const now = new Date();
    const systemTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    try {
      const res = await axios.post('http://localhost:5001/api/plan-trip', {
        origin,
        destination,
        departureTime: systemTimeStr
      });

      const options = res.data.options || [];
      setJourneyOptions(options);
      setSelectedOptionIdx(options.length > 0 ? 0 : null);
    } catch (err) {
      console.error(err);
      alert('Error searching routes.');
    } finally {
      setLoading(false);
    }
  };

  const parseBackendRouteData = (data, routeMeta = {}, direction = 'AM') => {
    let stops = [];
    let pathPoints = [];

    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      data.features.forEach(f => {
        if (f.geometry?.type === 'LineString') {
          pathPoints = f.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        } else if (f.geometry?.type === 'Point') {
          stops.push({
            id: f.properties?.id || `stop-${stops.length}`,
            name: f.properties?.name || f.properties?.stop_name || `Stop #${stops.length + 1}`,
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0]
          });
        }
      });
    } else {
      const rawStops = data.stops || data.allRouteStops || data.routeStops || [];
      stops = rawStops.map((st, i) => ({
        id: st.id || `stop-${i}`,
        name: st.name || st.stop_name || st.label || `Stop #${i + 1}`,
        lat: parseFloat(st.lat || st.latitude || (st.coordinates && st.coordinates[1])),
        lng: parseFloat(st.lng || st.longitude || (st.coordinates && st.coordinates[0]))
      })).filter(s => !isNaN(s.lat) && !isNaN(s.lng));

      const rawPath = data.pathPoints || data.allPathPoints || data.geometry || data.coordinates || [];
      pathPoints = rawPath.map(p => {
        if (Array.isArray(p)) {
          return p[0] > 100 ? [p[1], p[0]] : [p[0], p[1]];
        }
        return [parseFloat(p.lat || p.latitude), parseFloat(p.lng || p.longitude)];
      });
    }

    return {
      id: routeMeta.id || data.id,
      code: routeMeta.code || data.code || routeMeta.id || data.id,
      name: data.name || routeMeta.name || `Route ${routeMeta.code || routeMeta.id}`,
      color: routeMeta.color || data.color || '#2563eb',
      isActiveNow: data.isActiveNow !== undefined ? data.isActiveNow : (routeMeta.isActiveNow !== undefined ? routeMeta.isActiveNow : true),
      startTime: data.startTime || (direction === 'PM' ? '16:00' : '06:00'),
      endTime: data.endTime || (direction === 'PM' ? '21:00' : '10:00'),
      totalDuration: data.totalDuration || routeMeta.totalDuration || 35,
      nextDepartureStr: data.nextDepartureStr || routeMeta.nextDepartureStr || '10-15 mins',
      direction,
      stops,
      pathPoints
    };
  };

  const handleSelectDirectoryRoute = async (route, direction = 'AM') => {
    const rId = route.id || route.code;
    setSelectedRouteId(rId);
    setSelectedDirection(direction);
    setSelectedStop(null);
    setRouteLoading(true);

    try {
      const res = await axios.get(`http://localhost:5001/api/routes/${rId}`, {
        params: { direction }
      });

      if (res.data) {
        setSelectedRouteDetails(parseBackendRouteData(res.data, route, direction));
      }
    } catch (err) {
      console.error(`Failed to fetch route details for ${rId}:`, err);
      setSelectedRouteDetails(parseBackendRouteData(route, route, direction));
    } finally {
      setRouteLoading(false);
    }
  };

  const filteredRoutes = routesList.filter(r =>
    (r.id && r.id.toLowerCase().includes(routesFilter.toLowerCase())) ||
    (r.code && r.code.toLowerCase().includes(routesFilter.toLowerCase())) ||
    (r.name && r.name.toLowerCase().includes(routesFilter.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }
        .leaflet-container { width: 100%; height: 100%; background: #f8fafc !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>

      {/* SIDEBAR PANEL */}
      <div style={{
        width: '390px',
        flexShrink: 0,
        background: '#ffffff',
        color: '#0f172a',
        padding: '20px 18px',
        overflowY: 'auto',
        borderRight: '1px solid #e2e8f0',
        boxShadow: '4px 0 20px rgba(15, 23, 42, 0.05)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px', background: '#2563eb', color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <BusIcon size={20} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              CSA Transit Network
            </h1>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Trip planning & route directory</p>
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', gap: '4px', width: '100%' }}>
          <button
            onClick={() => { setActiveTab('planner'); setSelectedRouteDetails(null); setSelectedStop(null); }}
            style={{
              flex: 1,
              padding: '8px 10px',
              border: 'none',
              borderRadius: '7px',
              fontWeight: '600',
              fontSize: '0.82rem',
              cursor: 'pointer',
              background: activeTab === 'planner' ? '#ffffff' : 'transparent',
              color: activeTab === 'planner' ? '#2563eb' : '#64748b',
              boxShadow: activeTab === 'planner' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <NavigationIcon size={14} color={activeTab === 'planner' ? '#2563eb' : '#64748b'} />
            Trip Planner
          </button>
          <button
            onClick={() => setActiveTab('routes')}
            style={{
              flex: 1,
              padding: '8px 10px',
              border: 'none',
              borderRadius: '7px',
              fontWeight: '600',
              fontSize: '0.82rem',
              cursor: 'pointer',
              background: activeTab === 'routes' ? '#ffffff' : 'transparent',
              color: activeTab === 'routes' ? '#2563eb' : '#64748b',
              boxShadow: activeTab === 'routes' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <BusIcon size={14} color={activeTab === 'routes' ? '#2563eb' : '#64748b'} />
            Bus Routes
          </button>
        </div>

        {/* TAB 1: TRIP PLANNER */}
        {activeTab === 'planner' && (
          <>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0', position: 'relative', width: '100%' }}>
              <div style={{ position: 'absolute', left: '28px', top: '32px', bottom: '32px', width: '2px', background: '#cbd5e1', zIndex: 1 }} />

              {/* ORIGIN SELECTOR */}
              <div style={{ marginBottom: '14px', position: 'relative', zIndex: activeInput === 'start' ? 100 : 2 }}>
                <div
                  onClick={() => {
                    setActiveInput(activeInput === 'start' ? null : 'start');
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  style={{
                    padding: '10px 14px 10px 38px',
                    background: '#ffffff',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    border: activeInput === 'start' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                    width: '10px', height: '10px', borderRadius: '50%', background: '#2563eb', border: '2px solid #ffffff', boxShadow: '0 0 0 2px #2563eb'
                  }} />
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', width: 'calc(100% - 20px)' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {origin.label}
                    </span>
                    <span style={{ fontSize: '0.73rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                      {origin.address || 'Select origin'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', flexShrink: 0 }}>▼</span>
                </div>

                {/* SEARCH DROPDOWN OVERLAY */}
                {activeInput === 'start' && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '6px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '8px',
                    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
                    zIndex: 200
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '8px' }}>
                      <SearchIcon size={15} color="#64748b" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search address, establishment, or area..."
                        value={searchQuery}
                        onChange={(e) => handleSearchInputChange(e.target.value)}
                        style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '0.82rem', color: '#0f172a' }}
                      />
                    </div>

                    <div style={{ maxHeight: '230px', overflowY: 'auto' }}>
                      {searchResults.map((place, idx) => {
                        const rawParts = place.display_name ? place.display_name.split(',') : [];
                        const title = rawParts[0]?.trim() || 'Place';
                        const fullAddress = rawParts.length > 1 ? rawParts.slice(1).join(',').trim() : place.display_name;

                        return (
                          <div
                            key={idx}
                            onClick={() => handleSelectEstablishment(place, 'start')}
                            style={{
                              padding: '9px 10px',
                              borderRadius: '7px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              marginBottom: '2px',
                              transition: 'background 0.12s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ marginTop: '2px', flexShrink: 0 }}>
                              <MapPinIcon size={15} color="#2563eb" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {title}
                              </span>
                              <span style={{ fontSize: '0.73rem', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '1px' }}>
                                {fullAddress}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      <div
                        onClick={handleUseCurrentLocation}
                        style={{
                          padding: '9px 10px',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          color: '#2563eb',
                          fontWeight: '600',
                          fontSize: '0.8rem',
                          background: '#eff6ff',
                          marginTop: '4px'
                        }}
                      >
                        <CrosshairIcon size={15} color="#2563eb" />
                        Use current location (GPS)
                      </div>

                      <div
                        onClick={() => { setMapPickMode('start'); setActiveInput(null); }}
                        style={{
                          padding: '9px 10px',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          color: '#475569',
                          fontWeight: '500',
                          fontSize: '0.8rem',
                          marginTop: '2px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <NavigationIcon size={15} color="#475569" />
                        Select location on map
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* DESTINATION SELECTOR */}
              <div style={{ position: 'relative', zIndex: activeInput === 'dest' ? 100 : 2 }}>
                <div
                  onClick={() => {
                    setActiveInput(activeInput === 'dest' ? null : 'dest');
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  style={{
                    padding: '10px 14px 10px 38px',
                    background: '#ffffff',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    border: activeInput === 'dest' ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                    width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', border: '2px solid #ffffff', boxShadow: '0 0 0 2px #ef4444'
                  }} />
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', width: 'calc(100% - 20px)' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {destination.label}
                    </span>
                    <span style={{ fontSize: '0.73rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                      {destination.address || 'Select destination'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', flexShrink: 0 }}>▼</span>
                </div>

                {/* SEARCH DROPDOWN OVERLAY */}
                {activeInput === 'dest' && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '6px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '8px',
                    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
                    zIndex: 200
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '8px' }}>
                      <SearchIcon size={15} color="#64748b" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search address, establishment, or area..."
                        value={searchQuery}
                        onChange={(e) => handleSearchInputChange(e.target.value)}
                        style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '0.82rem', color: '#0f172a' }}
                      />
                    </div>

                    <div style={{ maxHeight: '230px', overflowY: 'auto' }}>
                      {searchResults.map((place, idx) => {
                        const rawParts = place.display_name ? place.display_name.split(',') : [];
                        const title = rawParts[0]?.trim() || 'Place';
                        const fullAddress = rawParts.length > 1 ? rawParts.slice(1).join(',').trim() : place.display_name;

                        return (
                          <div
                            key={idx}
                            onClick={() => handleSelectEstablishment(place, 'dest')}
                            style={{
                              padding: '9px 10px',
                              borderRadius: '7px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              marginBottom: '2px',
                              transition: 'background 0.12s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ marginTop: '2px', flexShrink: 0 }}>
                              <MapPinIcon size={15} color="#ef4444" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {title}
                              </span>
                              <span style={{ fontSize: '0.73rem', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '1px' }}>
                                {fullAddress}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      <div
                        onClick={() => { setMapPickMode('dest'); setActiveInput(null); }}
                        style={{
                          padding: '9px 10px',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          color: '#475569',
                          fontWeight: '500',
                          fontSize: '0.8rem',
                          marginTop: '2px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <NavigationIcon size={15} color="#475569" />
                        Select location on map
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSearchRoutes}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? '#94a3b8' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '600',
                fontSize: '0.88rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                transition: 'background 0.15s ease'
              }}
            >
              {loading ? 'Searching Available Routes...' : 'Search Routes'}
            </button>

            {/* SEARCH RESULTS */}
            {journeyOptions.length > 0 && (
              <div>
                <h2 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Recommended Options
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {journeyOptions.map((opt, idx) => {
                    const isSelected = selectedOptionIdx === idx;
                    const routeColor = opt.primaryColor || '#2563eb';

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedOptionIdx(idx)}
                        style={{
                          padding: '14px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          background: isSelected ? '#f0f9ff' : '#ffffff',
                          border: isSelected ? `2px solid ${routeColor}` : '1px solid #e2e8f0',
                          boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ background: routeColor, color: '#ffffff', padding: '3px 9px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700' }}>
                            Bus {opt.primaryRouteNumber || opt.code || 'Route'}
                          </span>

                          {opt.isActiveNow ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '600', border: '1px solid #bbf7d0' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                              Active
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f8fafc', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '600', border: '1px solid #e2e8f0' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
                              Scheduled
                            </span>
                          )}
                        </div>

                        <div style={{ fontWeight: '600', color: '#0f172a', marginTop: '8px', fontSize: '0.9rem' }}>
                          {opt.primaryRouteName || opt.name}
                        </div>

                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '10px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ClockIcon size={13} color="#64748b" />
                            {opt.totalDuration || 35} mins
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <BusIcon size={13} color="#64748b" />
                            {opt.nextDepartureStr || '10-15 mins'}
                          </span>
                          <span>
                            {opt.allRouteStops ? opt.allRouteStops.length : 0} stops
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: ALL BUS ROUTES DIRECTORY */}
        {activeTab === 'routes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
            
            <input
              type="text"
              placeholder="Filter routes by code or name..."
              value={routesFilter}
              onChange={(e) => setRoutesFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                fontSize: '0.84rem',
                color: '#0f172a',
                outline: 'none'
              }}
            />

            {routesFetchError && (
              <div style={{ padding: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.78rem' }}>
                Failed to connect to backend service (`http://localhost:5001/api/routes`).
              </div>
            )}

            {routesList.length === 0 && !routesFetchError && (
              <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                Loading available routes...
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredRoutes.map((route, idx) => {
                const rId = route.id || route.code;
                const isSelected = selectedRouteId === rId;
                const activeDirection = isSelected ? selectedDirection : 'AM';
                const isAM = activeDirection === 'AM';
                const routeColor = route.color || '#2563eb';
                const isActive = route.isActiveNow !== undefined ? route.isActiveNow : true;

                const startTimeVal = isSelected && selectedRouteDetails?.startTime
                  ? selectedRouteDetails.startTime
                  : (isAM ? (route.startTimeAM || route.startTime || '06:00') : (route.startTimePM || '16:00'));

                const endTimeVal = isSelected && selectedRouteDetails?.endTime
                  ? selectedRouteDetails.endTime
                  : (isAM ? (route.endTimeAM || route.endTime || '10:00') : (route.endTimePM || '21:00'));

                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectDirectoryRoute(route, activeDirection)}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: isSelected ? '#f0f9ff' : '#ffffff',
                      border: isSelected ? `2px solid ${routeColor}` : '1px solid #e2e8f0',
                      boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        background: routeColor,
                        color: '#ffffff',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: '700'
                      }}>
                        Bus {route.code || route.id}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px', gap: '2px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelectDirectoryRoute(route, 'AM'); }}
                            style={{
                              border: 'none',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              background: activeDirection === 'AM' ? routeColor : 'transparent',
                              color: activeDirection === 'AM' ? '#ffffff' : '#64748b'
                            }}
                          >
                            AM
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelectDirectoryRoute(route, 'PM'); }}
                            style={{
                              border: 'none',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              background: activeDirection === 'PM' ? routeColor : 'transparent',
                              color: activeDirection === 'PM' ? '#ffffff' : '#64748b'
                            }}
                          >
                            PM
                          </button>
                        </div>

                        {isActive ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '600', border: '1px solid #bbf7d0' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                            Active
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f8fafc', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '600', border: '1px solid #e2e8f0' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
                            Scheduled
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ fontWeight: '600', color: '#0f172a', marginTop: '10px', fontSize: '0.9rem' }}>
                      {route.name || `Route ${route.code || route.id}`}
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '10px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ClockIcon size={13} color="#64748b" />
                        {formatTo12Hour(startTimeVal)} – {formatTo12Hour(endTimeVal)}
                      </span>
                      <span>
                        {(isSelected && selectedRouteDetails?.totalDuration) || route.totalDuration || 35} mins
                      </span>
                      <span>
                        {
                          (isSelected && selectedRouteDetails?.stops)
                            ? selectedRouteDetails.stops.length
                            : (route.stopsCount || route.stops?.length || 0)
                        } stops
                      </span>
                    </div>

                    {isSelected && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Route Stops ({activeDirection})
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            Click stop to focus map
                          </span>
                        </div>

                        {routeLoading ? (
                          <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Loading route stops...</p>
                        ) : selectedRouteDetails?.stops && selectedRouteDetails.stops.length > 0 ? (
                          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {selectedRouteDetails.stops.map((st, i) => {
                              const isStopActive = selectedStop && (selectedStop.id === st.id || (selectedStop.lat === st.lat && selectedStop.lng === st.lng));

                              return (
                                <div
                                  key={i}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStop(st);
                                  }}
                                  style={{
                                    fontSize: '0.76rem',
                                    color: isStopActive ? '#1e3a8a' : '#334155',
                                    background: isStopActive ? '#eff6ff' : '#ffffff',
                                    padding: '7px 10px',
                                    borderRadius: '6px',
                                    border: isStopActive ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justify: 'space-between',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                    <span style={{
                                      background: isStopActive ? '#2563eb' : '#f1f5f9',
                                      color: isStopActive ? '#ffffff' : '#475569',
                                      fontWeight: '700',
                                      fontSize: '0.68rem',
                                      padding: '2px 6px',
                                      borderRadius: '4px'
                                    }}>
                                      #{i + 1}
                                    </span>
                                    <span style={{ fontWeight: isStopActive ? '700' : '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {st.name}
                                    </span>
                                  </div>
                                  <MapPinIcon size={14} color={isStopActive ? '#2563eb' : '#cbd5e1'} />
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p style={{ fontSize: '0.76rem', color: '#94a3b8' }}>No stop details available for this route.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}

      </div>

      {/* MAP DISPLAY */}
      <div style={{ flex: 1, height: '100vh', cursor: mapPickMode ? 'crosshair' : 'grab' }}>
        <MapContainer center={[origin.lat, origin.lng]} zoom={14} style={{ width: '100%', height: '100%' }}>
          <TileLayer
  attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
  url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
  subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
  maxZoom={20}
/>

          <MapController
            origin={origin}
            destination={destination}
            activeOption={activeOption}
            selectedRouteDetails={selectedRouteDetails}
            activeTab={activeTab}
            selectedStop={selectedStop}
          />
          <MapClickHandler mapPickMode={mapPickMode} onMapClick={handleMapClick} />

          {/* TRIP PLANNER MAP LAYERS */}
          {activeTab === 'planner' && (
            <>
              {origin && (
                <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
                  <Popup>
                    <div style={{ padding: '2px 0' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{origin.label}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{origin.address}</div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {destination && (
                <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
                  <Popup>
                    <div style={{ padding: '2px 0' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{destination.label}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{destination.address}</div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {activeOption && (() => {
                const pathCoords = activeOption.allPathPoints?.length > 0
                  ? activeOption.allPathPoints.map(p => [p.lat, p.lng])
                  : activeOption.allRouteStops ? activeOption.allRouteStops.map(s => [s.lat, s.lng]) : [];

                return pathCoords.length > 0 ? (
                  <Polyline
                    positions={pathCoords}
                    pathOptions={{ color: activeOption.primaryColor || '#2563eb', weight: 5, opacity: 0.85 }}
                  />
                ) : null;
              })()}

              {activeOption?.allRouteStops?.map((stop, idx) => {
                const isBoarding = stop.id === activeOption.boardStopId;
                const isAlighting = stop.id === activeOption.alightStopId;

                if (isBoarding) {
                  return (
                    <Marker key={`board-${stop.id}-${idx}`} position={[stop.lat, stop.lng]} icon={boardStopIcon}>
                      <Popup>
                        <div style={{ padding: '2px 0' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Boarding Stop</span>
                          <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a', marginTop: '2px' }}>{stop.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Bus Route {activeOption.primaryRouteNumber}</div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                }

                if (isAlighting) {
                  return (
                    <Marker key={`alight-${stop.id}-${idx}`} position={[stop.lat, stop.lng]} icon={alightStopIcon}>
                      <Popup>
                        <div style={{ padding: '2px 0' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Alighting Stop</span>
                          <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a', marginTop: '2px' }}>{stop.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Bus Route {activeOption.primaryRouteNumber}</div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                }

                return (
                  <Marker
                    key={`stop-marker-${stop.id}-${idx}`}
                    position={[stop.lat, stop.lng]}
                    icon={createCircleStopIcon(activeOption.primaryColor || '#2563eb')}
                  >
                    <Popup>
                      <div style={{ padding: '2px 0' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#64748b' }}>Stop #{idx + 1}</span>
                        <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#0f172a', marginTop: '2px' }}>{stop.name}</div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {activeOption && (
                <>
                  {walkToBoardPath.length > 0 && (
                    <Polyline
                      positions={walkToBoardPath}
                      pathOptions={{ color: '#2563eb', weight: 4, dashArray: '6, 8', opacity: 0.8 }}
                    />
                  )}

                  {walkToDestPath.length > 0 && (
                    <Polyline
                      positions={walkToDestPath}
                      pathOptions={{ color: '#ef4444', weight: 4, dashArray: '6, 8', opacity: 0.8 }}
                    />
                  )}
                </>
              )}
            </>
          )}

          {/* ALL BUS ROUTES MAP LAYERS */}
          {activeTab === 'routes' && selectedRouteDetails && (
            <>
              {selectedRouteDetails.pathPoints?.length > 0 && (
                <Polyline
                  positions={selectedRouteDetails.pathPoints.map(p => Array.isArray(p) ? p : [p.lat, p.lng])}
                  pathOptions={{ color: selectedRouteDetails.color || '#2563eb', weight: 6, opacity: 0.9 }}
                />
              )}

              {selectedRouteDetails.stops?.map((stop, idx) => {
                const isSelectedStop = selectedStop && (
                  selectedStop.id === stop.id || (selectedStop.lat === stop.lat && selectedStop.lng === stop.lng)
                );

                return (
                  <Marker
                    key={`explorer-stop-${stop.id || idx}`}
                    position={[stop.lat, stop.lng]}
                    icon={isSelectedStop ? createHighlightedStopIcon('#ef4444') : createCircleStopIcon(selectedRouteDetails.color || '#2563eb')}
                    eventHandlers={{
                      click: () => setSelectedStop(stop)
                    }}
                  >
                    <Popup autoPan={false}>
                      <div style={{ padding: '2px 0' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Stop #{idx + 1}
                        </span>
                        <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a', marginTop: '2px' }}>
                          {stop.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          Route {selectedRouteDetails.code || selectedRouteDetails.id} ({selectedDirection})
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </>
          )}

        </MapContainer>
      </div>

    </div>
  );
}