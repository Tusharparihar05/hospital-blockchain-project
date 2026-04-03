// frontend/src/components/NearbyDoctorsMap.jsx
// Shows a Leaflet map with the patient's location (green marker) and
// nearby doctors (blue markers). No Google Maps API key needed.
//
// INSTALL FIRST (in /frontend):
//   npm install leaflet react-leaflet
//
// ADD TO YOUR main.jsx or App.jsx (top of file):
//   import "leaflet/dist/leaflet.css";

import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Fix for broken default marker icons in Webpack/Vite builds
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon   from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl:       markerIcon,
  shadowUrl:     markerShadow,
});

// Custom coloured circle icons
function makeCircleIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;
      background:${color};
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize:   [18, 18],
    iconAnchor: [9, 9],
  });
}

const patientIcon = makeCircleIcon("#22c55e");  // green — you
const doctorIcon  = makeCircleIcon("#3b82f6");  // blue  — doctor

// Re-centres map when user location changes
function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 13);
  }, [lat, lng, map]);
  return null;
}

// ── Geocode a text address using Nominatim (free, no API key) ─────────────────
async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  const res  = await fetch(url, { headers: { "Accept-Language": "en" } });
  const data = await res.json();
  if (!data.length) throw new Error(`Location not found: "${address}"`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
}

// ── Haversine distance in km ──────────────────────────────────────────────────
function distanceKm(lat1, lng1, lat2, lng2) {
  const R   = 6371;
  const dLa = ((lat2 - lat1) * Math.PI) / 180;
  const dLo = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLa / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLo / 2) ** 2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

// ── Main component ────────────────────────────────────────────────────────────
// Props:
//   doctors       – array of doctor objects from /api/doctors
//   onBookDoctor  – callback(doctor) when patient clicks Book
//   radiusKm      – filter doctors beyond this radius (default 20)

export default function NearbyDoctorsMap({ doctors = [], onBookDoctor, radiusKm = 20 }) {
  const [userLat,    setUserLat]    = useState(null);
  const [userLng,    setUserLng]    = useState(null);
  const [addressTxt, setAddressTxt] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error,      setError]      = useState("");
  const [nearby,     setNearby]     = useState([]);

  // Filter + sort doctors by distance whenever userLat/Lng changes
  useEffect(() => {
    if (userLat === null || userLng === null) return;
    const withDist = doctors
      .filter(d => d.location?.lat && d.location?.lng)
      .map(d => ({
        ...d,
        distance: distanceKm(userLat, userLng, d.location.lat, d.location.lng),
      }))
      .filter(d => d.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
    setNearby(withDist);
  }, [userLat, userLng, doctors, radiusKm]);

  // GPS button
  const handleGPS = () => {
    setGpsLoading(true);
    setError("");
    if (!navigator.geolocation) {
      setError("GPS not supported by your browser.");
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setGpsLoading(false);
      },
      err => {
        setError("GPS denied. Please type your address below.");
        setGpsLoading(false);
      }
    );
  };

  // Text address search
  const handleAddressSearch = async () => {
    if (!addressTxt.trim()) return;
    setGeoLoading(true);
    setError("");
    try {
      const { lat, lng } = await geocodeAddress(addressTxt.trim());
      setUserLat(lat);
      setUserLng(lng);
    } catch (e) {
      setError(e.message);
    } finally {
      setGeoLoading(false);
    }
  };

  const mapCenter = userLat ? [userLat, userLng] : [20.5937, 78.9629]; // India centre fallback

  return (
    <div style={{ fontFamily: "sans-serif" }}>
      {/* ── Controls ── */}
      <div style={{
        display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center",
      }}>
        <button
          onClick={handleGPS}
          disabled={gpsLoading}
          style={{
            background: "#22c55e", color: "#fff", border: "none",
            borderRadius: 8, padding: "10px 18px", cursor: "pointer",
            fontWeight: 600, fontSize: 14,
          }}
        >
          {gpsLoading ? "Getting GPS…" : "📍 Use My Location"}
        </button>

        <span style={{ color: "#9ca3af", fontSize: 13 }}>or</span>

        <input
          type="text"
          placeholder='Type your city / area (e.g. "Malviya Nagar, Jaipur")'
          value={addressTxt}
          onChange={e => setAddressTxt(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAddressSearch()}
          style={{
            flex: 1, minWidth: 220,
            padding: "10px 14px",
            background: "#131827", border: "1px solid #2a3040",
            borderRadius: 8, color: "#e0e6f0", fontSize: 14,
          }}
        />

        <button
          onClick={handleAddressSearch}
          disabled={geoLoading}
          style={{
            background: "#4f46e5", color: "#fff", border: "none",
            borderRadius: 8, padding: "10px 18px", cursor: "pointer",
            fontWeight: 600, fontSize: 14,
          }}
        >
          {geoLoading ? "Searching…" : "🔍 Search"}
        </button>
      </div>

      {error && (
        <div style={{ color: "#f87171", fontSize: 13, marginBottom: 8 }}>⚠️ {error}</div>
      )}

      {/* ── Map ── */}
      {userLat ? (
        <>
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #1f2937", marginBottom: 16 }}>
            <MapContainer
              center={mapCenter}
              zoom={13}
              style={{ height: 380, width: "100%" }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <RecenterMap lat={userLat} lng={userLng} />

              {/* Patient marker */}
              <Marker position={[userLat, userLng]} icon={patientIcon}>
                <Popup>📍 You are here</Popup>
              </Marker>

              {/* Doctor markers */}
              {nearby.map(doc => (
                <Marker
                  key={doc.id || doc._id}
                  position={[doc.location.lat, doc.location.lng]}
                  icon={doctorIcon}
                >
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <strong>👨‍⚕️ {doc.name}</strong><br />
                      <span style={{ color: "#6b7280" }}>{doc.specialty}</span><br />
                      <span style={{ color: "#6b7280" }}>{doc.hospital}</span><br />
                      <span style={{ color: "#22c55e", fontWeight: 600 }}>{doc.distance} km away</span><br />
                      {onBookDoctor && (
                        <button
                          onClick={() => onBookDoctor(doc)}
                          style={{
                            marginTop: 8, background: "#4f46e5", color: "#fff",
                            border: "none", borderRadius: 6, padding: "6px 12px",
                            cursor: "pointer", fontWeight: 600, fontSize: 12,
                          }}
                        >
                          Book Appointment
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* ── Doctor list below map ── */}
          {nearby.length === 0 ? (
            <div style={{ textAlign: "center", color: "#6b7280", padding: "20px 0" }}>
              No doctors with saved clinic locations found within {radiusKm} km.<br />
              <small>Doctors need to save their clinic location in their dashboard first.</small>
            </div>
          ) : (
            <div>
              <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>
                {nearby.length} doctor{nearby.length > 1 ? "s" : ""} found within {radiusKm} km
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {nearby.map(doc => (
                  <div
                    key={doc.id || doc._id}
                    style={{
                      background: "#161b2e", border: "1px solid #1f2937",
                      borderRadius: 10, padding: "14px 16px",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      flexWrap: "wrap", gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ color: "#e0e6f0", fontWeight: 600 }}>
                        👨‍⚕️ {doc.name}
                        {doc.isOnline && (
                          <span style={{ marginLeft: 8, color: "#22c55e", fontSize: 11 }}>● Online</span>
                        )}
                      </div>
                      <div style={{ color: "#9ca3af", fontSize: 13 }}>
                        {doc.specialty} · {doc.hospital}
                      </div>
                      <div style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>
                        📍 {doc.distance} km · ⭐ {doc.rating || "4.0"} · ₹{doc.fee}
                      </div>
                      {doc.location.address && (
                        <div style={{ color: "#6b7280", fontSize: 12 }}>
                          {doc.location.address.slice(0, 60)}…
                        </div>
                      )}
                    </div>
                    {onBookDoctor && (
                      <button
                        onClick={() => onBookDoctor(doc)}
                        style={{
                          background: "#4f46e5", color: "#fff", border: "none",
                          borderRadius: 8, padding: "10px 18px",
                          cursor: "pointer", fontWeight: 600, fontSize: 13,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Book Now
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{
          background: "#161b2e", border: "1px solid #1f2937",
          borderRadius: 12, padding: "40px 20px",
          textAlign: "center", color: "#6b7280",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontWeight: 600, color: "#9ca3af", marginBottom: 4 }}>
            Find Doctors Near You
          </div>
          <div style={{ fontSize: 13 }}>
            Press "Use My Location" or type your city above to see doctors on the map.
          </div>
        </div>
      )}
    </div>
  );
}