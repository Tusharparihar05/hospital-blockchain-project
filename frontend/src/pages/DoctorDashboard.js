import { useState, useEffect } from "react";

// ── API config (from your original file) ─────────────────────────────────────
const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:        "#060b16",
  surface:   "#0c1424",
  surfaceHi: "#101d30",
  border:    "#172035",
  borderHi:  "#1e2d48",
  teal:      "#00c8a0",
  blue:      "#3b82f6",
  purple:    "#8b5cf6",
  amber:     "#f59e0b",
  red:       "#f43f5e",
  green:     "#10b981",
  text:      "#dde6f5",
  muted:     "#4d6080",
  mutedHi:   "#7a92b8",
};

// ── Logged-in doctor profile ──────────────────────────────────────────────────
const LOGGED_IN_DOCTOR = {
  id: "DOC-001",
  name: "Dr. Ananya Singh",
  specialty: "Cardiology",
  experience: 12,
  rating: 4.8,
  reviews: 312,
  image: "👩‍⚕️",
  hospital: "AIIMS New Delhi",
  email: "ananya.singh@aiims.edu",
  phone: "+91 98765 43210",
  languages: ["English", "Hindi", "Punjabi"],
  education: "MBBS – AIIMS | MD Cardiology – PGI Chandigarh",
  bio: "Pioneer in minimally invasive cardiac procedures with 12 years at AIIMS. Specializes in complex arrhythmias and coronary interventions.",
  conditions: ["Heart Disease", "Hypertension", "Arrhythmia", "Heart Failure", "Coronary Artery Disease"],
  availability: {
    Mon: ["9:00 AM", "10:30 AM", "2:00 PM", "4:00 PM"],
    Tue: ["9:00 AM", "11:00 AM", "3:00 PM"],
    Wed: ["10:00 AM", "2:00 PM", "4:30 PM"],
    Thu: ["9:30 AM", "1:00 PM", "3:30 PM", "5:00 PM"],
    Fri: ["9:00 AM", "11:30 AM", "2:00 PM"],
    Sat: ["10:00 AM", "12:00 PM"],
    Sun: [],
  },
};

// ── Fallback mock data (used when backend is offline) ─────────────────────────
const mockPatients = [
  { id: "P001", name: "Alice Carter",   age: 34, gender: "Female", phone: "9876543210" },
  { id: "P002", name: "John Doe",       age: 45, gender: "Male",   phone: "9123456780" },
  { id: "P003", name: "Emma Wilson",    age: 29, gender: "Female", phone: "9012345678" },
  { id: "P004", name: "Michael Brown",  age: 52, gender: "Male",   phone: "9988776655" },
];

const mockAppointments = [
  { id: "APT-001", patientName: "Rajesh Kumar",  patientId: "P001", age: 45, time: "9:00 AM",  date: "2026-03-27", type: "Consultation", status: "confirmed",   isEmergency: false, doctorId: "DOC-001", notes: "Follow-up for hypertension medication", blockchain: "0x4a2f...", specialty: "Cardiology" },
  { id: "APT-002", patientName: "Sunita Devi",   patientId: "P002", age: 62, time: "10:30 AM", date: "2026-03-27", type: "Follow-up",    status: "in-progress", isEmergency: false, doctorId: "DOC-001", notes: "Post angioplasty checkup",             blockchain: "0x8c1d...", specialty: "Cardiology" },
  { id: "APT-003", patientName: "Amit Joshi",    patientId: "P003", age: 34, time: "2:00 PM",  date: "2026-03-27", type: "Emergency",   status: "confirmed",   isEmergency: true,  doctorId: "DOC-001", notes: "Chest pain since morning",              blockchain: "0x2e9b...", specialty: "Cardiology" },
  { id: "APT-004", patientName: "Kavya Nair",    patientId: "P004", age: 28, time: "4:00 PM",  date: "2026-03-27", type: "Consultation", status: "pending",    isEmergency: false, doctorId: "DOC-001", notes: "First consultation for palpitations",   blockchain: "0x7f3a...", specialty: "Cardiology" },
  { id: "APT-005", patientName: "Mohan Das",     patientId: "P001", age: 57, time: "9:00 AM",  date: "2026-03-28", type: "Follow-up",   status: "pending",     isEmergency: false, doctorId: "DOC-001", notes: "Monthly cardiac monitoring",            blockchain: "0x1b5e...", specialty: "Cardiology" },
  { id: "APT-006", patientName: "Leela Patel",   patientId: "P002", age: 71, time: "11:00 AM", date: "2026-03-28", type: "Consultation", status: "pending",    isEmergency: false, doctorId: "DOC-001", notes: "Echocardiogram review",                 blockchain: "0x9c4f...", specialty: "Cardiology" },
  { id: "APT-007", patientName: "Farhan Sheikh", patientId: "P003", age: 41, time: "3:00 PM",  date: "2026-03-26", type: "Follow-up",   status: "completed",   isEmergency: false, doctorId: "DOC-001", notes: "Stress test results discussed",         blockchain: "0x3d8a...", specialty: "Cardiology" },
  { id: "APT-008", patientName: "Geeta Mishra",  patientId: "P004", age: 53, time: "5:00 PM",  date: "2026-03-26", type: "Consultation", status: "completed",  isEmergency: false, doctorId: "DOC-001", notes: "Blood pressure management",             blockchain: "0x6e2c...", specialty: "Cardiology" },
];

const mockHealthReports = [
  { id: "R001", patientId: "P001", category: "Cardiology", fileName: "ECG_Report.pdf",  uploadDate: "2026-03-10", blockchainHash: "0x4a2f9b1c..." },
  { id: "R002", patientId: "P002", category: "Lab",        fileName: "Blood_Test.pdf",  uploadDate: "2026-03-08", blockchainHash: "0x8c1d3f7e..." },
  { id: "R003", patientId: "P001", category: "Radiology",  fileName: "Chest_XRay.pdf", uploadDate: "2026-03-05", blockchainHash: "0x2e9b5a4d..." },
  { id: "R004", patientId: "P003", category: "Neurology",  fileName: "MRI_Scan.pdf",   uploadDate: "2026-03-01", blockchainHash: null },
];

const mockAllDoctors = [
  { id: "DOC-001", name: "Dr. Ananya Singh",  specialty: "Cardiology",   experience: 12, rating: 4.8, reviews: 312, image: "👩‍⚕️", hospital: "AIIMS New Delhi",       status: "online",  patients: 847,  todayAppts: 6, color: C.teal,   languages: ["English","Hindi","Punjabi"],           education: "MBBS – AIIMS | MD Cardiology – PGI Chandigarh",    bio: "Pioneer in minimally invasive cardiac procedures.", conditions: ["Heart Disease","Hypertension","Arrhythmia","Heart Failure"] },
  { id: "DOC-002", name: "Dr. Vikram Patel",  specialty: "Dermatology",  experience: 8,  rating: 4.5, reviews: 198, image: "👨‍⚕️", hospital: "Fortis Bangalore",      status: "online",  patients: 624,  todayAppts: 4, color: C.purple, languages: ["English","Hindi","Gujarati"],           education: "MBBS – KMC Manipal | MD Dermatology – JIPMER",    bio: "Expert in cosmetic and clinical dermatology.",            conditions: ["Acne","Psoriasis","Eczema","Skin Cancer Screening"] },
  { id: "DOC-003", name: "Dr. Meena Roy",     specialty: "Orthopedics",  experience: 15, rating: 4.9, reviews: 427, image: "👩‍⚕️", hospital: "Apollo Chennai",        status: "busy",    patients: 1103, todayAppts: 8, color: C.green,  languages: ["English","Tamil","Malayalam"],          education: "MBBS – Stanley Medical | MS Ortho – CMC Vellore",  bio: "15 years excellence in joint replacement surgery.",        conditions: ["Arthritis","Sports Injuries","Spine Problems","Fractures"] },
  { id: "DOC-004", name: "Dr. Suresh Nair",   specialty: "Neurology",    experience: 10, rating: 4.7, reviews: 261, image: "👨‍⚕️", hospital: "Kokilaben Mumbai",      status: "offline", patients: 732,  todayAppts: 0, color: C.amber,  languages: ["English","Hindi","Malayalam","Marathi"], education: "MBBS – Grant Medical | DM Neurology – NIMHANS",   bio: "Specializes in epilepsy and stroke management.",          conditions: ["Migraine","Epilepsy","Stroke","Parkinson's"] },
  { id: "DOC-005", name: "Dr. Priya Sharma",  specialty: "Pediatrics",   experience: 7,  rating: 4.6, reviews: 183, image: "👩‍⚕️", hospital: "Medanta Gurgaon",      status: "online",  patients: 519,  todayAppts: 5, color: "#ec4899",languages: ["English","Hindi"],                      education: "MBBS – Lady Hardinge | MD Pediatrics – AIIMS",    bio: "Pediatrician with expertise in neonatal care.",           conditions: ["Fever","Growth Disorders","Asthma","Malnutrition"] },
  { id: "DOC-006", name: "Dr. Rahul Mehta",   specialty: "Oncology",     experience: 14, rating: 4.9, reviews: 356, image: "👨‍⚕️", hospital: "Tata Memorial Mumbai", status: "busy",    patients: 961,  todayAppts: 7, color: "#ef4444", languages: ["English","Hindi","Marathi"],           education: "MBBS – Grant Medical | DM Oncology – Tata Memorial",bio: "Leading oncologist specializing in breast and lung cancer.", conditions: ["Breast Cancer","Lung Cancer","Lymphoma","Chemotherapy"] },
];

const SPECIALTIES = ["All", "Cardiology", "Dermatology", "Orthopedics", "Neurology", "Pediatrics", "Oncology"];
const TODAY = "2026-03-27";

// ── Toast system ──────────────────────────────────────────────────────────────
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
        <div key={t.id} style={{
          background: t.type === "error" ? `${C.red}18` : t.type === "info" ? `${C.blue}18` : `${C.green}18`,
          border: `1.5px solid ${t.type === "error" ? C.red : t.type === "info" ? C.blue : C.green}55`,
          borderRadius: 12, padding: "13px 20px", fontSize: 13, fontWeight: 600,
          color: t.type === "error" ? C.red : t.type === "info" ? C.blue : C.green,
          boxShadow: "0 8px 24px #00000066", maxWidth: 340,
        }}>{t.msg}</div>
      ))}
    </div>
  );
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────
function Badge({ children, color = C.teal, size = "sm" }) {
  return (
    <span style={{
      padding: size === "lg" ? "4px 14px" : "2px 10px",
      fontSize: size === "lg" ? 12 : 11, fontWeight: 700, borderRadius: 20,
      background: color + "1a", color, border: `1px solid ${color}33`,
      display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function StatusDot({ status }) {
  const map = { online: C.green, busy: C.amber, offline: C.muted };
  const col = map[status] || C.muted;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: col, fontWeight: 600 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, display: "inline-block", boxShadow: status !== "offline" ? `0 0 6px ${col}` : "none" }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function StarRating({ value }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1,2,3,4,5].map(i => <span key={i} style={{ color: i <= Math.round(value) ? C.amber : C.border, fontSize: 11 }}>★</span>)}
    </span>
  );
}

function ApptStatusBadge({ status, isEmergency }) {
  if (isEmergency) return <Badge color={C.red}>🚨 Emergency</Badge>;
  const map = { confirmed: { color: C.blue, label: "Confirmed" }, "in-progress": { color: C.teal, label: "● In Progress" }, pending: { color: C.amber, label: "Pending" }, scheduled: { color: C.blue, label: "Scheduled" }, completed: { color: C.green, label: "✓ Completed" } };
  const m = map[status] || { color: C.muted, label: status };
  return <Badge color={m.color}>{m.label}</Badge>;
}

const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 };

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({ activeView, setActiveView }) {
  const nav = [
    { key: "overview",     icon: "⚡", label: "Overview" },
    { key: "doctors",      icon: "👨‍⚕️", label: "Doctor Directory" },
    { key: "appointments", icon: "📅", label: "Appointments" },
    { key: "patients",     icon: "🔍", label: "Patients" },
    { key: "myprofile",    icon: "🪪",  label: "My Profile" },
  ];
  return (
    <div style={{
      background: "#04080f99", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      borderBottom: `1px solid ${C.border}`, padding: "0 28px", height: 64,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>⛓️</div>
        <div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 15, fontFamily: "monospace" }}>MediChain</div>
          <div style={{ color: C.muted, fontSize: 10, letterSpacing: 1 }}>DOCTOR PORTAL</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {nav.map(n => (
          <button key={n.key} onClick={() => setActiveView(n.key)} style={{
            padding: "7px 13px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 13, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
            background: activeView === n.key ? `${C.teal}18` : "transparent",
            color: activeView === n.key ? C.teal : C.mutedHi,
            fontWeight: activeView === n.key ? 700 : 400,
            borderBottom: activeView === n.key ? `2px solid ${C.teal}` : "2px solid transparent",
          }}>
            <span style={{ fontSize: 14 }}>{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <StatusDot status="online" />
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 10, background: C.surfaceHi, border: `1px solid ${C.borderHi}` }}>
          <span style={{ fontSize: 20 }}>{LOGGED_IN_DOCTOR.image}</span>
          <div>
            <p style={{ color: C.text, fontSize: 13, fontWeight: 600, lineHeight: 1 }}>{LOGGED_IN_DOCTOR.name}</p>
            <p style={{ color: C.muted, fontSize: 11 }}>{LOGGED_IN_DOCTOR.specialty}</p>
          </div>
        </div>
        <button style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 13, cursor: "pointer" }}>Logout</button>
      </div>
    </div>
  );
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
function OverviewView({ appointments, patients, reports, loadingAppts, chainStatus, onCompleteAppt, onReschedule, setActiveView }) {
  const doc = LOGGED_IN_DOCTOR;
  const todayAppts     = appointments.filter(a => a.date === TODAY);
  const emergencyCount = appointments.filter(a => a.isEmergency).length;

  return (
    <div>
      {/* Banner */}
      <div style={{ borderRadius: 16, padding: "26px 32px", marginBottom: 24, background: `linear-gradient(120deg, ${C.teal}18, ${C.blue}10, ${C.bg})`, border: `1px solid ${C.teal}30`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 4 }}>Good morning,</p>
          <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, marginBottom: 10 }}>{doc.name} 👋</h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Badge color={C.teal} size="lg">🏥 {doc.hospital}</Badge>
            <Badge color={C.blue} size="lg">🩺 {doc.specialty}</Badge>
            <Badge color={C.amber} size="lg">⭐ {doc.rating} ({doc.reviews} reviews)</Badge>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>Today</p>
          <p style={{ color: C.teal, fontSize: 42, fontWeight: 800, fontFamily: "monospace", lineHeight: 1 }}>{todayAppts.length}</p>
          <p style={{ color: C.muted, fontSize: 13 }}>appointments</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Today's Appointments", value: loadingAppts ? "…" : todayAppts.length,   icon: "📅", color: C.teal },
          { label: "Total Patients",        value: loadingAppts ? "…" : patients.length,     icon: "👥", color: C.blue },
          { label: "Reports Submitted",     value: loadingAppts ? "…" : reports.length,      icon: "📋", color: C.purple },
          { label: "Emergency Cases",       value: loadingAppts ? "…" : emergencyCount,       icon: "🚨", color: C.red },
        ].map(s => (
          <div key={s.label} style={{ ...card, border: s.color === C.red && emergencyCount > 0 ? `1px solid ${C.red}44` : `1px solid ${C.border}`, background: s.color === C.red && emergencyCount > 0 ? `${C.red}08` : C.surface }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>{s.label}</p>
                <p style={{ color: s.color, fontSize: 30, fontWeight: 800, fontFamily: "monospace" }}>{s.value}</p>
              </div>
              <span style={{ fontSize: 28 }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 310px", gap: 20 }}>
        {/* Today's appointments list */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <h3 style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>📅 Today's Appointments</h3>
              <p style={{ color: C.muted, fontSize: 13 }}>{loadingAppts ? "Loading..." : `${todayAppts.length} scheduled · ${emergencyCount} emergency`}</p>
            </div>
            <button onClick={() => setActiveView("appointments")} style={{ fontSize: 13, color: C.teal, background: `${C.teal}15`, border: `1px solid ${C.teal}30`, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>View All →</button>
          </div>
          {loadingAppts ? (
            <p style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Loading...</p>
          ) : todayAppts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.muted }}><div style={{ fontSize: 32, marginBottom: 8 }}>📭</div><p>No appointments today</p></div>
          ) : (
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
                      <p style={{ color: C.muted, fontSize: 12 }}>{appt.notes || appt.specialty}</p>
                      {appt.blockchain && <p style={{ color: C.muted, fontSize: 11, fontFamily: "monospace", marginTop: 2 }}>⛓️ {appt.blockchain}</p>}
                      {chainStatus[appt.id] === "done" && <p style={{ color: C.green, fontSize: 11, marginTop: 4 }}>🔗 Token minted on blockchain</p>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                      <ApptStatusBadge status={appt.status} isEmergency={appt.isEmergency} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => onReschedule(appt)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", background: "transparent", border: `1px solid ${C.border}`, color: C.mutedHi }}>↺ Reschedule</button>
                        <button
                          onClick={() => onCompleteAppt(appt)}
                          disabled={chainStatus[appt.id] === "minting" || appt.status === "completed"}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", border: "none", background: appt.status === "completed" ? `${C.green}22` : `linear-gradient(135deg, ${C.teal}, ${C.blue})`, color: appt.status === "completed" ? C.green : "#fff", fontWeight: 600 }}
                        >{chainStatus[appt.id] === "minting" ? "⛓️ Minting…" : appt.status === "completed" ? "✓ Done" : "✓ Complete"}</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Weekly schedule */}
          <div style={card}>
            <h3 style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>🗓️ Weekly Availability</h3>
            {Object.entries(doc.availability).map(([day, slots]) => (
              <div key={day} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ minWidth: 32, fontSize: 12, fontWeight: 700, color: slots.length ? C.teal : C.muted }}>{day}</span>
                {slots.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {slots.map(s => <span key={s} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: `${C.teal}15`, color: C.teal, border: `1px solid ${C.teal}25` }}>{s}</span>)}
                  </div>
                ) : <span style={{ color: C.muted, fontSize: 12 }}>Off</span>}
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <div style={card}>
            <h3 style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>⚡ Recent Activity</h3>
            {[
              { icon: "✅", color: C.green,  title: "Report Submitted",      sub: "Blood test for Rajesh Kumar",    time: "2 hours ago" },
              { icon: "📅", color: C.teal,   title: "Appointment Completed", sub: "Farhan Sheikh · ⛓️ Token minted", time: "Yesterday" },
              { icon: "📤", color: C.purple, title: "Lab Results Uploaded",  sub: "Emma Wilson MRI scan",           time: "2 days ago" },
            ].map(a => (
              <div key={a.title} style={{ display: "flex", gap: 10, padding: "10px 12px", background: `${a.color}0d`, borderRadius: 10, marginBottom: 8, border: `1px solid ${a.color}20` }}>
                <span style={{ fontSize: 15 }}>{a.icon}</span>
                <div>
                  <p style={{ color: C.text, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{a.title}</p>
                  <p style={{ color: C.muted, fontSize: 12 }}>{a.sub}</p>
                  <p style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DOCTOR DIRECTORY ──────────────────────────────────────────────────────────
function DoctorsView({ allDoctors }) {
  const [search, setSearch]               = useState("");
  const [filterSpec, setFilterSpec]       = useState("All");
  const [filterStatus, setFilterStatus]   = useState("All");
  const [sortBy, setSortBy]               = useState("rating");
  const [expanded, setExpanded]           = useState(null);

  const filtered = allDoctors
    .filter(d => {
      const ms = d.name.toLowerCase().includes(search.toLowerCase())
        || d.specialty.toLowerCase().includes(search.toLowerCase())
        || d.hospital.toLowerCase().includes(search.toLowerCase())
        || d.languages.some(l => l.toLowerCase().includes(search.toLowerCase()));
      const msp = filterSpec === "All" || d.specialty === filterSpec;
      const mst = filterStatus === "All" || d.status === filterStatus;
      return ms && msp && mst;
    })
    .sort((a, b) => sortBy === "rating" ? b.rating - a.rating : sortBy === "experience" ? b.experience - a.experience : b.patients - a.patients);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: C.text, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>👨‍⚕️ Doctor Directory</h2>
        <p style={{ color: C.muted, fontSize: 14 }}>{filtered.length} of {allDoctors.length} doctors</p>
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, specialty, hospital, language..." style={{ flex: 1, minWidth: 240, padding: "10px 16px", borderRadius: 10, fontSize: 14, background: C.surface, border: `1px solid ${C.borderHi}`, color: C.text, outline: "none" }} />
        {[
          { val: filterSpec,   set: setFilterSpec,   opts: SPECIALTIES },
          { val: filterStatus, set: setFilterStatus, opts: ["All","online","busy","offline"] },
          { val: sortBy,       set: setSortBy,       opts: ["rating","experience","patients"] },
        ].map((f, i) => (
          <select key={i} value={f.val} onChange={e => f.set(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, fontSize: 13, background: C.surface, border: `1px solid ${C.borderHi}`, color: C.text, outline: "none", cursor: "pointer" }}>
            {f.opts.map(o => <option key={o}>{o}</option>)}
          </select>
        ))}
      </div>

      {/* Doctor cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
        {filtered.map(doc => (
          <div key={doc.id} style={{ borderRadius: 14, border: `1px solid ${expanded === doc.id ? doc.color : C.border}`, background: C.surface, overflow: "hidden", boxShadow: expanded === doc.id ? `0 0 0 1px ${doc.color}22, 0 8px 24px ${doc.color}10` : "none", transition: "border-color 0.2s, box-shadow 0.2s" }}>
            {/* Header */}
            <div style={{ padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ position: "relative" }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, flexShrink: 0, background: `${doc.color}20`, border: `2px solid ${doc.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{doc.image}</div>
                <span style={{ position: "absolute", bottom: -3, right: -3, width: 14, height: 14, borderRadius: "50%", background: doc.status === "online" ? C.green : doc.status === "busy" ? C.amber : C.muted, border: `2px solid ${C.surface}`, boxShadow: doc.status !== "offline" ? `0 0 6px ${doc.status === "online" ? C.green : C.amber}` : "none" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{doc.name}</p>
                    <p style={{ color: doc.color, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{doc.specialty}</p>
                  </div>
                  <StatusDot status={doc.status} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <StarRating value={doc.rating} />
                  <span style={{ color: C.amber, fontSize: 13, fontWeight: 700 }}>{doc.rating}</span>
                  <span style={{ color: C.muted, fontSize: 12 }}>({doc.reviews})</span>
                </div>
                <p style={{ color: C.mutedHi, fontSize: 12 }}>🏥 {doc.hospital} · {doc.experience} yrs</p>
              </div>
            </div>
            {/* Stats bar */}
            <div style={{ display: "flex", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: C.surfaceHi }}>
              {[{ label: "Patients", val: doc.patients.toLocaleString(), color: C.blue }, { label: "Today", val: `${doc.todayAppts} appts`, color: C.teal }, { label: "Experience", val: `${doc.experience} yrs`, color: C.purple }].map((s, i) => (
                <div key={s.label} style={{ flex: 1, padding: "10px 0", textAlign: "center", borderRight: i < 2 ? `1px solid ${C.border}` : "none" }}>
                  <p style={{ color: s.color, fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>{s.val}</p>
                  <p style={{ color: C.muted, fontSize: 11 }}>{s.label}</p>
                </div>
              ))}
            </div>
            {/* Languages + expand */}
            <div style={{ padding: "10px 16px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {doc.languages.map(l => <Badge key={l} color={doc.color}>🌐 {l}</Badge>)}
              </div>
              <button onClick={() => setExpanded(expanded === doc.id ? null : doc.id)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, cursor: "pointer", background: `${doc.color}15`, border: `1px solid ${doc.color}30`, color: doc.color, fontWeight: 600 }}>
                {expanded === doc.id ? "▲ Hide" : "▼ View Profile"}
              </button>
            </div>
            {/* Expanded profile */}
            {expanded === doc.id && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: 16, background: C.bg }}>
                <div style={{ marginBottom: 10, padding: 12, background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>📝 About</p>
                  <p style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{doc.bio}</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  {[{ label: "🎓 Education", value: doc.education }, { label: "🏥 Hospital", value: doc.hospital }].map(r => (
                    <div key={r.label} style={{ padding: 10, background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                      <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{r.label}</p>
                      <p style={{ color: C.text, fontSize: 12, lineHeight: 1.5 }}>{r.value}</p>
                    </div>
                  ))}
                </div>
                <div style={{ padding: 10, background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🩺 Treats</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {doc.conditions.map(c => <Badge key={c} color={doc.color}>{c}</Badge>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
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

  const filtered = appointments.filter(a => {
    const matchDate = filterDate === "all" ? true : filterDate === "today" ? a.date === TODAY : filterDate === "tomorrow" ? a.date === "2026-03-28" : filterDate === "past" ? a.date < TODAY : true;
    const matchStatus = filterStatus === "all" ? true : filterStatus === "emergency" ? a.isEmergency : a.status === filterStatus;
    const matchSearch = a.patientName.toLowerCase().includes(search.toLowerCase()) || (a.type || "").toLowerCase().includes(search.toLowerCase());
    return matchDate && matchStatus && matchSearch;
  });

  const emergencyCount = appointments.filter(a => a.isEmergency).length;
  const pendingCount   = appointments.filter(a => a.status === "pending" || a.status === "scheduled").length;
  const completedCount = appointments.filter(a => a.status === "completed").length;
  const todayCount     = appointments.filter(a => a.date === TODAY).length;

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ color: C.text, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>📅 Appointments</h2>
        <p style={{ color: C.muted, fontSize: 14 }}>Manage and track all patient appointments</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
        {[{ label: "Today", value: todayCount, color: C.teal, icon: "📅" }, { label: "Emergencies", value: emergencyCount, color: C.red, icon: "🚨" }, { label: "Pending", value: pendingCount, color: C.amber, icon: "⏳" }, { label: "Completed", value: completedCount, color: C.green, icon: "✅" }].map(s => (
          <div key={s.label} style={{ ...card, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><p style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>{s.label}</p><p style={{ color: s.color, fontSize: 26, fontWeight: 800, fontFamily: "monospace" }}>{s.value}</p></div>
            <span style={{ fontSize: 22 }}>{s.icon}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or type..." style={{ flex: 1, minWidth: 200, padding: "9px 14px", borderRadius: 9, fontSize: 13, background: C.surface, border: `1px solid ${C.borderHi}`, color: C.text, outline: "none" }} />
        <div style={{ display: "flex", gap: 3, background: C.surface, padding: 4, borderRadius: 10, border: `1px solid ${C.border}` }}>
          {["today","tomorrow","past","all"].map(d => (
            <button key={d} onClick={() => setFilterDate(d)} style={{ padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "inherit", background: filterDate === d ? C.surfaceHi : "transparent", color: filterDate === d ? C.teal : C.muted, fontWeight: filterDate === d ? 700 : 400 }}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: "9px 12px", borderRadius: 9, fontSize: 13, background: C.surface, border: `1px solid ${C.borderHi}`, color: C.text, outline: "none", cursor: "pointer" }}>
          {["all","confirmed","in-progress","pending","scheduled","completed","emergency"].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 20 }}>
        {/* List */}
        <div style={card}>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>Showing <strong style={{ color: C.text }}>{filtered.length}</strong> appointments</p>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: C.muted }}><div style={{ fontSize: 32, marginBottom: 8 }}>📭</div><p>No appointments found</p></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(apt => (
                <div key={apt.id} onClick={() => setSelectedApt(selectedApt?.id === apt.id ? null : apt)} style={{ padding: "13px 15px", borderRadius: 12, cursor: "pointer", border: `1px solid ${selectedApt?.id === apt.id ? C.teal : apt.isEmergency ? C.red + "55" : C.border}`, background: selectedApt?.id === apt.id ? `${C.teal}08` : apt.isEmergency ? `${C.red}06` : C.surfaceHi, transition: "border-color 0.2s" }}>
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
                      <p style={{ color: C.muted, fontSize: 12 }}>{apt.notes || apt.specialty}</p>
                      {apt.blockchain && <span style={{ color: C.muted, fontSize: 11, fontFamily: "monospace" }}>⛓️ {apt.blockchain}</span>}
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
                  {chainStatus[apt.id] === "done" && <p style={{ color: C.green, fontSize: 11, marginTop: 6 }}>🔗 Blockchain token minted</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div style={card}>
          {selectedApt ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>Appointment Detail</h3>
                <button onClick={() => setSelectedApt(null)} style={{ fontSize: 13, color: C.muted, background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: C.surfaceHi, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: `${C.teal}20`, border: `1px solid ${C.teal}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>👤</div>
                <div>
                  <p style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>{selectedApt.patientName}</p>
                  <p style={{ color: C.muted, fontSize: 13 }}>{selectedApt.age ? `Age ${selectedApt.age} · ` : ""}{selectedApt.type || selectedApt.specialty}</p>
                </div>
              </div>
              {[
                { label: "Date",     value: new Date(selectedApt.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) },
                { label: "Time",     value: selectedApt.time },
                { label: "Type",     value: selectedApt.type || selectedApt.specialty },
                { label: "Priority", value: selectedApt.isEmergency ? "🚨 Emergency" : "Standard" },
                { label: "ID",       value: selectedApt.id },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.muted, fontSize: 13 }}>{r.label}</span>
                  <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{r.value}</span>
                </div>
              ))}
              {selectedApt.notes && (
                <div style={{ margin: "14px 0", padding: 12, background: C.surfaceHi, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Notes</p>
                  <p style={{ color: C.text, fontSize: 13, lineHeight: 1.5 }}>{selectedApt.notes}</p>
                </div>
              )}
              {selectedApt.blockchain && (
                <div style={{ padding: 12, background: `${C.teal}08`, borderRadius: 10, border: `1px solid ${C.teal}25`, marginBottom: 14 }}>
                  <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>⛓️ Blockchain Token</p>
                  <p style={{ color: C.teal, fontSize: 13, fontFamily: "monospace", fontWeight: 700 }}>{selectedApt.blockchain}</p>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(selectedApt.status === "pending" || selectedApt.status === "scheduled") && (
                  <button style={{ padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontFamily: "inherit", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, color: "#fff", fontWeight: 700 }}>✅ Confirm Appointment</button>
                )}
                {selectedApt.status !== "completed" && (
                  <button onClick={() => onCompleteAppt(selectedApt)} disabled={chainStatus[selectedApt.id] === "minting"} style={{ padding: "10px", borderRadius: 8, border: `1px solid ${C.green}`, cursor: "pointer", fontSize: 13, fontFamily: "inherit", background: `${C.green}15`, color: C.green, fontWeight: 600 }}>
                    {chainStatus[selectedApt.id] === "minting" ? "⛓️ Minting token..." : "✓ Mark Complete + Mint Token"}
                  </button>
                )}
                <button onClick={() => onReschedule(selectedApt)} style={{ padding: "10px", borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 13, fontFamily: "inherit", background: "transparent", color: C.mutedHi }}>↺ Reschedule</button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 48, color: C.muted }}><div style={{ fontSize: 34, marginBottom: 10 }}>👆</div><p style={{ fontSize: 14 }}>Select an appointment to view details</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PATIENTS (Patient Search + History) ───────────────────────────────────────
function PatientsView({ patients, reports, onShowToast }) {
  const [searchQuery, setSearchQuery]         = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);

  const filtered      = patients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase()) || (p.phone && p.phone.includes(searchQuery)));
  const selectedData  = patients.find(p => p.id === selectedPatient);
  const patientReports = reports.filter(r => r.patientId === selectedPatient);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ color: C.text, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🔍 Patient Search</h2>
        <p style={{ color: C.muted, fontSize: 14 }}>Find a patient to view history or upload reports</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        {/* Search */}
        <div style={card}>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: C.muted }}>🔍</span>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, ID, or phone number..." style={{ width: "100%", padding: "11px 14px 11px 38px", borderRadius: 10, fontSize: 14, background: C.surfaceHi, border: `1px solid ${C.borderHi}`, color: C.text, outline: "none", boxSizing: "border-box" }} />
          </div>

          {searchQuery ? (
            filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: C.muted }}><div style={{ fontSize: 28, marginBottom: 8 }}>😶</div><p>No patients found</p></div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {filtered.map(p => (
                  <div key={p.id} onClick={() => setSelectedPatient(p.id)} style={{ padding: "13px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 8, border: `1px solid ${selectedPatient === p.id ? C.teal : C.border}`, background: selectedPatient === p.id ? `${C.teal}08` : C.surfaceHi, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "border-color 0.15s" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <p style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{p.name}</p>
                        <Badge color={C.blue}>{p.id}</Badge>
                      </div>
                      <p style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>{p.age} yrs · {p.gender} · {p.phone}</p>
                    </div>
                    <span style={{ color: C.muted, fontSize: 16 }}>›</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <p style={{ fontSize: 14 }}>Type a name, ID, or phone to search</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>{patients.length} patients in database</p>
            </div>
          )}

          {selectedPatient && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => onShowToast("Redirecting to upload report...", "info")} style={{ padding: "11px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontFamily: "inherit", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, color: "#fff", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                📤 Upload Report for {selectedData?.name}
              </button>
              <button style={{ padding: "11px 14px", borderRadius: 9, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 13, fontFamily: "inherit", background: "transparent", color: C.text, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                📋 View Full History
              </button>
            </div>
          )}
        </div>

        {/* Patient detail + reports */}
        <div style={card}>
          {selectedData ? (
            <div>
              <div style={{ textAlign: "center", padding: "16px 0 20px", borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
                <div style={{ width: 60, height: 60, borderRadius: 16, background: `${C.teal}20`, border: `2px solid ${C.teal}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 10px" }}>{selectedData.gender === "Female" ? "👩" : "👨"}</div>
                <p style={{ color: C.text, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{selectedData.name}</p>
                <p style={{ color: C.muted, fontSize: 13 }}>{selectedData.age} yrs · {selectedData.gender}</p>
                <p style={{ color: C.muted, fontSize: 13 }}>{selectedData.phone}</p>
                <div style={{ marginTop: 8 }}><Badge color={C.blue}>{selectedData.id}</Badge></div>
              </div>
              <h4 style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📋 Health Reports</h4>
              {patientReports.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: C.muted }}><div style={{ fontSize: 28, marginBottom: 8 }}>📂</div><p>No reports found</p></div>
              ) : (
                patientReports.map((r, i) => (
                  <div key={r.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < patientReports.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "flex-start" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${C.blue}20`, border: `1px solid ${C.blue}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📄</div>
                    <div>
                      <Badge color={C.purple}>{r.category}</Badge>
                      <p style={{ color: C.text, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{r.fileName}</p>
                      <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{new Date(r.uploadDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                      {r.blockchainHash ? (
                        <p style={{ color: C.teal, fontSize: 10, marginTop: 2, fontFamily: "monospace" }}>⛓️ {r.blockchainHash.slice(0, 18)}...</p>
                      ) : (
                        <p style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>⚠️ Not on blockchain</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 48, color: C.muted }}><div style={{ fontSize: 36, marginBottom: 12 }}>👆</div><p style={{ fontSize: 14 }}>Select a patient to view details and report history</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MY PROFILE ────────────────────────────────────────────────────────────────
function MyProfileView() {
  const doc = LOGGED_IN_DOCTOR;
  const [editMode, setEditMode] = useState(false);
  const [bio, setBio]           = useState(doc.bio);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🪪 My Profile</h2>
          <p style={{ color: C.muted, fontSize: 14 }}>Manage your professional information</p>
        </div>
        <button onClick={() => setEditMode(e => !e)} style={{ padding: "9px 18px", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: editMode ? `linear-gradient(135deg, ${C.teal}, ${C.blue})` : `${C.teal}15`, border: `1px solid ${C.teal}40`, color: editMode ? "#fff" : C.teal }}>
          {editMode ? "💾 Save Changes" : "✏️ Edit Profile"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20 }}>
        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...card, textAlign: "center" }}>
            <div style={{ width: 80, height: 80, borderRadius: 18, margin: "0 auto 12px", background: `${C.teal}20`, border: `3px solid ${C.teal}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>{doc.image}</div>
            <p style={{ color: C.text, fontWeight: 800, fontSize: 17, marginBottom: 3 }}>{doc.name}</p>
            <p style={{ color: C.teal, fontWeight: 600, fontSize: 13, marginBottom: 10 }}>{doc.specialty}</p>
            <StatusDot status="online" />
            <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 5 }}>
              <StarRating value={doc.rating} />
              <span style={{ color: C.amber, fontSize: 13, fontWeight: 700 }}>{doc.rating}</span>
            </div>
            <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>({doc.reviews} reviews)</p>
          </div>
          <div style={card}>
            <h4 style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📞 Contact</h4>
            {[{ icon: "📧", value: doc.email }, { icon: "📱", value: doc.phone }, { icon: "🏥", value: doc.hospital }].map(r => (
              <div key={r.icon} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}><span style={{ fontSize: 14 }}>{r.icon}</span><p style={{ color: C.mutedHi, fontSize: 13, lineHeight: 1.4 }}>{r.value}</p></div>
            ))}
          </div>
          <div style={card}>
            <h4 style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>🌐 Languages</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{doc.languages.map(l => <Badge key={l} color={C.teal}>{l}</Badge>)}</div>
          </div>
        </div>

        {/* Main */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={card}>
            <h4 style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📝 Professional Bio</h4>
            {editMode ? (
              <textarea value={bio} onChange={e => setBio(e.target.value)} style={{ width: "100%", minHeight: 100, padding: 12, borderRadius: 10, fontSize: 14, background: C.bg, border: `1px solid ${C.teal}50`, color: C.text, outline: "none", resize: "vertical", lineHeight: 1.6, fontFamily: "inherit", boxSizing: "border-box" }} />
            ) : (
              <p style={{ color: C.text, fontSize: 14, lineHeight: 1.7, background: C.bg, padding: 14, borderRadius: 10, border: `1px solid ${C.border}` }}>{bio}</p>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[{ label: "🎓 Education", value: doc.education }, { label: "🏥 Hospital", value: doc.hospital }, { label: "⏱️ Experience", value: `${doc.experience} years` }, { label: "🪪 Doctor ID", value: doc.id }].map(r => (
              <div key={r.label} style={card}><p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>{r.label}</p><p style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{r.value}</p></div>
            ))}
          </div>
          <div style={card}>
            <h4 style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🩺 Conditions Treated</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{doc.conditions.map(c => <Badge key={c} color={C.teal} size="lg">{c}</Badge>)}</div>
          </div>
          <div style={card}>
            <h4 style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🗓️ Weekly Availability</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
              {Object.entries(doc.availability).map(([day, slots]) => (
                <div key={day} style={{ padding: "10px 6px", borderRadius: 10, textAlign: "center", background: slots.length ? `${C.teal}10` : C.bg, border: `1px solid ${slots.length ? C.teal + "30" : C.border}` }}>
                  <p style={{ color: slots.length ? C.teal : C.muted, fontSize: 12, fontWeight: 700, marginBottom: 5 }}>{day}</p>
                  <p style={{ color: C.mutedHi, fontSize: 10 }}>{slots.length ? `${slots.length} slots` : "Off"}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...card, background: `${C.teal}07`, border: `1px solid ${C.teal}25` }}>
            <h4 style={{ color: C.teal, fontWeight: 700, fontSize: 15, marginBottom: 12 }}>⛓️ Blockchain Identity</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[{ label: "Wallet", value: "0x4A2F...9B1C" }, { label: "Chain ID", value: "ETH-Mainnet" }, { label: "Tokens", value: "847 issued" }, { label: "Verified", value: "✅ On-chain" }].map(r => (
                <div key={r.label} style={{ padding: 10, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <p style={{ color: C.muted, fontSize: 11, marginBottom: 3 }}>{r.label}</p>
                  <p style={{ color: C.teal, fontSize: 13, fontFamily: "monospace", fontWeight: 700 }}>{r.value}</p>
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
  const { toasts, show } = useToast();
  const [activeView, setActiveView] = useState("overview");

  // Shared state lifted to root
  const [patients,     setPatients]     = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [reports,      setReports]      = useState([]);
  const [allDoctors,   setAllDoctors]   = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [chainStatus,  setChainStatus]  = useState({});

  // Fetch from backend, fall back to mock data
  useEffect(() => {
    Promise.all([
      fetch(`${API}/patients`).then(r => r.json()).catch(() => mockPatients),
      fetch(`${API}/appointments`).then(r => r.json()).catch(() => mockAppointments),
      fetch(`${API}/records`).then(r => r.json()).catch(() => mockHealthReports),
      fetch(`${API}/doctors`).then(r => r.json()).catch(() => mockAllDoctors),
    ]).then(([pts, appts, recs, docs]) => {
      setPatients(Array.isArray(pts)   ? pts   : mockPatients);
      setAppointments(Array.isArray(appts) ? appts : mockAppointments);
      setReports(Array.isArray(recs)   ? recs  : mockHealthReports);
      setAllDoctors(Array.isArray(docs) ? docs  : mockAllDoctors);
    }).finally(() => setLoadingAppts(false));
  }, []);

  // Complete appointment + mint blockchain token
  const handleCompleteAppt = async (appt) => {
    setChainStatus(s => ({ ...s, [appt.id]: "minting" }));
    try {
      await fetch(`${API}/appointments/${appt.id}/complete`, { method: "PUT" }).catch(() => {});
      const { issueAppointmentToken } = await import("../hooks/useBlockchain");
      const tokenId = await issueAppointmentToken(
        parseInt(appt.patientId?.replace(/\D/g, "").slice(0, 5) || "1"),
        1,
        appt.date || new Date().toISOString()
      );
      setChainStatus(s => ({ ...s, [appt.id]: "done" }));
      show(`✅ Appointment completed! On-chain token #${tokenId} minted`);
      setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: "completed" } : a));
    } catch (err) {
      setChainStatus(s => ({ ...s, [appt.id]: "failed" }));
      show(`Appointment completed (chain: ${err.message})`, "info");
      setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: "completed" } : a));
    }
  };

  const handleReschedule = async (appt) => {
    try { await fetch(`${API}/appointments/${appt.id}/reschedule`, { method: "PUT" }).catch(() => {}); }
    finally { show("Reschedule request sent to patient", "info"); }
  };

  return (
    <>
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI', 'Noto Sans', sans-serif", color: C.text }}>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          ::-webkit-scrollbar { width: 5px; }
          ::-webkit-scrollbar-track { background: ${C.bg}; }
          ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
          button, select, input, textarea { font-family: inherit; }
          @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        `}</style>

        <TopBar activeView={activeView} setActiveView={setActiveView} />

        <div style={{ maxWidth: 1300, margin: "0 auto", padding: "32px 24px", animation: "fadeIn 0.3s ease" }}>
          {activeView === "overview" && (
            <OverviewView
              appointments={appointments} patients={patients} reports={reports}
              loadingAppts={loadingAppts} chainStatus={chainStatus}
              onCompleteAppt={handleCompleteAppt} onReschedule={handleReschedule}
              setActiveView={setActiveView}
            />
          )}
          {activeView === "doctors" && (
            <DoctorsView allDoctors={allDoctors.length ? allDoctors : mockAllDoctors} />
          )}
          {activeView === "appointments" && (
            <AppointmentsView
              appointments={appointments} chainStatus={chainStatus}
              onCompleteAppt={handleCompleteAppt} onReschedule={handleReschedule}
            />
          )}
          {activeView === "patients" && (
            <PatientsView patients={patients} reports={reports} onShowToast={show} />
          )}
          {activeView === "myprofile" && <MyProfileView />}
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </>
  );
}

export default DoctorDashboard;