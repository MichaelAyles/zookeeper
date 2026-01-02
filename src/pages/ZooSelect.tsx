import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '../stores/useStore';
import { getZoos } from '../services/zoos';
import { startVisit } from '../services/visits';
import { colors } from '../lib/colors';
import type { Zoo } from '../types';

// Fix Leaflet default marker icon issue
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-expect-error - Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom zoo marker icon
const zooIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <circle cx="12" cy="12" r="10" fill="${colors.forest}" stroke="white" stroke-width="2"/>
      <text x="12" y="16" text-anchor="middle" font-size="12" fill="white">🦁</text>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// User location marker
const userIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <circle cx="12" cy="12" r="8" fill="${colors.terracotta}" stroke="white" stroke-width="3"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface UserLocation {
  latitude: number;
  longitude: number;
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Format distance for display
function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  } else if (km < 10) {
    return `${km.toFixed(1)}km`;
  } else {
    return `${Math.round(km)}km`;
  }
}

// Component to handle map view - zoom to user location or fit all zoos
function MapController({ zoos, userLocation }: { zoos: Zoo[]; userLocation: UserLocation | null }) {
  const map = useMap();

  useEffect(() => {
    if (userLocation) {
      // Zoom to user location with ~15 mile radius (zoom 10 ≈ 20mi radius at UK latitude)
      map.setView([userLocation.latitude, userLocation.longitude], 10);
    } else {
      // No user location - fit all zoos in view
      const validZoos = zoos.filter(z => z.latitude && z.longitude);
      if (validZoos.length === 0) return;

      const bounds = L.latLngBounds(
        validZoos.map(z => [z.latitude!, z.longitude!] as [number, number])
      );
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
    }
  }, [map, zoos, userLocation]);

  return null;
}

export default function ZooSelect() {
  const navigate = useNavigate();
  const setActiveVisit = useStore((state) => state.setActiveVisit);
  const listRef = useRef<HTMLDivElement>(null);

  const [zoos, setZoos] = useState<Zoo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedZoo, setSelectedZoo] = useState<Zoo | null>(null);

  useEffect(() => {
    loadZoos();
    requestLocation();
  }, []);

  async function loadZoos() {
    setLoading(true);
    const allZoos = await getZoos();
    setZoos(allZoos);
    setLoading(false);
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        // Location denied or unavailable - will sort alphabetically
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSelectZoo(zoo: Zoo) {
    const visit = await startVisit(zoo.id);
    setActiveVisit(visit, zoo);
    navigate(`/visit/${visit.id}`);
  }

  // Sort zoos by distance if we have user location, otherwise alphabetically
  const sortedZoos = [...zoos].sort((a, b) => {
    if (userLocation && a.latitude && a.longitude && b.latitude && b.longitude) {
      const distA = calculateDistance(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude);
      const distB = calculateDistance(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude);
      return distA - distB;
    }
    return a.name.localeCompare(b.name);
  });

  // Get distance for a zoo
  function getZooDistance(zoo: Zoo): number | null {
    if (!userLocation || !zoo.latitude || !zoo.longitude) return null;
    return calculateDistance(userLocation.latitude, userLocation.longitude, zoo.latitude, zoo.longitude);
  }

  // Scroll to zoo in list when marker clicked
  function handleMarkerClick(zoo: Zoo) {
    setSelectedZoo(zoo);
    // Find the zoo item in the list and scroll to it
    const element = document.getElementById(`zoo-${zoo.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Default center (UK)
  const defaultCenter: [number, number] = [54.5, -2];
  const mapCenter: [number, number] = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : defaultCenter;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: colors.cream,
    }}>
      {/* Header - Fixed */}
      <div style={{
        padding: '24px 20px 16px',
        background: colors.cream,
        borderBottom: `1px solid ${colors.sand}`,
        flexShrink: 0,
      }}>
        <div style={{ height: '24px' }} /> {/* Status bar spacer */}
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 0',
            background: 'transparent',
            border: 'none',
            color: colors.forest,
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            marginBottom: '8px',
          }}
        >
          ← Back
        </button>
        <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '700', color: colors.text }}>
          Find a Zoo
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: colors.textMuted }}>
          {userLocation ? 'Sorted by distance from you' : 'Sorted alphabetically'}
        </p>
      </div>

      {loading ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.textMuted,
        }}>
          Loading zoos...
        </div>
      ) : (
        <>
          {/* Map - Top Half */}
          <div style={{
            height: '40vh',
            minHeight: '250px',
            position: 'relative',
            borderBottom: `3px solid ${colors.forest}`,
          }}>
            <MapContainer
              center={mapCenter}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapController zoos={sortedZoos} userLocation={userLocation} />

              {/* User location marker */}
              {userLocation && (
                <Marker
                  position={[userLocation.latitude, userLocation.longitude]}
                  icon={userIcon}
                >
                  <Popup>You are here</Popup>
                </Marker>
              )}

              {/* Zoo markers */}
              {sortedZoos
                .filter(zoo => zoo.latitude && zoo.longitude)
                .map((zoo) => (
                  <Marker
                    key={zoo.id}
                    position={[zoo.latitude!, zoo.longitude!]}
                    icon={zooIcon}
                    eventHandlers={{
                      click: () => handleMarkerClick(zoo),
                    }}
                  >
                    <Popup>
                      <div style={{ textAlign: 'center', minWidth: '120px' }}>
                        <strong>{zoo.name}</strong>
                        <br />
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          {zoo.city}
                        </span>
                        {userLocation && zoo.latitude && zoo.longitude && (
                          <>
                            <br />
                            <span style={{ fontSize: '11px', color: colors.forest }}>
                              {formatDistance(getZooDistance(zoo)!)}
                            </span>
                          </>
                        )}
                        <br />
                        <button
                          onClick={() => handleSelectZoo(zoo)}
                          style={{
                            marginTop: '8px',
                            padding: '6px 12px',
                            background: colors.forest,
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Start Visit
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>

            {/* Zoo count badge */}
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'white',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '600',
              color: colors.forest,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 1000,
            }}>
              {sortedZoos.length} zoos
            </div>
          </div>

          {/* Zoo List - Bottom Half */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px 20px',
            }}
          >
            {sortedZoos.length === 0 ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🔍</span>
                <p style={{ margin: 0, color: colors.textMuted }}>
                  No zoos found.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sortedZoos.map((zoo) => {
                  const distance = getZooDistance(zoo);
                  const isSelected = selectedZoo?.id === zoo.id;

                  return (
                    <button
                      id={`zoo-${zoo.id}`}
                      key={zoo.id}
                      onClick={() => handleSelectZoo(zoo)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '14px 16px',
                        background: isSelected ? `${colors.forest}10` : '#fff',
                        borderRadius: '14px',
                        border: isSelected ? `2px solid ${colors.forest}` : '2px solid transparent',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{
                        width: '44px',
                        height: '44px',
                        background: `linear-gradient(135deg, ${colors.gold}30 0%, ${colors.forest}20 100%)`,
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '22px',
                        flexShrink: 0,
                      }}>
                        🦁
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0,
                          fontSize: '15px',
                          fontWeight: '600',
                          color: colors.text,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>{zoo.name}</p>
                        <p style={{
                          margin: '2px 0 0',
                          fontSize: '12px',
                          color: colors.textMuted,
                        }}>
                          {zoo.city}
                        </p>
                      </div>
                      {distance !== null && (
                        <div style={{
                          padding: '4px 10px',
                          background: colors.warmGray,
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: colors.forest,
                          flexShrink: 0,
                        }}>
                          {formatDistance(distance)}
                        </div>
                      )}
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: colors.forest,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '14px',
                        flexShrink: 0,
                      }}>
                        →
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
