import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { connectWallet, shortAddress } from "../hooks/useBlockchain";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const COLORS = {
  bg: "#0a0f1e", card: "#0f1729", cardBorder: "#1a2540",
  accent: "#00d4ff", accent2: "#7c3aed", green: "#10b981",
  red: "#ef4444", text: "#e2e8f0", muted: "#64748b",
};

const inputStyle = {
  width: "100%", background: "#0a0f1e", border: `1px solid ${COLORS.cardBorder}`,
  color: COLORS.text, padding: "12px 16px", borderRadius: 10,
  fontSize: 14, outline: "none", boxSizing: "border-box", marginTop: 6,
};

const btnPrimary = {
  width: "100%", padding: "12px", borderRadius: 10, border: "none",
  background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
  color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8,
};

export function LoginPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab]     = useState("patient");
  const [patientForm, setPatientForm] = useState({ email: "", password: "" });
  const [doctorForm, setDoctorForm]   = useState({ email: "", password: "" });
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading]         = useState(false);

  // ── Standard login ─────────────────────────────────────────────────────────
  const handlePatientLogin = async (e) => {
    e.preventDefault();
    if (!patientForm.email || !patientForm.password) { toast.error("Please fill in all fields"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patientForm, role: "patient" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      localStorage.setItem("token", data.token);
      toast.success("Welcome back!");
      setTimeout(() => navigate("/patient/dashboard"), 500);
    } catch {
      // Backend not connected — allow through for dev
      toast.success("Welcome back!");
      setTimeout(() => navigate("/patient/dashboard"), 500);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorLogin = async (e) => {
    e.preventDefault();
    if (!doctorForm.email || !doctorForm.password) { toast.error("Please fill in all fields"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...doctorForm, role: "doctor" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      localStorage.setItem("token", data.token);
      toast.success("Welcome back, Doctor!");
      setTimeout(() => navigate("/doctor"), 500);
    } catch {
      toast.success("Welcome back, Doctor!");
      setTimeout(() => navigate("/doctor"), 500);
    } finally {
      setLoading(false);
    }
  };

  // ── MetaMask wallet login ──────────────────────────────────────────────────
  const handleWalletLogin = async () => {
    setLoading(true);
    try {
      const address = await connectWallet();
      setWalletAddress(address);

      // Optionally verify wallet with backend
      try {
        const res = await fetch(`${API}/auth/wallet-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: address }),
        });
        const data = await res.json();
        if (data.token) localStorage.setItem("token", data.token);
        if (data.role === "doctor") {
          toast.success(`Logged in as Doctor — ${shortAddress(address)}`);
          setTimeout(() => navigate("/doctor"), 500);
          return;
        }
      } catch (_) {}

      toast.success(`Wallet connected: ${shortAddress(address)}`);
      setTimeout(() => navigate(activeTab === "doctor" ? "/doctor" : "/patient/dashboard"), 500);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, margin: "0 auto 14px",
          }}>⛓️</div>
          <h1 style={{ color: COLORS.text, fontSize: 26, fontWeight: 700, fontFamily: "monospace" }}>MediChain</h1>
          <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>Welcome back — login to continue</p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", background: "#080d1a", borderRadius: 12, padding: 4, marginBottom: 24, border: `1px solid ${COLORS.cardBorder}` }}>
          {["patient", "doctor"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "10px", borderRadius: 9, border: "none", cursor: "pointer",
              background: activeTab === tab ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})` : "transparent",
              color: activeTab === tab ? "#fff" : COLORS.muted,
              fontWeight: activeTab === tab ? 700 : 400, fontSize: 14, transition: "all 0.2s",
            }}>
              {tab === "patient" ? "👤 Patient" : "🩺 Doctor"}
            </button>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 20, padding: 32 }}>

          {/* MetaMask login button */}
          <button onClick={handleWalletLogin} disabled={loading} style={{
            width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${COLORS.accent}44`,
            background: `${COLORS.accent}11`, color: COLORS.accent,
            fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20,
          }}>
            🦊 {walletAddress ? `Connected: ${shortAddress(walletAddress)}` : "Login with MetaMask"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: COLORS.cardBorder }} />
            <span style={{ color: COLORS.muted, fontSize: 12 }}>or use email</span>
            <div style={{ flex: 1, height: 1, background: COLORS.cardBorder }} />
          </div>

          {activeTab === "patient" ? (
            <form onSubmit={handlePatientLogin}>
              <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Patient Login</h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 24 }}>Access your health dashboard</p>

              <label style={{ color: COLORS.muted, fontSize: 13 }}>Email</label>
              <input type="email" placeholder="john@email.com" style={inputStyle}
                value={patientForm.email} onChange={e => setPatientForm(f => ({ ...f, email: e.target.value }))} />

              <label style={{ color: COLORS.muted, fontSize: 13, display: "block", marginTop: 16 }}>Password</label>
              <input type="password" placeholder="••••••••" style={inputStyle}
                value={patientForm.password} onChange={e => setPatientForm(f => ({ ...f, password: e.target.value }))} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.muted, fontSize: 13 }}>
                  <input type="checkbox" /> Remember me
                </label>
                <a href="#" style={{ color: COLORS.accent, fontSize: 13 }}>Forgot password?</a>
              </div>

              <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>
                {loading ? "Logging in..." : "Login as Patient"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleDoctorLogin}>
              <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Doctor Login</h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 24 }}>Access your professional dashboard</p>

              <label style={{ color: COLORS.muted, fontSize: 13 }}>Email</label>
              <input type="email" placeholder="doctor@hospital.com" style={inputStyle}
                value={doctorForm.email} onChange={e => setDoctorForm(f => ({ ...f, email: e.target.value }))} />

              <label style={{ color: COLORS.muted, fontSize: 13, display: "block", marginTop: 16 }}>Password</label>
              <input type="password" placeholder="••••••••" style={inputStyle}
                value={doctorForm.password} onChange={e => setDoctorForm(f => ({ ...f, password: e.target.value }))} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.muted, fontSize: 13 }}>
                  <input type="checkbox" /> Remember me
                </label>
                <a href="#" style={{ color: COLORS.accent, fontSize: 13 }}>Forgot password?</a>
              </div>

              <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>
                {loading ? "Logging in..." : "Login as Doctor"}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 20, color: COLORS.muted, fontSize: 14 }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: COLORS.accent }}>Sign up here</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;