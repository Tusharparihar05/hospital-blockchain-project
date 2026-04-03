// frontend/src/components/ClinicLocationSetter.jsx
// Drop this file at: frontend/src/components/ClinicLocationSetter.jsx

import { useState, useEffect } from "react";

const API_BASE = (() => {
  const base = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
  return base.replace(/\/api$/, "");
})();

// Free Nominatim geocoder (OpenStreetMap) — no API key needed
async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=in`;
  const res  = await fetch(url, { headers: { "Accept-Language": "en" } });
  const data = await res.json();
  if (!data.length) throw new Error(`Location not found: "${address}"`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// Reverse geocode lat/lng → human address
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res  = await fetch(url, { headers: { "Accept-Language": "en" } });
  const data = await res.json();
  return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

const C = {
  bg:       "#060b16",
  surface:  "#0c1424",
  border:   "#172035",
  teal:     "#00c8a0",
  muted:    "#4d6080",
  mutedHi:  "#7a92b8",
  text:     "#dde6f5",
  green:    "#10b981",
  red:      "#f43f5e",
  amber:    "#f59e0b",
};

export default function ClinicLocationSetter({ doctorId, token, currentLocation, onSaved }) {
  const [addressInput, setAddressInput] = useState("");
  const [coords,       setCoords]       = useState(currentLocation?.lat ? currentLocation : null);
  const [status,       setStatus]       = useState(""); // "", "geocoding", "gps", "saving", "saved", "error"
  const [message,      setMessage]      = useState("");

  useEffect(() => {
    if (currentLocation?.lat) {
      setCoords(currentLocation);
      setAddressInput(currentLocation.address || "");
    }
  }, [currentLocation?.lat]);

  const msg = (text, st) => { setMessage(text); setStatus(st); };

  // --- Search by text ---
  const handleSearch = async () => {
    if (!addressInput.trim()) return;
    msg("Searching…", "geocoding");
    try {
      const { lat, lng } = await geocodeAddress(addressInput.trim());
      const address = await reverseGeocode(lat, lng);
      setCoords({ lat, lng, address });
      setAddressInput(address);
      msg(`📍 Found: ${address.slice(0, 60)}`, "found");
    } catch (e) {
      msg(e.message, "error");
    }
  };

  // --- GPS detect ---
  const handleGPS = () => {
    if (!navigator.geolocation) return msg("GPS not supported by your browser.", "error");
    msg("Detecting your location…", "gps");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const address = await reverseGeocode(lat, lng);
          setCoords({ lat, lng, address });
          setAddressInput(address);
          msg(`📍 GPS found: ${address.slice(0, 60)}`, "found");
        } catch {
          setCoords({ lat, lng, address: "" });
          msg(`📍 GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, "found");
        }
      },
      (err) => msg(`GPS denied (${err.message}). Enter address manually.`, "error")
    );
  };

  // --- Save to backend ---
  const handleSave = async () => {
    if (!coords?.lat || !coords?.lng) return msg("Please set a location first.", "error");
    if (!doctorId || doctorId === "USR-LOCAL") return msg("Not logged in — cannot save.", "error");
    msg("Saving…", "saving");
    try {
      const res = await fetch(`${API_BASE}/api/doctors/${doctorId}/location`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ lat: coords.lat, lng: coords.lng, address: coords.address || addressInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved?.(data.location);
      msg("✅ Clinic location saved! You now appear on the patient map.", "saved");
    } catch (e) {
      msg(e.message, "error");
    }
  };

  const isBusy = status === "geocoding" || status === "gps" || status === "saving";

  const inputStyle = {
    flex: 1,
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    background: C.bg,
    border: `1px solid ${C.teal}50`,
    color: C.text,
    outline: "none",
    fontFamily: "inherit",
  };

  const btnBase = {
    padding: "10px 16px",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 600,
    cursor: isBusy ? "wait" : "pointer",
    border: "none",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };

  const statusColor = {
    error:  C.red,
    saved:  C.green,
    found:  C.teal,
    geocoding: C.amber,
    gps:    C.amber,
    saving: C.amber,
  }[status] || C.mutedHi;

  return (
    <div style={{
      background: `${C.teal}07`,
      border: `1px solid ${C.teal}30`,
      borderRadius: 14,
      padding: "18px 20px",
      marginBottom: 20,
    }}>
      <h4 style={{ color: C.teal, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
        📍 Set Clinic Location
      </h4>
      <p style={{ color: C.muted, fontSize: 12, marginBottom: 14 }}>
        Your clinic will appear on the <strong style={{ color: C.mutedHi }}>Nearby Doctors</strong> map for patients.
        Enter your clinic address or use GPS.
      </p>

      {/* Current saved location badge */}
      {currentLocation?.lat && (
        <div style={{
          background: `${C.green}10`,
          border: `1px solid ${C.green}40`,
          borderRadius: 8,
          padding: "7px 12px",
          fontSize: 12,
          color: C.green,
          marginBottom: 12,
        }}>
          ✅ Currently saved: {currentLocation.address || `${currentLocation.lat?.toFixed(4)}, ${currentLocation.lng?.toFixed(4)}`}
        </div>
      )}

      {/* Search row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder='e.g. "Medanta Hospital, Sector 38, Gurugram"'
          value={addressInput}
          onChange={e => setAddressInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          disabled={isBusy}
          style={inputStyle}
        />
        <button
          onClick={handleSearch}
          disabled={isBusy || !addressInput.trim()}
          style={{ ...btnBase, background: `linear-gradient(135deg,${C.teal},#00a07f)`, color: "#fff" }}
        >
          🔍 Search
        </button>
        <button
          onClick={handleGPS}
          disabled={isBusy}
          style={{ ...btnBase, background: C.surface, border: `1px solid ${C.border}`, color: C.mutedHi }}
          title="Detect my GPS location"
        >
          🛰️ GPS
        </button>
      </div>

      {/* Coordinates preview */}
      {coords?.lat && (
        <div style={{
          fontSize: 12,
          color: C.mutedHi,
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: "6px 12px",
          marginBottom: 10,
          fontFamily: "monospace",
        }}>
          lat: {coords.lat.toFixed(6)} &nbsp;|&nbsp; lng: {coords.lng.toFixed(6)}
        </div>
      )}

      {/* Status message */}
      {message && (
        <div style={{ fontSize: 12, color: statusColor, marginBottom: 10, fontWeight: 500 }}>
          {message}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isBusy || !coords?.lat}
        style={{
          ...btnBase,
          background: coords?.lat
            ? `linear-gradient(135deg,${C.teal},${C.green})`
            : C.border,
          color: coords?.lat ? "#fff" : C.muted,
          opacity: isBusy ? 0.7 : 1,
        }}
      >
        {status === "saving" ? "Saving…" : "💾 Save Clinic Location"}
      </button>
    </div>
  );
  
}