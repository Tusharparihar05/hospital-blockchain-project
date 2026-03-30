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
  width: "100%",
  background: "#0a0f1e",
  border: `1px solid ${COLORS.cardBorder}`,
  color: COLORS.text,
  padding: "12px 16px",
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  display: "block",
  fontFamily: "inherit",
};

const btnPrimary = {
  width: "100%", padding: "12px", borderRadius: 10, border: "none",
  background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
  color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8,
  fontFamily: "inherit",
};

export function LoginPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("patient");
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const [pEmail, setPEmail] = useState("");
  const [pPass,  setPPass]  = useState("");
  const [dEmail, setDEmail] = useState("");
  const [dPass,  setDPass]  = useState("");

  function resolveDisplayName(apiUser, email) {
    if (apiUser?.name && String(apiUser.name).trim()) return String(apiUser.name).trim();
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      if (stored.email === email && stored.name && String(stored.name).trim()) {
        return String(stored.name).trim();
      }
    } catch (_) {}
    return email ? email.split("@")[0].replace(/[._]/g, " ") : "User";
  }

  // FIX: offline fallback only runs on genuine network errors (TypeError).
  // A 401 / 403 from the server means wrong credentials — we throw it, not swallow it.
  const handlePatientLogin = async (e) => {
    e.preventDefault();
    if (!pEmail || !pPass) { toast.error("Please fill in all fields"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pEmail, password: pPass, role: "patient" }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Server responded with an error (wrong password, wrong role, etc.)
        toast.error(data.error || "Login failed");
        return;
      }
      if (data.token) localStorage.setItem("token", data.token);
      const name = resolveDisplayName(data.user, pEmail);
      localStorage.setItem("user", JSON.stringify({
        ...(data.user || {}),
        name,
        email: pEmail,
        role: "patient",
        patientId:      data.user?.patientId      || "HLT-0x72A91B",
        walletAddress:  data.user?.walletAddress  || "",
        chainPatientId: data.user?.chainPatientId || 72,
      }));
      toast.success(`Welcome back, ${name}!`);
      setTimeout(() => navigate("/patient/dashboard"), 500);
    } catch (err) {
      // Only reach here on a genuine network / CORS failure (TypeError)
      if (err instanceof TypeError) {
        const name = resolveDisplayName(null, pEmail);
        localStorage.setItem("user", JSON.stringify({
          id: "USR-LOCAL", name, email: pEmail, role: "patient",
          patientId: "HLT-0x72A91B", walletAddress: "", chainPatientId: 72,
        }));
        toast.success(`Welcome back, ${name}! (offline mode)`);
        setTimeout(() => navigate("/patient/dashboard"), 500);
      } else {
        toast.error(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorLogin = async (e) => {
    e.preventDefault();
    if (!dEmail || !dPass) { toast.error("Please fill in all fields"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: dEmail, password: dPass, role: "doctor" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Login failed");
        return;
      }
      if (data.token) localStorage.setItem("token", data.token);
      const name = resolveDisplayName(data.user, dEmail);
      localStorage.setItem("user", JSON.stringify({
        ...(data.user || {}),
        name,
        email: dEmail,
        role: "doctor",
        specialty:     data.user?.specialty     || "",
        licenseNumber: data.user?.licenseNumber || "",
        walletAddress: data.user?.walletAddress || "",
      }));
      toast.success(`Welcome back, ${name}!`);
      setTimeout(() => navigate("/doctor"), 500);
    } catch (err) {
      if (err instanceof TypeError) {
        const name = resolveDisplayName(null, dEmail);
        localStorage.setItem("user", JSON.stringify({
          id: "USR-LOCAL", name, email: dEmail, role: "doctor",
          specialty: "", licenseNumber: "", walletAddress: "",
        }));
        toast.success(`Welcome back, ${name}! (offline mode)`);
        setTimeout(() => navigate("/doctor"), 500);
      } else {
        toast.error(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWalletLogin = async () => {
    setLoading(true);
    try {
      const address = await connectWallet();
      setWalletAddress(address);
      try {
        const res = await fetch(`${API}/auth/wallet-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: address }),
        });
        const data = await res.json();
        if (data.token) localStorage.setItem("token", data.token);
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
          const dest = data.user.role === "doctor" ? "/doctor" : "/patient/dashboard";
          toast.success(`Welcome back, ${data.user.name || shortAddress(address)}!`);
          setTimeout(() => navigate(dest), 500);
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
    <div style={{
      minHeight: "100vh", background: COLORS.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, fontFamily: "'Segoe UI', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

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

        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 20, padding: 32,
        }}>

          <button onClick={handleWalletLogin} disabled={loading} style={{
            width: "100%", padding: "12px", borderRadius: 10,
            border: `1px solid ${COLORS.accent}44`,
            background: `${COLORS.accent}11`, color: COLORS.accent,
            fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 10, marginBottom: 20, fontFamily: "inherit",
          }}>
            🦊 {walletAddress ? `Connected: ${shortAddress(walletAddress)}` : "Login with MetaMask"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: COLORS.cardBorder }} />
            <span style={{ color: COLORS.muted, fontSize: 12 }}>or use email</span>
            <div style={{ flex: 1, height: 1, background: COLORS.cardBorder }} />
          </div>

          {activeTab === "patient" ? (
            <form onSubmit={handlePatientLogin} autoComplete="off">
              <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Patient Login</h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 24 }}>Access your health dashboard</p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ color: COLORS.muted, fontSize: 13, display: "block", marginBottom: 6 }}>Email</label>
                <input type="email" placeholder="john@email.com" style={inputStyle} value={pEmail} onChange={e => setPEmail(e.target.value)} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ color: COLORS.muted, fontSize: 13, display: "block", marginBottom: 6 }}>Password</label>
                <input type="password" placeholder="••••••••" style={inputStyle} value={pPass} onChange={e => setPPass(e.target.value)} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
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
            <form onSubmit={handleDoctorLogin} autoComplete="off">
              <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Doctor Login</h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 24 }}>Access your professional dashboard</p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ color: COLORS.muted, fontSize: 13, display: "block", marginBottom: 6 }}>Email</label>
                <input type="email" placeholder="doctor@hospital.com" style={inputStyle} value={dEmail} onChange={e => setDEmail(e.target.value)} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ color: COLORS.muted, fontSize: 13, display: "block", marginBottom: 6 }}>Password</label>
                <input type="password" placeholder="••••••••" style={inputStyle} value={dPass} onChange={e => setDPass(e.target.value)} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
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