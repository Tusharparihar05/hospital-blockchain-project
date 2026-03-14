import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/landingpage";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorSubmitPage from "./pages/doctororstafsubmitpage";
import PatientDashboard from "./pages/patientdashbord";
import PatientSubmit from "./pages/patientsubmit";
import NotFound from "./pages/notfound";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import { useState, useEffect, useCallback } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

const COLORS = {
  bg: "#0a0f1e",
  card: "#0f1729",
  cardBorder: "#1a2540",
  accent: "#00d4ff",
  accent2: "#7c3aed",
  green: "#10b981",
  red: "#ef4444",
  yellow: "#f59e0b",
  text: "#e2e8f0",
  muted: "#64748b",
};

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
function TopBar({ activeTab, setActiveTab, walletConnected, setWalletConnected, setWalletAddress }) {
  const tabs = ["Dashboard", "Book Appointment", "My Records", "Doctors", "Emergency"];

  const handleWallet = async () => {
    if (walletConnected) {
      setWalletConnected(false);
      setWalletAddress("");
      return;
    }
    const mockAddress = "0x72A9...1B";
    try {
      const data = await apiFetch("/wallet/connect", {
        method: "POST",
        body: JSON.stringify({ walletAddress: mockAddress }),
      });
      setWalletConnected(true);
      setWalletAddress(data.walletAddress);
    } catch (err) {
      console.error("Wallet connect failed:", err.message);
    }
  };

  return (
    <div style={{
      background: "#080d1a",
      borderBottom: `1px solid ${COLORS.cardBorder}`,
      padding: "0 32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 64,
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>⛓️</div>
        <div>
          <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, fontFamily: "'Courier New', monospace" }}>MediChain</div>
          <div style={{ color: COLORS.muted, fontSize: 10 }}>Blockchain Health Platform</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4 }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: activeTab === tab ? `linear-gradient(135deg, ${COLORS.accent}22, ${COLORS.accent2}22)` : "transparent",
            border: activeTab === tab ? `1px solid ${COLORS.accent}55` : "1px solid transparent",
            color: activeTab === tab ? COLORS.accent : COLORS.muted,
            padding: "6px 14px", borderRadius: 8, cursor: "pointer",
            fontSize: 13, fontWeight: activeTab === tab ? 600 : 400, transition: "all 0.2s",
          }}>
            {tab === "Emergency" ? "🚨 " : ""}{tab}
          </button>
        ))}
      </div>

      <button onClick={handleWallet} style={{
        background: walletConnected
          ? `linear-gradient(135deg, ${COLORS.green}22, ${COLORS.green}11)`
          : `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
        border: walletConnected ? `1px solid ${COLORS.green}55` : "none",
        color: walletConnected ? COLORS.green : "#fff",
        padding: "8px 16px", borderRadius: 10, cursor: "pointer",
        fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
      }}>
        <span>{walletConnected ? "🟢" : "🦊"}</span>
        {walletConnected ? "0x72A9...1B" : "Connect Wallet"}
      </button>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, sub }) {
  return (
    <div style={{
      background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
      borderRadius: 16, padding: "20px 24px", flex: 1,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -20, right: -20,
        width: 80, height: 80, borderRadius: "50%", background: `${color}11`,
      }} />
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 28, fontWeight: 700, fontFamily: "'Courier New', monospace" }}>{value}</div>
      {sub && <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── LoadingSpinner & ErrorBox ────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div style={{ textAlign: "center", padding: 60, color: COLORS.muted }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⛓️</div>
      <div>Loading from chain...</div>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div style={{
      background: `${COLORS.red}11`, border: `1px solid ${COLORS.red}33`,
      borderRadius: 12, padding: "16px 20px", color: COLORS.red,
    }}>
      ⚠️ {message}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ walletConnected }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/dashboard")
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div>
      {!walletConnected && (
        <div style={{
          background: `linear-gradient(135deg, ${COLORS.accent}11, ${COLORS.accent2}11)`,
          border: `1px solid ${COLORS.accent}33`,
          borderRadius: 12, padding: "12px 20px",
          color: COLORS.accent, marginBottom: 24, fontSize: 14,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span>🦊</span> Connect your MetaMask wallet to access your blockchain health records
        </div>
      )}

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <StatCard icon="🏥" label="Total Patients"     value={stats.totalPatients}        color={COLORS.accent}  sub="↑ 12 today" />
        <StatCard icon="📋" label="Appointments Today" value={stats.appointmentsToday}    color={COLORS.accent2} sub="pending review" />
        <StatCard icon="⛓️" label="On-Chain Records"   value={stats.onChainRecords}       color={COLORS.green}   sub="Tamper-proof" />
        <StatCard icon="⚡" label="Avg Wait Time"      value={`${stats.avgWaitMinutes}m`} color={COLORS.yellow}  sub="across all depts" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, padding: 24 }}>
          <div style={{ color: COLORS.text, fontWeight: 700, marginBottom: 16, fontSize: 15 }}>🏃 Live Queue Status</div>
          {stats.queueData.map(d => (
            <div key={d.dept} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ color: COLORS.text, fontSize: 13, width: 110 }}>{d.dept}</span>
              <div style={{ flex: 1, height: 6, background: "#1a2540", borderRadius: 3, margin: "0 12px" }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  width: d.level === "high" ? "85%" : d.level === "medium" ? "50%" : "20%",
                  background: d.level === "high" ? COLORS.red : d.level === "medium" ? COLORS.yellow : COLORS.green,
                }} />
              </div>
              <span style={{
                fontSize: 12, width: 60, textAlign: "right",
                color: d.level === "high" ? COLORS.red : d.level === "medium" ? COLORS.yellow : COLORS.green,
              }}>
                {d.level === "high" ? "🔴" : d.level === "medium" ? "🟡" : "🟢"} {d.wait}m
              </span>
            </div>
          ))}
        </div>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, padding: 24 }}>
          <div style={{ color: COLORS.text, fontWeight: 700, marginBottom: 16, fontSize: 15 }}>👥 Recent Patients</div>
          {stats.recentPatients.map(p => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 0", borderBottom: `1px solid ${COLORS.cardBorder}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLORS.accent}33, ${COLORS.accent2}33)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: COLORS.accent, fontWeight: 700, fontSize: 14,
                }}>{p.name[0]}</div>
                <div>
                  <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: COLORS.muted, fontSize: 11 }}>{p.id} · {p.dept}</div>
                </div>
              </div>
              <span style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 20,
                background: p.status === "Checked In" ? `${COLORS.green}22` : p.status === "In Consultation" ? `${COLORS.accent}22` : `${COLORS.yellow}22`,
                color: p.status === "Checked In" ? COLORS.green : p.status === "In Consultation" ? COLORS.accent : COLORS.yellow,
                border: `1px solid ${p.status === "Checked In" ? COLORS.green : p.status === "In Consultation" ? COLORS.accent : COLORS.yellow}44`,
              }}>{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── BookAppointment ──────────────────────────────────────────────────────────
function BookAppointment() {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState({ dept: "", doctor: "", date: "", time: "" });
  const [doctors, setDoctors] = useState([]);
  const [booked, setBooked] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const depts = ["Cardiology", "Dermatology", "Orthopedics", "Neurology", "Pediatrics", "General"];
  const times = ["09:00 AM", "10:30 AM", "11:00 AM", "02:00 PM", "03:30 PM", "05:00 PM"];

  useEffect(() => {
    if (!selected.dept) return;
    apiFetch(`/doctors/dept/${selected.dept}`)
      .then(setDoctors)
      .catch(() => setDoctors([]));
  }, [selected.dept]);

  const confirmBooking = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/appointments", {
        method: "POST",
        body: JSON.stringify({
          patientId: "HLT-0x72A91B",
          dept: selected.dept,
          doctorName: selected.doctor,
          date: selected.date,
          time: selected.time,
        }),
      });
      setBooked(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (booked) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.green}44`,
          borderRadius: 20, padding: 40, textAlign: "center",
        }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🎫</div>
          <div style={{ color: COLORS.green, fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Appointment Confirmed!</div>
          <div style={{ color: COLORS.muted, marginBottom: 24 }}>Your NFT appointment token has been minted</div>
          <div style={{ background: "#0a0f1e", border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 4 }}>TOKEN ID</div>
            <div style={{ color: COLORS.accent, fontSize: 20, fontWeight: 700, fontFamily: "'Courier New', monospace" }}>{booked.tokenId}</div>
            <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 8 }}>
              Queue #{booked.appointment.queuePosition} · {booked.appointment.dept} · {booked.appointment.time}
            </div>
          </div>
          <button onClick={() => { setBooked(null); setStep(1); setSelected({ dept: "", doctor: "", date: "", time: "" }); }} style={{
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
            border: "none", color: "#fff", padding: "12px 28px", borderRadius: 10, cursor: "pointer", fontWeight: 700,
          }}>Book Another</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 0, marginBottom: 32 }}>
        {["Department", "Doctor", "Date & Time", "Confirm"].map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: step > i + 1 ? COLORS.green : step === i + 1 ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})` : COLORS.cardBorder,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: step >= i + 1 ? "#fff" : COLORS.muted, fontWeight: 700, fontSize: 14,
            }}>{step > i + 1 ? "✓" : i + 1}</div>
            <div style={{ color: step === i + 1 ? COLORS.accent : COLORS.muted, fontSize: 12, margin: "0 4px" }}>{s}</div>
            {i < 3 && <div style={{ width: 30, height: 1, background: COLORS.cardBorder, margin: "0 4px" }} />}
          </div>
        ))}
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 20, padding: 32 }}>
        {step === 1 && (
          <div>
            <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Select Department</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {depts.map(d => (
                <button key={d} onClick={() => { setSelected(s => ({ ...s, dept: d })); setStep(2); }} style={{
                  background: "#0a0f1e", border: `1px solid ${COLORS.cardBorder}`,
                  color: COLORS.text, padding: "16px 12px", borderRadius: 12, cursor: "pointer", fontSize: 14,
                }}>
                  {d === "Cardiology" ? "❤️" : d === "Dermatology" ? "🧴" : d === "Orthopedics" ? "🦴" : d === "Neurology" ? "🧠" : d === "Pediatrics" ? "👶" : "🏥"} {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Select Doctor — {selected.dept}</div>
            {doctors.length === 0 && <div style={{ color: COLORS.muted, textAlign: "center", padding: 24 }}>No doctors available.</div>}
            {doctors.map(d => (
              <div key={d.name} onClick={() => d.available && (setSelected(s => ({ ...s, doctor: d.name })), setStep(3))} style={{
                background: "#0a0f1e", border: `1px solid ${COLORS.cardBorder}`,
                borderRadius: 12, padding: 16, marginBottom: 10,
                cursor: d.available ? "pointer" : "not-allowed", opacity: d.available ? 1 : 0.5,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${COLORS.accent2}44, ${COLORS.accent}44)`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                  }}>👨‍⚕️</div>
                  <div>
                    <div style={{ color: COLORS.text, fontWeight: 600 }}>{d.name}</div>
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>{d.dept} · ⭐ {d.rating}</div>
                  </div>
                </div>
                <div style={{ color: d.available ? COLORS.green : COLORS.red, fontSize: 12 }}>
                  {d.available ? `${d.slots} slots` : "Unavailable"}
                </div>
              </div>
            ))}
            <button onClick={() => setStep(1)} style={{
              marginTop: 8, background: "transparent", border: `1px solid ${COLORS.muted}`,
              color: COLORS.muted, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13,
            }}>← Back</button>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Select Date & Time</div>
            <input type="date" onChange={e => setSelected(s => ({ ...s, date: e.target.value }))} style={{
              width: "100%", background: "#0a0f1e", border: `1px solid ${COLORS.cardBorder}`,
              color: COLORS.text, padding: "12px 16px", borderRadius: 10, marginBottom: 20,
              fontSize: 14, outline: "none", boxSizing: "border-box",
            }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {times.map(t => (
                <button key={t} onClick={() => { setSelected(s => ({ ...s, time: t })); setStep(4); }} style={{
                  background: selected.time === t ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})` : "#0a0f1e",
                  border: `1px solid ${selected.time === t ? COLORS.accent : COLORS.cardBorder}`,
                  color: selected.time === t ? "#fff" : COLORS.text,
                  padding: "12px 8px", borderRadius: 10, cursor: "pointer", fontSize: 13,
                }}>🕐 {t}</button>
              ))}
            </div>
            <button onClick={() => setStep(2)} style={{
              marginTop: 16, background: "transparent", border: `1px solid ${COLORS.muted}`,
              color: COLORS.muted, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13,
            }}>← Back</button>
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Confirm Appointment</div>
            {[["Department", selected.dept], ["Doctor", selected.doctor], ["Date", selected.date], ["Time", selected.time]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${COLORS.cardBorder}` }}>
                <span style={{ color: COLORS.muted }}>{k}</span>
                <span style={{ color: COLORS.text, fontWeight: 600 }}>{v || "Not selected"}</span>
              </div>
            ))}
            {error && <div style={{ color: COLORS.red, marginTop: 12, fontSize: 13 }}>⚠️ {error}</div>}
            <div style={{
              background: `${COLORS.accent}11`, border: `1px solid ${COLORS.accent}33`,
              borderRadius: 10, padding: 12, marginTop: 16, color: COLORS.accent, fontSize: 13,
            }}>⛓️ An NFT appointment token will be minted to your wallet upon confirmation</div>
            <button onClick={confirmBooking} disabled={loading} style={{
              width: "100%", marginTop: 20,
              background: loading ? COLORS.cardBorder : `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
              border: "none", color: "#fff", padding: "14px", borderRadius: 12,
              cursor: loading ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700,
            }}>{loading ? "⛓️ Minting token..." : "🔐 Sign & Mint Appointment Token"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MyRecords ────────────────────────────────────────────────────────────────
function MyRecords({ walletConnected }) {
  const PATIENT_ID = "HLT-0x72A91B";
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [error, setError] = useState("");

  const fetchRecords = useCallback(() => {
    setLoading(true);
    apiFetch(`/records/${PATIENT_ID}`)
      .then(setRecords)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleUpload = async () => {
    setUploading(true);
    setUploadMsg("");
    try {
      const data = await apiFetch("/records", {
        method: "POST",
        body: JSON.stringify({ patientId: PATIENT_ID, type: "Lab Report", doctor: "Dr. Ananya Singh", dept: "Cardiology" }),
      });
      setUploadMsg(`✅ Uploaded! IPFS hash: ${data.ipfsHash}`);
      fetchRecords();
    } catch (e) {
      setUploadMsg(`⚠️ ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 20 }}>My Health Records</div>
          <div style={{ color: COLORS.muted, fontSize: 13 }}>
            Patient ID: <span style={{ color: COLORS.accent, fontFamily: "monospace" }}>{PATIENT_ID}</span>
          </div>
        </div>
        <div>
          <button onClick={handleUpload} disabled={uploading} style={{
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
            border: "none", color: "#fff", padding: "10px 20px",
            borderRadius: 10, cursor: uploading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600,
          }}>{uploading ? "⛓️ Uploading to IPFS..." : "📤 Upload Document"}</button>
          {uploadMsg && <div style={{ color: COLORS.green, fontSize: 12, marginTop: 6 }}>{uploadMsg}</div>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, padding: 24 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{
              width: 70, height: 70, borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, margin: "0 auto 12px",
            }}>👤</div>
            <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>Arjun Sharma</div>
            <div style={{ color: COLORS.muted, fontSize: 12, fontFamily: "monospace" }}>{PATIENT_ID}</div>
          </div>
          {[["Age", "34 years"], ["Blood Group", "B+"], ["Allergies", "Penicillin"], ["Chronic", "Hypertension"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.cardBorder}` }}>
              <span style={{ color: COLORS.muted, fontSize: 12 }}>{k}</span>
              <span style={{ color: COLORS.text, fontSize: 12, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: 12, background: `${COLORS.green}11`, border: `1px solid ${COLORS.green}33`, borderRadius: 10, textAlign: "center" }}>
            <div style={{ color: COLORS.green, fontSize: 11 }}>⛓️ Verified on Blockchain</div>
          </div>
        </div>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, padding: 24 }}>
          <div style={{ color: COLORS.text, fontWeight: 700, marginBottom: 16 }}>Document History ({records.length})</div>
          {records.map((r, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: 14, background: "#0a0f1e", borderRadius: 10, marginBottom: 10,
              border: `1px solid ${COLORS.cardBorder}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `linear-gradient(135deg, ${COLORS.accent2}33, ${COLORS.accent}33)`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>
                  {r.type === "Prescription" ? "💊" : r.type === "Lab Report" ? "🔬" : r.type === "X-Ray" ? "🩻" : "📋"}
                </div>
                <div>
                  <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 14 }}>{r.type}</div>
                  <div style={{ color: COLORS.muted, fontSize: 11 }}>{r.doctor} · {r.date}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: COLORS.accent, fontSize: 11, fontFamily: "monospace" }}>{r.hash.slice(0, 14)}...</div>
                <div style={{ color: COLORS.green, fontSize: 11, marginTop: 2 }}>✓ On IPFS</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Doctors ──────────────────────────────────────────────────────────────────
function DoctorsList() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/doctors")
      .then(setDoctors)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div>
      <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 20, marginBottom: 24 }}>Find Doctors</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {doctors.map(d => (
          <div key={d.name} style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: `linear-gradient(135deg, ${COLORS.accent2}55, ${COLORS.accent}55)`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
              }}>👨‍⚕️</div>
              <div>
                <div style={{ color: COLORS.text, fontWeight: 700 }}>{d.name}</div>
                <div style={{ color: COLORS.muted, fontSize: 12 }}>{d.dept}</div>
                <div style={{ color: COLORS.yellow, fontSize: 12 }}>⭐ {d.rating} / 5.0</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{
                fontSize: 12, padding: "4px 12px", borderRadius: 20,
                background: d.available ? `${COLORS.green}22` : `${COLORS.red}22`,
                color: d.available ? COLORS.green : COLORS.red,
                border: `1px solid ${d.available ? COLORS.green : COLORS.red}44`,
              }}>{d.available ? `✅ ${d.slots} slots available` : "❌ Unavailable today"}</div>
              {d.available && (
                <button style={{
                  background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                  border: "none", color: "#fff", padding: "6px 14px",
                  borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
                }}>Book Now</button>
              )}
            </div>
            <div style={{ marginTop: 12, padding: 10, background: "#0a0f1e", borderRadius: 8, fontSize: 11, color: COLORS.muted }}>
              ⛓️ Reviews stored immutably on blockchain
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Emergency ────────────────────────────────────────────────────────────────
function Emergency() {
  const [activated, setActivated] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activated && countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
    if (activated && countdown === 0 && !response && !loading) {
      setLoading(true);
      apiFetch("/emergency", {
        method: "POST",
        body: JSON.stringify({ patientId: "HLT-0x72A91B" }),
      })
        .then(setResponse)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [activated, countdown, response, loading]);

  const reset = () => { setActivated(false); setCountdown(3); setResponse(null); };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
      <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 22, marginBottom: 8 }}>🚨 Emergency Protocol</div>
      <div style={{ color: COLORS.muted, marginBottom: 32 }}>Instantly share your medical info with nearby hospitals</div>

      {!activated ? (
        <div>
          <button onClick={() => setActivated(true)} style={{
            width: 180, height: 180, borderRadius: "50%",
            background: `radial-gradient(circle, ${COLORS.red}, #7f1d1d)`,
            border: `4px solid ${COLORS.red}`, color: "#fff", fontSize: 16, fontWeight: 700,
            cursor: "pointer", boxShadow: `0 0 40px ${COLORS.red}66`,
          }}>🆘<br />EMERGENCY<br />SOS</button>
          <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 20 }}>Press to share location + medical history with ER</div>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, padding: 20, marginTop: 32, textAlign: "left" }}>
            <div style={{ color: COLORS.text, fontWeight: 600, marginBottom: 12 }}>Will share instantly:</div>
            {["Blood Type: B+", "Allergies: Penicillin", "Chronic: Hypertension", "Emergency Contact: +91 9876543210", "GPS Location", "Last 3 Visit Summaries"].map(item => (
              <div key={item} style={{ color: COLORS.muted, fontSize: 13, padding: "4px 0" }}>✓ {item}</div>
            ))}
          </div>
        </div>
      ) : countdown > 0 ? (
        <div>
          <div style={{
            width: 160, height: 160, borderRadius: "50%",
            background: `radial-gradient(circle, ${COLORS.red}55, ${COLORS.red}11)`,
            border: `4px solid ${COLORS.red}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 64, color: COLORS.red, fontWeight: 900,
          }}>{countdown}</div>
          <div style={{ color: COLORS.red, fontSize: 18, fontWeight: 700 }}>Activating Emergency Protocol...</div>
          <button onClick={reset} style={{
            marginTop: 20, background: "transparent", border: `1px solid ${COLORS.muted}`,
            color: COLORS.muted, padding: "8px 20px", borderRadius: 8, cursor: "pointer",
          }}>Cancel</button>
        </div>
      ) : response ? (
        <div>
          <div style={{ fontSize: 60, marginBottom: 16 }}>📡</div>
          <div style={{ color: COLORS.green, fontWeight: 700, fontSize: 20, marginBottom: 8 }}>SOS Activated!</div>
          <div style={{ color: COLORS.muted, marginBottom: 20 }}>Emergency token generated — one-time 24hr access granted</div>
          <div style={{
            background: `${COLORS.red}11`, border: `1px solid ${COLORS.red}33`,
            borderRadius: 12, padding: 16, marginBottom: 16,
          }}>
            <div style={{ color: COLORS.red, fontFamily: "monospace", fontSize: 14 }}>EMERGENCY TOKEN: {response.emergencyToken}</div>
            <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>Expires: {new Date(response.expiresAt).toLocaleString()}</div>
          </div>
          <div style={{ color: COLORS.green, fontSize: 13 }}>
            🏥 {response.nearbyHospital.name} ({response.nearbyHospital.distanceKm}km) — Notified<br />
            🚑 Ambulance dispatched — {response.nearbyHospital.etaMinutes} min ETA
          </div>
          <button onClick={reset} style={{
            marginTop: 24, background: "transparent", border: `1px solid ${COLORS.muted}`,
            color: COLORS.muted, padding: "8px 20px", borderRadius: 8, cursor: "pointer",
          }}>Reset</button>
        </div>
      ) : <LoadingSpinner />}
    </div>
  );
}

// ─── DashboardLayout ──────────────────────────────────────────────────────────
function DashboardLayout() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  const renderTab = () => {
    switch (activeTab) {
      case "Dashboard":        return <Dashboard walletConnected={walletConnected} />;
      case "Book Appointment": return <BookAppointment />;
      case "My Records":       return <MyRecords walletConnected={walletConnected} />;
      case "Doctors":          return <DoctorsList />;
      case "Emergency":        return <Emergency />;
      default:                 return <Dashboard walletConnected={walletConnected} />;
    }
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "'Segoe UI', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0f1e; }
        ::-webkit-scrollbar-thumb { background: #1a2540; border-radius: 3px; }
        button:hover { opacity: 0.9; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        walletConnected={walletConnected}
        setWalletConnected={setWalletConnected}
        setWalletAddress={setWalletAddress}
      />
      <div style={{ padding: "32px 40px" }}>{renderTab()}</div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"          element={<LandingPage />} />
        <Route path="/signup"    element={<Signup />} />
        <Route path="/login"     element={<Login />} />
        <Route path="/dashboard" element={<DashboardLayout />} />
        <Route path="/doctor"    element={<DoctorDashboard />} />
        <Route path="/doctor/submit" element={<DoctorSubmitPage />} />
        <Route path="/patient/dashboard" element={<PatientDashboard />} />
        <Route path="/patient/upload"    element={<PatientSubmit />} />
        <Route path="*"          element={<NotFound />} />
      </Routes>
    </Router>
  );
}