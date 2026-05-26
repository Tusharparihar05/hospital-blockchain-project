import { Link } from "react-router-dom";
import { useState } from "react";

const COLORS = {
  bg: "#0a0f1e", card: "#0f1729", cardBorder: "#1a2540",
  accent: "#00d4ff", accent2: "#7c3aed", green: "#10b981",
  red: "#ef4444", yellow: "#f59e0b", text: "#e2e8f0", muted: "#64748b",
};

// ─── Reusable Icon Wrappers ───────────────────────────────────────────────────
const IconBox = ({ bg, children }) => (
  <div style={{
    background: bg, borderRadius: 12, padding: 12,
    width: "fit-content", display: "flex", alignItems: "center", justifyContent: "center",
  }}>{children}</div>
);

// ─── SVG Icons (no lucide-react needed) ──────────────────────────────────────
const icons = {
  sparkles:   <svg width="22" height="22" fill="none" stroke="#7c3aed" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z"/></svg>,
  clock:      <svg width="22" height="22" fill="none" stroke="#00d4ff" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  fileText:   <svg width="22" height="22" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
  calendar:   <svg width="22" height="22" fill="none" stroke="#00d4ff" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  upload:     <svg width="22" height="22" fill="none" stroke="#00d4ff" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  userPlus:   <svg width="22" height="22" fill="none" stroke="#00d4ff" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>,
  search:     <svg width="22" height="22" fill="none" stroke="#f59e0b" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  shield:     <svg width="22" height="22" fill="none" stroke="#6366f1" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  alert:      <svg width="22" height="22" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  zap:        <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  checkCircle:<svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
};

// ─── Feature cards data ───────────────────────────────────────────────────────
const featureCards = [
  { bg: "rgba(0,212,255,0.12)",   icon: icons.calendar,  title: "Online Booking",          desc: "Book appointments 24/7 with real-time doctor availability. No phone calls needed." },
  { bg: "rgba(239,68,68,0.12)",   icon: icons.alert,     title: "Emergency Priority",       desc: "Flag urgent cases for immediate attention and priority queue placement." },
  { bg: "rgba(16,185,129,0.12)",  icon: icons.fileText,  title: "Digital Health Records",   desc: "Store all medical documents securely in one place, accessible anytime." },
  { bg: "rgba(124,58,237,0.12)",  icon: icons.sparkles,  title: "AI Report Translation",    desc: "Complex medical reports explained in simple, understandable language." },
  { bg: "rgba(245,158,11,0.12)",  icon: icons.search,    title: "Quick Patient Search",     desc: "Doctors can instantly find patients and upload results directly to their records." },
  { bg: "rgba(99,102,241,0.12)",  icon: icons.shield,    title: "Secure & Private",         desc: "Your health data is encrypted and protected with enterprise-grade security." },
];

const steps = [
  { icon: icons.userPlus,  title: "Sign Up",           desc: "Create your account as a Patient or Doctor. Doctors need a verified Medical License Number to access professional features." },
  { icon: icons.calendar,  title: "Book Appointment",  desc: "Browse available doctors by specialty, check real-time availability, and book your appointment instantly. Mark as emergency for priority handling." },
  { icon: icons.upload,    title: "Upload Reports",    desc: "Upload your medical reports, test results, and prescriptions. Our AI instantly analyzes and creates easy-to-understand summaries." },
  { icon: icons.sparkles,  title: "Get AI Summary",   desc: "Receive plain-language explanations of your medical reports, key findings highlighted, and recommended next steps — all powered by AI." },
];

const stats = [
  { value: "50K+",  label: "Patients Served"   },
  { value: "2M+",   label: "Records On-Chain"  },
  { value: "1,200+",label: "Verified Doctors"  },
  { value: "99.9%", label: "Uptime"            },
];

const footerLinks = {
  Product: ["Features", "Pricing", "Security"],
  Company: ["About Us", "Careers", "Contact"],
  Legal:   ["Privacy Policy", "Terms of Service", "HIPAA Compliance"],
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResult(null);
    try {
      const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${API}/verification/lookup?query=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Search failed");
      }
      setSearchResult(data);
    } catch (err) {
      setSearchError(err.message || "No verified doctor or license found matching your search term.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", color: COLORS.text }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0f1e; }
        ::-webkit-scrollbar-thumb { background: #1a2540; border-radius: 3px; }
        .hover-card:hover { border-color: rgba(0,212,255,0.35) !important; transform: translateY(-2px); }
        .hover-card { transition: all 0.2s; }
        .nav-link:hover { color: #e2e8f0 !important; }
        .btn-hover:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-hover { transition: all 0.18s; }
        @media (max-width: 768px) {
          .hero-btns { flex-direction: column; align-items: center; }
          .benefit-grid { grid-template-columns: 1fr !important; }
          .steps-row { flex-direction: column !important; }
          .feature-grid { grid-template-columns: 1fr 1fr !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
          .hero-title { font-size: 36px !important; }
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 520px) {
          .feature-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 68,
        background: "rgba(8,13,26,0.97)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${COLORS.cardBorder}`,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>⛓️</div>
          <div>
            <div style={{ color: COLORS.text, fontWeight: 800, fontSize: 16, fontFamily: "monospace" }}>MediChain</div>
            <div style={{ color: COLORS.muted, fontSize: 10 }}>Blockchain Health Platform</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="#how-it-works" className="nav-link" style={{ color: COLORS.muted, fontSize: 14, fontWeight: 500 }}>How It Works</a>
          <a href="#features" className="nav-link" style={{ color: COLORS.muted, fontSize: 14, fontWeight: 500, marginRight: 8 }}>Features</a>
          <Link to="/login" className="btn-hover" style={{
            padding: "9px 22px", borderRadius: 9,
            border: `1px solid ${COLORS.cardBorder}`, color: COLORS.muted,
            fontSize: 14, fontWeight: 600,
          }}>Login</Link>
          <Link to="/signup" className="btn-hover" style={{
            padding: "9px 22px", borderRadius: 9,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
            color: "#fff", fontSize: 14, fontWeight: 700,
          }}>Get Started</Link>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: "100px 24px 80px", textAlign: "center" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: `${COLORS.accent2}22`, border: `1px solid ${COLORS.accent2}44`,
            color: "#a78bfa", padding: "7px 18px", borderRadius: 24,
            fontSize: 13, fontWeight: 600, marginBottom: 28,
          }}>
            {icons.sparkles} AI-Powered Healthcare Management
          </div>

          {/* Headline */}
          <h1 className="hero-title" style={{ fontSize: 58, fontWeight: 900, lineHeight: 1.12, marginBottom: 20 }}>
            Your Health, Simplified.
            <br />
            <span style={{
              background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>No More Waiting.</span>
          </h1>

          <p style={{ color: COLORS.muted, fontSize: 18, maxWidth: 580, margin: "0 auto 40px", lineHeight: 1.7 }}>
            Book online appointments instantly, manage your health records digitally, and get
            AI-powered translations of your medical reports in plain language you understand.
          </p>

          {/* CTA Buttons */}
          <div className="hero-btns" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/signup" className="btn-hover" style={{
              padding: "14px 36px", borderRadius: 12,
              background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
              color: "#fff", fontSize: 16, fontWeight: 700,
            }}>🚀 Get Started Free</Link>
            <Link to="/login" className="btn-hover" style={{
              padding: "14px 36px", borderRadius: 12,
              border: `1px solid ${COLORS.cardBorder}`,
              color: COLORS.muted, fontSize: 16, fontWeight: 600,
            }}>Login →</Link>
          </div>

          {/* Benefit Cards */}
          <div className="benefit-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginTop: 64 }}>
            {[
              { bg: "rgba(0,212,255,0.10)",  icon: icons.clock,    title: "No More Queues",   desc: "Book appointments online and skip the waiting room",      border: COLORS.accent },
              { bg: "rgba(16,185,129,0.10)", icon: icons.fileText, title: "Digital Records",  desc: "All your health documents in one secure place",           border: COLORS.green  },
              { bg: "rgba(124,58,237,0.10)", icon: icons.sparkles, title: "AI Summaries",     desc: "Medical jargon translated to plain English instantly",    border: COLORS.accent2},
            ].map(c => (
              <div key={c.title} className="hover-card" style={{
                background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
                borderRadius: 16, padding: "28px 20px", textAlign: "center",
              }}>
                <div style={{
                  background: c.bg, borderRadius: 12, padding: 12,
                  width: 52, height: 52, display: "flex", alignItems: "center",
                  justifyContent: "center", margin: "0 auto 16px",
                }}>{c.icon}</div>
                <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{c.title}</h3>
                <p style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: "0 48px 80px" }}>
        <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, maxWidth: 960, margin: "0 auto" }}>
          {stats.map(s => (
            <div key={s.label} className="hover-card" style={{
              background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 16, padding: "24px 20px", textAlign: "center",
            }}>
              <div style={{
                fontSize: 30, fontWeight: 900, fontFamily: "monospace",
                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>{s.value}</div>
              <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Public License Verification Lookup ─────────────────────────────── */}
      <section style={{ padding: "0 48px 80px", background: COLORS.bg }}>
        <div style={{
          maxWidth: 860, margin: "0 auto", background: `${COLORS.card}`,
          border: `1px solid ${COLORS.cardBorder}`, borderRadius: 24, padding: "40px 32px",
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4)`
        }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: COLORS.text }}>
              🛡️ Public Medical License Registry
            </h2>
            <p style={{ color: COLORS.muted, fontSize: 14 }}>
              Verify doctor credentials, active licensing councils, and blockchain proof status in real-time.
            </p>
          </div>

          <form onSubmit={handleSearch} style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by doctor name, email, or license number (e.g. NMC-2024-67890)"
              style={{
                flex: 1, minWidth: 280, background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`,
                color: COLORS.text, padding: "12px 18px", borderRadius: 10, fontSize: 14,
                outline: "none", transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = COLORS.accent}
              onBlur={(e) => e.target.style.borderColor = COLORS.cardBorder}
            />
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              style={{
                padding: "12px 24px", borderRadius: 10, border: "none",
                background: searchQuery.trim() ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})` : COLORS.cardBorder,
                color: "#fff", fontWeight: 700, fontSize: 14, cursor: searchQuery.trim() && !searching ? "pointer" : "not-allowed",
                transition: "opacity 0.2s"
              }}
            >
              {searching ? "⏳ Searching..." : "🔍 Search Registry"}
            </button>
          </form>

          {searching && (
            <div style={{ textAlign: "center", padding: "20px 0", color: COLORS.muted }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⛓️</div>
              <p style={{ fontSize: 13 }}>Querying database & verifying signature anchors...</p>
            </div>
          )}

          {searchError && (
            <div style={{
              padding: "16px 20px", background: `${COLORS.red}0d`, border: `1px solid ${COLORS.red}25`,
              borderRadius: 12, color: COLORS.red, fontSize: 13, display: "flex", gap: 10, alignItems: "center"
            }}>
              <span>⚠️</span>
              <div>
                <p style={{ fontWeight: 700, marginBottom: 2 }}>Verification Lookup Failed</p>
                <p style={{ color: COLORS.muted }}>{searchError}</p>
              </div>
            </div>
          )}

          {searchResult && searchResult.found && (
            <div style={{
              background: "rgba(16, 185, 129, 0.04)", border: `1px solid ${COLORS.green}25`,
              borderRadius: 16, padding: "24px 20px", marginTop: 10
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
                <div>
                  <h3 style={{ color: COLORS.text, fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                    👨‍⚕️ {searchResult.doctor?.name || "Registered Professional"}
                  </h3>
                  <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>
                    {searchResult.doctor?.specialty} • {searchResult.doctor?.email}
                  </p>
                </div>
                <div style={{
                  background: `${COLORS.green}15`, color: COLORS.green, border: `1px solid ${COLORS.green}30`,
                  padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 800,
                  display: "flex", alignItems: "center", gap: 6
                }}>
                  <span>🛡️</span> NMC VERIFIED
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, borderTop: `1px solid ${COLORS.cardBorder}`, paddingTop: 18 }}>
                {[
                  { label: "License Number", value: searchResult.verification?.licenseNumber },
                  { label: "Licensing Council", value: searchResult.verification?.councilName },
                  { label: "Registration Year", value: searchResult.verification?.registrationYear || "—" },
                  { label: "Validity", value: searchResult.verification?.expiryDate ? `Valid until ${new Date(searchResult.verification.expiryDate).toLocaleDateString()}` : "Active" }
                ].map(item => (
                  <div key={item.label}>
                    <p style={{ color: COLORS.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>{item.label}</p>
                    <p style={{ color: COLORS.text, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{item.value}</p>
                  </div>
                ))}
              </div>

              {searchResult.verification?.blockchainTx && (
                <div style={{
                  marginTop: 20, padding: 14, background: `${COLORS.accent}0a`,
                  border: `1px solid ${COLORS.accent}20`, borderRadius: 12
                }}>
                  <p style={{ color: COLORS.accent, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>⛓️</span> Cryptographic Proof Anchored On-Chain
                  </p>
                  <p style={{ color: COLORS.muted, fontSize: 11, lineHeight: 1.5, marginTop: 6 }}>
                    This licensing record was cryptographically hashed and permanently written to the blockchain. If any credential details are altered, the verification signature will break.
                  </p>
                  <div style={{
                    marginTop: 10, background: COLORS.bg, padding: "8px 12px", borderRadius: 8,
                    border: `1px solid ${COLORS.cardBorder}`, fontFamily: "monospace", fontSize: 10,
                    color: COLORS.muted, wordBreak: "break-all"
                  }}>
                    TX: {searchResult.verification.blockchainTx}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ background: COLORS.card, padding: "80px 48px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 38, fontWeight: 800, marginBottom: 12 }}>How It Works</h2>
            <p style={{ color: COLORS.muted, fontSize: 16 }}>Get started with MediChain in just a few simple steps</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {steps.map((step, i) => (
              <div key={step.title} className="steps-row" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                {/* Step number */}
                <div style={{
                  width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 800, fontSize: 18,
                }}>{i + 1}</div>

                {/* Content */}
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    {step.icon}
                    <h3 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700 }}>{step.title}</h3>
                  </div>
                  <p style={{ color: COLORS.muted, fontSize: 14, lineHeight: 1.7 }}>{step.desc}</p>
                </div>

                {/* Connector line (except last) */}
                {i < steps.length - 1 && (
                  <div style={{ display: "none" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: "80px 48px", background: COLORS.bg }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 38, fontWeight: 800, marginBottom: 12 }}>
              Powerful Features for{" "}
              <span style={{
                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>Everyone</span>
            </h2>
            <p style={{ color: COLORS.muted, fontSize: 16 }}>Built for patients and healthcare professionals</p>
          </div>

          <div className="feature-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {featureCards.map(f => (
              <div key={f.title} className="hover-card" style={{
                background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
                borderRadius: 18, padding: 28,
              }}>
                <IconBox bg={f.bg}>{f.icon}</IconBox>
                <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, margin: "16px 0 8px" }}>{f.title}</h3>
                <p style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────── */}
      <section style={{ padding: "0 48px 80px" }}>
        <div style={{
          background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
          borderRadius: 24, padding: "60px 48px", textAlign: "center",
          maxWidth: 900, margin: "0 auto",
        }}>
          <h2 style={{ color: "#fff", fontSize: 36, fontWeight: 800, marginBottom: 14 }}>
            Ready to Transform Your Healthcare Experience?
          </h2>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 16, marginBottom: 36 }}>
            Join thousands of patients and doctors already using MediChain
          </p>
          <div className="hero-btns" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/signup" className="btn-hover" style={{
              padding: "13px 32px", borderRadius: 11,
              background: "#fff", color: COLORS.accent2,
              fontSize: 15, fontWeight: 700,
            }}>Sign Up as Patient</Link>
            <Link to="/signup" className="btn-hover" style={{
              padding: "13px 32px", borderRadius: 11,
              border: "2px solid rgba(255,255,255,0.6)", color: "#fff",
              fontSize: 15, fontWeight: 700,
            }}>Sign Up as Doctor</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ background: "#050a14", borderTop: `1px solid ${COLORS.cardBorder}`, padding: "56px 48px 32px" }}>
        <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 32, maxWidth: 1100, margin: "0 auto", paddingBottom: 40, borderBottom: `1px solid ${COLORS.cardBorder}` }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                borderRadius: 9, padding: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{icons.zap}</div>
              <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>MediChain</span>
            </div>
            <p style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.7 }}>
              Modern blockchain healthcare management for everyone.
            </p>
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              {["⛓️", "🔐", "🌐"].map(e => (
                <div key={e} style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                }}>{e}</div>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h4 style={{ color: COLORS.text, fontWeight: 700, fontSize: 14, marginBottom: 16 }}>{heading}</h4>
              <ul style={{ listStyle: "none" }}>
                {links.map(l => (
                  <li key={l} style={{ marginBottom: 10 }}>
                    <span onClick={(e) => { e.preventDefault(); }} className="nav-link" style={{ color: COLORS.muted, fontSize: 13, cursor: "pointer" }}>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ maxWidth: 1100, margin: "28px auto 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <p style={{ color: COLORS.muted, fontSize: 12 }}>© 2026 MediChain. All rights reserved.</p>
          <p style={{ color: COLORS.muted, fontSize: 12 }}>Built on Ethereum · IPFS · Solidity</p>
        </div>
      </footer>
    </div>
  );
}