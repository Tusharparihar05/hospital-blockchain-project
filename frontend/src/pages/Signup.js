import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const COLORS = {
  bg: "#0a0f1e", card: "#0f1729", cardBorder: "#1a2540",
  accent: "#00d4ff", accent2: "#7c3aed", green: "#10b981",
  red: "#ef4444", yellow: "#f59e0b", text: "#e2e8f0", muted: "#64748b",
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

export function SignupPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("patient");

  const [patientForm, setPatientForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [doctorForm, setDoctorForm]   = useState({ name: "", email: "", phone: "", specialty: "", licenseNumber: "", password: "", confirmPassword: "" });

  const handlePatientSignup = (e) => {
    e.preventDefault();
    if (!patientForm.name || !patientForm.email || !patientForm.phone || !patientForm.password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (patientForm.password !== patientForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    toast.success("Patient account created successfully!");
    setTimeout(() => navigate("/patient/dashboard"), 1000);
  };

  const handleDoctorSignup = (e) => {
    e.preventDefault();
    if (!doctorForm.name || !doctorForm.email || !doctorForm.specialty || !doctorForm.licenseNumber || !doctorForm.password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (doctorForm.password !== doctorForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (doctorForm.licenseNumber.length < 6) {
      toast.error("Valid Medical License Number is required");
      return;
    }
    toast.success("Doctor account created! License verified.");
    setTimeout(() => navigate("/doctor"), 1000);
  };

  const Field = ({ label, type = "text", placeholder, value, onChange, hint }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ color: COLORS.muted, fontSize: 13 }}>{label}</label>
      <input type={type} placeholder={placeholder} style={inputStyle} value={value} onChange={onChange} />
      {hint && <p style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>{hint}</p>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Segoe UI', sans-serif" }}>
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
          {activeTab === "patient" ? (
            <form onSubmit={handlePatientSignup}>
              <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Patient Registration</h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 24 }}>Create your account to book appointments</p>

              <Field label="Full Name"    placeholder="John Doe"        value={patientForm.name}            onChange={e => setPatientForm(f => ({ ...f, name: e.target.value }))} />
              <Field label="Email"        type="email" placeholder="john@email.com"  value={patientForm.email}           onChange={e => setPatientForm(f => ({ ...f, email: e.target.value }))} />
              <Field label="Phone Number" placeholder="+91 9876543210"  value={patientForm.phone}           onChange={e => setPatientForm(f => ({ ...f, phone: e.target.value }))} />
              <Field label="Password"     type="password" placeholder="••••••••"        value={patientForm.password}        onChange={e => setPatientForm(f => ({ ...f, password: e.target.value }))} />
              <Field label="Confirm Password" type="password" placeholder="••••••••"   value={patientForm.confirmPassword} onChange={e => setPatientForm(f => ({ ...f, confirmPassword: e.target.value }))} />

              <button type="submit" style={btnPrimary}>Create Patient Account</button>
            </form>
          ) : (
            <form onSubmit={handleDoctorSignup}>
              <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Doctor Registration</h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>Create your professional account</p>

              {/* License Notice */}
              <div style={{
                background: `${COLORS.accent}11`, border: `1px solid ${COLORS.accent}33`,
                borderRadius: 10, padding: "10px 14px", marginBottom: 20,
                color: COLORS.accent, fontSize: 13, display: "flex", alignItems: "center", gap: 8,
              }}>
                ⚠️ A verified Medical License Number is required to access the doctor dashboard
              </div>

              <Field label="Full Name"    placeholder="Dr. Sarah Johnson" value={doctorForm.name}          onChange={e => setDoctorForm(f => ({ ...f, name: e.target.value }))} />
              <Field label="Email"        type="email" placeholder="doctor@hospital.com" value={doctorForm.email} onChange={e => setDoctorForm(f => ({ ...f, email: e.target.value }))} />
              <Field label="Phone Number" placeholder="+91 9876543210"    value={doctorForm.phone}         onChange={e => setDoctorForm(f => ({ ...f, phone: e.target.value }))} />
              <Field label="Specialty"    placeholder="Cardiology, Neurology, etc." value={doctorForm.specialty}  onChange={e => setDoctorForm(f => ({ ...f, specialty: e.target.value }))} />
              <Field
                label="Medical License Number *"
                placeholder="MED123456"
                value={doctorForm.licenseNumber}
                onChange={e => setDoctorForm(f => ({ ...f, licenseNumber: e.target.value }))}
                hint="This will be verified before granting access"
              />
              <Field label="Password"         type="password" placeholder="••••••••" value={doctorForm.password}        onChange={e => setDoctorForm(f => ({ ...f, password: e.target.value }))} />
              <Field label="Confirm Password" type="password" placeholder="••••••••" value={doctorForm.confirmPassword} onChange={e => setDoctorForm(f => ({ ...f, confirmPassword: e.target.value }))} />

              <button type="submit" style={btnPrimary}>Create Doctor Account</button>
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