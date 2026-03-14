import { Link } from "react-router-dom";

const COLORS = {
  bg: "#0a0f1e", accent: "#00d4ff", accent2: "#7c3aed",
  text: "#e2e8f0", muted: "#64748b", cardBorder: "#1a2540",
};

export function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif", padding: 20, textAlign: "center",
    }}>
      <div>
        <div style={{
          fontSize: 120, fontWeight: 900, fontFamily: "monospace",
          background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          lineHeight: 1, marginBottom: 16,
        }}>404</div>

        <h2 style={{ color: COLORS.text, fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
          Page Not Found
        </h2>
        <p style={{ color: COLORS.muted, fontSize: 15, maxWidth: 400, margin: "0 auto 32px" }}>
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link to="/" style={{
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
            color: "#fff", padding: "12px 24px", borderRadius: 10,
            fontWeight: 700, fontSize: 14, textDecoration: "none",
          }}>🏠 Go Home</Link>

          <button onClick={() => window.history.back()} style={{
            background: "transparent", border: `1px solid ${COLORS.cardBorder}`,
            color: COLORS.muted, padding: "12px 24px", borderRadius: 10,
            fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>← Go Back</button>
        </div>
      </div>
    </div>
  );
}

export default NotFound;