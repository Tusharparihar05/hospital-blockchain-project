import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const COLORS = {
  bg: "#0a0f1e", card: "#0f1729", cardBorder: "#1a2540",
  accent: "#00d4ff", accent2: "#7c3aed", green: "#10b981",
  red: "#ef4444", yellow: "#f59e0b", text: "#e2e8f0", muted: "#64748b",
};

const mockDoctors = [
  { id: "DOC-001", name: "Dr. Ananya Singh", specialty: "Cardiology",   rating: 4.8, experience: "12 yrs", image: "👩‍⚕️", availability: ["9:00 AM", "10:30 AM", "2:00 PM", "4:00 PM"] },
  { id: "DOC-002", name: "Dr. Vikram Patel", specialty: "Dermatology",  rating: 4.5, experience: "8 yrs",  image: "👨‍⚕️", availability: ["11:00 AM", "1:00 PM", "3:30 PM", "5:00 PM"] },
  { id: "DOC-003", name: "Dr. Meena Roy",    specialty: "Orthopedics",  rating: 4.9, experience: "15 yrs", image: "👩‍⚕️", availability: ["9:30 AM", "11:30 AM", "2:30 PM"] },
  { id: "DOC-004", name: "Dr. Suresh Nair",  specialty: "Neurology",    rating: 4.7, experience: "10 yrs", image: "👨‍⚕️", availability: ["10:00 AM", "12:00 PM", "3:00 PM", "5:30 PM"] },
];

const mockReports = [
  { id: "R001", fileName: "Blood_Test_March2026.pdf",    category: "Blood Test",    uploadDate: "2026-03-01", aiSummary: { keyFindings: ["Cholesterol slightly elevated at 210 mg/dL", "Blood glucose normal at 95 mg/dL", "Hemoglobin within range at 14.5 g/dL"], plainLanguage: "Your blood test shows mostly good results. Blood sugar and red blood cells are healthy. Cholesterol is slightly high — manageable with diet and exercise.", recommendedSteps: ["Reduce saturated fat intake", "30 min daily exercise", "Follow-up in 3 months"] } },
  { id: "R002", fileName: "Chest_Xray_Feb2026.pdf",      category: "X-Ray",         uploadDate: "2026-02-14", aiSummary: { keyFindings: ["No abnormalities detected", "Lung fields clear", "Heart size normal"], plainLanguage: "Your chest X-ray looks completely normal. Lungs are clear and heart is a healthy size.", recommendedSteps: ["No immediate action required", "Routine check in 1 year"] } },
  { id: "R003", fileName: "Prescription_Jan2026.pdf",    category: "Prescription",  uploadDate: "2026-01-20", aiSummary: null },
];

const cardStyle = {
  background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: 16, padding: 24,
};

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar() {
  return (
    <div style={{
      background: "#080d1a", borderBottom: `1px solid ${COLORS.cardBorder}`,
      padding: "0 32px", height: 64,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>⛓️</div>
        <div>
          <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, fontFamily: "monospace" }}>MediChain</div>
          <div style={{ color: COLORS.muted, fontSize: 10 }}>Patient Portal</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link to="/patient/upload" style={{
          color: COLORS.accent, fontSize: 13, textDecoration: "none",
          padding: "6px 14px", borderRadius: 8,
          background: `${COLORS.accent}15`, border: `1px solid ${COLORS.accent}30`,
        }}>📤 Upload Report</Link>
        <Link to="/" style={{
          color: COLORS.muted, fontSize: 13, textDecoration: "none",
          padding: "6px 14px", borderRadius: 8, border: `1px solid ${COLORS.cardBorder}`,
        }}>Logout</Link>
      </div>
    </div>
  );
}

// ── AISummaryCard ─────────────────────────────────────────────────────────────
function AISummaryCard({ summary }) {
  return (
    <div style={{ background: `${COLORS.accent2}0d`, border: `1px solid ${COLORS.accent2}30`, borderRadius: 14, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 20 }}>✨</span>
        <h4 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>AI Summary</h4>
      </div>

      <div style={{ marginBottom: 20 }}>
        <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Plain Language Explanation</p>
        <p style={{ color: COLORS.text, fontSize: 14, lineHeight: 1.7, background: COLORS.bg, padding: 14, borderRadius: 10 }}>
          {summary.plainLanguage}
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Key Findings</p>
        {summary.keyFindings.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
            <span style={{ color: COLORS.yellow, marginTop: 2 }}>⚡</span>
            <span style={{ color: COLORS.text, fontSize: 14 }}>{f}</span>
          </div>
        ))}
      </div>

      <div>
        <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Recommended Steps</p>
        {summary.recommendedSteps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
            <span style={{ color: COLORS.green, marginTop: 2 }}>✅</span>
            <span style={{ color: COLORS.text, fontSize: 14 }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function PatientDashboard() {
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedTime, setSelectedTime]     = useState("");
  const [isEmergency, setIsEmergency]       = useState(false);
  const [activeTab, setActiveTab]           = useState("reports");
  const [selectedReport, setSelectedReport] = useState(mockReports[0]);

  const handleBookAppointment = () => {
    if (!selectedDoctor || !selectedTime) {
      toast.error("Please select a doctor and time slot");
      return;
    }
    const emergencyText = isEmergency ? " (Emergency Priority)" : "";
    toast.success(`Appointment booked with ${selectedDoctor.name} at ${selectedTime}${emergencyText}`);
    setSelectedDoctor(null);
    setSelectedTime("");
    setIsEmergency(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Segoe UI', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0f1e; }
        ::-webkit-scrollbar-thumb { background: #1a2540; border-radius: 3px; }
      `}</style>
      <TopBar />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {/* Welcome */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: COLORS.text, fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Welcome back, John! 👋</h1>
          <p style={{ color: COLORS.muted }}>Manage your health appointments and records</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Upcoming Appointments", value: "2", icon: "📅", color: COLORS.accent  },
            { label: "Health Reports",         value: mockReports.length, icon: "📋", color: COLORS.green  },
            { label: "Notifications",          value: "3", icon: "🔔", color: COLORS.yellow },
          ].map(s => (
            <div key={s.label} style={{ ...cardStyle }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 6 }}>{s.label}</p>
                  <p style={{ color: s.color, fontSize: 32, fontWeight: 800, fontFamily: "monospace" }}>{s.value}</p>
                </div>
                <span style={{ fontSize: 36 }}>{s.icon}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 28 }}>

          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Upcoming Appointments */}
            <div style={cardStyle}>
              <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 16 }}>📅 Upcoming Appointments</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { doctor: "Dr. Sarah Johnson", dept: "Cardiology",      date: "March 15, 2026 - 10:30 AM", emergency: true  },
                  { doctor: "Dr. Robert Lee",     dept: "General Medicine", date: "March 20, 2026 - 2:00 PM",  emergency: false },
                ].map(a => (
                  <div key={a.doctor} style={{
                    display: "flex", gap: 14, padding: 16, borderRadius: 12,
                    background: a.emergency ? `${COLORS.accent}08` : COLORS.bg,
                    border: `1px solid ${a.emergency ? COLORS.accent + "30" : COLORS.cardBorder}`,
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      background: a.emergency ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})` : COLORS.cardBorder,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                    }}>📅</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div>
                          <p style={{ color: COLORS.text, fontWeight: 700 }}>{a.doctor}</p>
                          <p style={{ color: COLORS.muted, fontSize: 12 }}>{a.dept}</p>
                        </div>
                        <span style={{
                          fontSize: 11, padding: "3px 10px", borderRadius: 20, height: "fit-content",
                          background: a.emergency ? `${COLORS.red}22` : `${COLORS.muted}22`,
                          color: a.emergency ? COLORS.red : COLORS.muted,
                          border: `1px solid ${a.emergency ? COLORS.red : COLORS.muted}44`,
                        }}>{a.emergency ? "🚨 Emergency" : "Regular"}</span>
                      </div>
                      <p style={{ color: COLORS.muted, fontSize: 13 }}>🕐 {a.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Book Appointment */}
            <div style={cardStyle}>
              <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Book New Appointment</h3>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 20 }}>Find available doctors and schedule your visit</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {mockDoctors.map(doctor => (
                  <div
                    key={doctor.id}
                    onClick={() => setSelectedDoctor(doctor)}
                    style={{
                      padding: 14, borderRadius: 12, cursor: "pointer",
                      border: `2px solid ${selectedDoctor?.id === doctor.id ? COLORS.accent : COLORS.cardBorder}`,
                      background: selectedDoctor?.id === doctor.id ? `${COLORS.accent}0d` : COLORS.bg,
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 28 }}>{doctor.image}</span>
                      <div>
                        <p style={{ color: COLORS.text, fontWeight: 700, fontSize: 13 }}>{doctor.name}</p>
                        <p style={{ color: COLORS.muted, fontSize: 11 }}>{doctor.specialty}</p>
                        <p style={{ color: COLORS.yellow, fontSize: 11 }}>⭐ {doctor.rating} · {doctor.experience}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedDoctor && (
                <div style={{ background: COLORS.bg, borderRadius: 12, padding: 16, border: `1px solid ${COLORS.cardBorder}` }}>
                  <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 12 }}>Available Time Slots</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {selectedDoctor.availability.map(time => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        style={{
                          padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                          background: selectedTime === time ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})` : "transparent",
                          border: `1px solid ${selectedTime === time ? COLORS.accent : COLORS.cardBorder}`,
                          color: selectedTime === time ? "#fff" : COLORS.text,
                        }}
                      >{time}</button>
                    ))}
                  </div>

                  {/* Emergency toggle */}
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: 12, background: COLORS.card, borderRadius: 10,
                    border: `1px solid ${COLORS.cardBorder}`, marginBottom: 12,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>⚠️</span>
                      <span style={{ color: COLORS.text, fontSize: 14 }}>Mark as Emergency</span>
                    </div>
                    <div
                      onClick={() => setIsEmergency(e => !e)}
                      style={{
                        width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                        background: isEmergency ? COLORS.red : COLORS.cardBorder,
                        position: "relative", transition: "background 0.2s",
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", background: "#fff",
                        position: "absolute", top: 3,
                        left: isEmergency ? 23 : 3,
                        transition: "left 0.2s",
                      }} />
                    </div>
                  </div>

                  {isEmergency && (
                    <div style={{
                      padding: 12, background: `${COLORS.red}11`,
                      border: `1px solid ${COLORS.red}33`, borderRadius: 10,
                      color: COLORS.red, fontSize: 13, marginBottom: 12,
                    }}>
                      Emergency appointments receive priority handling and will be placed at the top of the queue.
                    </div>
                  )}

                  <button onClick={handleBookAppointment} style={{
                    width: "100%", padding: "12px",
                    background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                    border: "none", color: "#fff", fontSize: 15, fontWeight: 700,
                    borderRadius: 10, cursor: "pointer",
                  }}>Book Appointment</button>
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Notifications */}
            <div style={cardStyle}>
              <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🔔 Notifications</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { icon: "✅", color: COLORS.accent,  bg: `${COLORS.accent}10`,  title: "Appointment Confirmed", desc: "Your appointment with Dr. Johnson is scheduled" },
                  { icon: "📄", color: COLORS.green,   bg: `${COLORS.green}10`,   title: "New Report Available",  desc: "Blood test results have been uploaded" },
                  { icon: "🕐", color: COLORS.yellow,  bg: `${COLORS.yellow}10`,  title: "Appointment Reminder",  desc: "Tomorrow at 10:30 AM" },
                ].map(n => (
                  <div key={n.title} style={{ display: "flex", gap: 10, padding: 12, borderRadius: 10, background: n.bg }}>
                    <span style={{ fontSize: 16 }}>{n.icon}</span>
                    <div>
                      <p style={{ color: COLORS.text, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{n.title}</p>
                      <p style={{ color: COLORS.muted, fontSize: 12 }}>{n.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div style={cardStyle}>
              <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Quick Actions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Link to="/patient/upload" style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 14px", borderRadius: 10,
                  border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text,
                  fontSize: 14, textDecoration: "none", background: COLORS.bg,
                }}>📤 Upload Health Report</Link>
                <button style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 14px", borderRadius: 10,
                  border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text,
                  fontSize: 14, background: COLORS.bg, cursor: "pointer", width: "100%",
                }}>📋 View All Reports</button>
              </div>
            </div>
          </div>
        </div>

        {/* Health Reports Section */}
        <div style={cardStyle}>
          <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>📋 My Health Reports</h3>
          <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 20 }}>View your uploaded reports and AI summaries</p>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20, background: COLORS.bg, padding: 4, borderRadius: 10, width: "fit-content" }}>
            {[
              { key: "reports", label: `All Reports (${mockReports.length})` },
              { key: "summary", label: "AI Summary" },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13,
                background: activeTab === tab.key ? COLORS.card : "transparent",
                color: activeTab === tab.key ? COLORS.text : COLORS.muted,
                fontWeight: activeTab === tab.key ? 700 : 400,
                boxShadow: activeTab === tab.key ? `0 1px 4px ${COLORS.cardBorder}` : "none",
              }}>{tab.label}</button>
            ))}
          </div>

          {activeTab === "reports" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {mockReports.map(report => (
                <div
                  key={report.id}
                  onClick={() => { setSelectedReport(report); setActiveTab("summary"); }}
                  style={{
                    padding: 16, borderRadius: 12, cursor: "pointer",
                    border: `1px solid ${COLORS.cardBorder}`, background: COLORS.bg,
                    transition: "border-color 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.cardBorder}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      background: `${COLORS.accent}15`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                    }}>📄</div>
                    <div>
                      <p style={{ color: COLORS.text, fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{report.fileName}</p>
                      <span style={{
                        background: `${COLORS.accent2}20`, color: "#a78bfa",
                        border: `1px solid ${COLORS.accent2}30`,
                        padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      }}>{report.category}</span>
                      <p style={{ color: COLORS.muted, fontSize: 11, marginTop: 6 }}>
                        Uploaded: {new Date(report.uploadDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "summary" && (
            selectedReport?.aiSummary
              ? <AISummaryCard summary={selectedReport.aiSummary} />
              : (
                <div style={{ textAlign: "center", padding: 48, color: COLORS.muted }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>📄</div>
                  <p>No AI summary available for this report yet.</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}>Processing may take a few minutes.</p>
                </div>
              )
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientDashboard;