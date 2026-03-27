import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { verifyRecord } from "../hooks/useBlockchain";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const PATIENT_NUM_ID = 72;

const COLORS = {
  bg: "#0a0f1e", card: "#0f1729", cardBorder: "#1a2540",
  accent: "#00d4ff", accent2: "#7c3aed", green: "#10b981",
  red: "#ef4444", yellow: "#f59e0b", text: "#e2e8f0", muted: "#64748b",
  cardHover: "#131d35",
};

const cardStyle = {
  background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: 16, padding: 24,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateToken() {
  const prefix = "MCT";
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${rand}`;
}

function Avatar({ name, size = 48 }) {
  const initials = name.split(" ").filter(w => w !== "Dr.").map(w => w[0]).join("").substring(0, 2);
  const colors = [
    ["#0e3a5c", "#00d4ff"], ["#2d1a5c", "#7c3aed"], ["#0a3d2e", "#10b981"],
    ["#3d2200", "#f59e0b"], ["#3d0a1a", "#ef4444"],
  ];
  const pick = colors[name.charCodeAt(4) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: pick[0], border: `2px solid ${pick[1]}40`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.33, fontWeight: 700, color: pick[1], fontFamily: "monospace",
    }}>{initials}</div>
  );
}

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

// ── Doctor Detail Modal ───────────────────────────────────────────────────────
function DoctorModal({ doctor, onClose, onSelect }) {
  if (!doctor) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 20, padding: 32, maxWidth: 560, width: "100%",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 24 }}>
          <Avatar name={doctor.name} size={64} />
          <div style={{ flex: 1 }}>
            <h2 style={{ color: COLORS.text, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{doctor.name}</h2>
            <p style={{ color: COLORS.accent, fontSize: 13, marginBottom: 4 }}>{doctor.specialty} · {doctor.hospital}</p>
            <p style={{ color: COLORS.muted, fontSize: 12 }}>{doctor.experience} experience · {doctor.education}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ color: COLORS.yellow, fontSize: 13 }}>⭐ {doctor.rating}</span>
              <span style={{ color: COLORS.muted, fontSize: 13 }}>({doctor.reviewCount} reviews)</span>
              <span style={{ color: COLORS.green, fontSize: 13, fontWeight: 700 }}>₹{doctor.fee}/consult</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* About */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>About</p>
          <p style={{ color: COLORS.text, fontSize: 14, lineHeight: 1.7, background: COLORS.bg, padding: 14, borderRadius: 10 }}>{doctor.bio}</p>
        </div>

        {/* Specializations */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Specializations</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {doctor.tags.map(tag => (
              <span key={tag} style={{
                background: `${COLORS.accent2}20`, color: "#a78bfa",
                border: `1px solid ${COLORS.accent2}30`,
                padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* Languages */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Languages Spoken</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {doctor.languages.map(lang => (
              <span key={lang} style={{
                background: `${COLORS.accent}10`, color: COLORS.accent,
                border: `1px solid ${COLORS.accent}25`,
                padding: "4px 12px", borderRadius: 20, fontSize: 12,
              }}>🗣️ {lang}</span>
            ))}
          </div>
        </div>

        {/* Reviews */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Patient Reviews</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {doctor.reviews.map((r, i) => (
              <div key={i} style={{ background: COLORS.bg, padding: 12, borderRadius: 10, border: `1px solid ${COLORS.cardBorder}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{r.name}</span>
                  <span style={{ color: COLORS.yellow, fontSize: 12 }}>{"⭐".repeat(r.rating)}</span>
                </div>
                <p style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>{r.comment}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => { onSelect(doctor); onClose(); }}
          style={{
            width: "100%", padding: 14,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
            border: "none", color: "#fff", fontSize: 15, fontWeight: 700,
            borderRadius: 12, cursor: "pointer",
          }}
        >Book Appointment with {doctor.name.split(" ").slice(-1)}</button>
      </div>
    </div>
  );
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ doctor, time, isEmergency, onClose, onSuccess }) {
  const [step, setStep] = useState("payment"); // "payment" | "processing" | "done"
  const [method, setMethod] = useState("card");
  const [token, setToken] = useState("");
  const totalFee = isEmergency ? Math.round(doctor.fee * 1.5) : doctor.fee;

  const handlePay = async () => {
    setStep("processing");
    await new Promise(r => setTimeout(r, 2200));
    const newToken = generateToken();
    setToken(newToken);
    setStep("done");
  };

  if (step === "done") {
    return (
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: COLORS.card, border: `1px solid ${COLORS.green}40`, borderRadius: 20, padding: 32, maxWidth: 440, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 style={{ color: COLORS.green, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Appointment Confirmed!</h2>
          <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 24 }}>Payment successful. Your appointment token has been generated.</p>

          {/* Token Card */}
          <div style={{
            background: COLORS.bg, border: `1px solid ${COLORS.accent}40`,
            borderRadius: 14, padding: 20, marginBottom: 24,
          }}>
            <p style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Appointment Token</p>
            <div style={{
              fontFamily: "monospace", fontSize: 28, fontWeight: 800,
              color: COLORS.accent, letterSpacing: 4, marginBottom: 16,
              background: `${COLORS.accent}10`, padding: "10px 20px", borderRadius: 10,
              border: `1px solid ${COLORS.accent}30`,
            }}>{token}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, textAlign: "left" }}>
              {[
                { label: "Doctor", value: doctor.name },
                { label: "Specialty", value: doctor.specialty },
                { label: "Time", value: time },
                { label: "Date", value: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
                { label: "Hospital", value: doctor.hospital },
                { label: "Fee Paid", value: `₹${totalFee}` },
              ].map(item => (
                <div key={item.label} style={{ background: COLORS.card, padding: "8px 12px", borderRadius: 8 }}>
                  <p style={{ color: COLORS.muted, fontSize: 10, marginBottom: 2 }}>{item.label}</p>
                  <p style={{ color: COLORS.text, fontSize: 12, fontWeight: 600 }}>{item.value}</p>
                </div>
              ))}
            </div>
            {isEmergency && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: `${COLORS.red}15`, border: `1px solid ${COLORS.red}30`, borderRadius: 8 }}>
                <p style={{ color: COLORS.red, fontSize: 12, fontWeight: 700 }}>🚨 Emergency Priority — You are #1 in queue</p>
              </div>
            )}
          </div>

          <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 20 }}>
            Show this token at the hospital reception. A confirmation SMS has been sent to your registered number.
          </p>
          <button
            onClick={() => { onSuccess(token); onClose(); }}
            style={{
              width: "100%", padding: 13,
              background: `linear-gradient(135deg, ${COLORS.green}, #059669)`,
              border: "none", color: "#fff", fontSize: 14, fontWeight: 700,
              borderRadius: 10, cursor: "pointer",
            }}
          >✅ Done</button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: COLORS.text }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: "spin 1s linear infinite" }}>⛓️</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Processing Payment...</p>
          <p style={{ color: COLORS.muted, fontSize: 13 }}>Minting appointment token on blockchain</p>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 20, padding: 28, maxWidth: 420, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: COLORS.text, fontSize: 18, fontWeight: 800 }}>💳 Payment</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {/* Summary */}
        <div style={{ background: COLORS.bg, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${COLORS.cardBorder}` }}>
            <Avatar name={doctor.name} size={40} />
            <div>
              <p style={{ color: COLORS.text, fontSize: 14, fontWeight: 700 }}>{doctor.name}</p>
              <p style={{ color: COLORS.muted, fontSize: 12 }}>{doctor.specialty} · {time}</p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: COLORS.muted, fontSize: 13 }}>Consultation Fee</span>
              <span style={{ color: COLORS.text, fontSize: 13 }}>₹{doctor.fee}</span>
            </div>
            {isEmergency && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: COLORS.red, fontSize: 13 }}>Emergency Surcharge (50%)</span>
                <span style={{ color: COLORS.red, fontSize: 13 }}>+₹{Math.round(doctor.fee * 0.5)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${COLORS.cardBorder}`, marginTop: 4 }}>
              <span style={{ color: COLORS.text, fontSize: 15, fontWeight: 700 }}>Total</span>
              <span style={{ color: COLORS.accent, fontSize: 15, fontWeight: 800 }}>₹{totalFee}</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <p style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Payment Method</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          {[
            { key: "card", label: "💳 Card" },
            { key: "upi", label: "📱 UPI" },
            { key: "netbanking", label: "🏦 Net Banking" },
          ].map(m => (
            <button
              key={m.key}
              onClick={() => setMethod(m.key)}
              style={{
                padding: "10px 6px", borderRadius: 10, cursor: "pointer", fontSize: 12,
                border: `1px solid ${method === m.key ? COLORS.accent : COLORS.cardBorder}`,
                background: method === m.key ? `${COLORS.accent}15` : COLORS.bg,
                color: method === m.key ? COLORS.accent : COLORS.muted,
                fontWeight: method === m.key ? 700 : 400,
              }}
            >{m.label}</button>
          ))}
        </div>

        {/* Card fields */}
        {method === "card" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {[
              { placeholder: "Card Number", defaultValue: "•••• •••• •••• 4242" },
              { placeholder: "Name on Card", defaultValue: "John Doe" },
            ].map(f => (
              <input key={f.placeholder} defaultValue={f.defaultValue} style={{
                background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10,
                padding: "10px 14px", color: COLORS.text, fontSize: 13, outline: "none", width: "100%",
              }} />
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input defaultValue="12/28" style={{ background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 13, outline: "none" }} />
              <input defaultValue="•••" style={{ background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 13, outline: "none" }} />
            </div>
          </div>
        )}
        {method === "upi" && (
          <input defaultValue="john@upi" style={{
            width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10,
            padding: "10px 14px", color: COLORS.text, fontSize: 13, outline: "none", marginBottom: 20,
          }} />
        )}
        {method === "netbanking" && (
          <select style={{
            width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10,
            padding: "10px 14px", color: COLORS.text, fontSize: 13, outline: "none", marginBottom: 20,
          }}>
            <option>State Bank of India</option>
            <option>HDFC Bank</option>
            <option>ICICI Bank</option>
            <option>Axis Bank</option>
          </select>
        )}

        <button onClick={handlePay} style={{
          width: "100%", padding: 14,
          background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
          border: "none", color: "#fff", fontSize: 15, fontWeight: 700,
          borderRadius: 12, cursor: "pointer",
        }}>
          Pay ₹{totalFee} & Confirm Appointment
        </button>
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
  const [doctors, setDoctors]           = useState([]);
  const [reports, setReports]           = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [isEmergency, setIsEmergency]   = useState(false);
  const [activeTab, setActiveTab]       = useState("reports");
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [verifyStatus, setVerifyStatus] = useState({});
  const [modalDoctor, setModalDoctor]   = useState(null);
  const [showPayment, setShowPayment]   = useState(false);
  const [bookedTokens, setBookedTokens] = useState([]);
  const [filterSpec, setFilterSpec]     = useState("All");

  useEffect(() => {
    Promise.all([
      fetch(`${API}/doctors`).then(r => r.json()).catch(() => []),
      fetch(`${API}/records/HLT-0x72A91B`).then(r => r.json()).catch(() => []),
      fetch(`${API}/appointments?patientId=HLT-0x72A91B`).then(r => r.json()).catch(() => []),
    ]).then(([docs, recs, appts]) => {
      setDoctors(docs.length ? docs : mockDoctors);
      setReports(recs.length ? recs : mockReports);
      setAppointments(appts.length ? appts : []);
      if (recs.length || mockReports.length) setSelectedReport(recs[0] || mockReports[0]);
    }).finally(() => setLoading(false));
  }, []);

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

  const handlePaymentSuccess = (token) => {
    const entry = {
      token, doctor: selectedDoctor, time: selectedTime,
      isEmergency, date: new Date().toLocaleDateString("en-IN"),
    };
    setBookedTokens(prev => [entry, ...prev]);
    setAppointments(prev => [entry, ...prev]);
    setSelectedDoctor(null);
    setSelectedTime("");
    setIsEmergency(false);
    toast.success(`✅ Token ${token} saved to your appointments!`);
  };

  const displayReports = reports.length ? reports : mockReports;
  const displayDoctors = doctors.length ? doctors : mockDoctors;
  const specialties = ["All", ...new Set(displayDoctors.map(d => d.specialty))];
  const filteredDoctors = filterSpec === "All" ? displayDoctors : displayDoctors.filter(d => d.specialty === filterSpec);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Segoe UI', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0f1e; }
        ::-webkit-scrollbar-thumb { background: #1a2540; border-radius: 3px; }
        input, select { font-family: 'Segoe UI', sans-serif; }
      `}</style>

      <TopBar />

      {/* Modals */}
      {modalDoctor && (
        <DoctorModal
          doctor={modalDoctor}
          onClose={() => setModalDoctor(null)}
          onSelect={(doc) => { setSelectedDoctor(doc); setSelectedTime(""); }}
        />
      )}
      {showPayment && selectedDoctor && selectedTime && (
        <PaymentModal
          doctor={selectedDoctor}
          time={selectedTime}
          isEmergency={isEmergency}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>

        {/* Welcome */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: COLORS.text, fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Welcome back, John! 👋</h1>
          <p style={{ color: COLORS.muted }}>Manage your health appointments and records</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Upcoming Appointments", value: appointments.length || bookedTokens.length || "0", icon: "📅", color: COLORS.accent },
            { label: "Health Reports",         value: displayReports.length, icon: "📋", color: COLORS.green },
            { label: "Tokens Issued",          value: bookedTokens.length,   icon: "🎟️", color: COLORS.accent2 },
            { label: "Notifications",          value: "3",                   icon: "🔔", color: COLORS.yellow },
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

        {/* My Tokens (if any) */}
        {bookedTokens.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 28 }}>
            <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 16 }}>🎟️ My Appointment Tokens</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {bookedTokens.map((entry, i) => (
                <div key={i} style={{
                  background: COLORS.bg, border: `1px solid ${COLORS.accent}30`,
                  borderRadius: 12, padding: 16,
                }}>
                  <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: COLORS.accent, marginBottom: 8, letterSpacing: 2 }}>{entry.token}</div>
                  <p style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{entry.doctor?.name}</p>
                  <p style={{ color: COLORS.muted, fontSize: 12 }}>{entry.time} · {entry.date}</p>
                  {entry.isEmergency && <span style={{ color: COLORS.red, fontSize: 11, fontWeight: 700 }}>🚨 Emergency</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 28 }}>

          {/* ── Left: Book Appointment ───────────────────────── */}
          <div style={cardStyle}>
            <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🗓️ Book Appointment</h3>
            <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>Browse doctors, view specializations, and book your slot</p>

            {/* Specialty filter */}
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

            {/* Doctor cards */}
            <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
              {filteredDoctors.map(doc => (
                <div
                  key={doc.id}
                  style={{
                    borderRadius: 14, border: `1px solid ${selectedDoctor?.id === doc.id ? COLORS.accent : COLORS.cardBorder}`,
                    background: selectedDoctor?.id === doc.id ? `${COLORS.accent}06` : COLORS.bg,
                    overflow: "hidden",
                  }}
                >
                  {/* Top row — click to select */}
                  <div
                    onClick={() => { setSelectedDoctor(doc); setSelectedTime(""); }}
                    style={{ padding: 14, cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start" }}
                  >
                    <Avatar name={doc.name} size={52} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <p style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{doc.name}</p>
                          <p style={{ color: COLORS.accent, fontSize: 12, marginBottom: 3 }}>{doc.specialty} · {doc.hospital}</p>
                          <p style={{ color: COLORS.muted, fontSize: 12 }}>{doc.experience} · {doc.education}</p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                          <p style={{ color: COLORS.green, fontWeight: 800, fontSize: 15 }}>₹{doc.fee}</p>
                          <p style={{ color: COLORS.muted, fontSize: 10 }}>per consult</p>
                          <p style={{ color: COLORS.yellow, fontSize: 12, marginTop: 4 }}>⭐ {doc.rating} ({doc.reviewCount})</p>
                        </div>
                      </div>
                      {/* Tags */}
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                        {doc.tags.slice(0, 3).map(tag => (
                          <span key={tag} style={{
                            background: `${COLORS.accent2}15`, color: "#a78bfa",
                            border: `1px solid ${COLORS.accent2}25`,
                            padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                          }}>{tag}</span>
                        ))}
                        <span style={{ color: COLORS.muted, fontSize: 10, alignSelf: "center" }}>
                          🗣️ {doc.languages.join(", ")}
                        </span>
                      </div>
                    </div>
                    {selectedDoctor?.id === doc.id && (
                      <span style={{ color: COLORS.accent, fontSize: 20, flexShrink: 0 }}>✓</span>
                    )}
                  </div>

                  {/* View Profile button */}
                  <div style={{ padding: "0 14px 12px", display: "flex", gap: 8 }}>
                    <button
                      onClick={e => { e.stopPropagation(); setModalDoctor(doc); }}
                      style={{
                        padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                        border: `1px solid ${COLORS.cardBorder}`, background: "transparent",
                        color: COLORS.muted,
                      }}
                    >👤 View Full Profile</button>
                    <span style={{
                      padding: "5px 10px", borderRadius: 8, fontSize: 11,
                      background: `${COLORS.green}15`, color: COLORS.green,
                    }}>
                      🟢 {doc.availability.length} slots today
                    </span>
                  </div>

                  {/* Time slots — show only when selected */}
                  {selectedDoctor?.id === doc.id && (
                    <div style={{ borderTop: `1px solid ${COLORS.cardBorder}`, padding: 14, background: `${COLORS.accent}04` }}>
                      <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10, fontWeight: 600 }}>🕐 Available Time Slots</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                        {doc.availability.map(t => (
                          <button key={t} onClick={() => setSelectedTime(t)} style={{
                            padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                            border: `1px solid ${selectedTime === t ? COLORS.accent : COLORS.cardBorder}`,
                            background: selectedTime === t ? `${COLORS.accent}20` : COLORS.bg,
                            color: selectedTime === t ? COLORS.accent : COLORS.text,
                            fontWeight: selectedTime === t ? 700 : 400,
                          }}>{t}</button>
                        ))}
                      </div>

                      {/* Emergency toggle */}
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        marginBottom: 12, padding: "10px 14px", background: COLORS.bg,
                        borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`,
                      }}>
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
                        <div style={{ padding: 10, background: `${COLORS.red}11`, border: `1px solid ${COLORS.red}33`, borderRadius: 10, color: COLORS.red, fontSize: 12, marginBottom: 12 }}>
                          🚨 Emergency adds 50% surcharge (₹{doc.fee} → ₹{Math.round(doc.fee * 1.5)}). You'll be placed #1 in queue.
                        </div>
                      )}

                      {selectedTime && (
                        <button
                          onClick={() => setShowPayment(true)}
                          style={{
                            width: "100%", padding: "12px",
                            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                            border: "none", color: "#fff", fontSize: 15, fontWeight: 700,
                            borderRadius: 10, cursor: "pointer",
                          }}
                        >
                          💳 Proceed to Pay ₹{isEmergency ? Math.round(doc.fee * 1.5) : doc.fee}
                        </button>
                      )}
                      {!selectedTime && (
                        <p style={{ color: COLORS.muted, fontSize: 13, textAlign: "center" }}>← Select a time slot above to continue</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right column ─────────────────────────────────── */}
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

            {/* Doctor Quick Stats */}
            <div style={cardStyle}>
              <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🏥 Available Specialists</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {specialties.filter(s => s !== "All").map(spec => {
                  const count = displayDoctors.filter(d => d.specialty === spec).length;
                  return (
                    <div key={spec} onClick={() => setFilterSpec(spec)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                      background: filterSpec === spec ? `${COLORS.accent}10` : COLORS.bg,
                      border: `1px solid ${filterSpec === spec ? COLORS.accent + "40" : COLORS.cardBorder}`,
                    }}>
                      <span style={{ color: filterSpec === spec ? COLORS.accent : COLORS.text, fontSize: 13 }}>{spec}</span>
                      <span style={{ color: COLORS.muted, fontSize: 12, background: COLORS.card, padding: "2px 8px", borderRadius: 10 }}>{count} doctor{count > 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div style={cardStyle}>
              <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Quick Actions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Link to="/patient/upload" style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10,
                  border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text, fontSize: 14, textDecoration: "none", background: COLORS.bg,
                }}>📤 Upload Health Report</Link>
                <button onClick={() => setActiveTab("reports")} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10,
                  border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text, fontSize: 14, background: COLORS.bg, cursor: "pointer", width: "100%",
                }}>📋 View All Reports</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Health Reports ──────────────────────────────────────── */}
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
                  style={{ padding: 16, borderRadius: 12, cursor: "pointer", border: `1px solid ${COLORS.cardBorder}`, background: COLORS.bg, transition: "border-color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.cardBorder}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: `${COLORS.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📄</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: COLORS.text, fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{report.fileName}</p>
                      <span style={{ background: `${COLORS.accent2}20`, color: "#a78bfa", border: `1px solid ${COLORS.accent2}30`, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{report.category}</span>
                      <p style={{ color: COLORS.muted, fontSize: 11, marginTop: 6 }}>Uploaded: {new Date(report.uploadDate).toLocaleDateString()}</p>
                      <button
                        onClick={e => { e.stopPropagation(); handleVerifyReport(report, idx); }}
                        disabled={verifyStatus[idx] === "checking"}
                        style={{
                          marginTop: 8, fontSize: 11, padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: "none",
                          background: verifyStatus[idx] === "verified" ? `${COLORS.green}22` : verifyStatus[idx] === "failed" ? `${COLORS.red}22` : `${COLORS.accent}22`,
                          color: verifyStatus[idx] === "verified" ? COLORS.green : verifyStatus[idx] === "failed" ? COLORS.red : COLORS.accent,
                        }}
                      >
                        {verifyStatus[idx] === "checking" ? "⛓️ Checking..." : verifyStatus[idx] === "verified" ? "✅ Blockchain Verified" : verifyStatus[idx] === "failed" ? "⚠️ Hash Mismatch" : "🔍 Verify on Chain"}
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

// ── Mock Data ─────────────────────────────────────────────────────────────────
const mockDoctors = [
  {
    id: "DOC-001", name: "Dr. Ananya Singh", specialty: "Cardiology",
    hospital: "AIIMS Delhi", rating: 4.8, reviewCount: 247,
    experience: "12 yrs", education: "MBBS, MD (Cardiology)",
    fee: 800, image: "👩‍⚕️",
    bio: "Senior Cardiologist specializing in interventional cardiology, heart failure management, and preventive cardiac care. Has performed over 2,000 successful angioplasty procedures.",
    tags: ["Heart Failure", "Interventional", "Preventive Care", "ECG"],
    languages: ["English", "Hindi", "Punjabi"],
    availability: ["9:00 AM", "10:30 AM", "2:00 PM", "4:00 PM"],
    reviews: [
      { name: "Ramesh K.", rating: 5, comment: "Excellent doctor. Explained everything very clearly and the treatment worked perfectly." },
      { name: "Sunita M.", rating: 5, comment: "Very thorough and caring. Highly recommend for any heart-related issues." },
      { name: "Ajay P.", rating: 4, comment: "Great expertise. Had to wait a bit but worth it." },
    ],
  },
  {
    id: "DOC-002", name: "Dr. Vikram Patel", specialty: "Dermatology",
    hospital: "Fortis Hospital", rating: 4.5, reviewCount: 183,
    experience: "8 yrs", education: "MBBS, DVD (Dermatology)",
    fee: 600, image: "👨‍⚕️",
    bio: "Expert in acne management, eczema, psoriasis, skin cancer screening, and cosmetic dermatology including chemical peels and laser treatments.",
    tags: ["Acne", "Eczema", "Skin Cancer", "Cosmetic"],
    languages: ["English", "Gujarati", "Hindi"],
    availability: ["11:00 AM", "1:00 PM", "3:30 PM", "5:00 PM"],
    reviews: [
      { name: "Priya S.", rating: 5, comment: "My acne cleared up within 2 months of treatment. Amazing results!" },
      { name: "Karan T.", rating: 4, comment: "Very knowledgeable doctor, gives detailed explanations." },
      { name: "Meera R.", rating: 4, comment: "Good experience overall. The clinic is well-maintained." },
    ],
  },
  {
    id: "DOC-003", name: "Dr. Meena Roy", specialty: "Orthopedics",
    hospital: "Apollo Hospital", rating: 4.9, reviewCount: 312,
    experience: "15 yrs", education: "MBBS, MS (Ortho), FRCS",
    fee: 1000, image: "👩‍⚕️",
    bio: "Renowned orthopedic surgeon specializing in joint replacement, sports injuries, and spine disorders. Has successfully performed 3,500+ joint replacement surgeries.",
    tags: ["Joint Replacement", "Spine", "Sports Injury", "Arthroscopy"],
    languages: ["English", "Bengali", "Hindi"],
    availability: ["9:30 AM", "11:30 AM", "2:30 PM"],
    reviews: [
      { name: "Anand V.", rating: 5, comment: "My knee replacement surgery was a huge success. Back to normal life!" },
      { name: "Lakshmi N.", rating: 5, comment: "Best orthopedic surgeon in Delhi. Very professional." },
      { name: "Deepak M.", rating: 5, comment: "Outstanding care before, during, and after the surgery." },
    ],
  },
  {
    id: "DOC-004", name: "Dr. Suresh Nair", specialty: "Neurology",
    hospital: "Medanta Hospital", rating: 4.7, reviewCount: 198,
    experience: "10 yrs", education: "MBBS, DM (Neurology)",
    fee: 900, image: "👨‍⚕️",
    bio: "Specialist in movement disorders, epilepsy, stroke management, and neuro-rehabilitation. Pioneered advanced EMG techniques at Medanta.",
    tags: ["Epilepsy", "Stroke", "Movement Disorders", "Migraine"],
    languages: ["English", "Malayalam", "Hindi"],
    availability: ["10:00 AM", "12:00 PM", "3:00 PM", "5:30 PM"],
    reviews: [
      { name: "Rohit G.", rating: 5, comment: "Correctly diagnosed my condition when others couldn't. Life-changing!" },
      { name: "Fatima S.", rating: 4, comment: "Very patient and explains everything in simple language." },
      { name: "Vinod K.", rating: 5, comment: "Exceptional neurologist. Highly recommended for any brain or nerve issues." },
    ],
  },
  {
    id: "DOC-005", name: "Dr. Priya Sharma", specialty: "Pediatrics",
    hospital: "Rainbow Children's Hospital", rating: 4.6, reviewCount: 156,
    experience: "9 yrs", education: "MBBS, MD (Pediatrics)",
    fee: 500, image: "👩‍⚕️",
    bio: "Dedicated pediatrician with expertise in child nutrition, developmental disorders, respiratory infections, and neonatal care. Known for her gentle approach with children.",
    tags: ["Neonatal Care", "Child Nutrition", "Vaccinations", "Development"],
    languages: ["English", "Hindi", "Marathi"],
    availability: ["9:00 AM", "11:00 AM", "2:00 PM", "4:30 PM"],
    reviews: [
      { name: "Neha K.", rating: 5, comment: "Dr. Priya is amazing with kids. My daughter loves going to her!" },
      { name: "Sanjay M.", rating: 5, comment: "Very thorough with vaccinations and follow-ups. Highly recommended." },
      { name: "Rita D.", rating: 4, comment: "Very caring and patient with young children." },
    ],
  },
];

const mockReports = [
  { id: "R001", fileName: "Blood_Test_March2026.pdf", category: "Blood Test", uploadDate: "2026-03-01", aiSummary: { keyFindings: ["Cholesterol slightly elevated at 210 mg/dL", "Blood glucose normal at 95 mg/dL", "Hemoglobin within range at 14.5 g/dL"], plainLanguage: "Your blood test shows mostly good results. Blood sugar and red blood cells are healthy. Cholesterol is slightly high — manageable with diet and exercise.", recommendedSteps: ["Reduce saturated fat intake", "30 min daily exercise", "Follow-up in 3 months"] } },
  { id: "R002", fileName: "Chest_Xray_Feb2026.pdf", category: "X-Ray", uploadDate: "2026-02-14", aiSummary: { keyFindings: ["No abnormalities detected", "Lung fields clear", "Heart size normal"], plainLanguage: "Your chest X-ray looks completely normal. Lungs are clear and heart is a healthy size.", recommendedSteps: ["No immediate action required", "Routine check in 1 year"] } },
  { id: "R003", fileName: "Prescription_Jan2026.pdf", category: "Prescription", uploadDate: "2026-01-20", aiSummary: null },
];

export default PatientDashboard;