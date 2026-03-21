import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { verifyRecord, hashData } from "../hooks/useBlockchain";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const PATIENT_NUM_ID = 72;

const COLORS = {
  bg: "#0a0f1e", card: "#0f1729", cardBorder: "#1a2540",
  accent: "#00d4ff", accent2: "#7c3aed", green: "#10b981",
  red: "#ef4444", yellow: "#f59e0b", text: "#e2e8f0", muted: "#64748b",
};

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
  const [doctors, setDoctors]                       = useState([]);
  const [reports, setReports]                       = useState([]);
  const [appointments, setAppointments]             = useState([]);
  const [selectedDoctor, setSelectedDoctor]         = useState(null);
  const [selectedTime, setSelectedTime]             = useState("");
  const [isEmergency, setIsEmergency]               = useState(false);
  const [activeTab, setActiveTab]                   = useState("reports");
  const [selectedReport, setSelectedReport]         = useState(null);
  const [loading, setLoading]                       = useState(true);
  const [bookingLoading, setBookingLoading]         = useState(false);
  const [verifyStatus, setVerifyStatus]             = useState({}); // reportId -> "checking"|"verified"|"failed"

  // ── Fetch from backend ────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`${API}/doctors`).then(r => r.json()).catch(() => []),
      fetch(`${API}/records/HLT-0x72A91B`).then(r => r.json()).catch(() => []),
      fetch(`${API}/appointments?patientId=HLT-0x72A91B`).then(r => r.json()).catch(() => []),
    ]).then(([docs, recs, appts]) => {
      setDoctors(docs.length ? docs : mockDoctors);
      setReports(recs.length ? recs : mockReports);
      setAppointments(appts.length ? appts : []);
      if (recs.length || mockReports.length) setSelectedReport((recs[0] || mockReports[0]));
    }).finally(() => setLoading(false));
  }, []);

  // ── Verify a report on chain ───────────────────────────────────────────────
  const handleVerifyReport = async (report, idx) => {
    setVerifyStatus(s => ({ ...s, [idx]: "checking" }));
    try {
      const ok = await verifyRecord(PATIENT_NUM_ID, report);
      setVerifyStatus(s => ({ ...s, [idx]: ok ? "verified" : "failed" }));
      toast[ok ? "success" : "error"](ok ? "✅ Record verified on blockchain!" : "⚠️ Hash mismatch — record may have been altered!");
    } catch (err) {
      setVerifyStatus(s => ({ ...s, [idx]: "failed" }));
      toast.error("Verification failed: " + err.message);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedDoctor || !selectedTime) {
      toast.error("Please select a doctor and time slot");
      return;
    }
    setBookingLoading(true);
    try {
      // Call backend
      const res = await fetch(`${API}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: "HLT-0x72A91B",
          doctorId: selectedDoctor.id,
          doctorName: selectedDoctor.name,
          time: selectedTime,
          isEmergency,
          date: new Date().toISOString().split("T")[0],
        }),
      });
      const data = await res.json();

      // Mint on-chain token
      try {
        const { issueAppointmentToken } = await import("../hooks/useBlockchain");
        const tokenId = await issueAppointmentToken(PATIENT_NUM_ID, 1, new Date().toISOString());
        toast.success(`Appointment booked! On-chain token #${tokenId} minted ✅`);
      } catch (chainErr) {
        toast.success(`Appointment booked with ${selectedDoctor.name} at ${selectedTime}${isEmergency ? " (Emergency)" : ""}`);
        console.warn("Chain mint failed:", chainErr.message);
      }

      setSelectedDoctor(null);
      setSelectedTime("");
      setIsEmergency(false);
    } catch (err) {
      // Backend not connected — just show local success
      const emergencyText = isEmergency ? " (Emergency Priority)" : "";
      toast.success(`Appointment booked with ${selectedDoctor.name} at ${selectedTime}${emergencyText}`);
      setSelectedDoctor(null);
      setSelectedTime("");
      setIsEmergency(false);
    } finally {
      setBookingLoading(false);
    }
  };

  const displayReports = reports.length ? reports : mockReports;
  const displayDoctors = doctors.length ? doctors : mockDoctors;

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
            { label: "Upcoming Appointments", value: appointments.length || "2", icon: "📅", color: COLORS.accent },
            { label: "Health Reports",         value: displayReports.length,     icon: "📋", color: COLORS.green },
            { label: "Notifications",          value: "3",                        icon: "🔔", color: COLORS.yellow },
          ].map(s => (
            <div key={s.label} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 6 }}>{s.label}</p>
                  <p style={{ color: s.color, fontSize: 32, fontWeight: 800, fontFamily: "monospace" }}>{s.value}</p>
                </div>
                <span style={{ fontSize: 32 }}>{s.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 28 }}>

          {/* Left — Book Appointment */}
          <div style={cardStyle}>
            <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🗓️ Book Appointment</h3>
            <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 20 }}>Select a doctor and time slot</p>

            {/* Doctor list */}
            <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
              {displayDoctors.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => { setSelectedDoctor(doc); setSelectedTime(""); }}
                  style={{
                    padding: 14, borderRadius: 12, cursor: "pointer", transition: "border-color 0.2s",
                    border: `1px solid ${selectedDoctor?.id === doc.id ? COLORS.accent : COLORS.cardBorder}`,
                    background: selectedDoctor?.id === doc.id ? `${COLORS.accent}08` : COLORS.bg,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{doc.image || "👨‍⚕️"}</span>
                    <div>
                      <p style={{ color: COLORS.text, fontWeight: 600, fontSize: 14 }}>{doc.name}</p>
                      <p style={{ color: COLORS.muted, fontSize: 12 }}>{doc.specialty} · {doc.experience}</p>
                      <p style={{ color: COLORS.yellow, fontSize: 12 }}>⭐ {doc.rating}</p>
                    </div>
                  </div>
                  {selectedDoctor?.id === doc.id && <span style={{ color: COLORS.accent, fontSize: 20 }}>✓</span>}
                </div>
              ))}
            </div>

            {/* Time slots */}
            {selectedDoctor && (
              <div>
                <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 10 }}>Available Times</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {selectedDoctor.availability.map(t => (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      style={{
                        padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                        border: `1px solid ${selectedTime === t ? COLORS.accent : COLORS.cardBorder}`,
                        background: selectedTime === t ? `${COLORS.accent}22` : COLORS.bg,
                        color: selectedTime === t ? COLORS.accent : COLORS.text,
                        fontWeight: selectedTime === t ? 700 : 400,
                      }}
                    >{t}</button>
                  ))}
                </div>

                {/* Emergency toggle */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "10px 14px", background: COLORS.bg, borderRadius: 10, border: `1px solid ${COLORS.cardBorder}` }}>
                  <span style={{ color: COLORS.text, fontSize: 13 }}>🚨 Emergency Priority</span>
                  <div
                    onClick={() => setIsEmergency(!isEmergency)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, position: "relative", cursor: "pointer",
                      background: isEmergency ? COLORS.red : COLORS.cardBorder, transition: "background 0.2s",
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3, left: isEmergency ? 23 : 3, transition: "left 0.2s",
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

                <button onClick={handleBookAppointment} disabled={bookingLoading} style={{
                  width: "100%", padding: "12px",
                  background: bookingLoading ? COLORS.cardBorder : `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                  border: "none", color: "#fff", fontSize: 15, fontWeight: 700,
                  borderRadius: 10, cursor: bookingLoading ? "not-allowed" : "pointer",
                }}>
                  {bookingLoading ? "⛓️ Minting token..." : "Book Appointment"}
                </button>
              </div>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Notifications */}
            <div style={cardStyle}>
              <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🔔 Notifications</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { icon: "✅", color: COLORS.accent,  bg: `${COLORS.accent}10`,  title: "Appointment Confirmed",  desc: "Your appointment with Dr. Johnson is scheduled" },
                  { icon: "📄", color: COLORS.green,   bg: `${COLORS.green}10`,   title: "New Report Available",   desc: "Blood test results have been uploaded" },
                  { icon: "🕐", color: COLORS.yellow,  bg: `${COLORS.yellow}10`,  title: "Appointment Reminder",   desc: "Tomorrow at 10:30 AM" },
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
                <button
                  onClick={() => setActiveTab("reports")}
                  style={{
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

          <div style={{ display: "flex", gap: 4, marginBottom: 20, background: COLORS.bg, padding: 4, borderRadius: 10, width: "fit-content" }}>
            {[
              { key: "reports", label: `All Reports (${displayReports.length})` },
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
              {displayReports.map((report, idx) => (
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
                    <div style={{ flex: 1 }}>
                      <p style={{ color: COLORS.text, fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{report.fileName}</p>
                      <span style={{
                        background: `${COLORS.accent2}20`, color: "#a78bfa",
                        border: `1px solid ${COLORS.accent2}30`,
                        padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      }}>{report.category}</span>
                      <p style={{ color: COLORS.muted, fontSize: 11, marginTop: 6 }}>
                        Uploaded: {new Date(report.uploadDate).toLocaleDateString()}
                      </p>
                      {/* ── Blockchain verify button ─────────────────────── */}
                      <button
                        onClick={e => { e.stopPropagation(); handleVerifyReport(report, idx); }}
                        disabled={verifyStatus[idx] === "checking"}
                        style={{
                          marginTop: 8, fontSize: 11, padding: "3px 10px", borderRadius: 6,
                          cursor: "pointer", border: "none",
                          background: verifyStatus[idx] === "verified" ? `${COLORS.green}22`
                            : verifyStatus[idx] === "failed"   ? `${COLORS.red}22`
                            : `${COLORS.accent}22`,
                          color: verifyStatus[idx] === "verified" ? COLORS.green
                            : verifyStatus[idx] === "failed"   ? COLORS.red
                            : COLORS.accent,
                        }}
                      >
                        {verifyStatus[idx] === "checking"  ? "⛓️ Checking..."
                          : verifyStatus[idx] === "verified" ? "✅ Blockchain Verified"
                          : verifyStatus[idx] === "failed"   ? "⚠️ Hash Mismatch"
                          : "🔍 Verify on Chain"}
                      </button>
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

// ── Fallback mock data (used when backend is offline) ─────────────────────────
const mockDoctors = [
  { id: "DOC-001", name: "Dr. Ananya Singh", specialty: "Cardiology",  rating: 4.8, experience: "12 yrs", image: "👩‍⚕️", availability: ["9:00 AM", "10:30 AM", "2:00 PM", "4:00 PM"] },
  { id: "DOC-002", name: "Dr. Vikram Patel", specialty: "Dermatology", rating: 4.5, experience: "8 yrs",  image: "👨‍⚕️", availability: ["11:00 AM", "1:00 PM", "3:30 PM", "5:00 PM"] },
  { id: "DOC-003", name: "Dr. Meena Roy",    specialty: "Orthopedics", rating: 4.9, experience: "15 yrs", image: "👩‍⚕️", availability: ["9:30 AM", "11:30 AM", "2:30 PM"] },
  { id: "DOC-004", name: "Dr. Suresh Nair",  specialty: "Neurology",   rating: 4.7, experience: "10 yrs", image: "👨‍⚕️", availability: ["10:00 AM", "12:00 PM", "3:00 PM", "5:30 PM"] },
];

const mockReports = [
  { id: "R001", fileName: "Blood_Test_March2026.pdf",   category: "Blood Test",   uploadDate: "2026-03-01", aiSummary: { keyFindings: ["Cholesterol slightly elevated at 210 mg/dL", "Blood glucose normal at 95 mg/dL", "Hemoglobin within range at 14.5 g/dL"], plainLanguage: "Your blood test shows mostly good results. Blood sugar and red blood cells are healthy. Cholesterol is slightly high — manageable with diet and exercise.", recommendedSteps: ["Reduce saturated fat intake", "30 min daily exercise", "Follow-up in 3 months"] } },
  { id: "R002", fileName: "Chest_Xray_Feb2026.pdf",     category: "X-Ray",        uploadDate: "2026-02-14", aiSummary: { keyFindings: ["No abnormalities detected", "Lung fields clear", "Heart size normal"], plainLanguage: "Your chest X-ray looks completely normal. Lungs are clear and heart is a healthy size.", recommendedSteps: ["No immediate action required", "Routine check in 1 year"] } },
  { id: "R003", fileName: "Prescription_Jan2026.pdf",   category: "Prescription", uploadDate: "2026-01-20", aiSummary: null },
];

export default PatientDashboard;