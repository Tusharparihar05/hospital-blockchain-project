import { useState, useEffect } from "react";
import AvailabilityCalendar from "./AvailabilityCalendar";
import { useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// ── Auth helper ───────────────────────────────────────────────────────────────
function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:"#060b16", surface:"#0c1424", surfaceHi:"#101d30", border:"#172035",
  borderHi:"#1e2d48", teal:"#00c8a0", blue:"#3b82f6", purple:"#8b5cf6",
  amber:"#f59e0b", red:"#f43f5e", green:"#10b981", text:"#dde6f5",
  muted:"#4d6080", mutedHi:"#7a92b8",
};

function getSessionDoctorProfile() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u.role !== "doctor") return null;
    return u;
  } catch (_) { return null; }
}

function isoToday() { return new Date().toISOString().slice(0, 10); }
function isoTomorrow() { const d = new Date(); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }

function normalizeAppointment(a) {
  let status = String(a.status || "pending").trim().toLowerCase().replace(/\s+/g, "-");
  if (status === "reschedule-requested") status = "pending";
  return {
    ...a,
    id: String(a._id || a.id),
    patientName: a.patientName || "Patient",
    type: a.type || "Consultation",
    notes: a.notes || "",
    status,
    isEmergency: !!a.isEmergency,
    blockchain: a.blockchain || "",
  };
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
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, display:"flex", flexDirection:"column", gap:10 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: t.type==="error" ? `${C.red}18` : t.type==="info" ? `${C.blue}18` : `${C.green}18`, border:`1.5px solid ${t.type==="error"?C.red:t.type==="info"?C.blue:C.green}55`, borderRadius:12, padding:"13px 20px", fontSize:13, fontWeight:600, color:t.type==="error"?C.red:t.type==="info"?C.blue:C.green, boxShadow:"0 8px 24px #00000066", maxWidth:340 }}>{t.msg}</div>
      ))}
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Badge({ children, color=C.teal, size="sm" }) {
  return <span style={{ padding:size==="lg"?"4px 14px":"2px 10px", fontSize:size==="lg"?12:11, fontWeight:700, borderRadius:20, background:color+"1a", color, border:`1px solid ${color}33`, display:"inline-flex", alignItems:"center", gap:4, whiteSpace:"nowrap" }}>{children}</span>;
}
function StatusDot({ status }) {
  // StatusDot removed (online indicator not needed)
  return null;
}
function StarRating({ value }) {
  return <span style={{ display:"inline-flex", gap:1 }}>{[1,2,3,4,5].map(i=><span key={i} style={{ color:i<=Math.round(value)?C.amber:C.border, fontSize:11 }}>★</span>)}</span>;
}
function ApptStatusBadge({ status, isEmergency }) {
  if (isEmergency) return <Badge color={C.red}>🚨 Emergency</Badge>;
  const map={confirmed:{color:C.blue,label:"Confirmed"},"in-progress":{color:C.teal,label:"● In Progress"},pending:{color:C.amber,label:"Pending"},scheduled:{color:C.blue,label:"Scheduled"},completed:{color:C.green,label:"✓ Completed"}};
  const m=map[status]||{color:C.muted,label:status};
  return <Badge color={m.color}>{m.label}</Badge>;
}
const card={background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20};

// ── Doctor Profile Modal ──────────────────────────────────────────────────────
function DoctorProfileModal({ doc, onClose }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!doc) return null;

  // Remove statusColor and online indicator

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(4, 8, 15, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        animation: "fadeIn 0.18s ease",
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(32px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 700, maxHeight: "88vh",
          overflowY: "auto",
          background: C.surface,
          border: `1px solid ${C.teal}40`,
          borderRadius: 20,
          boxShadow: `0 32px 80px #000000cc, 0 0 0 1px ${C.teal}15`,
          animation: "slideUp 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Header banner */}
        <div style={{
          background: `linear-gradient(135deg, ${C.teal}20, ${C.blue}15, ${C.bg})`,
          borderBottom: `1px solid ${C.border}`,
          padding: "28px 28px 24px",
          position: "relative",
        }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 16, right: 16,
              width: 32, height: 32, borderRadius: 8,
              background: C.surfaceHi, border: `1px solid ${C.border}`,
              color: C.muted, fontSize: 16, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>

          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            {/* Avatar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 80, height: 80, borderRadius: 20,
                background: `${C.teal}20`,
                border: `3px solid ${C.teal}50`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 40,
              }}>👨‍⚕️</div>
              {/* Online status dot removed */}
            </div>

            {/* Identity */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                <h2 style={{ color: C.text, fontSize: 22, fontWeight: 800 }}>{doc.name}</h2>
              </div>
              <p style={{ color: C.teal, fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
                {doc.specialty || "General Practitioner"}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {doc.hospital && <Badge color={C.blue} size="lg">🏥 {doc.hospital}</Badge>}
                {doc.experience > 0 && <Badge color={C.purple} size="lg">⏱️ {doc.experience} yrs exp</Badge>}
                {doc.fee > 0 && <Badge color={C.green} size="lg">💰 ₹{doc.fee}</Badge>}
              </div>
            </div>
          </div>

          {/* Rating row */}
          {doc.rating > 0 && (
            <div style={{
              marginTop: 16, padding: "10px 14px",
              background: `${C.amber}0d`, border: `1px solid ${C.amber}25`,
              borderRadius: 10, display: "flex", alignItems: "center", gap: 10,
            }}>
              <StarRating value={doc.rating} />
              <span style={{ color: C.amber, fontWeight: 700, fontSize: 14 }}>{doc.rating}</span>
              <span style={{ color: C.muted, fontSize: 13 }}>· {doc.reviewCount} reviews</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Stats row */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
          }}>
            {[
              { icon: "💰", label: "Consultation Fee", value: doc.fee ? `₹${doc.fee}` : "—", color: C.green },
              { icon: "⏱️", label: "Experience", value: doc.experience ? `${doc.experience} years` : "—", color: C.purple },
              { icon: "🗓️", label: "Available Slots", value: `${(doc.availability || []).length} today`, color: C.teal },
            ].map(s => (
              <div key={s.label} style={{
                padding: "14px 16px", borderRadius: 12,
                background: C.surfaceHi, border: `1px solid ${C.border}`,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
                <p style={{ color: s.color, fontSize: 18, fontWeight: 800, fontFamily: "monospace" }}>{s.value}</p>
                <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Bio */}
          {doc.bio && (
            <div style={{ padding: 16, background: C.surfaceHi, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📝 About</p>
              <p style={{ color: C.text, fontSize: 14, lineHeight: 1.7 }}>{doc.bio}</p>
            </div>
          )}

          {/* Education & Hospital */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "🎓 Education", value: doc.education || "—" },
              { label: "🏥 Hospital / Clinic", value: doc.hospital || "—" },
              { label: "📱 Phone", value: doc.phone || "—" },
              { label: "📧 Email", value: doc.email || "—" },
            ].map(r => (
              <div key={r.label} style={{
                padding: "12px 14px", borderRadius: 10,
                background: C.surfaceHi, border: `1px solid ${C.border}`,
              }}>
                <p style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>{r.label}</p>
                <p style={{ color: C.text, fontSize: 13, fontWeight: 600, wordBreak: "break-word" }}>{r.value}</p>
              </div>
            ))}
          </div>

          {/* Availability */}
          {(doc.availability || []).length > 0 && (
            <div style={{ padding: 16, background: `${C.teal}08`, borderRadius: 12, border: `1px solid ${C.teal}25` }}>
              <p style={{ color: C.teal, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🕐 Available Slots</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(doc.availability || []).map(s => (
                  <Badge key={s} color={C.teal} size="lg">⏰ {s}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Languages */}
          {(doc.languages || []).length > 0 && (
            <div>
              <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🌐 Languages</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {(doc.languages || []).map(l => <Badge key={l} color={C.blue} size="lg">{l}</Badge>)}
              </div>
            </div>
          )}

          {/* Tags / Specializations */}
          {(doc.tags || []).length > 0 && (
            <div>
              <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🩺 Conditions Treated</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {(doc.tags || []).map(t => <Badge key={t} color={C.purple} size="lg">{t}</Badge>)}
              </div>
            </div>
          )}

          {/* License / Blockchain */}
          {(doc.licenseNumber || doc.walletAddress) && (
            <div style={{ padding: 14, background: `${C.purple}08`, borderRadius: 12, border: `1px solid ${C.purple}25` }}>
              <p style={{ color: C.purple, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>⛓️ Verification</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {doc.licenseNumber && (
                  <div style={{ padding: "8px 12px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <p style={{ color: C.muted, fontSize: 10, marginBottom: 2 }}>License #</p>
                    <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{doc.licenseNumber}</p>
                  </div>
                )}
                {doc.licenseVerified && (
                  <Badge color={C.green} size="lg">✅ License Verified</Badge>
                )}
                {doc.walletAddress && (
                  <div style={{ padding: "8px 12px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <p style={{ color: C.muted, fontSize: 10, marginBottom: 2 }}>Wallet</p>
                    <p style={{ color: C.teal, fontSize: 12, fontFamily: "monospace" }}>
                      {doc.walletAddress.slice(0, 6)}…{doc.walletAddress.slice(-4)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({ activeView, setActiveView, doctor, onLogout }) {
  const nav=[{key:"overview",icon:"⚡",label:"Overview"},{key:"doctors",icon:"👨‍⚕️",label:"Doctors"},{key:"appointments",icon:"📅",label:"Appointments"},{key:"patients",icon:"🔍",label:"Patients"},{key:"myprofile",icon:"🪪",label:"My Profile"}];
  return (
    <div style={{ background:"#04080f99", backdropFilter:"blur(20px)", borderBottom:`1px solid ${C.border}`, padding:"0 28px", height:64, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg, ${C.teal}, ${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>⛓️</div>
        <div><div style={{ color:C.text, fontWeight:800, fontSize:15, fontFamily:"monospace" }}>MediChain</div><div style={{ color:C.muted, fontSize:10, letterSpacing:1 }}>DOCTOR PORTAL</div></div>
      </div>
      <div style={{ display:"flex", gap:2 }}>
        {nav.map(n=>(
          <button key={n.key} onClick={()=>setActiveView(n.key)} style={{ padding:"7px 13px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontFamily:"inherit", display:"flex", alignItems:"center", gap:5, background:activeView===n.key?`${C.teal}18`:"transparent", color:activeView===n.key?C.teal:C.mutedHi, fontWeight:activeView===n.key?700:400, borderBottom:activeView===n.key?`2px solid ${C.teal}`:"2px solid transparent" }}>
            <span style={{ fontSize:14 }}>{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 12px", borderRadius:10, background:C.surfaceHi, border:`1px solid ${C.borderHi}` }}>
          <span style={{ fontSize:20 }}>👨‍⚕️</span>
          <div>
            <p style={{ color:C.text, fontSize:13, fontWeight:600, lineHeight:1 }}>{doctor?.name || "Doctor"}</p>
            <p style={{ color:C.muted, fontSize:11 }}>{doctor?.specialty || "General"}</p>
          </div>
        </div>
        <button type="button" onClick={onLogout} style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:13, cursor:"pointer" }}>Logout</button>
      </div>
    </div>
  );
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
function OverviewView({ appointments, patients, reports, loadingAppts, chainStatus, onCompleteAppt, onReschedule, setActiveView, doctor }) {
  const todayStr = isoToday();
  const todayAppts = appointments.filter(a => a.date === todayStr);
  const emergencyCount = appointments.filter(a => a.isEmergency).length;
  const doc = doctor || {};

  return (
    <div>
      <div style={{ borderRadius:16, padding:"26px 32px", marginBottom:24, background:`linear-gradient(120deg, ${C.teal}18, ${C.blue}10, ${C.bg})`, border:`1px solid ${C.teal}30`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <p style={{ color:C.muted, fontSize:13, marginBottom:4 }}>Good morning,</p>
          <h1 style={{ color:C.text, fontSize:24, fontWeight:800, marginBottom:10 }}>{doc.name} 👋</h1>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <Badge color={C.teal} size="lg">🏥 {doc.hospital || "Hospital not set"}</Badge>
            <Badge color={C.blue} size="lg">🩺 {doc.specialty || "Specialty not set"}</Badge>
            {doc.rating > 0 && <Badge color={C.amber} size="lg">⭐ {doc.rating} ({doc.reviewCount} reviews)</Badge>}
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <p style={{ color:C.muted, fontSize:12, marginBottom:4 }}>Today</p>
          <p style={{ color:C.teal, fontSize:42, fontWeight:800, fontFamily:"monospace", lineHeight:1 }}>{todayAppts.length}</p>
          <p style={{ color:C.muted, fontSize:13 }}>appointments</p>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        {[
          { label:"Today's Appointments", value:loadingAppts?"…":todayAppts.length,   icon:"📅", color:C.teal },
          { label:"Total Patients",        value:loadingAppts?"…":patients.length,     icon:"👥", color:C.blue },
          { label:"Reports Submitted",     value:loadingAppts?"…":reports.length,      icon:"📋", color:C.purple },
          { label:"Emergency Cases",       value:loadingAppts?"…":emergencyCount,       icon:"🚨", color:C.red },
        ].map(s=>(
          <div key={s.label} style={{ ...card, border:s.color===C.red&&emergencyCount>0?`1px solid ${C.red}44`:`1px solid ${C.border}`, background:s.color===C.red&&emergencyCount>0?`${C.red}08`:C.surface }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div><p style={{ color:C.muted, fontSize:12, marginBottom:6 }}>{s.label}</p><p style={{ color:s.color, fontSize:30, fontWeight:800, fontFamily:"monospace" }}>{s.value}</p></div>
              <span style={{ fontSize:28 }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 310px", gap:20 }}>
        <div style={card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div><h3 style={{ color:C.text, fontWeight:700, fontSize:16 }}>📅 Today's Appointments</h3><p style={{ color:C.muted, fontSize:13 }}>{loadingAppts?"Loading...":`${todayAppts.length} scheduled`}</p></div>
            <button onClick={()=>setActiveView("appointments")} style={{ fontSize:13, color:C.teal, background:`${C.teal}15`, border:`1px solid ${C.teal}30`, padding:"6px 12px", borderRadius:8, cursor:"pointer" }}>View All →</button>
          </div>
          {loadingAppts ? <p style={{ color:C.muted, fontSize:13, textAlign:"center", padding:"24px 0" }}>Loading...</p>
          : todayAppts.length===0 ? <div style={{ textAlign:"center", padding:"32px 0", color:C.muted }}><div style={{ fontSize:32, marginBottom:8 }}>📭</div><p>No appointments today</p></div>
          : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {todayAppts.map(appt=>(
                <div key={appt.id} style={{ padding:"13px 15px", borderRadius:12, border:`1px solid ${appt.isEmergency?C.red+"55":C.border}`, background:appt.isEmergency?`${C.red}07`:C.surfaceHi }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ minWidth:68, textAlign:"center", padding:"7px 4px", background:C.bg, borderRadius:8, border:`1px solid ${C.border}` }}>
                      <p style={{ color:C.teal, fontSize:12, fontWeight:700, fontFamily:"monospace" }}>{appt.time}</p>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                        <p style={{ color:C.text, fontWeight:600, fontSize:14 }}>{appt.patientName}</p>
                        {appt.age && <span style={{ color:C.muted, fontSize:12 }}>· {appt.age}y</span>}
                        <Badge color={C.blue}>{appt.type}</Badge>
                      </div>
                      <p style={{ color:C.muted, fontSize:12 }}>{appt.notes || appt.specialty}</p>
                      {chainStatus[appt.id]==="done" && <p style={{ color:C.green, fontSize:11, marginTop:4 }}>🔗 Token minted on blockchain</p>}
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                      <ApptStatusBadge status={appt.status} isEmergency={appt.isEmergency}/>
                      <div style={{ display:"flex", gap:6 }}>
                        <button onClick={()=>onReschedule(appt)} style={{ fontSize:11, padding:"4px 10px", borderRadius:6, cursor:"pointer", background:"transparent", border:`1px solid ${C.border}`, color:C.mutedHi }}>↺ Reschedule</button>
                        <button onClick={()=>onCompleteAppt(appt)} disabled={chainStatus[appt.id]==="minting"||appt.status==="completed"} style={{ fontSize:11, padding:"4px 10px", borderRadius:6, cursor:"pointer", border:"none", background:appt.status==="completed"?`${C.green}22`:`linear-gradient(135deg,${C.teal},${C.blue})`, color:appt.status==="completed"?C.green:"#fff", fontWeight:600 }}>
                          {chainStatus[appt.id]==="minting"?"⛓️ Minting…":appt.status==="completed"?"✓ Done":"✓ Complete"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={card}>
            <h3 style={{ color:C.text, fontWeight:700, fontSize:14, marginBottom:14 }}>🗓️ My Availability</h3>
            {(doc.availability||[]).length === 0
              ? <p style={{ color:C.muted, fontSize:13 }}>No slots set — edit your profile to add availability slots.</p>
              : (doc.availability||[]).map(slot=>(
                <div key={slot} style={{ padding:"6px 10px", background:`${C.teal}10`, border:`1px solid ${C.teal}25`, borderRadius:8, marginBottom:6 }}>
                  <span style={{ color:C.teal, fontSize:13, fontWeight:600 }}>🕐 {slot}</span>
                </div>
              ))
            }
          </div>
          <div style={card}>
            <h3 style={{ color:C.text, fontWeight:700, fontSize:14, marginBottom:14 }}>⚡ Recent Activity</h3>
            {appointments.slice(0,3).map((a,i)=>(
              <div key={i} style={{ display:"flex", gap:10, padding:"10px 12px", background:`${C.teal}0d`, borderRadius:10, marginBottom:8, border:`1px solid ${C.teal}20` }}>
                <span style={{ fontSize:15 }}>📅</span>
                <div>
                  <p style={{ color:C.text, fontSize:13, fontWeight:600, marginBottom:2 }}>{a.patientName}</p>
                  <p style={{ color:C.muted, fontSize:12 }}>{a.date} · {a.time}</p>
                </div>
              </div>
            ))}
            {appointments.length===0 && <p style={{ color:C.muted, fontSize:13 }}>No recent appointments.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DOCTOR DIRECTORY ──────────────────────────────────────────────────────────
function DoctorsView({ allDoctors }) {
  const [search, setSearch]         = useState("");
  const [filterSpec, setFilterSpec] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortBy, setSortBy]         = useState("rating");
  const [selectedDoc, setSelectedDoc] = useState(null); // ← profile modal state

  const specialties = ["All", ...new Set((allDoctors||[]).map(d=>d.specialty).filter(Boolean))];
  const q = search.toLowerCase();
  const filtered = (allDoctors||[])
    .filter(d=>{
      const ms=(d.name||"").toLowerCase().includes(q)||(d.specialty||"").toLowerCase().includes(q)||(d.hospital||"").toLowerCase().includes(q);
      const msp=filterSpec==="All"||d.specialty===filterSpec;
      const mst=filterStatus==="All"||d.status===filterStatus;
      return ms&&msp&&mst;
    })
    .sort((a,b)=>{
      if(sortBy==="rating") return (b.rating||0)-(a.rating||0);
      if(sortBy==="experience") return (b.experience||0)-(a.experience||0);
      return (b.patients||0)-(a.patients||0);
    });

  return (
    <div>
      {/* Profile modal */}
      {selectedDoc && (
        <DoctorProfileModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
      )}

      <div style={{ marginBottom:20 }}>
        <h2 style={{ color:C.text, fontSize:22, fontWeight:800, marginBottom:4 }}>👨‍⚕️ Doctor Directory</h2>
        <p style={{ color:C.muted, fontSize:14 }}>{filtered.length} of {(allDoctors||[]).length} doctors · <span style={{ color:C.teal }}>Click any card to view full profile</span></p>
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, specialty, hospital..." style={{ flex:1, minWidth:240, padding:"10px 16px", borderRadius:10, fontSize:14, background:C.surface, border:`1px solid ${C.borderHi}`, color:C.text, outline:"none" }}/>
        <select value={filterSpec} onChange={e=>setFilterSpec(e.target.value)} style={{ padding:"10px 12px", borderRadius:10, fontSize:13, background:C.surface, border:`1px solid ${C.borderHi}`, color:C.text, outline:"none", cursor:"pointer" }}>
          {specialties.map(o=><option key={o}>{o}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ padding:"10px 12px", borderRadius:10, fontSize:13, background:C.surface, border:`1px solid ${C.borderHi}`, color:C.text, outline:"none", cursor:"pointer" }}>
          {["All","online","busy","offline"].map(o=><option key={o}>{o}</option>)}
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ padding:"10px 12px", borderRadius:10, fontSize:13, background:C.surface, border:`1px solid ${C.borderHi}`, color:C.text, outline:"none", cursor:"pointer" }}>
          {["rating","experience","patients"].map(o=><option key={o}>{o}</option>)}
        </select>
      </div>

      {filtered.length===0 && <div style={{ textAlign:"center", padding:48, color:C.muted }}><div style={{ fontSize:32, marginBottom:8 }}>😶</div><p>No doctors found</p></div>}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:16 }}>
        {filtered.map((doc)=>{
          const dk = doc.id||doc._id||doc.name;
          const docColor = C.teal;
          return (
            <div
              key={dk}
              onClick={() => setSelectedDoc(doc)}
              style={{
                borderRadius:14, border:`1px solid ${C.border}`,
                background:C.surface, overflow:"hidden",
                cursor:"pointer",
                transition:"border-color 0.15s, box-shadow 0.15s, transform 0.15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${C.teal}60`;
                e.currentTarget.style.boxShadow = `0 8px 32px #00000055, 0 0 0 1px ${C.teal}20`;
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ padding:"18px 20px", display:"flex", gap:14, alignItems:"flex-start" }}>
                <div style={{ position:"relative" }}>
                  <div style={{ width:56, height:56, borderRadius:14, background:`${docColor}20`, border:`2px solid ${docColor}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>👨‍⚕️</div>
                  {/* Online status dot removed */}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <p style={{ color:C.text, fontWeight:700, fontSize:15, marginBottom:2 }}>{doc.name}</p>
                      <p style={{ color:docColor, fontSize:13, fontWeight:600, marginBottom:4 }}>{doc.specialty||"General"}</p>
                    </div>
                    {/* StatusDot removed */}
                  </div>
                  {doc.rating>0 && <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}><StarRating value={doc.rating}/><span style={{ color:C.amber, fontSize:13, fontWeight:700 }}>{doc.rating}</span><span style={{ color:C.muted, fontSize:12 }}>({doc.reviewCount})</span></div>}
                  <p style={{ color:C.mutedHi, fontSize:12 }}>🏥 {doc.hospital||"—"} · {doc.experience} yrs</p>
                </div>
              </div>
              <div style={{ display:"flex", borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, background:C.surfaceHi }}>
                {[{label:"Fee",val:`₹${doc.fee}`,color:C.green},{label:"Slots",val:`${(doc.availability||[]).length} today`,color:C.teal},{label:"Experience",val:`${doc.experience} yrs`,color:C.purple}].map((s,i)=>(
                  <div key={s.label} style={{ flex:1, padding:"10px 0", textAlign:"center", borderRight:i<2?`1px solid ${C.border}`:"none" }}>
                    <p style={{ color:s.color, fontSize:14, fontWeight:700, fontFamily:"monospace" }}>{s.val}</p>
                    <p style={{ color:C.muted, fontSize:11 }}>{s.label}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding:"10px 16px", display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {(doc.languages||[]).map(l=><Badge key={l} color={docColor}>🌐 {l}</Badge>)}
                  {(doc.languages||[]).length===0 && <span style={{ color:C.muted, fontSize:12 }}>No languages set</span>}
                </div>
                {/* "View Profile" hint */}
                <span style={{ fontSize:11, color:C.teal, fontWeight:600, opacity:0.7 }}>View Profile →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── APPOINTMENTS ──────────────────────────────────────────────────────────────
function AppointmentsView({ appointments, chainStatus, onCompleteAppt, onReschedule }) {
  const [filterDate, setFilterDate] = useState("today");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedApt, setSelectedApt] = useState(null);
  const todayStr=isoToday(), tomorrowStr=isoTomorrow();

  const filtered = appointments.filter(a=>{
    const matchDate=filterDate==="all"?true:filterDate==="today"?a.date===todayStr:filterDate==="tomorrow"?a.date===tomorrowStr:filterDate==="past"?a.date<todayStr:true;
    const matchStatus=filterStatus==="all"?true:filterStatus==="emergency"?a.isEmergency:filterStatus==="scheduled"?(a.status==="scheduled"||a.status==="confirmed"):a.status===filterStatus;
    const matchSearch=(a.patientName||"").toLowerCase().includes(search.toLowerCase())||(a.type||"").toLowerCase().includes(search.toLowerCase());
    return matchDate&&matchStatus&&matchSearch;
  });

  // Add refresh button state
  const [refreshing, setRefreshing] = useState(false);
  // Handler for manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    window.dispatchEvent(new Event('focus'));
    setTimeout(() => setRefreshing(false), 1000);
  };
  return (
    <div>
      <div style={{ marginBottom:22, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h2 style={{ color:C.text, fontSize:22, fontWeight:800, marginBottom:4 }}>📅 Appointments</h2>
          <p style={{ color:C.muted, fontSize:14 }}>Total: {appointments.length}</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} style={{ padding:'7px 16px', borderRadius:8, border:`1px solid ${C.teal}55`, background:refreshing?C.mutedHi:`${C.teal}15`, color:C.teal, fontWeight:700, fontSize:13, cursor:refreshing?'not-allowed':'pointer' }}>{refreshing ? 'Refreshing...' : 'Refresh'}</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:22 }}>
        {[{label:"Today",value:appointments.filter(a=>a.date===todayStr).length,color:C.teal,icon:"📅"},{label:"Emergencies",value:appointments.filter(a=>a.isEmergency).length,color:C.red,icon:"🚨"},{label:"Pending",value:appointments.filter(a=>a.status==="pending"||a.status==="confirmed").length,color:C.amber,icon:"⏳"},{label:"Completed",value:appointments.filter(a=>a.status==="completed").length,color:C.green,icon:"✅"}].map(s=>(
          <div key={s.label} style={{ ...card, padding:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div><p style={{ color:C.muted, fontSize:12, marginBottom:4 }}>{s.label}</p><p style={{ color:s.color, fontSize:26, fontWeight:800, fontFamily:"monospace" }}>{s.value}</p></div>
            <span style={{ fontSize:22 }}>{s.icon}</span>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search patient or type..." style={{ flex:1, minWidth:200, padding:"9px 14px", borderRadius:9, fontSize:13, background:C.surface, border:`1px solid ${C.borderHi}`, color:C.text, outline:"none" }}/>
        <div style={{ display:"flex", gap:3, background:C.surface, padding:4, borderRadius:10, border:`1px solid ${C.border}` }}>
          {["today","tomorrow","past","all"].map(d=>(
            <button key={d} onClick={()=>setFilterDate(d)} style={{ padding:"5px 12px", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontFamily:"inherit", background:filterDate===d?C.surfaceHi:"transparent", color:filterDate===d?C.teal:C.muted, fontWeight:filterDate===d?700:400 }}>{d.charAt(0).toUpperCase()+d.slice(1)}</button>
          ))}
        </div>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ padding:"9px 12px", borderRadius:9, fontSize:13, background:C.surface, border:`1px solid ${C.borderHi}`, color:C.text, outline:"none", cursor:"pointer" }}>
          {["all","confirmed","in-progress","pending","completed","emergency"].map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 330px", gap:20 }}>
        <div style={card}>
          <p style={{ color:C.muted, fontSize:13, marginBottom:14 }}>Showing <strong style={{ color:C.text }}>{filtered.length}</strong> appointments</p>
          {filtered.length===0
            ? <div style={{ textAlign:"center", padding:40, color:C.muted }}><div style={{ fontSize:32, marginBottom:8 }}>📭</div><p>No appointments found</p></div>
            : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {filtered.map(apt=>(
                  <div key={apt.id} onClick={()=>setSelectedApt(selectedApt?.id===apt.id?null:apt)} style={{ padding:"13px 15px", borderRadius:12, cursor:"pointer", border:`1px solid ${selectedApt?.id===apt.id?C.teal:apt.isEmergency?C.red+"55":C.border}`, background:selectedApt?.id===apt.id?`${C.teal}08`:apt.isEmergency?`${C.red}06`:C.surfaceHi }}>
                    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                      <div style={{ minWidth:68, textAlign:"center", padding:"7px 4px", background:C.bg, borderRadius:8, border:`1px solid ${C.border}` }}>
                        <p style={{ color:C.teal, fontSize:12, fontWeight:700, fontFamily:"monospace" }}>{apt.time}</p>
                        <p style={{ color:C.muted, fontSize:10 }}>{apt.date}</p>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                          <p style={{ color:C.text, fontWeight:600, fontSize:14 }}>{apt.patientName}</p>
                          <Badge color={C.blue}>{apt.type}</Badge>
                        </div>
                        <p style={{ color:C.muted, fontSize:12 }}>{apt.notes}</p>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:5, alignItems:"flex-end" }}>
                        <ApptStatusBadge status={apt.status} isEmergency={apt.isEmergency}/>
                        {apt.status!=="completed" && (
                          <div style={{ display:"flex", gap:5 }}>
                            <button onClick={e=>{e.stopPropagation();onReschedule(apt);}} style={{ fontSize:10, padding:"3px 8px", borderRadius:5, cursor:"pointer", background:"transparent", border:`1px solid ${C.border}`, color:C.mutedHi }}>↺</button>
                            <button onClick={e=>{e.stopPropagation();onCompleteAppt(apt);}} disabled={chainStatus[apt.id]==="minting"} style={{ fontSize:10, padding:"3px 8px", borderRadius:5, cursor:"pointer", border:"none", background:`linear-gradient(135deg,${C.teal},${C.blue})`, color:"#fff", fontWeight:700 }}>
                              {chainStatus[apt.id]==="minting"?"⛓️…":"✓"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
        <div style={card}>
          {selectedApt
            ? <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <h3 style={{ color:C.text, fontWeight:700, fontSize:15 }}>Appointment Detail</h3>
                  <button onClick={()=>setSelectedApt(null)} style={{ fontSize:13, color:C.muted, background:"transparent", border:"none", cursor:"pointer" }}>✕</button>
                </div>
                <div style={{ padding:14, background:C.surfaceHi, borderRadius:10, border:`1px solid ${C.border}`, marginBottom:16 }}>
                  <p style={{ color:C.text, fontWeight:700, fontSize:15 }}>{selectedApt.patientName}</p>
                  <p style={{ color:C.muted, fontSize:13 }}>{selectedApt.type}</p>
                </div>
                {[{label:"Date",value:selectedApt.date},{label:"Time",value:selectedApt.time},{label:"Type",value:selectedApt.type},{label:"Priority",value:selectedApt.isEmergency?"🚨 Emergency":"Standard"},{label:"Status",value:selectedApt.status}].map(r=>(
                  <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ color:C.muted, fontSize:13 }}>{r.label}</span>
                    <span style={{ color:C.text, fontSize:13, fontWeight:600 }}>{r.value}</span>
                  </div>
                ))}
                {selectedApt.notes && <div style={{ margin:"14px 0", padding:12, background:C.surfaceHi, borderRadius:10 }}><p style={{ color:C.muted, fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Notes</p><p style={{ color:C.text, fontSize:13, lineHeight:1.5 }}>{selectedApt.notes}</p></div>}
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:14 }}>
                  {selectedApt.status!=="completed" && <button onClick={()=>onCompleteAppt(selectedApt)} disabled={chainStatus[selectedApt.id]==="minting"} style={{ padding:"10px", borderRadius:8, border:`1px solid ${C.green}`, cursor:"pointer", fontSize:13, fontFamily:"inherit", background:`${C.green}15`, color:C.green, fontWeight:600 }}>{chainStatus[selectedApt.id]==="minting"?"⛓️ Minting...":"✓ Mark Complete"}</button>}
                  <button onClick={()=>onReschedule(selectedApt)} style={{ padding:"10px", borderRadius:8, border:`1px solid ${C.border}`, cursor:"pointer", fontSize:13, fontFamily:"inherit", background:"transparent", color:C.mutedHi }}>↺ Reschedule</button>
                </div>
              </div>
            : <div style={{ textAlign:"center", padding:48, color:C.muted }}><div style={{ fontSize:34, marginBottom:10 }}>👆</div><p style={{ fontSize:14 }}>Select an appointment to view details</p></div>
          }
        </div>
      </div>
    </div>
  );
}

// ── PATIENTS ──────────────────────────────────────────────────────────────────
function PatientsView({ patients, reports, onShowToast }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);

  const sq = searchQuery.toLowerCase();
  const filtered = (patients||[]).filter(p =>
    !sq ||
    (p.name||"").toLowerCase().includes(sq) ||
    (p.patientId||p.id||"").toLowerCase().includes(sq) ||
    (p.email||"").toLowerCase().includes(sq) ||
    String(p.phone||"").includes(searchQuery)
  );
  const selectedData = (patients||[]).find(p => (p._id||p.id) === selectedPatient);
  const patientReports = (reports||[]).filter(r => r.patientId === selectedPatient || r.patientStrId === selectedPatient);

  return (
    <div>
      <div style={{ marginBottom:22 }}>
        <h2 style={{ color:C.text, fontSize:22, fontWeight:800, marginBottom:4 }}>🔍 Patient Search</h2>
        <p style={{ color:C.muted, fontSize:14 }}>{(patients||[]).length} patients in database</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:20 }}>
        <div style={card}>
          <div style={{ position:"relative", marginBottom:16 }}>
            <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:16, color:C.muted }}>🔍</span>
            <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search by name, patient ID, email, or phone..." style={{ width:"100%", padding:"11px 14px 11px 38px", borderRadius:10, fontSize:14, background:C.surfaceHi, border:`1px solid ${C.borderHi}`, color:C.text, outline:"none", boxSizing:"border-box" }}/>
          </div>
          {filtered.length===0
            ? <div style={{ textAlign:"center", padding:"32px 0", color:C.muted }}><div style={{ fontSize:28, marginBottom:8 }}>😶</div><p>{searchQuery?"No patients found":"Type to search patients"}</p><p style={{ fontSize:13, marginTop:4 }}>{patients.length} patients total</p></div>
            : <div style={{ maxHeight:500, overflowY:"auto" }}>
                {filtered.map(p=>{
                  const pid = String(p._id||p.id);
                  return (
                    <div key={pid} onClick={()=>setSelectedPatient(pid)} style={{ padding:"13px 14px", borderRadius:10, cursor:"pointer", marginBottom:8, border:`1px solid ${selectedPatient===pid?C.teal:C.border}`, background:selectedPatient===pid?`${C.teal}08`:C.surfaceHi, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <p style={{ color:C.text, fontWeight:600, fontSize:14 }}>{p.name}</p>
                          <Badge color={C.blue}>{p.patientId||p.id}</Badge>
                        </div>
                        <p style={{ color:C.muted, fontSize:12, marginTop:3 }}>
                          {p.age!=null?`${p.age} yrs · `:""}
                          {p.gender||"—"}
                          {p.phone?` · ${p.phone}`:""}
                          {p.email?` · ${p.email}`:""}
                        </p>
                      </div>
                      <span style={{ color:C.muted, fontSize:16 }}>›</span>
                    </div>
                  );
                })}
              </div>
          }
        </div>
        <div style={card}>
          {selectedData
            ? <div>
                <div style={{ textAlign:"center", padding:"16px 0 20px", borderBottom:`1px solid ${C.border}`, marginBottom:16 }}>
                  <div style={{ width:60, height:60, borderRadius:16, background:`${C.teal}20`, border:`2px solid ${C.teal}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 10px" }}>{selectedData.gender==="Female"?"👩":"👨"}</div>
                  <p style={{ color:C.text, fontWeight:700, fontSize:16, marginBottom:4 }}>{selectedData.name}</p>
                  <p style={{ color:C.muted, fontSize:13 }}>{selectedData.age!=null?`${selectedData.age} yrs · `:""}{selectedData.gender||"—"}</p>
                  {selectedData.phone && <p style={{ color:C.muted, fontSize:13 }}>{selectedData.phone}</p>}
                  {selectedData.email && <p style={{ color:C.muted, fontSize:12 }}>{selectedData.email}</p>}
                  <div style={{ marginTop:8 }}><Badge color={C.blue}>{selectedData.patientId||selectedData.id}</Badge></div>
                </div>
                <h4 style={{ color:C.text, fontWeight:700, fontSize:14, marginBottom:12 }}>📋 Health Reports</h4>
                {patientReports.length===0
                  ? <div style={{ textAlign:"center", padding:"24px 0", color:C.muted }}><div style={{ fontSize:28, marginBottom:8 }}>📂</div><p>No reports found</p></div>
                  : patientReports.map((r,i)=>(
                      <div key={r.id||i} style={{ display:"flex", gap:12, padding:"12px 0", borderBottom:i<patientReports.length-1?`1px solid ${C.border}`:"none", alignItems:"flex-start" }}>
                        <div style={{ width:36, height:36, borderRadius:8, background:`${C.blue}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>📄</div>
                        <div>
                          <Badge color={C.purple}>{r.category}</Badge>
                          <p style={{ color:C.text, fontSize:13, fontWeight:600, marginTop:4 }}>{r.fileName}</p>
                          <p style={{ color:C.muted, fontSize:11, marginTop:2 }}>{r.uploadDate}</p>
                          {r.ipfsUrl && <a href={r.ipfsUrl} target="_blank" rel="noreferrer" style={{ color:C.teal, fontSize:11, marginTop:2, display:"block" }}>🌐 View on IPFS</a>}
                          {r.anchoredOnChain && <p style={{ color:C.teal, fontSize:10, marginTop:2 }}>⛓️ Blockchain verified</p>}
                        </div>
                      </div>
                    ))
                }
              </div>
            : <div style={{ textAlign:"center", padding:48, color:C.muted }}><div style={{ fontSize:36, marginBottom:12 }}>👆</div><p style={{ fontSize:14 }}>Select a patient to view details</p></div>
          }
        </div>
      </div>
    </div>
  );
}

// ── MY PROFILE ────────────────────────────────────────────────────────────────
function MyProfileView({ doctor: doc, onUpdateProfile, licenseVerification, onLicenseVerify, onShowToast }) {
  const [editMode, setEditMode]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const [bio, setBio]             = useState(doc.bio||"");
  const [hospital, setHospital]   = useState(doc.hospital||"");
  const [education, setEducation] = useState(doc.education||"");
  const [experience, setExperience] = useState(doc.experience||0);
  const [fee, setFee]             = useState(doc.fee||500);
  const [specialty, setSpecialty] = useState(doc.specialty||"");
  const [phone, setPhone]         = useState(doc.phone||"");
  // Removed slotsInput, will use calendar-based availability
  const [availability, setAvailability] = useState(doc.availabilityMap || {});
  const [languagesInput, setLanguagesInput] = useState((doc.languages||[]).join(", "));
  const [tagsInput, setTagsInput] = useState((doc.tags||[]).join(", "));

  useEffect(()=>{
    setBio(doc.bio||""); setHospital(doc.hospital||""); setEducation(doc.education||"");
    setExperience(doc.experience||0); setFee(doc.fee||500); setSpecialty(doc.specialty||"");
    setPhone(doc.phone||"");
    setLanguagesInput((doc.languages||[]).join(", ")); setTagsInput((doc.tags||[]).join(", "));
  }, [doc._id||doc.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const id = doc._id || doc.id;
      if (!id || id==="USR-LOCAL") { onShowToast("Cannot save — not logged in with real account", "error"); setSaving(false); return; }
      // Flatten availability map to array of strings for legacy support
      const flatAvailability = Object.entries(availability)
        .flatMap(([date, slots]) => slots.map(slot => `${date} ${slot}`));
      const payload = {
        bio, hospital, education,
        experience: Number(experience),
        fee: Number(fee),
        specialty, phone,
        availability: flatAvailability,
        availabilityMap: availability,
        languages:    languagesInput.split(",").map(s=>s.trim()).filter(Boolean),
        tags:         tagsInput.split(",").map(s=>s.trim()).filter(Boolean),
      };
      const res = await fetch(`${API}/doctors/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      const stored = JSON.parse(localStorage.getItem("user")||"{}");
      localStorage.setItem("user", JSON.stringify({ ...stored, ...payload }));
      onUpdateProfile({ ...doc, ...payload });
      setEditMode(false);
      onShowToast("✅ Profile updated successfully!");
    } catch (err) {
      onShowToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { width:"100%", padding:"10px 12px", borderRadius:10, fontSize:13, background:C.bg, border:`1px solid ${C.teal}50`, color:C.text, outline:"none", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div><h2 style={{ color:C.text, fontSize:22, fontWeight:800, marginBottom:4 }}>🪪 My Profile</h2><p style={{ color:C.muted, fontSize:14 }}>Manage your professional information</p></div>
        {editMode
          ? <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setEditMode(false)} style={{ padding:"9px 18px", borderRadius:9, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:"transparent", border:`1px solid ${C.border}`, color:C.muted }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding:"9px 18px", borderRadius:9, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:`linear-gradient(135deg,${C.teal},${C.blue})`, border:"none", color:"#fff" }}>{saving?"Saving...":"💾 Save Changes"}</button>
            </div>
          : <button onClick={()=>setEditMode(true)} style={{ padding:"9px 18px", borderRadius:9, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:`${C.teal}15`, border:`1px solid ${C.teal}40`, color:C.teal }}>✏️ Edit Profile</button>
        }
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", gap:20 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ ...card, textAlign:"center" }}>
            <div style={{ width:80, height:80, borderRadius:18, margin:"0 auto 12px", background:`${C.teal}20`, border:`3px solid ${C.teal}50`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:40 }}>👨‍⚕️</div>
            <p style={{ color:C.text, fontWeight:800, fontSize:17, marginBottom:3 }}>{doc.name}</p>
            <p style={{ color:C.teal, fontWeight:600, fontSize:13, marginBottom:10 }}>{doc.specialty||"Specialty not set"}</p>
            {/* StatusDot removed */}
            {doc.rating>0 && <div style={{ marginTop:12 }}><StarRating value={doc.rating}/><p style={{ color:C.muted, fontSize:12, marginTop:4 }}>({doc.reviewCount} reviews)</p></div>}
          </div>
          <div style={card}>
            <h4 style={{ color:C.text, fontWeight:700, fontSize:14, marginBottom:12 }}>📞 Contact</h4>
            <p style={{ color:C.mutedHi, fontSize:13, marginBottom:8 }}>📧 {doc.email||"—"}</p>
            <p style={{ color:C.mutedHi, fontSize:13, marginBottom:8 }}>📱 {doc.phone||"Not set"}</p>
            <p style={{ color:C.mutedHi, fontSize:13 }}>🏥 {doc.hospital||"Not set"}</p>
          </div>
          <div style={card}>
            <h4 style={{ color:C.text, fontWeight:700, fontSize:14, marginBottom:10 }}>🪪 Account</h4>
            <p style={{ color:C.muted, fontSize:11, marginBottom:4 }}>MongoDB ID</p>
            <p style={{ color:C.teal, fontSize:12, fontFamily:"monospace", wordBreak:"break-all" }}>{doc._id||doc.id||"—"}</p>
            {doc.licenseNumber && <><p style={{ color:C.muted, fontSize:11, marginTop:10, marginBottom:4 }}>License #</p><p style={{ color:C.text, fontSize:13, fontWeight:600 }}>{doc.licenseNumber}</p></>}
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {editMode ? (
            <>
              <div style={card}>
                <h4 style={{ color:C.text, fontWeight:700, fontSize:15, marginBottom:16 }}>✏️ Edit Profile</h4>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                  {[
                    {label:"Specialty",    val:specialty,  set:setSpecialty},
                    {label:"Hospital",     val:hospital,   set:setHospital},
                    {label:"Experience (years)", val:experience, set:setExperience, type:"number"},
                    {label:"Fee (₹)",      val:fee,        set:setFee, type:"number"},
                    {label:"Phone",        val:phone,      set:setPhone},
                    {label:"Education",    val:education,  set:setEducation},
                  ].map(f=>(
                    <div key={f.label}>
                      <label style={{ color:C.muted, fontSize:11, display:"block", marginBottom:4 }}>{f.label}</label>
                      <input type={f.type||"text"} value={f.val} onChange={e=>f.set(e.target.value)} style={{ ...inputStyle, resize:"none" }}/>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:C.muted, fontSize:11, display:"block", marginBottom:4 }}>Professional Bio</label>
                  <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3} style={inputStyle}/>
                </div>
                <div style={{ marginBottom:18 }}>
                  <label style={{ color:C.muted, fontSize:11, display:"block", marginBottom:4 }}>Set Weekly/Monthly Availability</label>
                  <AvailabilityCalendar value={availability} onChange={setAvailability} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  {[{label:"Languages (comma-separated)", val:languagesInput, set:setLanguagesInput, hint:"e.g. English, Hindi"},
                    {label:"Conditions/Tags (comma-separated)", val:tagsInput, set:setTagsInput, hint:"e.g. Hypertension, Diabetes"}].map(f=>(
                    <div key={f.label}>
                      <label style={{ color:C.muted, fontSize:11, display:"block", marginBottom:4 }}>{f.label}</label>
                      <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.hint} style={{ ...inputStyle, resize:"none" }}/>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={card}>
                <h4 style={{ color:C.text, fontWeight:700, fontSize:15, marginBottom:12 }}>📝 Professional Bio</h4>
                <p style={{ color:doc.bio?C.text:C.muted, fontSize:14, lineHeight:1.7, background:C.bg, padding:14, borderRadius:10, border:`1px solid ${C.border}` }}>{doc.bio||"No bio set — click Edit Profile to add one."}</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                {[
                  {label:"🎓 Education",  value:doc.education||"Not set"},
                  {label:"🏥 Hospital",   value:doc.hospital||"Not set"},
                  {label:"⏱️ Experience", value:doc.experience?`${doc.experience} years`:"Not set"},
                  {label:"💰 Fee",        value:doc.fee?`₹${doc.fee}`:"Not set"},
                  {label:"📱 Phone",      value:doc.phone||"Not set"},
                  {label:"📜 License",    value:doc.licenseNumber||"Not set"},
                ].map(r=>(
                  <div key={r.label} style={card}><p style={{ color:C.muted, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:7 }}>{r.label}</p><p style={{ color:C.text, fontSize:14, fontWeight:600 }}>{r.value}</p></div>
                ))}
              </div>
              {(doc.availability||[]).length>0 && (
                <div style={card}>
                  <h4 style={{ color:C.text, fontWeight:700, fontSize:15, marginBottom:12 }}>🕐 Availability Slots</h4>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>{(doc.availability||[]).map(s=><Badge key={s} color={C.teal} size="lg">{s}</Badge>)}</div>
                </div>
              )}
              {(doc.languages||[]).length>0 && (
                <div style={card}>
                  <h4 style={{ color:C.text, fontWeight:700, fontSize:15, marginBottom:12 }}>🌐 Languages</h4>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>{(doc.languages||[]).map(l=><Badge key={l} color={C.blue} size="lg">{l}</Badge>)}</div>
                </div>
              )}
              {(doc.tags||[]).length>0 && (
                <div style={card}>
                  <h4 style={{ color:C.text, fontWeight:700, fontSize:15, marginBottom:12 }}>🩺 Conditions Treated</h4>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>{(doc.tags||[]).map(c=><Badge key={c} color={C.teal} size="lg">{c}</Badge>)}</div>
                </div>
              )}
            </>
          )}

          <div style={{ ...card, border:`1px solid ${C.purple}33`, background:`${C.purple}07` }}>
            <h4 style={{ color:C.text, fontWeight:700, fontSize:15, marginBottom:8 }}>📜 License Verification</h4>
            <p style={{ color:C.muted, fontSize:12, lineHeight:1.55, marginBottom:12 }}>Demo mode: any license matching format <code style={{ color:C.purple, fontSize:11 }}>MCI123456</code> (2–4 letters + 6+ digits) passes. In production, swap <code style={{ color:C.purple, fontSize:11 }}>verifyWithNMC()</code> in verification.js for a real NMC API call.</p>
            {licenseVerification?.status==="verified" && <p style={{ color:C.green, fontSize:13, fontWeight:600, marginBottom:8 }}>✅ Verified · {licenseVerification.issuer||"Demo Medical Council"}</p>}
            {licenseVerification?.status==="rejected" && <p style={{ color:C.red, fontSize:13, marginBottom:8 }}>❌ Rejected: {licenseVerification.note}</p>}
            {(!licenseVerification||licenseVerification?.status==="none") && <p style={{ color:C.muted, fontSize:12, marginBottom:8 }}>Not submitted yet.</p>}
            <button type="button" disabled={verifyBusy||!doc.licenseNumber||!doc.email} onClick={async()=>{setVerifyBusy(true);try{await onLicenseVerify();}finally{setVerifyBusy(false);}}} style={{ padding:"10px 16px", borderRadius:8, border:"none", cursor:verifyBusy||!doc.licenseNumber?"not-allowed":"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, background:doc.licenseNumber?`linear-gradient(135deg,${C.purple},${C.blue})`:C.border, color:"#fff" }}>
              {verifyBusy?"Submitting…":"Submit License for Verification"}
            </button>
          </div>

          <div style={{ ...card, background:`${C.teal}07`, border:`1px solid ${C.teal}25` }}>
            <h4 style={{ color:C.teal, fontWeight:700, fontSize:15, marginBottom:12 }}>⛓️ Blockchain Identity</h4>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                {label:"Wallet", value:doc.walletAddress?`${doc.walletAddress.slice(0,6)}…${doc.walletAddress.slice(-4)}`:"Not linked"},
                {label:"License Verified", value:doc.licenseVerified?"✅ Yes":"Not yet"},
              ].map(r=>(
                <div key={r.label} style={{ padding:10, background:C.bg, borderRadius:8, border:`1px solid ${C.border}` }}>
                  <p style={{ color:C.muted, fontSize:11, marginBottom:3 }}>{r.label}</p>
                  <p style={{ color:C.teal, fontSize:13, fontFamily:"monospace", fontWeight:700 }}>{r.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export function DoctorDashboard() {
  const navigate = useNavigate();
  const { toasts, show } = useToast();
  const [activeView, setActiveView]     = useState("overview");
  const [sessionDoctor, setSessionDoctor] = useState(()=>getSessionDoctorProfile());
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [licenseVerification, setLicenseVerification] = useState(null);
  const [patients,     setPatients]     = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [reports,      setReports]      = useState([]);
  const [allDoctors,   setAllDoctors]   = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [chainStatus,  setChainStatus]  = useState({});

  useEffect(()=>{
    if(!sessionDoctor) { navigate("/login"); return; }
    const id = sessionDoctor._id || sessionDoctor.id;
    if(id && id!=="USR-LOCAL") {
      fetch(`${API}/doctors/${id}`)
        .then(r=>r.ok?r.json():null)
        .then(d=>{ if(d) setDoctorProfile(d); })
        .catch(()=>{});
    }
  }, []);

  const doctor = doctorProfile || sessionDoctor || {};

  useEffect(()=>{
    const onStorage=()=>setSessionDoctor(getSessionDoctorProfile());
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onStorage);
    return ()=>{ window.removeEventListener("storage",onStorage); window.removeEventListener("focus",onStorage); };
  },[]);

  useEffect(()=>{
    if(!doctor.email) return;
    let cancelled=false;
    fetch(`${API}/verification/doctor-license?email=${encodeURIComponent(doctor.email)}`)
      .then(r=>r.ok?r.json():{status:"none"})
      .then(d=>{ if(!cancelled) setLicenseVerification(d); })
      .catch(()=>{});
    return ()=>{ cancelled=true; };
  },[doctor.email]);

  useEffect(()=>{
    let cancelled=false;
    const load=async(quiet)=>{
      if(!quiet) setLoadingAppts(true);
      try {
        const headers=authHeaders();
        const [pr,ar,rr,dr]=await Promise.all([
          fetch(`${API}/patients`,     {headers}),
          fetch(`${API}/appointments`, {headers}),
          fetch(`${API}/records`,      {headers}),
          fetch(`${API}/doctors`),
        ]);
        if(cancelled) return;
        const pts   = pr.ok  ? await pr.json()  : [];
        const apRaw = ar.ok  ? await ar.json()  : [];
        const recs  = rr.ok  ? await rr.json()  : [];
        const docs  = dr.ok  ? await dr.json()  : [];
        if(cancelled) return;
        setPatients(Array.isArray(pts)?pts:[]);
        setAppointments(Array.isArray(apRaw)?apRaw.map(normalizeAppointment):[]);
        setReports(Array.isArray(recs)?recs:[]);
        setAllDoctors(Array.isArray(docs)?docs:[]);
      } catch(_) {}
      finally { if(!cancelled&&!quiet) setLoadingAppts(false); }
    };
    load(false);
    const interval=setInterval(()=>load(true),8000);
    const onStorage=(e)=>{ if(e.key==="medichain-records-bump") load(true); };
    window.addEventListener("storage",onStorage);
    return ()=>{ cancelled=true; clearInterval(interval); window.removeEventListener("storage",onStorage); };
  },[]);

  const handleCompleteAppt=async(appt)=>{
    setChainStatus(s=>({...s,[appt.id]:"minting"}));
    try {
      await fetch(`${API}/appointments/${appt.id}/complete`,{method:"PUT",headers:authHeaders()}).catch(()=>{});
      setChainStatus(s=>({...s,[appt.id]:"done"}));
      show(`✅ Appointment completed!`);
      setAppointments(prev=>prev.map(a=>a.id===appt.id?{...a,status:"completed"}:a));
    } catch(err) {
      setChainStatus(s=>({...s,[appt.id]:"failed"}));
      show(`Appointment marked complete. Blockchain: ${err.message}`,"info");
      setAppointments(prev=>prev.map(a=>a.id===appt.id?{...a,status:"completed"}:a));
    }
  };

  const handleReschedule=async(appt)=>{
    try { await fetch(`${API}/appointments/${appt.id}/reschedule`,{method:"PUT",headers:authHeaders()}).catch(()=>{}); }
    finally { show("Reschedule request sent","info"); }
  };

  const handleLicenseVerify=async()=>{
    try {
      const res=await fetch(`${API}/verification/doctor-license`,{method:"POST",headers:authHeaders(),body:JSON.stringify({email:doctor.email,licenseNumber:doctor.licenseNumber,documentHash:""})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Verification failed");
      setLicenseVerification(data);
      show(data.status==="verified"?"✅ License verified!":data.note||"See result above",data.status==="verified"?"success":"info");
    } catch(e) { show(e.message,"error"); }
  };

  const handleUpdateProfile=(updated)=>{
    setDoctorProfile(updated);
    setSessionDoctor(s=>({...s,...updated}));
  };

  const handleLogout=()=>{
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  if(!sessionDoctor) return null;

  return (
    <>
      <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Segoe UI','Noto Sans',sans-serif", color:C.text }}>
        <style>{`* { box-sizing:border-box; margin:0; padding:0; } ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:${C.bg};} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;} button,select,input,textarea{font-family:inherit;}`}</style>
        <TopBar activeView={activeView} setActiveView={setActiveView} doctor={doctor} onLogout={handleLogout}/>
        <div style={{ maxWidth:1300, margin:"0 auto", padding:"32px 24px" }}>
          {activeView==="overview"      && <OverviewView appointments={appointments} patients={patients} reports={reports} loadingAppts={loadingAppts} chainStatus={chainStatus} onCompleteAppt={handleCompleteAppt} onReschedule={handleReschedule} setActiveView={setActiveView} doctor={doctor}/>}
          {activeView==="doctors"       && <DoctorsView allDoctors={allDoctors}/>}
          {activeView==="appointments"  && <AppointmentsView appointments={appointments} chainStatus={chainStatus} onCompleteAppt={handleCompleteAppt} onReschedule={handleReschedule}/>}
          {activeView==="patients"      && <PatientsView patients={patients} reports={reports} onShowToast={show}/>}
          {activeView==="myprofile"     && <MyProfileView doctor={doctor} onUpdateProfile={handleUpdateProfile} licenseVerification={licenseVerification} onLicenseVerify={handleLicenseVerify} onShowToast={show}/>}
        </div>
      </div>
      <ToastContainer toasts={toasts}/>
    </>
  );
}

export default DoctorDashboard;