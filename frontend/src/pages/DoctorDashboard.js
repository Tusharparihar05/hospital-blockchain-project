import { useState } from "react";

// ── Mock Data ──────────────────────────────────────────────────────────────────
const mockPatients = [
  { id: "P001", name: "Alice Carter", age: 34, gender: "Female", phone: "9876543210" },
  { id: "P002", name: "John Doe", age: 45, gender: "Male", phone: "9123456780" },
  { id: "P003", name: "Emma Wilson", age: 29, gender: "Female", phone: "9012345678" },
  { id: "P004", name: "Michael Brown", age: 52, gender: "Male", phone: "9988776655" },
];

const mockAppointments = [
  { id: "A001", patientName: "Alice Carter", patientId: "P001", specialty: "Cardiology", date: "2026-03-15", time: "09:00 AM", status: "scheduled", isEmergency: true },
  { id: "A002", patientName: "John Doe", patientId: "P002", specialty: "General", date: "2026-03-15", time: "10:30 AM", status: "scheduled", isEmergency: false },
  { id: "A003", patientName: "Emma Wilson", patientId: "P003", specialty: "Neurology", date: "2026-03-16", time: "02:00 PM", status: "scheduled", isEmergency: false },
  { id: "A004", patientName: "Michael Brown", patientId: "P004", specialty: "Orthopedics", date: "2026-03-15", time: "11:00 AM", status: "scheduled", isEmergency: true },
];

const mockHealthReports = [
  { id: "R001", patientId: "P001", category: "Cardiology", fileName: "ECG_Report.pdf", uploadDate: "2026-03-10" },
  { id: "R002", patientId: "P002", category: "Lab", fileName: "Blood_Test.pdf", uploadDate: "2026-03-08" },
  { id: "R003", patientId: "P001", category: "Radiology", fileName: "Chest_XRay.pdf", uploadDate: "2026-03-05" },
];

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: "100vh",
    background: "#f0f4fa",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  },
  header: {
    background: "#0d1f3c",
    color: "#fff",
    padding: "0 32px",
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 2px 12px #0002",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontWeight: 800, fontSize: 20, letterSpacing: "-0.5px", color: "#60a5fa" },
  dot: { width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginRight: 6 },
  headerRight: { display: "flex", alignItems: "center", gap: 16, fontSize: 14 },
  avatar: {
    width: 36, height: 36, borderRadius: "50%",
    background: "linear-gradient(135deg,#3b82f6,#6366f1)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 14, color: "#fff",
  },
  main: { maxWidth: 1280, margin: "0 auto", padding: "32px 24px" },
  welcomeRow: { marginBottom: 28 },
  welcomeTitle: { fontSize: 26, fontWeight: 800, color: "#0d1f3c", margin: 0 },
  welcomeSub: { color: "#64748b", fontSize: 14, marginTop: 4 },

  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, marginBottom: 32 },
  statCard: {
    background: "#fff", borderRadius: 14, padding: "20px 24px",
    boxShadow: "0 1px 6px #0001",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  statCardEmergency: {
    background: "#fff1f2", border: "1.5px solid #fecaca", borderRadius: 14, padding: "20px 24px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  statLabel: { fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 500 },
  statValue: { fontSize: 28, fontWeight: 800, color: "#0d1f3c" },
  statValueRed: { fontSize: 28, fontWeight: 800, color: "#dc2626" },
  iconBox: (bg) => ({
    width: 46, height: 46, borderRadius: 12,
    background: bg, display: "flex", alignItems: "center", justifyContent: "center",
  }),

  twoCol: { display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 },
  leftCol: { display: "flex", flexDirection: "column", gap: 24 },
  rightCol: { display: "flex", flexDirection: "column", gap: 24 },

  card: {
    background: "#fff", borderRadius: 16, boxShadow: "0 1px 8px #0001",
    overflow: "hidden",
  },
  cardHeader: {
    padding: "20px 24px 16px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#0d1f3c", display: "flex", alignItems: "center", gap: 8 },
  cardDesc: { fontSize: 12, color: "#94a3b8", marginTop: 3 },
  cardBody: { padding: "20px 24px" },

  badge: (variant) => {
    const map = {
      secondary: { background: "#f1f5f9", color: "#475569" },
      emergency: { background: "#fee2e2", color: "#dc2626" },
      green: { background: "#dcfce7", color: "#16a34a" },
      blue: { background: "#dbeafe", color: "#1d4ed8" },
      purple: { background: "#ede9fe", color: "#7c3aed" },
    };
    return {
      ...map[variant] || map.secondary,
      borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600,
    };
  },

  apptCard: (isEmergency) => ({
    border: isEmergency ? "1.5px solid #fca5a5" : "1.5px solid #e2e8f0",
    background: isEmergency ? "#fff9f9" : "#fafafa",
    borderRadius: 12, padding: "16px",
    marginBottom: 12,
  }),
  apptName: { fontWeight: 700, fontSize: 14, color: "#0d1f3c" },
  apptMeta: { fontSize: 12, color: "#64748b", marginTop: 3 },
  apptActions: { display: "flex", gap: 8, marginTop: 12 },

  btn: (variant) => {
    const map = {
      primary: { background: "#2563eb", color: "#fff", border: "none" },
      outline: { background: "#fff", color: "#374151", border: "1.5px solid #d1d5db" },
      ghost: { background: "transparent", color: "#374151", border: "none" },
    };
    return {
      ...map[variant] || map.outline,
      borderRadius: 8, padding: "6px 14px", fontSize: 12,
      fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
      flex: 1, justifyContent: "center",
      transition: "opacity .15s",
    };
  },

  searchInput: {
    width: "100%", padding: "10px 14px 10px 38px",
    border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 13,
    outline: "none", background: "#f8fafc", boxSizing: "border-box",
  },
  searchWrap: { position: "relative" },
  searchIcon: { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" },

  patientItem: (selected) => ({
    padding: "12px 14px", borderRadius: 10,
    border: selected ? "1.5px solid #2563eb" : "1.5px solid #e2e8f0",
    background: selected ? "#eff6ff" : "#fff",
    cursor: "pointer", marginBottom: 8,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    transition: "border-color .15s",
  }),
  patientName: { fontWeight: 600, fontSize: 13, color: "#0d1f3c" },
  patientMeta: { fontSize: 11, color: "#64748b", marginTop: 2 },

  activityItem: (bg) => ({
    display: "flex", gap: 12, padding: "12px 14px",
    background: bg, borderRadius: 10, alignItems: "flex-start",
  }),
  activityTitle: { fontSize: 13, fontWeight: 600, color: "#0d1f3c" },
  activitySub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  activityTime: { fontSize: 10, color: "#94a3b8", marginTop: 4 },

  historyItem: {
    display: "flex", gap: 12, paddingBottom: 14, borderBottom: "1px solid #f1f5f9",
    marginBottom: 14, alignItems: "flex-start",
  },
  historyIcon: {
    width: 34, height: 34, borderRadius: 8,
    background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },

  emergencyBadge: {
    background: "#dc2626", color: "#fff", borderRadius: 5,
    padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.5px",
    display: "inline-flex", alignItems: "center", gap: 4,
  },
  quickActionBtn: {
    width: "100%", display: "flex", alignItems: "center", gap: 10,
    padding: "11px 16px", background: "#fff", border: "1.5px solid #e2e8f0",
    borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#374151",
    cursor: "pointer", marginBottom: 8, transition: "background .15s",
    textAlign: "left",
  },
};

// ── SVG Icon helpers ───────────────────────────────────────────────────────────
const Icon = ({ d, size = 18, color = "currentColor", stroke = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const CalendarIcon = ({ size, color }) => (
  <svg width={size || 18} height={size || 18} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const ClockIcon = ({ size, color }) => (
  <svg width={size || 18} height={size || 18} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const UsersIcon = ({ size, color }) => (
  <svg width={size || 18} height={size || 18} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const FileTextIcon = ({ size, color }) => (
  <svg width={size || 18} height={size || 18} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);
const SearchIcon = ({ size, color }) => (
  <svg width={size || 18} height={size || 18} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const UploadIcon = ({ size, color }) => (
  <svg width={size || 18} height={size || 18} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);
const CheckIcon = ({ size, color }) => (
  <svg width={size || 18} height={size || 18} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const RefreshIcon = ({ size, color }) => (
  <svg width={size || 18} height={size || 18} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);
const ChevronRightIcon = ({ size, color }) => (
  <svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const AlertIcon = ({ size, color }) => (
  <svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

// ── Toast (simple) ─────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = (msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };
  return { toasts, show };
}

function ToastContainer({ toasts }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999, display: "flex", flexDirection: "column", gap: 10 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === "success" ? "#16a34a" : t.type === "info" ? "#2563eb" : "#dc2626",
          color: "#fff", borderRadius: 10, padding: "12px 18px",
          fontSize: 13, fontWeight: 600, boxShadow: "0 4px 16px #0003",
          animation: "slideIn .25s ease",
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DoctorDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const { toasts, show } = useToast();

  const sorted = [...mockAppointments].sort((a, b) =>
    a.isEmergency === b.isEmergency ? 0 : a.isEmergency ? -1 : 1
  );
  const upcoming = sorted.filter(a => a.status === "scheduled");
  const todayCount = upcoming.filter(a => a.date === "2026-03-15").length;
  const emergencyCount = upcoming.filter(a => a.isEmergency).length;

  const filtered = mockPatients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone.includes(searchQuery)
  );

  const selectedPatientData = mockPatients.find(p => p.id === selectedPatient);
  const patientReports = mockHealthReports.filter(r => r.patientId === selectedPatient);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes slideIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:none } }
      `}</style>

      <div style={styles.root}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.logo}>⚕ MedCare</span>
            <span style={{ color: "#334155", fontSize: 13, marginLeft: 8 }}>Doctor Portal</span>
          </div>
          <div style={styles.headerRight}>
            <span style={{ color: "#94a3b8" }}>
              <span style={styles.dot} />
              Online
            </span>
            <div style={styles.avatar}>SJ</div>
            <span style={{ color: "#cbd5e1", fontWeight: 600 }}>Dr. Sarah Johnson</span>
          </div>
        </header>

        <main style={styles.main}>
          {/* Welcome */}
          <div style={styles.welcomeRow}>
            <h1 style={styles.welcomeTitle}>Welcome back, Dr. Sarah Johnson 👋</h1>
            <p style={styles.welcomeSub}>Cardiology Department · Sunday, March 15 2026</p>
          </div>

          {/* Stats */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div>
                <div style={styles.statLabel}>Today's Appointments</div>
                <div style={styles.statValue}>{todayCount}</div>
              </div>
              <div style={styles.iconBox("#dbeafe")}>
                <CalendarIcon size={22} color="#2563eb" />
              </div>
            </div>
            <div style={styles.statCardEmergency}>
              <div>
                <div style={{ ...styles.statLabel, color: "#dc2626" }}>Emergency Cases</div>
                <div style={styles.statValueRed}>{emergencyCount}</div>
              </div>
              <div style={styles.iconBox("#fee2e2")}>
                <AlertIcon size={22} color="#dc2626" />
              </div>
            </div>
            <div style={styles.statCard}>
              <div>
                <div style={styles.statLabel}>Total Patients</div>
                <div style={styles.statValue}>{mockPatients.length}</div>
              </div>
              <div style={styles.iconBox("#dcfce7")}>
                <UsersIcon size={22} color="#16a34a" />
              </div>
            </div>
            <div style={styles.statCard}>
              <div>
                <div style={styles.statLabel}>Reports Submitted</div>
                <div style={styles.statValue}>{mockHealthReports.length}</div>
              </div>
              <div style={styles.iconBox("#ede9fe")}>
                <FileTextIcon size={22} color="#7c3aed" />
              </div>
            </div>
          </div>

          {/* Two-column layout */}
          <div style={styles.twoCol}>
            {/* LEFT */}
            <div style={styles.leftCol}>

              {/* Patient Queue */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.cardTitle}>
                      <UsersIcon size={17} color="#2563eb" /> Patient Queue
                    </div>
                    <div style={styles.cardDesc}>Emergency cases shown first</div>
                  </div>
                  <span style={styles.badge("secondary")}>{upcoming.length} Scheduled</span>
                </div>
                <div style={styles.cardBody}>
                  {upcoming.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#94a3b8", padding: "32px 0" }}>
                      <CalendarIcon size={40} color="#cbd5e1" />
                      <p style={{ marginTop: 12 }}>No appointments scheduled</p>
                    </div>
                  ) : (
                    upcoming.map(appt => (
                      <div key={appt.id} style={styles.apptCard(appt.isEmergency)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={styles.apptName}>{appt.patientName}</span>
                              {appt.isEmergency && (
                                <span style={styles.emergencyBadge}>
                                  <AlertIcon size={10} color="#fff" /> EMERGENCY
                                </span>
                              )}
                            </div>
                            <div style={styles.apptMeta}>Patient ID: {appt.patientId}</div>
                          </div>
                          <span style={styles.badge("secondary")}>{appt.specialty}</span>
                        </div>
                        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "#64748b" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <CalendarIcon size={13} /> {new Date(appt.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <ClockIcon size={13} /> {appt.time}
                          </span>
                        </div>
                        <div style={styles.apptActions}>
                          <button style={styles.btn("outline")} onClick={() => show("Appointment accepted")}>
                            <CheckIcon size={14} color="#16a34a" /> Accept
                          </button>
                          <button style={styles.btn("outline")} onClick={() => show("Reschedule dialog would open", "info")}>
                            <RefreshIcon size={14} /> Reschedule
                          </button>
                          <button style={styles.btn("primary")} onClick={() => show("Appointment marked as completed")}>
                            <CheckIcon size={14} color="#fff" /> Complete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Patient Search */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.cardTitle}><SearchIcon size={17} color="#2563eb" /> Quick Patient Search</div>
                    <div style={styles.cardDesc}>Find a patient to view history or upload reports</div>
                  </div>
                </div>
                <div style={styles.cardBody}>
                  <div style={styles.searchWrap}>
                    <span style={styles.searchIcon}><SearchIcon size={15} color="#94a3b8" /></span>
                    <input
                      style={styles.searchInput}
                      placeholder="Search by name, ID, or phone number..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {searchQuery && (
                    <div style={{ marginTop: 14, maxHeight: 280, overflowY: "auto" }}>
                      {filtered.length === 0 ? (
                        <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>No patients found</p>
                      ) : (
                        filtered.map(p => (
                          <div key={p.id} style={styles.patientItem(selectedPatient === p.id)}
                            onClick={() => setSelectedPatient(p.id)}>
                            <div>
                              <div style={styles.patientName}>{p.name}</div>
                              <div style={styles.patientMeta}>ID: {p.id} · {p.age} yrs · {p.gender}</div>
                              <div style={{ ...styles.patientMeta, marginTop: 2 }}>{p.phone}</div>
                            </div>
                            <ChevronRightIcon size={16} color="#94a3b8" />
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {selectedPatient && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 8 }}>
                      <button style={{ ...styles.btn("primary"), flex: "none", justifyContent: "flex-start" }}
                        onClick={() => show("Redirecting to submit report...")}>
                        <UploadIcon size={15} color="#fff" /> Upload Report for Selected Patient
                      </button>
                      <button style={{ ...styles.btn("outline"), flex: "none", justifyContent: "flex-start" }}>
                        <FileTextIcon size={15} /> View Patient History
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div style={styles.rightCol}>

              {/* Quick Actions */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.cardTitle}>Quick Actions</div>
                </div>
                <div style={styles.cardBody}>
                  {[
                    { icon: <UploadIcon size={16} color="#2563eb" />, label: "Submit Patient Report" },
                    { icon: <CalendarIcon size={16} color="#2563eb" />, label: "View Schedule" },
                    { icon: <UsersIcon size={16} color="#2563eb" />, label: "All Patients" },
                  ].map(a => (
                    <button key={a.label} style={styles.quickActionBtn}
                      onClick={() => show(`${a.label} clicked`, "info")}>
                      {a.icon}
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.cardTitle}>Recent Activity</div>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={styles.activityItem("#f0fdf4")}>
                    <CheckIcon size={16} color="#16a34a" />
                    <div>
                      <div style={styles.activityTitle}>Report Submitted</div>
                      <div style={styles.activitySub}>Blood test for John Doe</div>
                      <div style={styles.activityTime}>2 hours ago</div>
                    </div>
                  </div>
                  <div style={styles.activityItem("#eff6ff")}>
                    <CalendarIcon size={16} color="#2563eb" />
                    <div>
                      <div style={styles.activityTitle}>Appointment Completed</div>
                      <div style={styles.activitySub}>Michael Brown checkup</div>
                      <div style={styles.activityTime}>Yesterday</div>
                    </div>
                  </div>
                  <div style={styles.activityItem("#faf5ff")}>
                    <UploadIcon size={16} color="#7c3aed" />
                    <div>
                      <div style={styles.activityTitle}>Lab Results Uploaded</div>
                      <div style={styles.activitySub}>Emma Wilson MRI scan</div>
                      <div style={styles.activityTime}>2 days ago</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Patient History (conditional) */}
              {selectedPatient && selectedPatientData && (
                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <div style={styles.cardTitle}><FileTextIcon size={16} color="#2563eb" /> Patient History</div>
                      <div style={styles.cardDesc}>{selectedPatientData.name}</div>
                    </div>
                  </div>
                  <div style={styles.cardBody}>
                    {patientReports.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "12px 0" }}>No reports found</p>
                    ) : (
                      patientReports.map((r, i) => (
                        <div key={r.id} style={{ ...styles.historyItem, ...(i === patientReports.length - 1 ? { borderBottom: "none", paddingBottom: 0, marginBottom: 0 } : {}) }}>
                          <div style={styles.historyIcon}><FileTextIcon size={16} color="#2563eb" /></div>
                          <div>
                            <span style={styles.badge("blue")}>{r.category}</span>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0d1f3c", marginTop: 4 }}>{r.fileName}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{new Date(r.uploadDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}