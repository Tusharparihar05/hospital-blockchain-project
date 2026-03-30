import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#060b16", surface: "#0c1424", surfaceHi: "#101d30",
  border: "#172035", borderHi: "#1e2d48",
  teal: "#00c8a0", blue: "#3b82f6", purple: "#8b5cf6",
  amber: "#f59e0b", red: "#f43f5e", green: "#10b981",
  text: "#dde6f5", muted: "#4d6080", mutedHi: "#7a92b8",
};

// ── Session doctor profile ────────────────────────────────────────────────────
function getSessionDoctorProfile() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u.role !== "doctor") return null;
    return {
      id:            u.id            || u._id || "—",
      name:          (u.name && String(u.name).trim()) || "Doctor",
      email:         u.email         || "—",
      specialty:     (u.specialty && String(u.specialty).trim()) || "General",
      hospital:      u.hospital      || "—",
      licenseNumber: u.licenseNumber || "",
      walletAddress: u.walletAddress || "",
      experience:    u.experience    || 0,
      rating:        u.rating        || 0,
      reviews:       u.reviewCount   || 0,
      image:         "👨‍⚕️",
      bio:           u.bio           || "",
      education:     u.education     || "",
      phone:         u.phone         || "",
      languages:     u.languages     || [],
      availability:  u.availability  ? buildAvailabilityMap(u.availability) : {},
      conditions:    u.tags          || [],
      fromSession:   true,
    };
  } catch (_) { return null; }
}

function buildAvailabilityMap(slots) {
  // slots is a flat array of time strings; map them to a simple day structure
  const days = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] };
  (slots || []).forEach((s, i) => {
    const dayKeys = Object.keys(days);
    days[dayKeys[i % dayKeys.length]].push(s);
  });
  return days;
}

// ── File Viewer modal ─────────────────────────────────────────────────────────
function FileViewer({ recordId, fileName, ipfsUrl, onClose }) {
  const url = recordId ? `${API}/records/file/${recordId}` : ipfsUrl;
  if (!url) return null;
  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(fileName || "");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 600, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 56, background: "#04080f", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>📄</span>
          <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{fileName || "Report"}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href={url} download={fileName || "report"} style={{ padding: "6px 14px", borderRadius: 8, background: `${C.green}20`, color: C.green, border: `1px solid ${C.green}30`, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>⬇ Download</a>
          <button onClick={onClose} style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", color: C.muted, border: `1px solid ${C.border}`, fontSize: 13, cursor: "pointer" }}>✕ Close</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {isImage
          ? <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}><img src={url} alt={fileName} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12, objectFit: "contain" }} /></div>
          : <iframe src={url} title={fileName} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />}
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = (msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
  return { toasts, show };
}
function ToastContainer({ toasts }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: t.type === "error" ? `${C.red}18` : t.type === "info" ? `${C.blue}18` : `${C.green}18`, border: `1.5px solid ${t.type === "error" ? C.red : t.type === "info" ? C.blue : C.green}55`, borderRadius: 12, padding: "13px 20px", fontSize: 13, fontWeight: 600, color: t.type === "error" ? C.red : t.type === "info" ? C.blue : C.green, boxShadow: "0 8px 24px #00000066", maxWidth: 340 }}>{t.msg}</div>
      ))}
    </div>
  );
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Badge({ children, color = C.teal, size = "sm" }) {
  return <span style={{ padding: size === "lg" ? "4px 14px" : "2px 10px", fontSize: size === "lg" ? 12 : 11, fontWeight: 700, borderRadius: 20, background: color + "1a", color, border: `1px solid ${color}33`, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>{children}</span>;
}
function StatusDot({ status }) {
  const map = { online: C.green, busy: C.amber, offline: C.muted };
  const col = map[status || "offline"] || C.muted;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: col, fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: col, display: "inline-block" }} />{(status || "offline").charAt(0).toUpperCase() + (status || "offline").slice(1)}</span>;
}
function StarRating({ value }) {
  return <span style={{ display: "inline-flex", gap: 1 }}>{[1,2,3,4,5].map(i => <span key={i} style={{ color: i <= Math.round(value) ? C.amber : C.border, fontSize: 11 }}>★</span>)}</span>;
}
function ApptStatusBadge({ status, isEmergency }) {
  if (isEmergency) return <Badge color={C.red}>🚨 Emergency</Badge>;
  const map = { confirmed: { color: C.blue, label: "Confirmed" }, "in-progress": { color: C.teal, label: "● In Progress" }, pending: { color: C.amber, label: "Pending" }, completed: { color: C.green, label: "✓ Completed" } };
  const m = map[status] || { color: C.muted, label: status };
  return <Badge color={m.color}>{m.label}</Badge>;
}
const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 };

// ── Helpers ───────────────────────────────────────────────────────────────────
function isoToday()    { return new Date().toISOString().slice(0, 10); }
function isoTomorrow() { const d = new Date(); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }

function normalizeReport(r) {
  const hash = r.blockchainHash || r.hash || "";
  return { ...r, id: r.id || r._id, fileName: r.fileName || r.type || "Report", category: r.category || r.type || "General", blockchainHash: hash, hash };
}
function normalizeAppt(a, patientById) {
  const p = patientById?.get?.(a.patientId);
  let status = String(a.status || "pending").trim().toLowerCase().replace(/\s+/g, "-");
  if (status === "reschedule-requested") status = "pending";
  return {
    ...a,
    id:          a.id || a._id,
    patientName: p?.name || a.patientName || "Patient",
    age:         a.age ?? p?.age,
    gender:      p?.gender || a.gender || "—",
    phone:       p?.phone  || a.phone,
    type:        a.type || a.dept || "Consultation",
    notes:       a.notes || [a.doctorName, a.dept].filter(Boolean).join(" · ") || "",
    status,
    specialty:   a.specialty || a.dept,
    isEmergency: !!a.isEmergency,
    blockchain:  a.blockchain || a.tokenId || "",
  };
}

// ── Empty-state placeholder ───────────────────────────────────────────────────
function EmptyState({ icon, message }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: C.muted }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <p style={{ fontSize: 14 }}>{message}</p>
    </div>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({ activeView, setActiveView, doctor, onLogout }) {
  const nav = [
    { key: "overview",     icon: "⚡", label: "Overview" },
    { key: "doctors",      icon: "👨‍⚕️", label: "Directory" },
    { key: "appointments", icon: "📅", label: "Appointments" },
    { key: "patients",     icon: "🔍", label: "Patients" },
    { key: "myprofile",    icon: "🪪",  label: "My Profile" },
  ];
  return (
    <div style={{ background: "#04080f99", backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}`, padding: "0 28px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>⛓️</div>
        <div><div style={{ color: C.text, fontWeight: 800, fontSize: 15, fontFamily: "monospace" }}>MediChain</div><div style={{ color: C.muted, fontSize: 10, letterSpacing: 1 }}>DOCTOR PORTAL</div></div>
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {nav.map(n => (
          <button key={n.key} onClick={() => setActiveView(n.key)} style={{ padding: "7px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, background: activeView === n.key ? `${C.teal}18` : "transparent", color: activeView === n.key ? C.teal : C.mutedHi, fontWeight: activeView === n.key ? 700 : 400, borderBottom: activeView === n.key ? `2px solid ${C.teal}` : "2px solid transparent" }}>
            <span style={{ fontSize: 14 }}>{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <StatusDot status="online" />
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 10, background: C.surfaceHi, border: `1px solid ${C.borderHi}` }}>
          <span style={{ fontSize: 20 }}>{doctor?.image || "👨‍⚕️"}</span>
          <div><p style={{ color: C.text, fontSize: 13, fontWeight: 600, lineHeight: 1 }}>{doctor?.name || "Doctor"}</p><p style={{ color: C.muted, fontSize: 11 }}>{doctor?.specialty}</p></div>
        </div>
        <button type="button" onClick={onLogout} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 13, cursor: "pointer" }}>Logout</button>
      </div>
    </div>
  );
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
function OverviewView({ appointments, patients, reports, loadingAppts, chainStatus, onCompleteAppt, onReschedule, setActiveView, doctor: doc }) {
  const todayStr       = isoToday();
  const todayAppts     = appointments.filter(a => a.date === todayStr);
  const emergencyCount = appointments.filter(a => a.isEmergency).length;

  return (
    <div>
      <div style={{ borderRadius: 16, padding: "26px 32px", marginBottom: 24, background: `linear-gradient(120deg, ${C.teal}18, ${C.blue}10, ${C.bg})`, border: `1px solid ${C.teal}30`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 4 }}>Good morning,</p>
          <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, marginBottom: 10 }}>{doc?.name} 👋</h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {doc?.hospital && <Badge color={C.teal} size="lg">🏥 {doc.hospital}</Badge>}
            {doc?.specialty && <Badge color={C.blue} size="lg">🩺 {doc.specialty}</Badge>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>Today</p>
          <p style={{ color: C.teal, fontSize: 42, fontWeight: 800, fontFamily: "monospace", lineHeight: 1 }}>{todayAppts.length}</p>
          <p style={{ color: C.muted, fontSize: 13 }}>appointments</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Today's Appointments", value: loadingAppts ? "…" : todayAppts.length,   icon: "📅", color: C.teal },
          { label: "Total Patients",        value: loadingAppts ? "…" : patients.length,     icon: "👥", color: C.blue },
          { label: "Reports Submitted",     value: loadingAppts ? "…" : reports.length,      icon: "📋", color: C.purple },
          { label: "Emergency Cases",       value: loadingAppts ? "…" : emergencyCount,      icon: "🚨", color: C.red },
        ].map(s => (
          <div key={s.label} style={{ ...card }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><p style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>{s.label}</p><p style={{ color: s.color, fontSize: 30, fontWeight: 800, fontFamily: "monospace" }}>{s.value}</p></div>
              <span style={{ fontSize: 28 }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div><h3 style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>📅 Today's Appointments</h3><p style={{ color: C.muted, fontSize: 13 }}>{loadingAppts ? "Loading..." : `${todayAppts.length} scheduled`}</p></div>
          <button onClick={() => setActiveView("appointments")} style={{ fontSize: 13, color: C.teal, background: `${C.teal}15`, border: `1px solid ${C.teal}30`, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>View All →</button>
        </div>
        {loadingAppts
          ? <p style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Loading...</p>
          : todayAppts.length === 0
            ? <EmptyState icon="📭" message="No appointments today" />
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {todayAppts.map(appt => (
                  <div key={appt.id} style={{ padding: "13px 15px", borderRadius: 12, border: `1px solid ${appt.isEmergency ? C.red + "55" : C.border}`, background: appt.isEmergency ? `${C.red}07` : C.surfaceHi }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ minWidth: 68, textAlign: "center", padding: "7px 4px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <p style={{ color: C.teal, fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>{appt.time}</p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <p style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{appt.patientName}</p>
                          {appt.age && <span style={{ color: C.muted, fontSize: 12 }}>· {appt.age}y</span>}
                          <Badge color={C.blue}>{appt.type || appt.specialty}</Badge>
                        </div>
                        <p style={{ color: C.muted, fontSize: 12 }}>{appt.notes}</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                        <ApptStatusBadge status={appt.status} isEmergency={appt.isEmergency} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => onReschedule(appt)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", background: "transparent", border: `1px solid ${C.border}`, color: C.mutedHi }}>↺ Reschedule</button>
                          <button onClick={() => onCompleteAppt(appt)} disabled={chainStatus[appt.id] === "minting" || appt.status === "completed"} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", border: "none", background: appt.status === "completed" ? `${C.green}22` : `linear-gradient(135deg, ${C.teal}, ${C.blue})`, color: appt.status === "completed" ? C.green : "#fff", fontWeight: 600 }}>
                            {chainStatus[appt.id] === "minting" ? "⛓️ Minting…" : appt.status === "completed" ? "✓ Done" : "✓ Complete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>
    </div>
  );
}

// ── DOCTOR DIRECTORY ──────────────────────────────────────────────────────────
function DoctorsView({ allDoctors, loading }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const q = search.toLowerCase();
  const filtered = (allDoctors || []).filter(d =>
    (d.name || "").toLowerCase().includes(q) || (d.specialty || "").toLowerCase().includes(q) || (d.hospital || "").toLowerCase().includes(q)
  );

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: C.text, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>👨‍⚕️ Doctor Directory</h2>
        <p style={{ color: C.muted, fontSize: 14 }}>{filtered.length} registered doctor{filtered.length !== 1 ? "s" : ""}</p>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, specialty, hospital..." style={{ width: "100%", padding: "10px 16px", borderRadius: 10, fontSize: 14, background: C.surface, border: `1px solid ${C.borderHi}`, color: C.text, outline: "none", marginBottom: 20 }} />

      {loading && <EmptyState icon="⏳" message="Loading doctors from database..." />}
      {!loading && filtered.length === 0 && <EmptyState icon="👨‍⚕️" message="No doctors registered yet. Doctors appear here after signing up." />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
        {filtered.map((doc, di) => {
          const dk = doc.id || `d-${di}`;
          return (
            <div key={dk} style={{ borderRadius: 14, border: `1px solid ${expanded === dk ? C.teal : C.border}`, background: C.surface, overflow: "hidden" }}>
              <div style={{ padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: `${C.teal}20`, border: `2px solid ${C.teal}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{doc.image || "👨‍⚕️"}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{doc.name}</p>
                  <p style={{ color: C.teal, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{doc.specialty || "General"}</p>
                  <p style={{ color: C.mutedHi, fontSize: 12 }}>🏥 {doc.hospital || "—"} · {doc.experience} yrs</p>
                  {doc.fee > 0 && <p style={{ color: C.green, fontSize: 13, fontWeight: 700, marginTop: 4 }}>₹{doc.fee}/consult</p>}
                </div>
              </div>
              {(doc.languages || []).length > 0 && (
                <div style={{ padding: "8px 16px 10px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {doc.languages.map(l => <Badge key={l} color={C.teal}>🌐 {l}</Badge>)}
                </div>
              )}
              {doc.bio && (
                <div style={{ padding: "8px 16px 12px", borderTop: `1px solid ${C.border}` }}>
                  <p style={{ color: C.mutedHi, fontSize: 12, lineHeight: 1.5 }}>{doc.bio}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── APPOINTMENTS ──────────────────────────────────────────────────────────────
function AppointmentsView({ appointments, chainStatus, onCompleteAppt, onReschedule }) {
  const [filterDate, setFilterDate]     = useState("today");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch]             = useState("");
  const [selectedApt, setSelectedApt]   = useState(null);
  const todayStr    = isoToday();
  const tomorrowStr = isoTomorrow();

  const filtered = appointments.filter(a => {
    const matchDate   = filterDate === "all" ? true : filterDate === "today" ? a.date === todayStr : filterDate === "tomorrow" ? a.date === tomorrowStr : filterDate === "past" ? a.date < todayStr : true;
    const matchStatus = filterStatus === "all" ? true : filterStatus === "emergency" ? a.isEmergency : a.status === filterStatus;
    const matchSearch = (a.patientName || "").toLowerCase().includes(search.toLowerCase()) || (a.type || "").toLowerCase().includes(search.toLowerCase());
    return matchDate && matchStatus && matchSearch;
  });

  return (
    <div>
      <div style={{ marginBottom: 22 }}><h2 style={{ color: C.text, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>📅 Appointments</h2><p style={{ color: C.muted, fontSize: 14 }}>All patient appointments from the database</p></div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or type..." style={{ flex: 1, minWidth: 200, padding: "9px 14px", borderRadius: 9, fontSize: 13, background: C.surface, border: `1px solid ${C.borderHi}`, color: C.text, outline: "none" }} />
        <div style={{ display: "flex", gap: 3, background: C.surface, padding: 4, borderRadius: 10, border: `1px solid ${C.border}` }}>
          {["today","tomorrow","past","all"].map(d => (
            <button key={d} onClick={() => setFilterDate(d)} style={{ padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "inherit", background: filterDate === d ? C.surfaceHi : "transparent", color: filterDate === d ? C.teal : C.muted, fontWeight: filterDate === d ? 700 : 400 }}>{d.charAt(0).toUpperCase()+d.slice(1)}</button>
          ))}
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: "9px 12px", borderRadius: 9, fontSize: 13, background: C.surface, border: `1px solid ${C.borderHi}`, color: C.text, outline: "none", cursor: "pointer" }}>
          {["all","confirmed","in-progress","pending","completed","emergency"].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 20 }}>
        <div style={card}>
          {filtered.length === 0
            ? <EmptyState icon="📭" message="No appointments found. Appointments appear here when patients book them." />
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filtered.map(apt => (
                  <div key={apt.id} onClick={() => setSelectedApt(selectedApt?.id === apt.id ? null : apt)} style={{ padding: "13px 15px", borderRadius: 12, cursor: "pointer", border: `1px solid ${selectedApt?.id === apt.id ? C.teal : apt.isEmergency ? C.red+"55" : C.border}`, background: selectedApt?.id === apt.id ? `${C.teal}08` : apt.isEmergency ? `${C.red}06` : C.surfaceHi }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ minWidth: 68, textAlign: "center", padding: "7px 4px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <p style={{ color: C.teal, fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>{apt.time}</p>
                        <p style={{ color: C.muted, fontSize: 10 }}>{new Date(apt.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <p style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{apt.patientName}</p>
                          {apt.age && <span style={{ color: C.muted, fontSize: 12 }}>· {apt.age}y</span>}
                          <Badge color={C.blue}>{apt.type || apt.specialty}</Badge>
                        </div>
                        <p style={{ color: C.muted, fontSize: 12 }}>{apt.notes}</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                        <ApptStatusBadge status={apt.status} isEmergency={apt.isEmergency} />
                        {apt.status !== "completed" && (
                          <div style={{ display: "flex", gap: 5 }}>
                            <button onClick={e => { e.stopPropagation(); onReschedule(apt); }} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, cursor: "pointer", background: "transparent", border: `1px solid ${C.border}`, color: C.mutedHi }}>↺</button>
                            <button onClick={e => { e.stopPropagation(); onCompleteAppt(apt); }} disabled={chainStatus[apt.id] === "minting"} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, cursor: "pointer", border: "none", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, color: "#fff", fontWeight: 700 }}>
                              {chainStatus[apt.id] === "minting" ? "⛓️…" : "✓"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
        <div style={card}>
          {selectedApt ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>Appointment Detail</h3>
                <button onClick={() => setSelectedApt(null)} style={{ fontSize: 13, color: C.muted, background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
              </div>
              {[
                { label: "Patient",  value: selectedApt.patientName },
                { label: "Date",     value: new Date(selectedApt.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) },
                { label: "Time",     value: selectedApt.time },
                { label: "Type",     value: selectedApt.type },
                { label: "Priority", value: selectedApt.isEmergency ? "🚨 Emergency" : "Standard" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.muted, fontSize: 13 }}>{r.label}</span>
                  <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                {selectedApt.status !== "completed" && (
                  <button onClick={() => onCompleteAppt(selectedApt)} disabled={chainStatus[selectedApt.id] === "minting"} style={{ padding: "10px", borderRadius: 8, border: `1px solid ${C.green}`, cursor: "pointer", fontSize: 13, fontFamily: "inherit", background: `${C.green}15`, color: C.green, fontWeight: 600 }}>
                    {chainStatus[selectedApt.id] === "minting" ? "⛓️ Minting..." : "✓ Mark Complete"}
                  </button>
                )}
                <button onClick={() => onReschedule(selectedApt)} style={{ padding: "10px", borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 13, fontFamily: "inherit", background: "transparent", color: C.mutedHi }}>↺ Reschedule</button>
              </div>
            </div>
          ) : (
            <EmptyState icon="👆" message="Select an appointment to view details" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── PATIENTS VIEW ─────────────────────────────────────────────────────────────
function PatientsView({ patients, reports, onShowToast }) {
  const [searchQuery, setSearchQuery]         = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [viewerRecord, setViewerRecord]       = useState(null);

  const sq             = searchQuery.toLowerCase();
  const filtered       = (patients || []).filter(p => (p.name||"").toLowerCase().includes(sq) || (p.id||"").toLowerCase().includes(sq) || (p.phone && String(p.phone).includes(searchQuery)));
  const selectedData   = patients.find(p => p.id === selectedPatient);
  const patientReports = reports.filter(r => r.patientId === selectedPatient);

  return (
    <div>
      {viewerRecord && <FileViewer recordId={viewerRecord.id} fileName={viewerRecord.fileName} ipfsUrl={viewerRecord.ipfsUrl} onClose={() => setViewerRecord(null)} />}
      <div style={{ marginBottom: 22 }}><h2 style={{ color: C.text, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🔍 Patient Search</h2><p style={{ color: C.muted, fontSize: 14 }}>{patients.length} registered patient{patients.length !== 1 ? "s" : ""}</p></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        <div style={card}>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: C.muted }}>🔍</span>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, ID, or phone..." style={{ width: "100%", padding: "11px 14px 11px 38px", borderRadius: 10, fontSize: 14, background: C.surfaceHi, border: `1px solid ${C.borderHi}`, color: C.text, outline: "none", boxSizing: "border-box" }} />
          </div>
          {searchQuery
            ? filtered.length === 0
              ? <EmptyState icon="😶" message="No patients match your search" />
              : (
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  {filtered.map(p => (
                    <div key={p.id} onClick={() => setSelectedPatient(p.id)} style={{ padding: "13px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 8, border: `1px solid ${selectedPatient === p.id ? C.teal : C.border}`, background: selectedPatient === p.id ? `${C.teal}08` : C.surfaceHi, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><p style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{p.name}</p><Badge color={C.blue}>{p.id}</Badge></div>
                        <p style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>{p.age ? `${p.age} yrs · ` : ""}{p.gender} · {p.phone}</p>
                      </div>
                      <span style={{ color: C.muted, fontSize: 16 }}>›</span>
                    </div>
                  ))}
                </div>
              )
            : <EmptyState icon="👥" message={`Type to search. ${patients.length} patient${patients.length !== 1 ? "s" : ""} in database.`} />
          }
        </div>
        <div style={card}>
          {selectedData
            ? (
              <div>
                <div style={{ textAlign: "center", padding: "16px 0 20px", borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 16, background: `${C.teal}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 10px" }}>{selectedData.gender === "Female" ? "👩" : "👨"}</div>
                  <p style={{ color: C.text, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{selectedData.name}</p>
                  <p style={{ color: C.muted, fontSize: 13 }}>{selectedData.phone}</p>
                  <div style={{ marginTop: 8 }}><Badge color={C.blue}>{selectedData.id}</Badge></div>
                </div>
                <h4 style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📋 Health Reports</h4>
                {patientReports.length === 0
                  ? <EmptyState icon="📂" message="No reports uploaded for this patient yet" />
                  : patientReports.map((r, i) => {
                    const hasFile = !!(r.ipfsUrl || r.id);
                    return (
                      <div key={r.id || i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < patientReports.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${C.blue}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📄</div>
                        <div style={{ flex: 1 }}>
                          <Badge color={C.purple}>{r.category || "General"}</Badge>
                          <p style={{ color: C.text, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{r.fileName || "Report"}</p>
                          <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{r.uploadDate}</p>
                          {hasFile && (
                            <button onClick={() => setViewerRecord({ id: r.id, fileName: r.fileName, ipfsUrl: r.ipfsUrl })} style={{ marginTop: 6, fontSize: 11, padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: `1px solid ${C.teal}40`, background: `${C.teal}15`, color: C.teal, fontWeight: 600 }}>📄 View Report</button>
                          )}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )
            : <EmptyState icon="👆" message="Select a patient to view details and reports" />
          }
        </div>
      </div>
    </div>
  );
}

// ── MY PROFILE ────────────────────────────────────────────────────────────────
function MyProfileView({ doctor: doc, licenseVerification, onLicenseVerify }) {
  const [verifyBusy, setVerifyBusy] = useState(false);
  if (!doc) return <EmptyState icon="🪪" message="Please log in to view your profile" />;

  const availability = doc.availability || {};

  return (
    <div>
      <div style={{ marginBottom: 24 }}><h2 style={{ color: C.text, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🪪 My Profile</h2><p style={{ color: C.muted, fontSize: 14 }}>Your professional information</p></div>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...card, textAlign: "center" }}>
            <div style={{ width: 80, height: 80, borderRadius: 18, margin: "0 auto 12px", background: `${C.teal}20`, border: `3px solid ${C.teal}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>{doc.image}</div>
            <p style={{ color: C.text, fontWeight: 800, fontSize: 17, marginBottom: 3 }}>{doc.name}</p>
            <p style={{ color: C.teal, fontWeight: 600, fontSize: 13, marginBottom: 10 }}>{doc.specialty}</p>
            <StatusDot status="online" />
          </div>
          <div style={card}>
            <h4 style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📞 Contact</h4>
            {[{ icon: "📧", value: doc.email }, { icon: "📱", value: doc.phone || "—" }, { icon: "🏥", value: doc.hospital || "—" }].map(r => (
              <div key={r.icon} style={{ display: "flex", gap: 8, marginBottom: 10 }}><span style={{ fontSize: 14 }}>{r.icon}</span><p style={{ color: C.mutedHi, fontSize: 13 }}>{r.value}</p></div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {doc.bio && (
            <div style={card}>
              <h4 style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📝 Bio</h4>
              <p style={{ color: C.text, fontSize: 14, lineHeight: 1.7 }}>{doc.bio}</p>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { label: "⏱️ Experience", value: `${doc.experience} years` },
              { label: "🪪 Account ID",  value: doc.id },
              ...(doc.licenseNumber ? [{ label: "📜 License", value: doc.licenseNumber }] : []),
              ...(doc.education     ? [{ label: "🎓 Education", value: doc.education }] : []),
            ].map(r => (
              <div key={r.label} style={card}><p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>{r.label}</p><p style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{r.value}</p></div>
            ))}
          </div>
          {(doc.languages || []).length > 0 && (
            <div style={card}>
              <h4 style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>🌐 Languages</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{doc.languages.map(l => <Badge key={l} color={C.teal}>{l}</Badge>)}</div>
            </div>
          )}
          {Object.keys(availability).length > 0 && (
            <div style={card}>
              <h4 style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🗓️ Availability</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px,1fr))", gap: 8 }}>
                {Object.entries(availability).map(([day, slots]) => (
                  <div key={day} style={{ padding: "10px 6px", borderRadius: 10, textAlign: "center", background: slots.length ? `${C.teal}10` : C.bg, border: `1px solid ${slots.length ? C.teal+"30" : C.border}` }}>
                    <p style={{ color: slots.length ? C.teal : C.muted, fontSize: 12, fontWeight: 700, marginBottom: 5 }}>{day}</p>
                    <p style={{ color: C.mutedHi, fontSize: 10 }}>{slots.length ? `${slots.length} slots` : "Off"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {doc.licenseNumber && (
            <div style={{ ...card, border: `1px solid ${C.purple}33`, background: `${C.purple}07` }}>
              <h4 style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>📜 License Verification</h4>
              {licenseVerification?.status === "verified" && <p style={{ color: C.green, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>✅ Verified</p>}
              {licenseVerification?.status === "rejected" && <p style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>❌ Rejected: {licenseVerification.note}</p>}
              {(!licenseVerification || licenseVerification.status === "none") && <p style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>Not yet verified.</p>}
              <button type="button" disabled={verifyBusy || !doc.licenseNumber} onClick={async () => { setVerifyBusy(true); try { await onLicenseVerify(); } finally { setVerifyBusy(false); } }} style={{ padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, background: `linear-gradient(135deg, ${C.purple}, ${C.blue})`, color: "#fff" }}>
                {verifyBusy ? "Submitting…" : "Submit for Verification"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export function DoctorDashboard() {
  const navigate = useNavigate();
  const { toasts, show } = useToast();
  const [activeView, setActiveView]       = useState("overview");
  const [sessionDoctor, setSessionDoctor] = useState(() => getSessionDoctorProfile());
  const [licenseVerification, setLicenseVerification] = useState(null);

  const [patients,     setPatients]     = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [reports,      setReports]      = useState([]);
  const [allDoctors,   setAllDoctors]   = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [chainStatus,  setChainStatus]  = useState({});

  // Sync session doctor when localStorage changes
  useEffect(() => {
    const sync = () => setSessionDoctor(getSessionDoctorProfile());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("focus", sync); };
  }, []);

  // Licence verification status
  useEffect(() => {
    if (!sessionDoctor?.email) return;
    fetch(`${API}/verification/doctor-license?email=${encodeURIComponent(sessionDoctor.email)}`)
      .then(r => r.ok ? r.json() : { status: "none" })
      .then(d => setLicenseVerification(d))
      .catch(() => {});
  }, [sessionDoctor?.email]);

  // Load real data — NO mock fallback
  useEffect(() => {
    let cancelled = false;
    const load = async (quiet) => {
      if (!quiet) setLoadingAppts(true);
      try {
        const headers = authHeaders();
        const [pr, ar, rr, dr] = await Promise.all([
          fetch(`${API}/patients`,     { headers }),
          fetch(`${API}/appointments`, { headers }),
          fetch(`${API}/records`,      { headers }),
          fetch(`${API}/doctors`),
        ]);
        if (cancelled) return;

        const pts     = pr.ok  ? await pr.json()  : [];
        const apRaw   = ar.ok  ? await ar.json()  : [];
        const recsRaw = rr.ok  ? await rr.json()  : [];
        const docsRaw = dr.ok  ? await dr.json()  : [];

        const patientById = new Map((pts || []).map(p => [p.id, p]));
        const appts = (apRaw  || []).map(a => normalizeAppt(a, patientById));
        const recs  = (recsRaw|| []).map(normalizeReport);
        const docs  = docsRaw || [];

        setPatients(pts   || []);
        setAppointments(appts);
        setReports(recs);
        setAllDoctors(docs);
        setLoadingDoctors(false);
      } catch (err) {
        console.error("Load error:", err);
        // Leave arrays empty — do NOT set mock data
      } finally {
        if (!cancelled && !quiet) setLoadingAppts(false);
      }
    };

    load(false);
    const interval = setInterval(() => load(true), 8000);
    let bc = null;
    try { bc = new BroadcastChannel("medichain-sync"); bc.onmessage = () => load(true); } catch (_) {}
    const onStorage = e => { if (e.key === "medichain-records-bump") load(true); };
    window.addEventListener("storage", onStorage);
    return () => { cancelled = true; clearInterval(interval); if (bc) bc.close(); window.removeEventListener("storage", onStorage); };
  }, []);

  const handleCompleteAppt = async (appt) => {
    setChainStatus(s => ({ ...s, [appt.id]: "minting" }));
    try {
      await fetch(`${API}/appointments/${appt.id}/complete`, { method: "PUT", headers: authHeaders() });
      setChainStatus(s => ({ ...s, [appt.id]: "done" }));
      show("✅ Appointment marked complete");
      setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: "completed" } : a));
    } catch (err) {
      setChainStatus(s => ({ ...s, [appt.id]: "failed" }));
      show(err.message, "error");
    }
  };

  const handleReschedule = async (appt) => {
    await fetch(`${API}/appointments/${appt.id}/reschedule`, { method: "PUT", headers: authHeaders() }).catch(() => {});
    show("Reschedule request sent", "info");
    setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: "pending" } : a));
  };

  const handleLicenseVerifyRequest = async () => {
    try {
      const res = await fetch(`${API}/verification/doctor-license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sessionDoctor.email, licenseNumber: sessionDoctor.licenseNumber, documentHash: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setLicenseVerification(data);
      show(data.status === "verified" ? "License verified!" : data.note || "Verification submitted", data.status === "verified" ? "success" : "info");
    } catch (e) { show(e.message, "error"); }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  // Redirect if not logged in as doctor
  if (!sessionDoctor) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <p style={{ fontSize: 16, marginBottom: 20 }}>Please log in as a doctor to access this dashboard.</p>
          <button onClick={() => navigate("/login")} style={{ padding: "12px 24px", borderRadius: 10, background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Go to Login</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI', 'Noto Sans', sans-serif", color: C.text }}>
        <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: ${C.bg}; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; } button, select, input, textarea { font-family: inherit; } @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <TopBar activeView={activeView} setActiveView={setActiveView} doctor={sessionDoctor} onLogout={handleLogout} />
        <div style={{ maxWidth: 1300, margin: "0 auto", padding: "32px 24px", animation: "fadeIn 0.3s ease" }}>
          {activeView === "overview"     && <OverviewView appointments={appointments} patients={patients} reports={reports} loadingAppts={loadingAppts} chainStatus={chainStatus} onCompleteAppt={handleCompleteAppt} onReschedule={handleReschedule} setActiveView={setActiveView} doctor={sessionDoctor} />}
          {activeView === "doctors"      && <DoctorsView allDoctors={allDoctors} loading={loadingDoctors} />}
          {activeView === "appointments" && <AppointmentsView appointments={appointments} chainStatus={chainStatus} onCompleteAppt={handleCompleteAppt} onReschedule={handleReschedule} />}
          {activeView === "patients"     && <PatientsView patients={patients} reports={reports} onShowToast={show} />}
          {activeView === "myprofile"    && <MyProfileView doctor={sessionDoctor} licenseVerification={licenseVerification} onLicenseVerify={handleLicenseVerifyRequest} />}
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </>
  );
}

export default DoctorDashboard;