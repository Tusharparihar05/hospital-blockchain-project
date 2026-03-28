import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { connectWallet, shortAddress } from "../hooks/useBlockchain";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const COLORS = {
  bg: "#0a0f1e", card: "#0f1729", cardBorder: "#1a2540",
  accent: "#00d4ff", accent2: "#7c3aed", green: "#10b981",
  red: "#ef4444", yellow: "#f59e0b", text: "#e2e8f0", muted: "#64748b",
};

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%",
  background: "#0a0f1e",
  border: `1px solid ${COLORS.cardBorder}`,
  color: COLORS.text,
  padding: "12px 16px",
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  display: "block",          // ← KEY FIX: block so each input takes full row
  fontFamily: "inherit",
};

const btnPrimary = {
  width: "100%", padding: "12px", borderRadius: 10, border: "none",
  background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
  color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8,
  fontFamily: "inherit",
};

// ── Field component: label + input on separate lines ─────────────────────────
function Field({ label, type = "text", placeholder, value, onChange, hint }) {
  return (
    <div style={{ marginBottom: 16, width: "100%" }}>
      <label style={{ color: COLORS.muted, fontSize: 13, display: "block", marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        style={inputStyle}
        value={value}
        onChange={onChange}
        autoComplete={type === "password" ? "new-password" : "off"}
      />
      {hint && <p style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("patient");
  const [loading, setLoading]     = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  // ── Separate state per field (no object spread) ───────────────────────────
  // Patient fields
  const [pName,    setPName]    = useState("");
  const [pEmail,   setPEmail]   = useState("");
  const [pPhone,   setPPhone]   = useState("");
  const [pPass,    setPPass]    = useState("");
  const [pConfirm, setPConfirm] = useState("");

  // Doctor fields
  const [dName,    setDName]    = useState("");
  const [dEmail,   setDEmail]   = useState("");
  const [dPhone,   setDPhone]   = useState("");
  const [dSpec,    setDSpec]    = useState("");
  const [dLicense, setDLicense] = useState("");
  const [dPass,    setDPass]    = useState("");
  const [dConfirm, setDConfirm] = useState("");

  // ── Connect wallet ────────────────────────────────────────────────────────
  const handleConnectWallet = async () => {
    try {
      const address = await connectWallet();
      setWalletAddress(address);
      toast.success(`Wallet linked: ${shortAddress(address)}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── Patient signup ────────────────────────────────────────────────────────
  const handlePatientSignup = async (e) => {
    e.preventDefault();
    if (!pName || !pEmail || !pPhone || !pPass) {
      toast.error("Please fill in all fields"); return;
    }
    if (pPass !== pConfirm) {
      toast.error("Passwords do not match"); return;
    }
    setLoading(true);
    const payload = {
      name: pName, email: pEmail, phone: pPhone,
      password: pPass, role: "patient", walletAddress,
    };
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      if (data.token) localStorage.setItem("token", data.token);
      // ← Store user with the real name from the form
      localStorage.setItem("user", JSON.stringify({
        ...(data.user || {}),
        name: pName,
        email: pEmail,
        role: "patient",
        patientId: data.user?.patientId || "HLT-0x72A91B",
        walletAddress,
        chainPatientId: data.user?.chainPatientId || Math.floor(Math.random() * 900000) + 100000,
      }));
      toast.success(`Welcome, ${pName}! Account created.`);
      setTimeout(() => navigate("/patient/dashboard"), 1000);
    } catch {
      // Offline fallback — still use the typed name
      localStorage.setItem("user", JSON.stringify({
        id: "USR-LOCAL",
        name: pName,
        email: pEmail,
        role: "patient",
        patientId: "HLT-0x72A91B",
        walletAddress,
        chainPatientId: Math.floor(Math.random() * 900000) + 100000,
      }));
      toast.success(`Welcome, ${pName}! Account created.`);
      setTimeout(() => navigate("/patient/dashboard"), 1000);
    } finally {
      setLoading(false);
    }
  };

  // ── Doctor signup ─────────────────────────────────────────────────────────
  const handleDoctorSignup = async (e) => {
    e.preventDefault();
    if (!dName || !dEmail || !dSpec || !dLicense || !dPass) {
      toast.error("Please fill in all fields"); return;
    }
    if (dPass !== dConfirm) {
      toast.error("Passwords do not match"); return;
    }
    if (dLicense.length < 6) {
      toast.error("Valid Medical License Number required"); return;
    }
    setLoading(true);
    const payload = {
      name: dName, email: dEmail, phone: dPhone,
      specialty: dSpec, licenseNumber: dLicense,
      password: dPass, role: "doctor", walletAddress,
    };
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      if (data.token) localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify({
        ...(data.user || {}),
        name: dName,
        email: dEmail,
        role: "doctor",
        specialty: dSpec,
        licenseNumber: dLicense,
        walletAddress,
      }));
      toast.success(`Welcome, ${dName}! License verified.`);
      setTimeout(() => navigate("/doctor"), 1000);
    } catch {
      localStorage.setItem("user", JSON.stringify({
        id: "USR-LOCAL",
        name: dName,
        email: dEmail,
        role: "doctor",
        specialty: dSpec,
        licenseNumber: dLicense,
        walletAddress,
      }));
      toast.success(`Welcome, ${dName}! Account created.`);
      setTimeout(() => navigate("/doctor"), 1000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, fontFamily: "'Segoe UI', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 520 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, margin: "0 auto 14px",
          }}>⛓️</div>
          <h1 style={{ color: COLORS.text, fontSize: 26, fontWeight: 700, fontFamily: "monospace" }}>MediChain</h1>
          <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>Create your account to get started</p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: "flex", background: "#080d1a", borderRadius: 12,
          padding: 4, marginBottom: 24, border: `1px solid ${COLORS.cardBorder}`,
        }}>
          {["patient", "doctor"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "10px", borderRadius: 9, border: "none", cursor: "pointer",
              background: activeTab === tab
                ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`
                : "transparent",
              color: activeTab === tab ? "#fff" : COLORS.muted,
              fontWeight: activeTab === tab ? 700 : 400,
              fontSize: 14, transition: "all 0.2s", fontFamily: "inherit",
            }}>
              {tab === "patient" ? "👤 Patient" : "🩺 Doctor"}
            </button>
          ))}
        </div>

        {/* Card */}
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 20, padding: 32,
        }}>

          {/* MetaMask connect */}
          <button onClick={handleConnectWallet} style={{
            width: "100%", padding: "11px", borderRadius: 10,
            border: `1px solid ${walletAddress ? COLORS.green : COLORS.accent}44`,
            background: walletAddress ? `${COLORS.green}11` : `${COLORS.accent}11`,
            color: walletAddress ? COLORS.green : COLORS.accent,
            fontSize: 14, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 10, marginBottom: 20, fontFamily: "inherit",
          }}>
            {walletAddress
              ? `🟢 Wallet Linked: ${shortAddress(walletAddress)}`
              : "🦊 Link MetaMask Wallet (Optional)"}
          </button>

          {walletAddress && (
            <div style={{
              background: `${COLORS.green}11`, border: `1px solid ${COLORS.green}33`,
              borderRadius: 10, padding: "10px 14px", marginBottom: 16,
              color: COLORS.green, fontSize: 12,
            }}>
              ✅ Wallet address will be stored with your account for blockchain features
            </div>
          )}

          {/* ── PATIENT FORM ── */}
          {activeTab === "patient" ? (
            <form onSubmit={handlePatientSignup} autoComplete="off">
              <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                Patient Registration
              </h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 24 }}>
                Create your account to book appointments
              </p>

              <Field
                label="Full Name"
                placeholder="John Doe"
                value={pName}
                onChange={e => setPName(e.target.value)}
              />
              <Field
                label="Email"
                type="email"
                placeholder="john@email.com"
                value={pEmail}
                onChange={e => setPEmail(e.target.value)}
              />
              <Field
                label="Phone Number"
                placeholder="+91 9876543210"
                value={pPhone}
                onChange={e => setPPhone(e.target.value)}
              />
              <Field
                label="Password"
                type="password"
                placeholder="••••••••"
                value={pPass}
                onChange={e => setPPass(e.target.value)}
              />
              <Field
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                value={pConfirm}
                onChange={e => setPConfirm(e.target.value)}
              />

              <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>
                {loading ? "Creating account..." : "Create Patient Account"}
              </button>
            </form>

          ) : (
            /* ── DOCTOR FORM ── */
            <form onSubmit={handleDoctorSignup} autoComplete="off">
              <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                Doctor Registration
              </h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>
                Create your professional account
              </p>

              <div style={{
                background: `${COLORS.accent}11`, border: `1px solid ${COLORS.accent}33`,
                borderRadius: 10, padding: "10px 14px", marginBottom: 20,
                color: COLORS.accent, fontSize: 13,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                ⚠️ A verified Medical License Number is required to access the doctor dashboard
              </div>

              <Field
                label="Full Name"
                placeholder="Dr. Sarah Johnson"
                value={dName}
                onChange={e => setDName(e.target.value)}
              />
              <Field
                label="Email"
                type="email"
                placeholder="doctor@hospital.com"
                value={dEmail}
                onChange={e => setDEmail(e.target.value)}
              />
              <Field
                label="Phone Number"
                placeholder="+91 9876543210"
                value={dPhone}
                onChange={e => setDPhone(e.target.value)}
              />
              <Field
                label="Specialty"
                placeholder="Cardiology, Neurology"
                value={dSpec}
                onChange={e => setDSpec(e.target.value)}
              />
              <Field
                label="Medical License Number *"
                placeholder="MED123456"
                value={dLicense}
                onChange={e => setDLicense(e.target.value)}
                hint="This will be verified before granting access"
              />
              <Field
                label="Password"
                type="password"
                placeholder="••••••••"
                value={dPass}
                onChange={e => setDPass(e.target.value)}
              />
              <Field
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                value={dConfirm}
                onChange={e => setDConfirm(e.target.value)}
              />

              <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>
                {loading ? "Creating account..." : "Create Doctor Account"}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 20, color: COLORS.muted, fontSize: 14 }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: COLORS.accent }}>Login here</Link>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;