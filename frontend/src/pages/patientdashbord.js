// src/pages/PatientDashboard.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { verifyRecord } from "../hooks/useBlockchain";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch (_) { return {}; }
}
function getStoredPatientId()  { return getStoredUser().patientId || null; }
function getChainPatientId()   { const u = getStoredUser(); return u.chainPatientId != null ? Number(u.chainPatientId) : null; }
function getSessionPatientProfile() {
  const u = getStoredUser();
  if (u.role === "patient" && u.name) return { name: String(u.name).trim(), patientId: u.patientId || null, fromSession: true };
  return { name: "Patient", patientId: null, fromSession: false };
}

const COLORS = {
  bg: "#0a0f1e", card: "#0f1729", cardBorder: "#1a2540",
  accent: "#00d4ff", accent2: "#7c3aed", green: "#10b981",
  red: "#ef4444", yellow: "#f59e0b", text: "#e2e8f0", muted: "#64748b",
  teal: "#00c8a0", purple: "#8b5cf6",
};
const cardStyle = { background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, padding: 24 };

function EmptyState({ icon, title, message }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 24px", color: COLORS.muted }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      {title && <p style={{ color: COLORS.text, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{title}</p>}
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>{message}</p>
    </div>
  );
}

function FileViewer({ recordId, fileName, ipfsUrl, onClose }) {
  const url = recordId ? `${API}/records/file/${recordId}` : ipfsUrl;
  if (!url) return null;
  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(fileName || "");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 600, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 56, background: "#080d1a", borderBottom: `1px solid ${COLORS.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>📄</span>
          <span style={{ color: COLORS.text, fontSize: 14, fontWeight: 600 }}>{fileName || "Report"}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href={url} download={fileName || "report"} style={{ padding: "6px 14px", borderRadius: 8, background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}30`, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>⬇ Download</a>
          <button onClick={onClose} style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", color: COLORS.muted, border: `1px solid ${COLORS.cardBorder}`, fontSize: 13, cursor: "pointer" }}>✕ Close</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {isImage
          ? <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}><img src={url} alt={fileName} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12, objectFit: "contain" }} /></div>
          : <iframe src={url} title={fileName} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />
        }
      </div>
    </div>
  );
}

function Avatar({ name, size = 48 }) {
  const safe     = name || "Unknown";
  const initials = safe.split(" ").filter(w => w !== "Dr.").map(w => w[0]).join("").substring(0, 2);
  const palettes = [["#0e3a5c","#00d4ff"],["#2d1a5c","#7c3aed"],["#0a3d2e","#10b981"],["#3d2200","#f59e0b"],["#3d0a1a","#ef4444"]];
  const p = palettes[(safe.charCodeAt(4) || 0) % palettes.length];
  return <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: p[0], border: `2px solid ${p[1]}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 700, color: p[1], fontFamily: "monospace" }}>{initials}</div>;
}

function TopBar({ patientName, onLogout }) {
  return (
    <div style={{ background: "#080d1a", borderBottom: `1px solid ${COLORS.cardBorder}`, padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⛓️</div>
        <div>
          <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, fontFamily: "monospace" }}>MediChain</div>
          <div style={{ color: COLORS.muted, fontSize: 10 }}>Patient Portal · {patientName}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link to="/patient/upload" style={{ color: COLORS.accent, fontSize: 13, textDecoration: "none", padding: "6px 14px", borderRadius: 8, background: `${COLORS.accent}15`, border: `1px solid ${COLORS.accent}30` }}>📤 Upload Report</Link>
        <button type="button" onClick={onLogout} style={{ color: COLORS.muted, fontSize: 13, padding: "6px 14px", borderRadius: 8, border: `1px solid ${COLORS.cardBorder}`, background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>Logout</button>
      </div>
    </div>
  );
}

function DoctorModal({ doctor, onClose, onSelect }) {
  if (!doctor) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 20, padding: 32, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 24 }}>
          <Avatar name={doctor.name} size={64} />
          <div style={{ flex: 1 }}>
            <h2 style={{ color: COLORS.text, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{doctor.name}</h2>
            <p style={{ color: COLORS.accent, fontSize: 13, marginBottom: 4 }}>{doctor.specialty}{doctor.hospital ? ` · ${doctor.hospital}` : ""}</p>
            {doctor.experience > 0 && <p style={{ color: COLORS.muted, fontSize: 12 }}>{doctor.experience} yrs exp</p>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        {doctor.bio && <p style={{ color: COLORS.text, fontSize: 14, lineHeight: 1.7, background: COLORS.bg, padding: 14, borderRadius: 10, marginBottom: 20 }}>{doctor.bio}</p>}
        <button onClick={() => { onSelect(doctor); onClose(); }} style={{ width: "100%", padding: 14, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, borderRadius: 12, cursor: "pointer" }}>
          Book Appointment
        </button>
      </div>
    </div>
  );
}

function PaymentModal({ doctor, time, date, isEmergency, patientId, onClose, onSuccess }) {
  const [step, setStep] = useState("payment");
  const [method, setMethod] = useState("card");
  const [token, setToken] = useState("");
  const totalFee = isEmergency ? Math.round((doctor.fee || 0) * 1.5) : (doctor.fee || 0);

  const handlePay = async () => {
    setStep("processing");
    try {
      const res = await fetch(`${API}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ doctorId: doctor.id || doctor._id, date: date || new Date().toISOString().slice(0, 10), time, type: "Consultation", isEmergency: !!isEmergency, fee: totalFee, feePaid: true, paymentMethod: method }),
      });
      const data = await res.json();
      const newTok = data.id || data.blockchain || `MCT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      setToken(newTok);
    } catch {
      setToken(`MCT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
    }
    setStep("done");
  };

  if (step === "processing") return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: COLORS.text }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⛓️</div>
        <p style={{ fontSize: 18, fontWeight: 700 }}>Processing Payment…</p>
      </div>
    </div>
  );

  if (step === "done") return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COLORS.card, border: `1px solid ${COLORS.green}40`, borderRadius: 20, padding: 32, maxWidth: 440, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h2 style={{ color: COLORS.green, fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Appointment Confirmed!</h2>
        <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 800, color: COLORS.accent, marginBottom: 20, wordBreak: "break-all" }}>{token}</div>
        <button onClick={() => { onSuccess(token); onClose(); }} style={{ width: "100%", padding: 13, background: `linear-gradient(135deg, ${COLORS.green}, #059669)`, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, borderRadius: 10, cursor: "pointer" }}>✅ Done</button>
      </div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 20, padding: 28, maxWidth: 420, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: COLORS.text, fontSize: 18, fontWeight: 800 }}>💳 Payment</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ background: COLORS.bg, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${COLORS.cardBorder}`, marginTop: 4 }}>
            <span style={{ color: COLORS.text, fontSize: 15, fontWeight: 700 }}>Total</span>
            <span style={{ color: COLORS.accent, fontSize: 15, fontWeight: 800 }}>₹{totalFee}</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          {[{ key: "card", label: "💳 Card" }, { key: "upi", label: "📱 UPI" }, { key: "netbanking", label: "🏦 Net Banking" }].map(m => (
            <button key={m.key} onClick={() => setMethod(m.key)} style={{ padding: "10px 6px", borderRadius: 10, cursor: "pointer", fontSize: 12, border: `1px solid ${method === m.key ? COLORS.accent : COLORS.cardBorder}`, background: method === m.key ? `${COLORS.accent}15` : COLORS.bg, color: method === m.key ? COLORS.accent : COLORS.muted }}>{m.label}</button>
          ))}
        </div>
        <button onClick={handlePay} style={{ width: "100%", padding: 14, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, borderRadius: 12, cursor: "pointer" }}>
          Pay ₹{totalFee} & Confirm
        </button>
      </div>
    </div>
  );
}

function AISummaryCard({ summary }) {
  return (
    <div style={{ background: `${COLORS.accent2}0d`, border: `1px solid ${COLORS.accent2}30`, borderRadius: 14, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}><span style={{ fontSize: 20 }}>✨</span><h4 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>AI Summary</h4></div>
      <p style={{ color: COLORS.text, fontSize: 14, lineHeight: 1.7, background: COLORS.bg, padding: 14, borderRadius: 10, marginBottom: 16 }}>{summary.plainLanguage}</p>
      {(summary.keyFindings || []).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Key Findings</p>
          {summary.keyFindings.map((f, i) => <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}><span style={{ color: COLORS.yellow }}>⚡</span><span style={{ color: COLORS.text, fontSize: 14 }}>{f}</span></div>)}
        </div>
      )}
      {(summary.recommendedSteps || []).length > 0 && (
        <div>
          <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Recommended Steps</p>
          {summary.recommendedSteps.map((s, i) => <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}><span style={{ color: COLORS.green }}>✅</span><span style={{ color: COLORS.text, fontSize: 14 }}>{s}</span></div>)}
        </div>
      )}
    </div>
  );
}

function AppointmentCard({ appt }) {
  const statusColor = { confirmed: COLORS.accent, "in-progress": COLORS.green, pending: COLORS.yellow, completed: COLORS.muted }[appt.status] || COLORS.muted;
  return (
    <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${appt.isEmergency ? COLORS.red + "55" : COLORS.cardBorder}`, background: appt.isEmergency ? `${COLORS.red}08` : COLORS.bg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <p style={{ color: COLORS.text, fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Dr. {appt.doctorName || "Unknown Doctor"}</p>
          <p style={{ color: COLORS.accent, fontSize: 12 }}>{appt.specialty || appt.type}</p>
        </div>
        <span style={{ background: statusColor + "20", color: statusColor, border: `1px solid ${statusColor}40`, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
          {appt.isEmergency ? "🚨 Emergency" : appt.status}
        </span>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: COLORS.muted }}>
        <span>📅 {appt.date}</span>
        <span>🕐 {appt.time}</span>
        {appt.fee > 0 && <span>💰 ₹{appt.fee}</span>}
      </div>
    </div>
  );
}

// ── Doctor Report Card ─────────────────────────────────────────────────────────
function DoctorReportCard({ report, onView }) {
  const [expanded, setExpanded] = useState(false);
  const hasComment      = !!(report.doctorComment || report.doctorNotes);
  const hasRecommend    = !!report.recommendation;
  const hasFile         = !!(report.ipfsUrl || report.id);
  const doctorName      = report.doctorName || report.doctor || "Doctor";
  const uploadDate      = report.uploadDate || report.createdAt?.slice(0,10) || "—";

  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${COLORS.teal}35`,
      background: `linear-gradient(135deg, ${COLORS.teal}06, ${COLORS.card})`,
      overflow: "hidden",
      transition: "box-shadow 0.2s",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: `${COLORS.teal}20`, border: `2px solid ${COLORS.teal}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
          👨‍⚕️
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <p style={{ color: COLORS.text, fontWeight: 700, fontSize: 14 }}>Dr. {doctorName}</p>
            <span style={{ background: `${COLORS.teal}15`, color: COLORS.teal, border: `1px solid ${COLORS.teal}30`, padding: "1px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{report.category || "General"}</span>
            {report.anchoredOnChain && <span style={{ background: `${COLORS.green}15`, color: COLORS.green, border: `1px solid ${COLORS.green}30`, padding: "1px 8px", borderRadius: 10, fontSize: 11 }}>⛓️ Verified</span>}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: COLORS.muted }}>
            <span>📅 {uploadDate}</span>
            {report.fileName && <span>📄 {report.fileName}</span>}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${COLORS.teal}30`, background: expanded ? `${COLORS.teal}15` : "transparent", color: COLORS.teal, fontSize: 12, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
        >
          {expanded ? "Hide ▲" : "Details ▼"}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${COLORS.teal}20`, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Doctor Comment */}
          {hasComment && (
            <div style={{ padding: "14px 16px", background: `${COLORS.blue}08`, border: `1px solid ${COLORS.blue}25`, borderRadius: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>💬</span>
                <p style={{ color: COLORS.accent, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Doctor's Comments</p>
              </div>
              <p style={{ color: COLORS.text, fontSize: 13, lineHeight: 1.7 }}>
                {report.doctorComment || report.doctorNotes}
              </p>
            </div>
          )}

          {/* Recommendations */}
          {hasRecommend && (
            <div style={{ padding: "14px 16px", background: `${COLORS.green}08`, border: `1px solid ${COLORS.green}25`, borderRadius: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>✅</span>
                <p style={{ color: COLORS.green, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Recommendations</p>
              </div>
              <p style={{ color: COLORS.text, fontSize: 13, lineHeight: 1.7 }}>
                {report.recommendation}
              </p>
            </div>
          )}

          {/* No comment state */}
          {!hasComment && !hasRecommend && (
            <p style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>No additional comments from the doctor.</p>
          )}

          {/* AI Summary from record */}
          {report.aiSummary?.plainLanguage && (
            <div style={{ padding: "14px 16px", background: `${COLORS.purple}08`, border: `1px solid ${COLORS.purple}25`, borderRadius: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>✨</span>
                <p style={{ color: COLORS.purple, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>AI Summary</p>
              </div>
              <p style={{ color: COLORS.text, fontSize: 13, lineHeight: 1.7 }}>{report.aiSummary.plainLanguage}</p>
            </div>
          )}

          {/* View file button */}
          {hasFile && (
            <button
              onClick={() => onView(report)}
              style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${COLORS.accent}40`, background: `${COLORS.accent}10`, color: COLORS.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              📄 View Report File
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
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
  const [showPayment,    setShowPayment]    = useState(false);
  const [bookedTokens,   setBookedTokens]   = useState([]);
  const [filterSpec,     setFilterSpec]     = useState("All");

  const [activeTab,      setActiveTab]      = useState("all_reports");
  const [selectedReport, setSelectedReport] = useState(null);
  const [verifyStatus,   setVerifyStatus]   = useState({});
  const [viewerRecord,   setViewerRecord]   = useState(null);

  const patientId = getStoredPatientId();

  // Separate doctor-uploaded reports from self-uploaded
  const doctorReports = reports.filter(r => r.uploadedByDoctor === "true" || r.uploadedByDoctor === true || (r.doctor && r.doctor !== "Self Upload" && r.doctor !== "Hospital Staff"));
  const selfReports   = reports.filter(r => !r.uploadedByDoctor || r.uploadedByDoctor === "false" || r.uploadedByDoctor === false);

  useEffect(() => {
    const sync = () => setSessionPatient(getSessionPatientProfile());
    sync();
    window.addEventListener("focus",   sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("focus", sync); window.removeEventListener("storage", sync); };
  }, []);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    let cancelled = false;

    const load = () => {
      const headers = authHeaders();
      Promise.all([
        fetch(`${API}/doctors`).then(r => r.json()).catch(() => []),
        fetch(`${API}/records/${encodeURIComponent(patientId)}`, { headers }).then(r => r.json()).catch(() => []),
        fetch(`${API}/appointments`, { headers }).then(r => r.json()).catch(() => []),
      ]).then(([docs, recs, appts]) => {
        if (cancelled) return;
        setDoctors(Array.isArray(docs)  ? docs  : []);
        const safeRecs = Array.isArray(recs) ? recs : [];
        setReports(safeRecs);
        setAppointments(Array.isArray(appts) ? appts : []);
        if (safeRecs.length && !selectedReport) setSelectedReport(safeRecs[0]);
      }).finally(() => { if (!cancelled) setLoading(false); });
    };

    load();
    const interval = setInterval(load, 10000);
    const onBump = e => { if (e.key === "medichain-records-bump") load(); };
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
      toast[ok ? "success" : "error"](ok ? "✅ Verified on blockchain!" : "⚠️ Hash mismatch detected!");
    } catch (err) {
      setVerifyStatus(s => ({ ...s, [idx]: "failed" }));
      toast.error("Verification failed: " + err.message);
    }
  };

  const handlePaymentSuccess = (token) => {
    setBookedTokens(prev => [{ token, doctor: selectedDoctor, time: selectedTime, date: selectedDate, isEmergency }, ...prev]);
    setSelectedDoctor(null); setSelectedTime(""); setIsEmergency(false);
    toast.success(`✅ Appointment booked! Token: ${token}`);
    const headers = authHeaders();
    fetch(`${API}/appointments`, { headers })
      .then(r => r.json())
      .then(appts => { if (Array.isArray(appts)) setAppointments(appts); })
      .catch(() => {});
  };

  const specialties     = ["All", ...new Set((doctors || []).map(d => d.specialty).filter(Boolean))];
  const filteredDoctors = filterSpec === "All" ? doctors : doctors.filter(d => d.specialty === filterSpec);

  const TABS = [
    { key: "all_reports",    label: `All Reports (${reports.length})` },
    { key: "doctor_reports", label: `From Doctor (${doctorReports.length})` },
    { key: "my_uploads",     label: `My Uploads (${selfReports.length})` },
    { key: "ai_summary",     label: "AI Summary" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Segoe UI', sans-serif" }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0a0f1e; } ::-webkit-scrollbar-thumb { background: #1a2540; border-radius: 3px; }`}</style>

      <TopBar patientName={sessionPatient.name} onLogout={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/"); }} />

      {modalDoctor && <DoctorModal doctor={modalDoctor} onClose={() => setModalDoctor(null)} onSelect={doc => { setSelectedDoctor(doc); setSelectedTime(""); }} />}
      {showPayment && selectedDoctor && selectedTime && (
        <PaymentModal doctor={selectedDoctor} time={selectedTime} date={selectedDate} isEmergency={isEmergency} patientId={patientId} onClose={() => setShowPayment(false)} onSuccess={handlePaymentSuccess} />
      )}
      {viewerRecord && <FileViewer recordId={viewerRecord.id} fileName={viewerRecord.fileName} ipfsUrl={viewerRecord.ipfsUrl} onClose={() => setViewerRecord(null)} />}

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: COLORS.text, fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Welcome back, {sessionPatient.name}! 👋</h1>
          {patientId
            ? <p style={{ color: COLORS.muted, fontSize: 12 }}>Patient ID: <span style={{ fontFamily: "monospace", color: COLORS.accent }}>{patientId}</span></p>
            : <p style={{ color: COLORS.red, fontSize: 13, marginTop: 6 }}>⚠️ Not logged in — please log in to view your data</p>
          }
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Appointments",    value: appointments.length + bookedTokens.length, icon: "📅", color: COLORS.accent },
            { label: "Health Reports",  value: reports.length,                            icon: "📋", color: COLORS.green },
            { label: "Doctor Reports",  value: doctorReports.length,                      icon: "👨‍⚕️", color: COLORS.teal },
            { label: "Booked Tokens",   value: bookedTokens.length,                       icon: "🎟️", color: COLORS.accent2 },
            { label: "Doctors Online",  value: doctors.filter(d => d.status !== "offline").length, icon: "🏥", color: COLORS.yellow },
          ].map(s => (
            <div key={s.label} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><p style={{ color: COLORS.muted, fontSize: 11, marginBottom: 6 }}>{s.label}</p><p style={{ color: s.color, fontSize: 28, fontWeight: 800, fontFamily: "monospace" }}>{s.value}</p></div>
                <span style={{ fontSize: 24 }}>{s.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Doctor notifications banner (if new doctor reports) */}
        {doctorReports.length > 0 && (
          <div style={{ ...cardStyle, padding: "16px 24px", marginBottom: 24, background: `${COLORS.teal}08`, border: `1px solid ${COLORS.teal}30`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: `${COLORS.teal}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🔔</div>
              <div>
                <p style={{ color: COLORS.text, fontWeight: 700, fontSize: 14 }}>
                  You have {doctorReports.length} report{doctorReports.length !== 1 ? "s" : ""} from your doctor{doctorReports.length !== 1 ? "s" : ""}
                </p>
                <p style={{ color: COLORS.muted, fontSize: 12 }}>Including comments, diagnoses, and recommendations</p>
              </div>
            </div>
            <button onClick={() => setActiveTab("doctor_reports")} style={{ padding: "8px 18px", borderRadius: 9, border: `1px solid ${COLORS.teal}40`, background: `${COLORS.teal}15`, color: COLORS.teal, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              View Doctor Reports →
            </button>
          </div>
        )}

        {/* My appointments */}
        {appointments.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 28 }}>
            <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 16 }}>📅 My Appointments</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 12 }}>
              {appointments.map(appt => <AppointmentCard key={appt.id} appt={appt} />)}
            </div>
          </div>
        )}

        {/* New booking tokens */}
        {bookedTokens.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 28 }}>
            <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 16 }}>🎟️ New Booking Tokens</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 12 }}>
              {bookedTokens.map((entry, i) => (
                <div key={i} style={{ background: COLORS.bg, border: `1px solid ${COLORS.accent}30`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: COLORS.accent, marginBottom: 8, letterSpacing: 2, wordBreak: "break-all" }}>{entry.token}</div>
                  <p style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{entry.doctor?.name}</p>
                  <p style={{ color: COLORS.muted, fontSize: 12 }}>{entry.time} · {entry.date}</p>
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
              <input type="date" value={selectedDate} min={new Date().toISOString().slice(0, 10)} onChange={e => setSelectedDate(e.target.value)} style={{ background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text, padding: "8px 12px", borderRadius: 8, fontSize: 13, outline: "none" }} />
            </div>

            {specialties.length > 1 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {specialties.map(spec => (
                  <button key={spec} onClick={() => setFilterSpec(spec)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: `1px solid ${filterSpec === spec ? COLORS.accent : COLORS.cardBorder}`, background: filterSpec === spec ? `${COLORS.accent}15` : "transparent", color: filterSpec === spec ? COLORS.accent : COLORS.muted, fontWeight: filterSpec === spec ? 700 : 400 }}>{spec}</button>
                ))}
              </div>
            )}

            {loading ? (
              <p style={{ color: COLORS.muted, textAlign: "center", padding: 24 }}>Loading doctors…</p>
            ) : filteredDoctors.length === 0 ? (
              <EmptyState icon="👨‍⚕️" title="No doctors registered yet" message="Doctors appear here after they sign up." />
            ) : (
              <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
                {filteredDoctors.map(doc => {
                  const docId      = doc.id || doc._id || String(doc.name);
                  const isSelected = selectedDoctor && (selectedDoctor.id === docId || selectedDoctor._id === docId);
                  const avail      = Array.isArray(doc.availability) ? doc.availability : [];
                  return (
                    <div key={docId} style={{ borderRadius: 14, border: `1px solid ${isSelected ? COLORS.accent : COLORS.cardBorder}`, background: isSelected ? `${COLORS.accent}06` : COLORS.bg, overflow: "hidden" }}>
                      <div onClick={() => { setSelectedDoctor({ ...doc, id: docId }); setSelectedTime(""); }} style={{ padding: 14, cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <Avatar name={doc.name} size={52} />
                        <div style={{ flex: 1 }}>
                          <p style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{doc.name}</p>
                          <p style={{ color: COLORS.accent, fontSize: 12, marginBottom: 3 }}>{doc.specialty}{doc.hospital ? ` · ${doc.hospital}` : ""}</p>
                          {doc.experience > 0 && <p style={{ color: COLORS.muted, fontSize: 12 }}>{doc.experience} yrs exp</p>}
                        </div>
                        {doc.fee > 0 && <p style={{ color: COLORS.green, fontWeight: 800, fontSize: 15 }}>₹{doc.fee}</p>}
                      </div>

                      <div style={{ padding: "0 14px 12px", display: "flex", gap: 8 }}>
                        <button onClick={e => { e.stopPropagation(); setModalDoctor({ ...doc, id: docId }); }} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", border: `1px solid ${COLORS.cardBorder}`, background: "transparent", color: COLORS.muted }}>👤 Profile</button>
                        {avail.length > 0 && <span style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, background: `${COLORS.green}15`, color: COLORS.green }}>🟢 {avail.length} slots</span>}
                      </div>

                      {isSelected && (
                        <div style={{ borderTop: `1px solid ${COLORS.cardBorder}`, padding: 14, background: `${COLORS.accent}04` }}>
                          <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10, fontWeight: 600 }}>🕐 Available Slots</p>
                          {avail.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                              {avail.map(t => (
                                <button key={t} onClick={() => setSelectedTime(t)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: `1px solid ${selectedTime === t ? COLORS.accent : COLORS.cardBorder}`, background: selectedTime === t ? `${COLORS.accent}20` : COLORS.bg, color: selectedTime === t ? COLORS.accent : COLORS.text, fontWeight: selectedTime === t ? 700 : 400 }}>{t}</button>
                              ))}
                            </div>
                          ) : (
                            <p style={{ color: COLORS.muted, fontSize: 12, marginBottom: 14 }}>No time slots set.</p>
                          )}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "10px 14px", background: COLORS.bg, borderRadius: 10, border: `1px solid ${COLORS.cardBorder}` }}>
                            <span style={{ color: COLORS.text, fontSize: 13 }}>🚨 Emergency Priority</span>
                            <div onClick={() => setIsEmergency(!isEmergency)} style={{ width: 44, height: 24, borderRadius: 12, position: "relative", cursor: "pointer", background: isEmergency ? COLORS.red : COLORS.cardBorder }}>
                              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: isEmergency ? 23 : 3, transition: "left 0.2s" }} />
                            </div>
                          </div>
                          {selectedTime
                            ? <button onClick={() => setShowPayment(true)} style={{ width: "100%", padding: "12px", background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, borderRadius: 10, cursor: "pointer" }}>💳 Pay ₹{isEmergency ? Math.round((doc.fee || 0) * 1.5) : doc.fee}</button>
                            : <p style={{ color: COLORS.muted, fontSize: 13, textAlign: "center" }}>← Select a time slot</p>
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
              <Link to="/patient/upload" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text, fontSize: 14, textDecoration: "none", background: COLORS.bg, marginBottom: 8 }}>📤 Upload Health Report</Link>
              <Link to="/patient/analyze" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text, fontSize: 14, textDecoration: "none", background: COLORS.bg, marginBottom: 8 }}>🩺 Analyze Report with AI</Link>
              <button onClick={() => setActiveTab("doctor_reports")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: `1px solid ${COLORS.teal}30`, background: `${COLORS.teal}08`, color: COLORS.teal, fontSize: 14, cursor: "pointer", width: "100%", marginBottom: 8 }}>👨‍⚕️ Doctor Reports ({doctorReports.length})</button>
              <button onClick={() => setActiveTab("all_reports")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text, fontSize: 14, background: COLORS.bg, cursor: "pointer", width: "100%" }}>📋 All Reports ({reports.length})</button>
            </div>
            {specialties.length > 1 && (
              <div style={cardStyle}>
                <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🏥 Specialties</h3>
                {specialties.filter(s => s !== "All").map(spec => {
                  const count = doctors.filter(d => d.specialty === spec).length;
                  return (
                    <div key={spec} onClick={() => setFilterSpec(spec)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderRadius: 10, cursor: "pointer", marginBottom: 6, background: filterSpec === spec ? `${COLORS.accent}10` : COLORS.bg, border: `1px solid ${filterSpec === spec ? COLORS.accent + "40" : COLORS.cardBorder}` }}>
                      <span style={{ color: filterSpec === spec ? COLORS.accent : COLORS.text, fontSize: 13 }}>{spec}</span>
                      <span style={{ color: COLORS.muted, fontSize: 12, background: COLORS.card, padding: "2px 8px", borderRadius: 10 }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Health Records Section */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>📋 My Health Records</h3>
            <Badge count={reports.length} />
          </div>
          <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 20 }}>
            {!patientId ? "Log in to view your reports" : `${reports.length} total · ${doctorReports.length} from doctors · ${selfReports.length} self-uploaded`}
          </p>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 24, background: COLORS.bg, padding: 4, borderRadius: 12, width: "fit-content", flexWrap: "wrap" }}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, background: activeTab === tab.key ? COLORS.card : "transparent", color: activeTab === tab.key ? COLORS.text : COLORS.muted, fontWeight: activeTab === tab.key ? 700 : 400 }}>{tab.label}</button>
            ))}
          </div>

          {/* All Reports Tab */}
          {activeTab === "all_reports" && (
            reports.length === 0
              ? <EmptyState icon="📂" title="No reports yet" message="Upload your medical documents or wait for your doctor to upload." />
              : <ReportGrid reports={reports} verifyStatus={verifyStatus} onVerify={handleVerifyReport} onView={setViewerRecord} />
          )}

          {/* Doctor Reports Tab */}
          {activeTab === "doctor_reports" && (
            doctorReports.length === 0
              ? <EmptyState icon="👨‍⚕️" title="No doctor reports yet" message="When your doctor uploads a report with comments and recommendations, it will appear here." />
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ padding: "12px 16px", background: `${COLORS.teal}08`, border: `1px solid ${COLORS.teal}25`, borderRadius: 10, marginBottom: 8 }}>
                    <p style={{ color: COLORS.teal, fontSize: 13, fontWeight: 600 }}>
                      💡 Click "Details" on any report to see your doctor's comments, diagnosis notes, and recommendations.
                    </p>
                  </div>
                  {doctorReports.map((r, i) => (
                    <DoctorReportCard
                      key={r.id || i}
                      report={r}
                      onView={(rec) => setViewerRecord({ id: rec.id, fileName: rec.fileName, ipfsUrl: rec.ipfsUrl })}
                    />
                  ))}
                </div>
              )
          )}

          {/* My Uploads Tab */}
          {activeTab === "my_uploads" && (
            selfReports.length === 0
              ? <EmptyState icon="📤" title="No self-uploads yet" message="Upload your medical documents using the Upload Report button." />
              : <ReportGrid reports={selfReports} verifyStatus={verifyStatus} onVerify={handleVerifyReport} onView={setViewerRecord} />
          )}

          {/* AI Summary Tab */}
          {activeTab === "ai_summary" && (
            selectedReport?.aiSummary
              ? <AISummaryCard summary={selectedReport.aiSummary} />
              : <EmptyState icon="📄" message="No AI summary available. Select a report from All Reports." />
          )}
        </div>
      </div>
    </div>
  );
}

// Small helper badge
function Badge({ count }) {
  return <span style={{ background: `${COLORS.accent}15`, color: COLORS.accent, border: `1px solid ${COLORS.accent}30`, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{count}</span>;
}

// Report grid for self-uploaded reports
function ReportGrid({ reports, verifyStatus, onVerify, onView }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {reports.map((report, idx) => {
        const hasFile = !!(report.ipfsUrl || report.id);
        return (
          <div
            key={report.id || idx}
            style={{ padding: 16, borderRadius: 12, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.bg, cursor: "pointer", transition: "border-color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.cardBorder}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: `${COLORS.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📄</div>
              <div style={{ flex: 1 }}>
                <p style={{ color: COLORS.text, fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{report.fileName || "Report"}</p>
                <span style={{ background: `${COLORS.accent2}20`, color: "#a78bfa", border: `1px solid ${COLORS.accent2}30`, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{report.category || "General"}</span>
                <p style={{ color: COLORS.muted, fontSize: 11, marginTop: 6 }}>{report.uploadDate || "—"}</p>
                {report.doctor && report.doctor !== "Self Upload" && (
                  <p style={{ color: COLORS.teal, fontSize: 11, marginTop: 3 }}>👨‍⚕️ Dr. {report.doctor}</p>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {hasFile && (
                    <button onClick={() => onView({ id: report.id, fileName: report.fileName, ipfsUrl: report.ipfsUrl })} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: `1px solid ${COLORS.accent}40`, background: `${COLORS.accent}15`, color: COLORS.accent, fontWeight: 600 }}>📄 View</button>
                  )}
                  <button onClick={() => onVerify(report, idx)} disabled={verifyStatus[idx] === "checking"} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: "none", background: verifyStatus[idx] === "verified" ? `${COLORS.green}22` : verifyStatus[idx] === "failed" ? `${COLORS.red}22` : `${COLORS.accent}22`, color: verifyStatus[idx] === "verified" ? COLORS.green : verifyStatus[idx] === "failed" ? COLORS.red : COLORS.accent }}>
                    {verifyStatus[idx] === "checking" ? "Checking…" : verifyStatus[idx] === "verified" ? "✅ Verified" : verifyStatus[idx] === "failed" ? "⚠️ Mismatch" : "🔍 Verify"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default PatientDashboard;