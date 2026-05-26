// frontend/src/pages/PatientDashboard.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// ── Fix Leaflet default marker icons ─────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ── Try to import verifyRecord; fall back gracefully ─────────────────────────
let verifyRecord = async () => false;
try {
  const mod = await import("../hooks/useBlockchain");
  if (mod.verifyRecord) verifyRecord = mod.verifyRecord;
} catch (_) {}

const API_BASE = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace(/\/api$/, "")
  : "http://localhost:5000";
const API = `${API_BASE}/api`;

// ── Auth helpers ──────────────────────────────────────────────────────────────
function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch (_) { return {}; }
}
function getStoredPatientId()  { return getStoredUser().patientId || null; }
function getNotificationPatientKey() {
  const u = getStoredUser();
  return u.patientId || u.id || u._id || null;
}
function getChainPatientId()   {
  const u = getStoredUser();
  return u.chainPatientId != null ? Number(u.chainPatientId) : null;
}
function getSessionPatientProfile() {
  const u = getStoredUser();
  if (u.role === "patient" && u.name) return { name: String(u.name).trim(), patientId: u.patientId || null, fromSession: true };
  return { name: "Patient", patientId: null, fromSession: false };
}

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}




// ── Nominatim geocoding ───────────────────────────────────────────────────────
async function geocodeAddress(address) {
  const url  = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=in`;
  const res  = await fetch(url, { headers: { "Accept-Language": "en" } });
  const data = await res.json();
  if (!data.length) throw new Error(`Could not find location: "${address}"`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// ── Browser notifications + alert sound ───────────────────────────────────────
let _alertAudioCtx = null;
function playAlertBuzzer() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!_alertAudioCtx) _alertAudioCtx = new Ctx();
    const ctx = _alertAudioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const playTone = (freq, start, dur, gain = 0.35) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, start);
      g.gain.exponentialRampToValueAtTime(0.01, start + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    };
    const t = ctx.currentTime;
    playTone(880, t, 0.12);
    playTone(660, t + 0.14, 0.12);
    playTone(880, t + 0.28, 0.18, 0.4);
  } catch (_) {}
}
function sendNotification(title, body, tag) {
  playAlertBuzzer();
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, { body, icon: "/favicon.ico", tag, requireInteraction: true });
  n.onclick = () => { window.focus(); n.close(); };
}
async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const p = await Notification.requestPermission();
    return p === "granted";
  }
  return false;
}

// ── Custom map icons ──────────────────────────────────────────────────────────
const doctorIcon = new L.DivIcon({
  className: "",
  html: `<div style="background:#4f46e5;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">👨‍⚕️</div>`,
  iconSize: [32, 32], iconAnchor: [16, 16],
});
const patientIcon = new L.DivIcon({
  className: "",
  html: `<div style="background:#10b981;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">📍</div>`,
  iconSize: [32, 32], iconAnchor: [16, 16],
});

// ── Map re-center helper ──────────────────────────────────────────────────────
function MapCenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], 13); }, [lat, lng, map]);
  return null;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const COLORS = {
  bg:         "#0a0f1e",
  card:       "#0f1729",
  cardBorder: "#1a2540",
  accent:     "#00d4ff",
  accent2:    "#7c3aed",
  green:      "#10b981",
  red:        "#ef4444",
  yellow:     "#f59e0b",
  text:       "#e2e8f0",
  muted:      "#64748b",
  teal:       "#00c8a0",
  blue:       "#3b82f6",
  purple:     "#8b5cf6",
};

const cardStyle = {
  background:   COLORS.card,
  border:       `1px solid ${COLORS.cardBorder}`,
  borderRadius: 16,
  padding:      24,
};

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, message }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 24px", color: COLORS.muted }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      {title && <p style={{ color: COLORS.text, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{title}</p>}
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>{message}</p>
    </div>
  );
}

// ── File Viewer ───────────────────────────────────────────────────────────────
function FileViewer({ recordId, fileName, ipfsUrl, onClose }) {
  const url = recordId ? `${API}/records/file/${recordId}` : ipfsUrl;
  if (!url) return null;
  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(fileName || "");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 600, display: "flex", flexDirection: "column" }}>
      <div style={{
        height: 56, background: "#080d1a", borderBottom: `1px solid ${COLORS.cardBorder}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>📄</span>
          <span style={{ color: COLORS.text, fontSize: 14, fontWeight: 600 }}>{fileName || "Report"}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href={url} download={fileName || "report"} style={{
            padding: "6px 14px", borderRadius: 8, background: `${COLORS.green}20`,
            color: COLORS.green, border: `1px solid ${COLORS.green}30`,
            fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}>⬇ Download</a>
          <button onClick={onClose} style={{
            padding: "6px 14px", borderRadius: 8, background: "transparent",
            color: COLORS.muted, border: `1px solid ${COLORS.cardBorder}`, fontSize: 13, cursor: "pointer",
          }}>✕ Close</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {isImage
          ? <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <img src={url} alt={fileName} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12, objectFit: "contain" }} />
            </div>
          : <iframe src={url} title={fileName} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />
        }
      </div>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 48 }) {
  const safe     = name || "Unknown";
  const initials = safe.split(" ").filter(w => w !== "Dr.").map(w => w[0]).join("").substring(0, 2);
  const palettes = [
    ["#0e3a5c", "#00d4ff"], ["#2d1a5c", "#7c3aed"], ["#0a3d2e", "#10b981"],
    ["#3d2200", "#f59e0b"], ["#3d0a1a", "#ef4444"],
  ];
  const p = palettes[(safe.charCodeAt(4) || 0) % palettes.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: p[0], border: `2px solid ${p[1]}40`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.33, fontWeight: 700, color: p[1], fontFamily: "monospace",
    }}>{initials}</div>
  );
}

// ── Notification Bell ─────────────────────────────────────────────────────────
function NotificationBell({ patientId }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [alertPulse, setAlertPulse] = useState(false);
  const ref = useRef(null);
  const notifyKey = patientId || getNotificationPatientKey();

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!notifyKey) return;
    try {
      const res = await fetch(`${API}/notifications/${encodeURIComponent(notifyKey)}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        
        // Trigger browser notification + buzzer for new unread notifications
        setNotifications(prev => {
          const prevMap = new Map(prev.map(n => [n.id || n._id, n]));
          let hasNew = false;
          data.forEach(n => {
            const nid = n.id || n._id;
            if (!prevMap.has(nid) && !n.read) {
              hasNew = true;
              sendNotification(n.title, n.message, nid);
            }
          });
          if (hasNew) {
            setAlertPulse(true);
            setTimeout(() => setAlertPulse(false), 3000);
          }
          return data;
        });
      }
    } catch (e) {
      console.error("Error fetching notifications:", e);
    }
  }, [notifyKey]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch(`${API}/notifications/read-all/${encodeURIComponent(notifyKey)}`, { method: "PUT", headers: authHeaders() });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      const res = await fetch(`${API}/notifications/${id}/read`, { method: "PUT", headers: authHeaders() });
      if (res.ok) {
        setNotifications(prev => prev.map(n => (n.id === id || n._id === id) ? { ...n, read: true } : n));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: alertPulse ? `${COLORS.red}25` : "transparent",
        border: `1px solid ${alertPulse ? COLORS.red : COLORS.cardBorder}`,
        borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontSize: "16px",
        position: "relative", color: COLORS.text,
        animation: alertPulse ? "pulse 0.8s ease-in-out infinite" : "none",
      }} title="Notifications">
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: "-4px", right: "-4px", background: COLORS.red,
            color: "#fff", borderRadius: "50%", fontSize: "10px",
            width: "16px", height: "16px", display: "flex", alignItems: "center",
            justifyContent: "center", fontWeight: 700,
          }}>{unreadCount}</span>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)", width: "320px",
          background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: "12px", zIndex: 200, overflow: "hidden",
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
        }}>
          <div style={{
            padding: "10px 14px", borderBottom: `1px solid ${COLORS.cardBorder}`,
            color: COLORS.text, fontSize: "12px", fontWeight: 600,
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: "transparent", border: "none", color: COLORS.accent,
                  fontSize: 11, cursor: "pointer", fontWeight: 700, padding: 0
                }}
              >
                Mark all as read
              </button>
            )}
          </div>
          <div style={{ maxHeight: "280px", overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "20px", color: COLORS.muted, fontSize: "13px", textAlign: "center" }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((n, i) => (
                <div
                  key={n.id || n._id || i}
                  onClick={() => !n.read && handleMarkRead(n.id || n._id)}
                  style={{
                    padding: "12px 14px",
                    borderBottom: `1px solid ${COLORS.cardBorder}`,
                    background: n.read ? "transparent" : `${COLORS.accent}05`,
                    cursor: n.read ? "default" : "pointer",
                    position: "relative"
                  }}
                >
                  {!n.read && (
                    <div style={{
                      position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)",
                      width: 6, height: 6, borderRadius: "50%", background: COLORS.accent
                    }} />
                  )}
                  <div style={{
                    color: n.read ? COLORS.text : "#fff",
                    fontSize: "13px",
                    fontWeight: n.read ? 500 : 700,
                    paddingLeft: n.read ? 0 : 6
                  }}>
                    {n.title}
                  </div>
                  <div style={{
                    color: COLORS.muted,
                    fontSize: "11px",
                    marginTop: "4px",
                    paddingLeft: n.read ? 0 : 6
                  }}>
                    {n.message}
                  </div>
                  <div style={{
                    color: COLORS.muted,
                    fontSize: "9px",
                    marginTop: "4px",
                    textAlign: "right"
                  }}>
                    {new Date(n.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({ patientName, patientId, onLogout }) {
  return (
    <div style={{
      background: "#080d1a", borderBottom: `1px solid ${COLORS.cardBorder}`,
      padding: "0 32px", height: 64, display: "flex", alignItems: "center",
      justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>⛓️</div>
        <div>
          <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, fontFamily: "monospace" }}>MediChain</div>
          <div style={{ color: COLORS.muted, fontSize: 10 }}>Patient Portal • {patientName}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <NotificationBell patientId={patientId || getNotificationPatientKey()} />
        <Link to="/patient/upload" style={{
          color: COLORS.accent, fontSize: 13, textDecoration: "none",
          padding: "6px 14px", borderRadius: 8, background: `${COLORS.accent}15`,
          border: `1px solid ${COLORS.accent}30`,
        }}>📤 Upload Report</Link>
        <button type="button" onClick={onLogout} style={{
          color: COLORS.muted, fontSize: 13, padding: "6px 14px", borderRadius: 8,
          border: `1px solid ${COLORS.cardBorder}`, background: "transparent",
          cursor: "pointer", fontFamily: "inherit",
        }}>Logout</button>
      </div>
    </div>
  );
}

// ── Doctor Profile Modal ──────────────────────────────────────────────────────
function DoctorModal({ doctor, initialStep = "profile", onClose, onBookConfirm }) {
  const [step, setStep] = useState(initialStep);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);

  useEffect(() => {
    setStep(initialStep);
    setTime("");
    setDate(todayStr);
    setIsEmergency(false);
  }, [doctor, initialStep, todayStr]);

  if (!doctor) return null;

  const avail = Array.isArray(doctor.availability) ? doctor.availability : [];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 20, padding: 32, maxWidth: 560, width: "100%",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {step === "profile" ? (
          <>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 24 }}>
              <Avatar name={doctor.name} size={64} />
              <div style={{ flex: 1 }}>
                <h2 style={{ color: COLORS.text, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{doctor.name}</h2>
                <p style={{ color: COLORS.accent, fontSize: 13, marginBottom: 4 }}>
                  {doctor.specialty}{doctor.hospital ? ` · ${doctor.hospital}` : ""}
                </p>
                {doctor.experience > 0 && (
                  <p style={{ color: COLORS.muted, fontSize: 12 }}>
                    {doctor.experience} yrs exp{doctor.education ? ` · ${doctor.education}` : ""}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {doctor.rating > 0    && <span style={{ color: COLORS.yellow, fontSize: 13 }}>⭐ {doctor.rating}</span>}
                  {doctor.fee    > 0    && <span style={{ color: COLORS.green, fontSize: 13, fontWeight: 700 }}>₹{doctor.fee}/consult</span>}
                  {doctor.licenseVerified && <span style={{
                    background: `${COLORS.green}18`, color: COLORS.green,
                    border: `1px solid ${COLORS.green}35`, padding: "3px 10px",
                    borderRadius: 20, fontSize: 11, fontWeight: 700,
                  }}>🛡️ NMC Verified</span>}
                  {!doctor.licenseVerified && <span style={{
                    background: `${COLORS.yellow}15`, color: COLORS.yellow,
                    border: `1px solid ${COLORS.yellow}30`, padding: "3px 10px",
                    borderRadius: 20, fontSize: 11, fontWeight: 600,
                  }}>⏳ Pending Verification</span>}
                </div>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 22, cursor: "pointer" }}>×</button>
            </div>
            {doctor.bio && (
              <p style={{
                color: COLORS.text, fontSize: 14, lineHeight: 1.7,
                background: COLORS.bg, padding: 14, borderRadius: 10, marginBottom: 20,
              }}>{doctor.bio}</p>
            )}
            <button onClick={() => setStep("schedule")} style={{
              width: "100%", padding: 14,
              background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
              border: "none", color: "#fff", fontSize: 15, fontWeight: 700, borderRadius: 12, cursor: "pointer",
            }}>
              Book Appointment
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <button onClick={() => setStep("profile")} style={{
                background: "none", border: "none", color: COLORS.accent, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0
              }}>
                ← Back to Profile
              </button>
              <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 22, cursor: "pointer" }}>×</button>
            </div>

            <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Schedule Appointment</h3>
            
            {/* Select Date */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 6, fontWeight: 600 }}>Select Date</label>
              <input
                type="date"
                min={todayStr}
                value={date}
                onChange={e => { setDate(e.target.value); setTime(""); }}
                style={{
                  width: "100%", padding: "10px 14px", background: COLORS.bg,
                  border: `1px solid ${COLORS.cardBorder}`, borderRadius: 8,
                  color: COLORS.text, fontSize: 14, outline: "none", boxSizing: "border-box"
                }}
              />
            </div>

            {/* Select Time Slot */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 6, fontWeight: 600 }}>🕐 Available Time Slots</label>
              {avail.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {avail.map(t => (
                    <button key={t} onClick={() => setTime(t)} style={{
                      padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                      border: `1px solid ${time === t ? COLORS.accent : COLORS.cardBorder}`,
                      background: time === t ? `${COLORS.accent}20` : COLORS.bg,
                      color: time === t ? COLORS.accent : COLORS.text,
                      fontWeight: time === t ? 700 : 400,
                    }}>{t}</button>
                  ))}
                </div>
              ) : (
                <p style={{ color: COLORS.muted, fontSize: 12 }}>No time slots set by this doctor yet.</p>
              )}
            </div>

            {/* Emergency Priority */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 24, padding: "10px 14px", background: COLORS.bg,
              borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`,
            }}>
              <span style={{ color: COLORS.text, fontSize: 13 }}>🚨 Emergency Priority</span>
              <div
                onClick={() => setIsEmergency(!isEmergency)}
                style={{
                  width: 44, height: 24, borderRadius: 12, position: "relative",
                  cursor: "pointer", background: isEmergency ? COLORS.red : COLORS.cardBorder,
                }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 3, left: isEmergency ? 23 : 3, transition: "left 0.2s",
                }} />
              </div>
            </div>

            <button
              onClick={() => onBookConfirm({ doctor, date, time, isEmergency })}
              disabled={!time}
              style={{
                width: "100%", padding: 14,
                background: time ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})` : COLORS.cardBorder,
                border: "none", color: time ? "#fff" : COLORS.muted, fontSize: 15, fontWeight: 700, borderRadius: 12,
                cursor: time ? "pointer" : "not-allowed",
              }}
            >
              Confirm Book & Pay
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ doctor, time, date, isEmergency, patientId, onClose, onSuccess }) {
  const [step,   setStep]   = useState("payment");
  const [method, setMethod] = useState(doctor?.upiId ? "upi" : "card");
  const [token,  setToken]  = useState("");
  const [queuePos, setQueuePos] = useState(null);
  const baseFee = isEmergency ? Math.round((doctor.fee || 0) * 1.5) : (doctor.fee || 0);
  const [customFee, setCustomFee] = useState(baseFee > 0 ? baseFee : 1);

  const createAppointment = async (paymentMethod) => {
    try {
      const apptRes = await fetch(`${API}/appointments`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          doctorId:      doctor.id || doctor._id,
          patientId,
          date:          date || new Date().toISOString().slice(0, 10),
          time,
          type:          "Consultation",
          isEmergency:   !!isEmergency,
          fee:           customFee,
          feePaid:       true,
          paymentMethod: paymentMethod,
        }),
      });
      const data = await apptRes.json();
      const newTok = data.id || data.blockchain || `MCT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      setToken(newTok);
      setQueuePos(data.queuePosition || null);
      setStep("done");
    } catch (e) {
      console.error(e);
      setToken(`MCT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
      setStep("done");
    }
  };

  const handlePay = async () => {
    if (customFee < 1) {
      alert("Payment amount must be at least ₹1");
      return;
    }
    
    if (method === "upi" && doctor.upiId) {
      setStep("upi_qr");
      return;
    }

    setStep("processing");
    try {
      // 1. Create Order
      const orderRes = await fetch(`${API}/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ amount: customFee, currency: "INR" })
      });
      const orderData = await orderRes.json();

      if (!orderData.id) {
        throw new Error("Failed to create order");
      }

      // 2. Open Razorpay Checkout
      const options = {
        key: "rzp_live_StV9hIqXCqEcHt", // Use LIVE key here
        amount: orderData.amount,
        currency: orderData.currency,
        name: "MediChain",
        description: `Appointment with ${doctor.name}`,
        order_id: orderData.id,
        handler: async function (response) {
          // 3. Verify Payment
          try {
            const verifyRes = await fetch(`${API}/payment/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeaders() },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              // 4. Create Appointment
              await createAppointment("razorpay");
            } else {
              alert("Payment verification failed");
              setStep("payment");
            }
          } catch (e) {
            console.error("Verification error", e);
            alert("Error verifying payment");
            setStep("payment");
          }
        },
        prefill: {
          name: "Patient", // You can pass actual patient details if available
          email: "patient@example.com",
          contact: "9999999999"
        },
        theme: {
          color: "#00d4ff" // Use theme accent color
        },
        modal: {
          ondismiss: function () {
            setStep("payment");
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response){
        alert(response.error.description);
        setStep("payment");
      });
      rzp.open();

    } catch (e) {
      console.error(e);
      alert("Payment failed or cancelled.");
      setStep("payment");
    }
  };

  if (step === "processing") return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center", color: COLORS.text }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⛓️</div>
        <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Processing Payment…</p>
        <p style={{ color: COLORS.muted, fontSize: 13 }}>Booking appointment with {doctor.name}</p>
      </div>
    </div>
  );

  if (step === "upi_qr") {
    const upiLink = `upi://pay?pa=${doctor.upiId}&pn=${encodeURIComponent(doctor.name)}&am=${customFee}&cu=INR`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;
    return (
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: COLORS.card, border: `1px solid ${COLORS.accent}40`,
          borderRadius: 20, padding: 32, maxWidth: 400, width: "100%", textAlign: "center",
        }}>
          <h3 style={{ color: COLORS.text, fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Scan to Pay ₹{customFee}</h3>
          <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 20 }}>
            Paying <strong>Dr. {doctor.name}</strong> directly via UPI
          </p>
          <div style={{ background: "#fff", padding: 16, borderRadius: 16, display: "inline-block", marginBottom: 20 }}>
            <img src={qrUrl} alt="UPI QR Code" style={{ width: 200, height: 200 }} />
          </div>
          <p style={{ color: COLORS.accent, fontSize: 14, fontWeight: 700, fontFamily: "monospace", marginBottom: 24 }}>
            UPI ID: {doctor.upiId}
          </p>
          <button onClick={() => { setStep("processing"); createAppointment("upi"); }} style={{
            width: "100%", padding: 14,
            background: `linear-gradient(135deg, ${COLORS.green}, #059669)`,
            border: "none", color: "#fff", fontSize: 15, fontWeight: 700, borderRadius: 12, cursor: "pointer",
          }}>✅ Payment Completed</button>
          <button onClick={() => setStep("payment")} style={{
            width: "100%", padding: 12, marginTop: 12,
            background: "transparent", border: `1px solid ${COLORS.cardBorder}`, color: COLORS.muted,
            fontSize: 14, fontWeight: 600, borderRadius: 12, cursor: "pointer",
          }}>Cancel</button>
        </div>
      </div>
    );
  }

  if (step === "done") return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 16, width: "100%", maxWidth: 420, overflow: "hidden",
      }}>
        {/* Receipt Header */}
        <div style={{ background: `linear-gradient(135deg, ${COLORS.green}20, ${COLORS.green}05)`, padding: "32px 24px", textAlign: "center", borderBottom: `2px dashed ${COLORS.cardBorder}` }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <h2 style={{ color: COLORS.green, fontSize: 20, fontWeight: 800, margin: 0 }}>Booking Confirmed</h2>
        </div>
        
        {/* Receipt Details */}
        <div style={{ padding: "24px 32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ color: COLORS.muted, fontSize: 13 }}>Booking ID</span>
            <span style={{ color: COLORS.text, fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>{token.slice(0, 12)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ color: COLORS.muted, fontSize: 13 }}>Doctor</span>
            <span style={{ color: COLORS.text, fontSize: 14, fontWeight: 600 }}>Dr. {doctor.name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ color: COLORS.muted, fontSize: 13 }}>Date & Time</span>
            <span style={{ color: COLORS.text, fontSize: 14, fontWeight: 600 }}>{date} at {time}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ color: COLORS.muted, fontSize: 13 }}>Amount Paid</span>
            <span style={{ color: COLORS.accent, fontSize: 14, fontWeight: 800 }}>₹{customFee}</span>
          </div>
          {queuePos != null && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: `${COLORS.accent}15`, borderRadius: 8, marginTop: 24 }}>
              <span style={{ color: COLORS.accent, fontSize: 13, fontWeight: 600 }}>Queue Position</span>
              <span style={{ color: COLORS.accent, fontSize: 16, fontWeight: 800 }}>#{queuePos}</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div style={{ padding: "0 24px 24px" }}>
          <button onClick={() => { onSuccess(token); onClose(); }} style={{
            width: "100%", padding: 14,
            background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text, 
            fontSize: 14, fontWeight: 700, borderRadius: 12, cursor: "pointer", transition: "all 0.2s"
          }}>Download Receipt & Close</button>
        </div>
      </div>
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 20, padding: 28, maxWidth: 420, width: "100%",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: COLORS.text, fontSize: 18, fontWeight: 800 }}>💳 Payment</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ background: COLORS.bg, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${COLORS.cardBorder}`, marginTop: 4 }}>
            <span style={{ color: COLORS.text, fontSize: 15, fontWeight: 700 }}>Amount (₹)</span>
            <input 
              type="number" 
              min="1" 
              value={customFee} 
              onChange={(e) => setCustomFee(Number(e.target.value))}
              style={{
                background: COLORS.card, border: `1px solid ${COLORS.accent}`, outline: "none",
                color: COLORS.accent, padding: "6px 12px", borderRadius: 8, fontSize: 15, fontWeight: 800, width: "120px", textAlign: "right"
              }}
            />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          {[
            { key: "card",       label: "💳 Card" },
            { key: "upi",        label: "📱 UPI" },
            { key: "netbanking", label: "🏦 Net Banking" },
          ].map(m => (
            <button key={m.key} onClick={() => setMethod(m.key)} style={{
              padding: "10px 6px", borderRadius: 10, cursor: "pointer", fontSize: 12,
              border: `1px solid ${method === m.key ? COLORS.accent : COLORS.cardBorder}`,
              background: method === m.key ? `${COLORS.accent}15` : COLORS.bg,
              color: method === m.key ? COLORS.accent : COLORS.muted,
              fontWeight: method === m.key ? 700 : 400,
            }}>{m.label}</button>
          ))}
        </div>
        <button onClick={handlePay} style={{
          width: "100%", padding: 14,
          background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
          border: "none", color: "#fff", fontSize: 15, fontWeight: 700, borderRadius: 12, cursor: "pointer",
        }}>
          Pay ₹{customFee} & Confirm Appointment
        </button>
      </div>
    </div>
  );
}

// ── AI Summary Card ───────────────────────────────────────────────────────────
function AISummaryCard({ summary }) {
  return (
    <div style={{
      background: `${COLORS.accent2}0d`, border: `1px solid ${COLORS.accent2}30`,
      borderRadius: 14, padding: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 20 }}>✨</span>
        <h4 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>AI Summary</h4>
      </div>
      <p style={{
        color: COLORS.text, fontSize: 14, lineHeight: 1.7,
        background: COLORS.bg, padding: 14, borderRadius: 10, marginBottom: 16,
      }}>{summary.plainLanguage}</p>
      {(summary.keyFindings || []).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Key Findings</p>
          {summary.keyFindings.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <span style={{ color: COLORS.yellow }}>⚡</span>
              <span style={{ color: COLORS.text, fontSize: 14 }}>{f}</span>
            </div>
          ))}
        </div>
      )}
      {(summary.recommendedSteps || []).length > 0 && (
        <div>
          <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Recommended Steps</p>
          {summary.recommendedSteps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <span style={{ color: COLORS.green }}>✅</span>
              <span style={{ color: COLORS.text, fontSize: 14 }}>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Appointment Card ──────────────────────────────────────────────────────────
function AppointmentCard({ appt }) {
  const now       = new Date();
  const apptTime  = new Date(`${appt.date} ${appt.time}`);
  const diffMs    = apptTime - now;
  const soonAlert = diffMs > 0 && diffMs < 2 * 3600 * 1000; // within 2 hours

  const statusColor = {
    confirmed:     COLORS.accent,
    "in-progress": COLORS.green,
    pending:       COLORS.yellow,
    completed:     COLORS.muted,
  }[appt.status] || COLORS.muted;

  return (
    <div style={{
      padding: 16, borderRadius: 12,
      border: `1px solid ${appt.isEmergency ? COLORS.red + "55" : soonAlert ? COLORS.yellow + "55" : COLORS.cardBorder}`,
      background: appt.isEmergency ? `${COLORS.red}08` : soonAlert ? "#1a1500" : COLORS.bg,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <p style={{ color: COLORS.text, fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
            Dr. {appt.doctorName || "Unknown Doctor"}
          </p>
          <p style={{ color: COLORS.accent, fontSize: 12 }}>{appt.specialty || appt.type}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{
            background: statusColor + "20", color: statusColor,
            border: `1px solid ${statusColor}40`,
            padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
          }}>
            {appt.isEmergency ? "🚨 Emergency" : appt.status}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 12, color: COLORS.muted }}>
        <span>📅 {appt.date}</span>
        <span>🕐 {appt.time}</span>
        {appt.type && <span>🩺 {appt.type}</span>}
      </div>
      {soonAlert && (
        <p style={{ color: COLORS.yellow, fontSize: 11, marginTop: 8, fontWeight: 600 }}>
          ⚡ Appointment coming up soon!
        </p>
      )}
      {appt.notes && (
        <p style={{ color: COLORS.muted, fontSize: 12, marginTop: 8, fontStyle: "italic" }}>{appt.notes}</p>
      )}
      {appt.blockchain && (
        <p style={{ color: COLORS.accent, fontSize: 10, fontFamily: "monospace", marginTop: 8 }}>
          ⛓️ {appt.blockchain.slice(0, 30)}…
          {appt.blockchainTokenId && <span style={{ color: COLORS.green, marginLeft: 8 }}>🎟️ Token #{appt.blockchainTokenId}</span>}
        </p>
      )}
    </div>
  );
}

// ── Live Queue Tracker Card ──────────────────────────────────────────────────
function LiveQueueTrackerCard({ appt }) {
  const [queueInfo, setQueueInfo] = useState({ queue: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchQueue = async () => {
      try {
        const res = await fetch(`${API}/queue?doctorId=${appt.doctorId}&date=${appt.date}`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setQueueInfo(data);
            setLoading(false);
          }
        }
      } catch (e) {
        console.error("Queue fetch error:", e);
      }
    };
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [appt.doctorId, appt.date]);

  if (loading) {
    return (
      <div style={{ padding: 16, background: COLORS.bg, borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.muted, fontSize: 13 }}>
        Loading queue status for Dr. {appt.doctorName}...
      </div>
    );
  }

  const queue = queueInfo.queue || [];
  const myIndex = queue.findIndex(q => q.appointmentId === String(appt._id || appt.id));
  const myEntry = queue.find(q => q.appointmentId === String(appt._id || appt.id));

  // Determine current seeing patient
  const currentPatient = queue[0];
  const nextPatient = queue[1];

  return (
    <div style={{
      padding: 20, background: COLORS.bg, borderRadius: 12,
      border: `1px solid ${myIndex === 0 ? COLORS.green : myIndex === 1 ? COLORS.yellow : COLORS.cardBorder}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h4 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, margin: "0 0 4px" }}>
            Dr. {appt.doctorName}
          </h4>
          <p style={{ color: COLORS.muted, fontSize: 12, margin: 0 }}>
            {appt.specialty || appt.type} · Scheduled: {appt.time}
          </p>
        </div>
        {myEntry && (
          <div style={{ textAlign: "right" }}>
            <span style={{
              background: `${COLORS.accent}15`, color: COLORS.accent,
              border: `1px solid ${COLORS.accent}30`,
              padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "monospace"
            }}>
              Token: {myEntry.queueToken}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        {/* Current Patient */}
        <div style={{ padding: 12, background: `${COLORS.card}`, borderRadius: 10, border: `1.5px solid ${COLORS.green}30` }}>
          <p style={{ color: COLORS.muted, fontSize: 11, margin: "0 0 4px", textTransform: "uppercase" }}>🟢 Currently Seeing</p>
          <p style={{ color: COLORS.green, fontSize: 15, fontWeight: 800, margin: 0, fontFamily: "monospace" }}>
            {currentPatient ? currentPatient.queueToken : "No patients in queue"}
          </p>
          <span style={{ color: COLORS.muted, fontSize: 11 }}>
            {currentPatient ? `Started: ${new Date(currentPatient.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "—"}
          </span>
        </div>

        {/* Next Patient */}
        <div style={{ padding: 12, background: `${COLORS.card}`, borderRadius: 10, border: `1.5px solid ${COLORS.yellow}30` }}>
          <p style={{ color: COLORS.muted, fontSize: 11, margin: "0 0 4px", textTransform: "uppercase" }}>⏳ Next Up</p>
          <p style={{ color: COLORS.yellow, fontSize: 15, fontWeight: 800, margin: 0, fontFamily: "monospace" }}>
            {nextPatient ? nextPatient.queueToken : "None"}
          </p>
          <span style={{ color: COLORS.muted, fontSize: 11 }}>
            {nextPatient ? `Scheduled: ${nextPatient.time}` : "—"}
          </span>
        </div>

        {/* Your Position */}
        <div style={{
          padding: 12,
          background: myIndex === 0 ? `${COLORS.green}10` : myIndex === 1 ? `${COLORS.yellow}10` : `${COLORS.card}`,
          borderRadius: 10,
          border: `1.5px solid ${myIndex === 0 ? COLORS.green : myIndex === 1 ? COLORS.yellow : COLORS.cardBorder}`
        }}>
          <p style={{ color: COLORS.muted, fontSize: 11, margin: "0 0 4px", textTransform: "uppercase" }}>🪪 Your Position</p>
          {myIndex !== -1 ? (
            <>
              <p style={{
                color: myIndex === 0 ? COLORS.green : myIndex === 1 ? COLORS.yellow : COLORS.text,
                fontSize: 15, fontWeight: 800, margin: 0
              }}>
                {myIndex === 0 ? "You're next!" : `#${myIndex + 1} in queue`}
              </p>
              <span style={{ color: COLORS.muted, fontSize: 11 }}>
                {myIndex === 0 ? "Being seen now" : `${myIndex} patient(s) ahead`}
              </span>
            </>
          ) : (
            <>
              <p style={{ color: COLORS.red, fontSize: 14, fontWeight: 700, margin: 0 }}>
                Not in queue
              </p>
              <span style={{ color: COLORS.muted, fontSize: 11 }}>
                Will appear when checked in
              </span>
            </>
          )}
        </div>
      </div>

      {myIndex === 0 && (
        <div style={{
          background: `${COLORS.green}15`, border: `1.5px solid ${COLORS.green}40`,
          borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center"
        }}>
          <span style={{ fontSize: 18 }}>🟢</span>
          <p style={{ color: COLORS.green, fontSize: 13, fontWeight: 600, margin: 0 }}>
            It is your turn! Please enter the consultation room.
          </p>
        </div>
      )}

      {myIndex === 1 && (
        <div style={{
          background: `${COLORS.yellow}15`, border: `1.5px solid ${COLORS.yellow}40`,
          borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center"
        }}>
          <span style={{ fontSize: 18 }}>⏳</span>
          <p style={{ color: COLORS.yellow, fontSize: 13, fontWeight: 600, margin: 0 }}>
            You are next in line. Please be ready near the consultation room.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Doctor Report Card ────────────────────────────────────────────────────────
function DoctorReportCard({ report, onView }) {
  const [expanded, setExpanded] = useState(false);
  const hasComment  = !!(report.doctorComment || report.doctorNotes);
  const hasRecommend = !!report.recommendation;
  const hasFile      = !!(report.ipfsUrl || report.id);

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.bg, overflow: "hidden" }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: "14px 16px", cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: `${COLORS.teal}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>📋</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{
              background: `${COLORS.purple}20`, color: COLORS.purple,
              border: `1px solid ${COLORS.purple}30`,
              padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
            }}>{report.category}</span>
            {report.uploadedByDoctor && (
              <span style={{ color: COLORS.teal, fontSize: 11, fontWeight: 600 }}>👨‍⚕️ By Doctor</span>
            )}
            {report.cleared && (
              <span style={{
                background: `${COLORS.green}18`, color: COLORS.green,
                border: `1px solid ${COLORS.green}30`,
                padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
              }}>✅ Cleared</span>
            )}
            {report.anchoredOnChain && (
              <span style={{
                background: `${COLORS.accent}15`, color: COLORS.accent,
                border: `1px solid ${COLORS.accent}30`,
                padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
              }}>⛓️ On-Chain</span>
            )}
          </div>
          <p style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{report.fileName}</p>
          <p style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>
            {report.uploadDate} {report.doctorName ? `• Dr. ${report.doctorName}` : ""}
            {report.cleared && report.clearedByName ? ` • Cleared by Dr. ${report.clearedByName}` : ""}
          </p>
        </div>
        <span style={{ color: COLORS.muted, fontSize: 16 }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ borderTop: `1px solid ${COLORS.cardBorder}`, padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {hasComment && (
            <div style={{
              padding: "14px 16px", background: `${COLORS.blue}08`,
              border: `1px solid ${COLORS.blue}25`, borderRadius: 12,
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>💬</span>
                <p style={{ color: COLORS.accent, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Doctor's Comments</p>
              </div>
              <p style={{ color: COLORS.text, fontSize: 13, lineHeight: 1.7 }}>{report.doctorComment || report.doctorNotes}</p>
            </div>
          )}
          {hasRecommend && (
            <div style={{
              padding: "14px 16px", background: `${COLORS.green}08`,
              border: `1px solid ${COLORS.green}25`, borderRadius: 12,
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>✅</span>
                <p style={{ color: COLORS.green, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Recommendations</p>
              </div>
              <p style={{ color: COLORS.text, fontSize: 13, lineHeight: 1.7 }}>{report.recommendation}</p>
            </div>
          )}
          {!hasComment && !hasRecommend && (
            <p style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>No additional comments from the doctor.</p>
          )}
          {report.aiSummary?.plainLanguage && (
            <div style={{
              padding: "14px 16px", background: `${COLORS.purple}08`,
              border: `1px solid ${COLORS.purple}25`, borderRadius: 12,
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>✨</span>
                <p style={{ color: COLORS.purple, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>AI Summary</p>
              </div>
              <p style={{ color: COLORS.text, fontSize: 13, lineHeight: 1.7 }}>{report.aiSummary.plainLanguage}</p>
            </div>
          )}
          {hasFile && (
            <button onClick={() => onView(report)} style={{
              padding: "10px 16px", borderRadius: 10, border: `1px solid ${COLORS.accent}40`,
              background: `${COLORS.accent}10`, color: COLORS.accent, fontSize: 13,
              fontWeight: 600, cursor: "pointer",
            }}>📄 View Report File</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Nearby Doctors Tab ────────────────────────────────────────────────────────
function NearbyDoctors({ doctors, onBook }) {
  const [locationInput, setLocationInput] = useState("");
  const [patientCoords, setPatientCoords] = useState(null);
  const [geocoding,     setGeocoding]     = useState(false);
  const [geoError,      setGeoError]      = useState("");
  const [sortedDocs,    setSortedDocs]    = useState([]);
  const [maxKm,         setMaxKm]         = useState(50);

  const detectGPS = () => {
    if (!navigator.geolocation) { setGeoError("GPS not supported. Enter location manually."); return; }
    setGeocoding(true); setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setPatientCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeocoding(false); },
      ()    => { setGeoError("GPS denied. Enter your city/address manually."); setGeocoding(false); }
    );
  };

  const handleGeocode = async () => {
    if (!locationInput.trim()) return;
    setGeocoding(true); setGeoError("");
    try {
      const { lat, lng } = await geocodeAddress(locationInput.trim());
      setPatientCoords({ lat, lng });
    } catch (e) { setGeoError(e.message); }
    finally { setGeocoding(false); }
  };

  useEffect(() => {
    if (!patientCoords) { setSortedDocs([]); return; }
    const withDist = doctors
      .filter(d => d.location?.lat && d.location?.lng)
      .map(d => ({ ...d, distKm: haversineKm(patientCoords.lat, patientCoords.lng, d.location.lat, d.location.lng) }))
      .filter(d => d.distKm <= maxKm)
      .sort((a, b) => a.distKm - b.distKm);
    setSortedDocs(withDist);
  }, [patientCoords, doctors, maxKm]);

  const docsWithLocation = doctors.filter(d => d.location?.lat && d.location?.lng);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={cardStyle}>
        <h2 style={{ color: COLORS.text, fontWeight: 700, fontSize: 18, marginBottom: 8 }}>📍 Find Doctors Near You</h2>
        <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>Enter your city or address, or click GPS. Works for any Indian location.</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <input
            type="text"
            placeholder='"Gurugram, Haryana" or "Koramangala, Bangalore"'
            value={locationInput}
            onChange={e => setLocationInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleGeocode()}
            style={{
              flex: 1, padding: "10px 14px", background: COLORS.bg,
              border: `1px solid ${COLORS.cardBorder}`, borderRadius: 8,
              color: COLORS.text, fontSize: 14, boxSizing: "border-box", outline: "none",
            }}
          />
          <button onClick={handleGeocode} disabled={geocoding || !locationInput.trim()} style={{
            background: COLORS.accent2, color: "#fff", border: "none", borderRadius: 8,
            padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
          }}>{geocoding ? "Searching…" : "🔍 Search"}</button>
          <button onClick={detectGPS} disabled={geocoding} style={{
            background: COLORS.card, color: COLORS.muted, border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 8, padding: "10px 14px", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap",
          }} title="Use device GPS">{geocoding ? "…" : "🛰️ GPS"}</button>
        </div>
        {geoError && (
          <div style={{
            background: "#2d1515", border: "1px solid #7f1d1d", borderRadius: 8,
            padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 12,
          }}>{geoError}</div>
        )}
        {patientCoords && (
          <div style={{
            background: "#0a2e1a", border: "1px solid #14532d", borderRadius: 8,
            padding: "8px 14px", color: COLORS.green, fontSize: 13, marginBottom: 12, display: "inline-block",
          }}>
            ✅ Location set • {patientCoords.lat.toFixed(4)}, {patientCoords.lng.toFixed(4)}
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <label style={{ color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 4 }}>Max Distance: {maxKm} km</label>
          <input type="range" min="5" max="200" step="5" value={maxKm} onChange={e => setMaxKm(Number(e.target.value))} style={{ width: "200px" }} />
        </div>
      </div>

      {/* Map */}
      {patientCoords && (
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <MapContainer center={[patientCoords.lat, patientCoords.lng]} zoom={12} style={{ height: 400, width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
            <MapCenter lat={patientCoords.lat} lng={patientCoords.lng} />
            <Marker position={[patientCoords.lat, patientCoords.lng]} icon={patientIcon}>
              <Popup>📍 Your Location</Popup>
            </Marker>
            {sortedDocs.map(doc => (
              <Marker key={doc.id || doc._id} position={[doc.location.lat, doc.location.lng]} icon={doctorIcon}>
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <p style={{ fontWeight: 700, marginBottom: 4 }}>{doc.name}</p>
                    <p style={{ color: "#555", fontSize: 12, marginBottom: 4 }}>{doc.specialty}</p>
                    <p style={{ fontSize: 12, marginBottom: 8 }}>{doc.distKm.toFixed(1)} km away</p>
                    <button
                      onClick={() => onBook(doc)}
                      style={{
                        width: "100%", padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11,
                        background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`, color: "#fff", fontWeight: 700,
                      }}
                    >
                      Book Appointment
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Results */}
      {patientCoords && (
        <div style={cardStyle}>
          <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
            {sortedDocs.length > 0 ? `${sortedDocs.length} doctor${sortedDocs.length !== 1 ? "s" : ""} within ${maxKm} km` : "No doctors found in range"}
          </h3>
          {sortedDocs.length === 0 && docsWithLocation.length === 0 && (
            <EmptyState icon="📍" message="No doctors have set their clinic location yet." />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sortedDocs.map(doc => (
              <div key={doc.id || doc._id} style={{
                padding: 16, borderRadius: 12, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.bg,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Avatar name={doc.name} size={44} />
                  <div>
                    <p style={{ color: COLORS.text, fontWeight: 700, fontSize: 14 }}>{doc.name}</p>
                    <p style={{ color: COLORS.accent, fontSize: 12 }}>{doc.specialty} • {doc.distKm.toFixed(1)} km away</p>
                    {doc.fee > 0 && <p style={{ color: COLORS.green, fontSize: 12, fontWeight: 700 }}>₹{doc.fee}</p>}
                  </div>
                </div>
                <button onClick={() => onBook(doc)} style={{
                  padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13,
                  background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`, color: "#fff", fontWeight: 700,
                }}>Book</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main PatientDashboard ─────────────────────────────────────────────────────
export function PatientDashboard() {
  const navigate = useNavigate();
  const [sessionPatient, setSessionPatient] = useState(() => getSessionPatientProfile());
  const [doctors,        setDoctors]        = useState([]);
  const [reports,        setReports]        = useState([]);
  const [appointments,   setAppointments]   = useState([]);
  const [loading,        setLoading]        = useState(true);

  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedTime,   setSelectedTime]   = useState("");
  const [selectedDate,   setSelectedDate]   = useState(new Date().toISOString().slice(0, 10));
  const [isEmergency,    setIsEmergency]    = useState(false);
  const [modalDoctor,    setModalDoctor]    = useState(null);
  const [modalInitialStep, setModalInitialStep] = useState("profile");
  const [showPayment,    setShowPayment]    = useState(false);
  const [bookedTokens,   setBookedTokens]   = useState([]);
  const [filterSpec,     setFilterSpec]     = useState("All");

  const [activeTab,      setActiveTab]      = useState("reports");
  const [selectedReport, setSelectedReport] = useState(null);
  const [verifyStatus,   setVerifyStatus]   = useState({});
  const [viewerRecord,   setViewerRecord]   = useState(null);

  const patientId = getStoredPatientId() || getNotificationPatientKey();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAppts = appointments.filter(appt => appt.date && appt.date.slice(0, 10) === todayStr);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  useEffect(() => {
    const sync = () => setSessionPatient(getSessionPatientProfile());
    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("focus", sync); window.removeEventListener("storage", sync); };
  }, []);

  useEffect(() => {
    requestNotificationPermission().then(granted => {
      if (granted) console.log("🔔 Browser notifications allowed.");
    });
  }, []);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    let cancelled = false;

    const load = () => {
      const headers = authHeaders();
      Promise.all([
        fetch(`${API}/doctors`).then(r => r.json()).catch(() => []),
        fetch(`${API}/records/${encodeURIComponent(patientId)}`, { headers }).then(r => r.json()).catch(() => []),
        fetch(`${API}/appointments?patientId=${encodeURIComponent(patientId)}`, { headers }).then(r => r.json()).catch(() => []),
      ]).then(([docs, recs, appts]) => {
        if (cancelled) return;
        setDoctors(Array.isArray(docs) ? docs : []);
        const safeRecs = Array.isArray(recs) ? recs : [];
        setReports(safeRecs);
        setAppointments(Array.isArray(appts) ? appts : []);
        if (safeRecs.length) setSelectedReport(safeRecs[0]);
      }).finally(() => { if (!cancelled) setLoading(false); });
    };

    load();
    const interval = setInterval(load, 10000);
    const onBump   = e => { if (e.key === "medichain-records-bump") load(); };
    window.addEventListener("storage", onBump);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener("storage", onBump); };
  }, [patientId]);

  const handleVerifyReport = async (report, idx) => {
    setVerifyStatus(s => ({ ...s, [idx]: "checking" }));
    try {
      const chainId = getChainPatientId();
      if (!chainId) throw new Error("No chain patient ID");
      const ok = await verifyRecord(chainId, report);
      setVerifyStatus(s => ({ ...s, [idx]: ok ? "verified" : "failed" }));
    } catch (err) {
      setVerifyStatus(s => ({ ...s, [idx]: "failed" }));
      console.error("Verify failed:", err.message);
    }
  };

  const handlePaymentSuccess = (tok) => {
    setBookedTokens(prev => [{ token: tok, doctor: selectedDoctor, time: selectedTime, date: selectedDate, isEmergency }, ...prev]);
    setSelectedDoctor(null);
    setSelectedTime("");
    setIsEmergency(false);
    // Refresh appointments
    const headers = authHeaders();
    fetch(`${API}/appointments`, { headers })
      .then(r => r.json())
      .then(appts => { if (Array.isArray(appts)) setAppointments(appts); })
      .catch(() => {});
  };

  const specialties     = ["All", ...new Set((doctors || []).map(d => d.specialty).filter(Boolean))];
  const filteredDoctors = filterSpec === "All" ? doctors : doctors.filter(d => d.specialty === filterSpec);

  // Separate doctor-uploaded vs self-uploaded reports
  const doctorReports = reports.filter(r => r.uploadedByDoctor);
  const selfReports   = reports.filter(r => !r.uploadedByDoctor);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Segoe UI', sans-serif" }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0a0f1e; } ::-webkit-scrollbar-thumb { background: #1a2540; border-radius: 3px; }`}</style>

      <TopBar
        patientName={sessionPatient.name}
        appointments={appointments.map(a => ({ ...a, doctorName: a.doctorName || "Doctor" }))}
        onLogout={handleLogout}
      />

      {modalDoctor && (
        <DoctorModal
          doctor={modalDoctor}
          initialStep={modalInitialStep}
          onClose={() => setModalDoctor(null)}
          onBookConfirm={(details) => {
            setSelectedDoctor(details.doctor);
            setSelectedDate(details.date);
            setSelectedTime(details.time);
            setIsEmergency(details.isEmergency);
            setShowPayment(true);
            setModalDoctor(null);
          }}
        />
      )}
      {showPayment && selectedDoctor && selectedTime && (
        <PaymentModal
          doctor={selectedDoctor}
          time={selectedTime}
          date={selectedDate}
          isEmergency={isEmergency}
          patientId={patientId}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {viewerRecord && (
        <FileViewer
          recordId={viewerRecord.id}
          fileName={viewerRecord.fileName}
          ipfsUrl={viewerRecord.ipfsUrl}
          onClose={() => setViewerRecord(null)}
        />
      )}

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        {/* Welcome */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: COLORS.text, fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            Welcome back, {sessionPatient.name}! 👋
          </h1>
          {patientId
            ? <p style={{ color: COLORS.muted, fontSize: 12 }}>
                Patient ID: <span style={{ fontFamily: "monospace", color: COLORS.accent }}>{patientId}</span>
              </p>
            : <p style={{ color: COLORS.red, fontSize: 13, marginTop: 6 }}>⚠️ Not logged in — please log in to view your data</p>
          }
        </div>

        {/* Live Queue Tracker Panel */}
        {todayAppts.length > 0 && (
          <div style={{ ...cardStyle, border: `1.5px solid ${COLORS.accent}40`, marginBottom: 28, background: `linear-gradient(135deg, ${COLORS.card}, #121d3a)` }}>
            <h3 style={{ color: COLORS.accent, fontWeight: 700, fontSize: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🏥 Live Queue Tracker</span>
              <span style={{ fontSize: 11, background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}30`, padding: "2px 8px", borderRadius: 10 }}>Live Updates</span>
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {todayAppts.map(appt => (
                <LiveQueueTrackerCard key={appt._id || appt.id} appt={appt} />
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Appointments",   value: appointments.length + bookedTokens.length,                       icon: "📅", color: COLORS.accent },
            { label: "Health Reports", value: reports.length,                                                   icon: "📋", color: COLORS.green },
            { label: "Booked Tokens",  value: bookedTokens.length,                                             icon: "🎟️", color: COLORS.accent2 },
            { label: "Doctors Online", value: doctors.filter(d => d.status !== "offline").length,              icon: "👨‍⚕️", color: COLORS.yellow },
          ].map(s => (
            <div key={s.label} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 6 }}>{s.label}</p>
                  <p style={{ color: s.color, fontSize: 32, fontWeight: 800, fontFamily: "monospace" }}>{s.value}</p>
                </div>
                <span style={{ fontSize: 28 }}>{s.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* My Appointments */}
        {appointments.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 28 }}>
            <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 16 }}>📅 My Appointments</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 12 }}>
              {appointments.map(appt => <AppointmentCard key={appt._id || appt.id} appt={appt} />)}
            </div>
          </div>
        )}

        {/* Booked tokens (session-only) */}
        {bookedTokens.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 28 }}>
            <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 16 }}>🎟️ New Booking Tokens</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 12 }}>
              {bookedTokens.map((entry, i) => (
                <div key={i} style={{ background: COLORS.bg, border: `1px solid ${COLORS.accent}30`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: COLORS.accent, marginBottom: 8, letterSpacing: 2, wordBreak: "break-all" }}>{entry.token}</div>
                  <p style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{entry.doctor?.name}</p>
                  <p style={{ color: COLORS.muted, fontSize: 12 }}>{entry.time} · {entry.date}</p>
                  {entry.isEmergency && <span style={{ color: COLORS.red, fontSize: 11, fontWeight: 700 }}>🚨 Emergency</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 28 }}>
          {/* Book Appointment */}
          <div style={cardStyle}>
            <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🗓️ Book Appointment</h3>
            <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 14 }}>Browse registered doctors and book your slot</p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Appointment Date</label>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setSelectedDate(e.target.value)}
                style={{
                  background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`,
                  color: COLORS.text, padding: "8px 12px", borderRadius: 8, fontSize: 13, outline: "none",
                }}
              />
            </div>

            {specialties.length > 1 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {specialties.map(spec => (
                  <button key={spec} onClick={() => setFilterSpec(spec)} style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                    border: `1px solid ${filterSpec === spec ? COLORS.accent : COLORS.cardBorder}`,
                    background: filterSpec === spec ? `${COLORS.accent}15` : "transparent",
                    color: filterSpec === spec ? COLORS.accent : COLORS.muted,
                    fontWeight: filterSpec === spec ? 700 : 400,
                  }}>{spec}</button>
                ))}
              </div>
            )}

            {loading ? (
              <p style={{ color: COLORS.muted, textAlign: "center", padding: 24 }}>Loading doctors…</p>
            ) : filteredDoctors.length === 0 ? (
              <EmptyState icon="👨‍⚕️" title="No doctors registered yet" message="Doctors appear here after they sign up and register on MediChain." />
            ) : (
              <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
                {filteredDoctors.map(doc => {
                  const docId      = doc.id || doc._id || String(doc.name);
                  const isSelected = selectedDoctor && (selectedDoctor.id === docId || selectedDoctor._id === docId);
                  const avail      = Array.isArray(doc.availability) ? doc.availability : [];
                  return (
                    <div key={docId} style={{
                      borderRadius: 14,
                      border: `1px solid ${isSelected ? COLORS.accent : COLORS.cardBorder}`,
                      background: isSelected ? `${COLORS.accent}06` : COLORS.bg,
                      overflow: "hidden",
                    }}>
                      <div
                        onClick={() => { setSelectedDoctor({ ...doc, id: docId }); setSelectedTime(""); }}
                        style={{ padding: 14, cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start" }}
                      >
                        <Avatar name={doc.name} size={52} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <p style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{doc.name}</p>
                              <p style={{ color: COLORS.accent, fontSize: 12, marginBottom: 3 }}>
                                {doc.specialty}{doc.hospital ? ` · ${doc.hospital}` : ""}
                              </p>
                              {doc.experience > 0 && <p style={{ color: COLORS.muted, fontSize: 12 }}>{doc.experience} yrs experience</p>}
                            </div>
                            {doc.fee > 0 && (
                              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                                <p style={{ color: COLORS.green, fontWeight: 800, fontSize: 15 }}>₹{doc.fee}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        {isSelected && <span style={{ color: COLORS.accent, fontSize: 20, flexShrink: 0 }}>✓</span>}
                      </div>

                      <div style={{ padding: "0 14px 12px", display: "flex", gap: 8 }}>
                        <button
                          onClick={e => { e.stopPropagation(); setModalDoctor({ ...doc, id: docId }); }}
                          style={{
                            padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                            border: `1px solid ${COLORS.cardBorder}`, background: "transparent", color: COLORS.muted,
                          }}>👤 View Profile</button>
                        {avail.length > 0 && (
                          <span style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, background: `${COLORS.green}15`, color: COLORS.green }}>
                            🟢 {avail.length} slots
                          </span>
                        )}
                        {doc.licenseVerified && (
                          <span style={{
                            padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                            background: `${COLORS.green}18`, color: COLORS.green,
                            border: `1px solid ${COLORS.green}35`,
                          }}>
                            🛡️ NMC Verified
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <div style={{ borderTop: `1px solid ${COLORS.cardBorder}`, padding: 14, background: `${COLORS.accent}04` }}>
                          <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10, fontWeight: 600 }}>🕐 Available Time Slots</p>
                          {avail.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                              {avail.map(t => (
                                <button key={t} onClick={() => setSelectedTime(t)} style={{
                                  padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                                  border: `1px solid ${selectedTime === t ? COLORS.accent : COLORS.cardBorder}`,
                                  background: selectedTime === t ? `${COLORS.accent}20` : COLORS.bg,
                                  color: selectedTime === t ? COLORS.accent : COLORS.text,
                                  fontWeight: selectedTime === t ? 700 : 400,
                                }}>{t}</button>
                              ))}
                            </div>
                          ) : (
                            <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 14 }}>No time slots set by this doctor yet.</p>
                          )}
                          <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            marginBottom: 12, padding: "10px 14px", background: COLORS.bg,
                            borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`,
                          }}>
                            <span style={{ color: COLORS.text, fontSize: 13 }}>🚨 Emergency Priority</span>
                            <div
                              onClick={() => setIsEmergency(!isEmergency)}
                              style={{
                                width: 44, height: 24, borderRadius: 12, position: "relative",
                                cursor: "pointer", background: isEmergency ? COLORS.red : COLORS.cardBorder,
                              }}>
                              <div style={{
                                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                                position: "absolute", top: 3, left: isEmergency ? 23 : 3, transition: "left 0.2s",
                              }} />
                            </div>
                          </div>
                          {selectedTime
                            ? <button onClick={() => setShowPayment(true)} style={{
                                width: "100%", padding: "12px",
                                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                                border: "none", color: "#fff", fontSize: 15, fontWeight: 700, borderRadius: 10, cursor: "pointer",
                              }}>💳 Proceed to Payment</button>
                            : <p style={{ color: COLORS.muted, fontSize: 13, textAlign: "center" }}>← Select a time slot to continue</p>
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={cardStyle}>
              <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Quick Actions</h3>
              <Link to="/patient/upload" style={{
                display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text,
                fontSize: 14, textDecoration: "none", background: COLORS.bg, marginBottom: 8,
              }}>📤 Upload Health Report</Link>
              <Link to="/patient/analyze" style={{
                display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text,
                fontSize: 14, textDecoration: "none", background: COLORS.bg, marginBottom: 8,
              }}>🩺 Analyze Report with AI</Link>
              <button onClick={() => setActiveTab("reports")} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text,
                fontSize: 14, background: COLORS.bg, cursor: "pointer", width: "100%",
              }}>📋 View All Reports ({reports.length})</button>
            </div>
            {specialties.length > 1 && (
              <div style={cardStyle}>
                <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🏥 Specialties</h3>
                {specialties.filter(s => s !== "All").map(spec => {
                  const count = doctors.filter(d => d.specialty === spec).length;
                  return (
                    <div
                      key={spec}
                      onClick={() => setFilterSpec(spec)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "9px 12px", borderRadius: 10, cursor: "pointer", marginBottom: 6,
                        background: filterSpec === spec ? `${COLORS.accent}10` : COLORS.bg,
                        border: `1px solid ${filterSpec === spec ? COLORS.accent + "40" : COLORS.cardBorder}`,
                      }}>
                      <span style={{ color: filterSpec === spec ? COLORS.accent : COLORS.text, fontSize: 13 }}>{spec}</span>
                      <span style={{ color: COLORS.muted, fontSize: 12, background: COLORS.card, padding: "2px 8px", borderRadius: 10 }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Nearby Doctors */}
        <div style={{ marginBottom: 28 }}>
          <NearbyDoctors doctors={doctors} onBook={doc => { setModalDoctor(doc); setModalInitialStep("schedule"); }} />
        </div>

        {/* Health Reports */}
        <div style={cardStyle}>
          <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>📋 My Health Reports</h3>
          <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 14 }}>
            {!patientId
              ? "Log in to view your reports"
              : reports.length === 0
                ? "No reports yet — upload your first report"
                : `${reports.length} report${reports.length !== 1 ? "s" : ""} on file`}
          </p>

          <div style={{ display: "flex", gap: 4, marginBottom: 20, background: COLORS.bg, padding: 4, borderRadius: 10, width: "fit-content" }}>
            {[
              { key: "reports",        label: `My Uploads (${selfReports.length})` },
              { key: "doctor_reports", label: `Doctor Reports (${doctorReports.length})` },
              { key: "summary",        label: "AI Summary" },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13,
                background: activeTab === tab.key ? COLORS.card : "transparent",
                color: activeTab === tab.key ? COLORS.text : COLORS.muted,
                fontWeight: activeTab === tab.key ? 700 : 400,
              }}>{tab.label}</button>
            ))}
          </div>

          {activeTab === "reports" && (
            selfReports.length === 0
              ? <EmptyState icon="📂" title="No self-uploaded reports" message="Upload your medical documents using the Upload Report button above." />
              : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {selfReports.map((report, idx) => {
                    const hasFile = !!(report.ipfsUrl || report.id);
                    return (
                      <div
                        key={report.id || idx}
                        style={{ padding: 16, borderRadius: 12, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.bg, cursor: "pointer" }}
                        onClick={() => { setSelectedReport(report); setActiveTab("summary"); }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.accent}
                        onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.cardBorder}
                      >
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                            background: `${COLORS.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                          }}>📄</div>
                          <div style={{ flex: 1 }}>
                            <p style={{ color: COLORS.text, fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{report.fileName || "Report"}</p>
                            <span style={{
                              background: `${COLORS.accent2}20`, color: "#a78bfa",
                              border: `1px solid ${COLORS.accent2}30`,
                              padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                            }}>{report.category || "General"}</span>
                            <p style={{ color: COLORS.muted, fontSize: 11, marginTop: 6 }}>{report.uploadDate || "—"}</p>
                            {(report.blockchainHash || report.hash) && (
                              <p style={{ color: COLORS.muted, fontSize: 10, fontFamily: "monospace", marginTop: 2 }}>
                                ⛓️ {String(report.blockchainHash || report.hash).slice(0, 20)}…
                              </p>
                            )}
                            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
                              {hasFile && (
                                <button onClick={() => setViewerRecord({ id: report.id, fileName: report.fileName, ipfsUrl: report.ipfsUrl })} style={{
                                  fontSize: 11, padding: "3px 10px", borderRadius: 6, cursor: "pointer",
                                  border: `1px solid ${COLORS.accent}40`, background: `${COLORS.accent}15`, color: COLORS.accent, fontWeight: 600,
                                }}>📄 View</button>
                              )}
                              <button
                                onClick={() => handleVerifyReport(report, idx)}
                                disabled={verifyStatus[idx] === "checking"}
                                style={{
                                  fontSize: 11, padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: "none",
                                  background: verifyStatus[idx] === "verified" ? `${COLORS.green}22` : verifyStatus[idx] === "failed" ? `${COLORS.red}22` : `${COLORS.accent}22`,
                                  color: verifyStatus[idx] === "verified" ? COLORS.green : verifyStatus[idx] === "failed" ? COLORS.red : COLORS.accent,
                                }}>
                                {verifyStatus[idx] === "checking" ? "Checking…" : verifyStatus[idx] === "verified" ? "✅ Verified" : verifyStatus[idx] === "failed" ? "⚠️ Mismatch" : "🔍 Verify"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
          )}

          {activeTab === "doctor_reports" && (
            doctorReports.length === 0
              ? <EmptyState icon="👨‍⚕️" title="No doctor reports yet" message="Reports uploaded by your doctor will appear here." />
              : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {doctorReports.map((report, idx) => (
                    <DoctorReportCard
                      key={report.id || idx}
                      report={report}
                      onView={r => setViewerRecord({ id: r.id, fileName: r.fileName, ipfsUrl: r.ipfsUrl })}
                    />
                  ))}
                </div>
          )}

          {activeTab === "summary" && (
            selectedReport?.aiSummary
              ? <AISummaryCard summary={selectedReport.aiSummary} />
              : <EmptyState icon="📄" message="No AI summary available for this report yet. Click on a report to select it." />
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientDashboard;