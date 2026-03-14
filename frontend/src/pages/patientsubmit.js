import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const COLORS = {
  bg: "#0a0f1e", card: "#0f1729", cardBorder: "#1a2540",
  accent: "#00d4ff", accent2: "#7c3aed", green: "#10b981",
  red: "#ef4444", yellow: "#f59e0b", text: "#e2e8f0", muted: "#64748b",
};

const categories = ["Blood Test", "X-Ray", "MRI Scan", "Prescription", "General Checkup", "Other"];

const mockAISummary = {
  keyFindings: [
    "Cholesterol levels slightly elevated at 210 mg/dL",
    "Blood glucose normal at 95 mg/dL",
    "Hemoglobin within normal range at 14.5 g/dL",
  ],
  plainLanguage:
    "Your recent blood test shows mostly good results. Your blood sugar and red blood cell levels are healthy. However, your cholesterol is a bit higher than ideal — it's at 210, and we'd like to see it below 200. This is a mild elevation and can often be managed with diet and exercise.",
  recommendedSteps: [
    "Consider reducing saturated fat intake",
    "Increase physical activity to 30 minutes daily",
    "Follow up with blood test in 3 months",
  ],
};

const cardStyle = {
  background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: 16, padding: 24, marginBottom: 20,
};

const inputStyle = {
  width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`,
  color: COLORS.text, padding: "11px 14px", borderRadius: 9,
  fontSize: 14, outline: "none", boxSizing: "border-box",
};

// ── TopBar ─────────────────────────────────────────────────────────────────────
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
      <Link to="/patient/dashboard" style={{
        color: COLORS.muted, fontSize: 13, textDecoration: "none",
        padding: "6px 14px", borderRadius: 8, border: `1px solid ${COLORS.cardBorder}`,
      }}>← Dashboard</Link>
    </div>
  );
}

// ── AISummaryCard ──────────────────────────────────────────────────────────────
function AISummaryCard({ summary }) {
  return (
    <div style={{ background: `${COLORS.accent2}0d`, border: `1px solid ${COLORS.accent2}30`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 20 }}>✨</span>
        <h4 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>AI Summary</h4>
        <span style={{
          marginLeft: "auto", background: `${COLORS.green}20`, color: COLORS.green,
          border: `1px solid ${COLORS.green}30`, padding: "2px 10px", borderRadius: 20, fontSize: 11,
        }}>Auto-Generated</span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <p style={{ color: COLORS.muted, fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Plain Language</p>
        <p style={{ color: COLORS.text, fontSize: 14, lineHeight: 1.7, background: COLORS.bg, padding: 14, borderRadius: 10 }}>
          {summary.plainLanguage}
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <p style={{ color: COLORS.muted, fontSize: 11, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Key Findings</p>
        {summary.keyFindings.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
            <span style={{ color: COLORS.yellow }}>⚡</span>
            <span style={{ color: COLORS.text, fontSize: 14 }}>{f}</span>
          </div>
        ))}
      </div>

      <div>
        <p style={{ color: COLORS.muted, fontSize: 11, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Recommended Steps</p>
        {summary.recommendedSteps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
            <span style={{ color: COLORS.green }}>✅</span>
            <span style={{ color: COLORS.text, fontSize: 14 }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function PatientUploadPage() {
  const [uploadedFiles, setUploadedFiles]     = useState([]);
  const [category, setCategory]               = useState("");
  const [isProcessing, setIsProcessing]       = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showAISummary, setShowAISummary]     = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} file(s) selected`);
    }
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    toast.info("File removed");
  };

  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files);
      setUploadedFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} file(s) added`);
    }
  };

  const handleUpload = () => {
    if (uploadedFiles.length === 0) { toast.error("Please select at least one file"); return; }
    if (!category) { toast.error("Please select a category"); return; }
    setIsProcessing(true);
    setProcessingProgress(0);
    const interval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          setShowAISummary(true);
          toast.success("Upload complete! AI summary generated.");
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const getFileIcon = (file) => {
    if (file.type.includes("image")) return "🖼️";
    if (file.type.includes("pdf"))   return "📄";
    return "📁";
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024, sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Segoe UI', sans-serif" }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
      <TopBar />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px" }}>

        {/* Page Header */}
        <div style={{ marginBottom: 28 }}>
          <Link to="/patient/dashboard" style={{ color: COLORS.accent, fontSize: 13, textDecoration: "none" }}>
            ← Back to Dashboard
          </Link>
          <h1 style={{ color: COLORS.text, fontSize: 28, fontWeight: 800, marginTop: 10, marginBottom: 4 }}>
            Upload Health Reports
          </h1>
          <p style={{ color: COLORS.muted, fontSize: 14 }}>
            Upload your medical documents and get instant AI-powered summaries
          </p>
        </div>

        {!showAISummary ? (
          <>
            {/* Upload Area */}
            <div style={cardStyle}>
              <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Select Files</h3>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>Upload PDFs, images, or other medical documents (max 10MB per file)</p>

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${COLORS.cardBorder}`, borderRadius: 14,
                  padding: "48px 20px", textAlign: "center", cursor: "pointer",
                  background: COLORS.bg, transition: "border-color 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.cardBorder}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>☁️</div>
                <h3 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Drag and drop files here</h3>
                <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 12 }}>or click to browse</p>
                <span style={{
                  background: `${COLORS.accent}15`, color: COLORS.accent,
                  border: `1px solid ${COLORS.accent}30`,
                  padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                }}>PDF, JPG, PNG accepted</span>
                <input
                  ref={fileInputRef} type="file" multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect} style={{ display: "none" }}
                />
              </div>

              {uploadedFiles.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 10 }}>
                    Selected Files ({uploadedFiles.length})
                  </p>
                  {uploadedFiles.map((file, index) => (
                    <div key={index} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 14px", background: COLORS.bg,
                      border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, marginBottom: 8,
                    }}>
                      <span style={{ fontSize: 28 }}>{getFileIcon(file)}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{file.name}</p>
                        <p style={{ color: COLORS.muted, fontSize: 11 }}>{formatFileSize(file.size)}</p>
                      </div>
                      <button onClick={() => handleRemoveFile(index)} style={{
                        background: "transparent", border: "none",
                        color: COLORS.red, cursor: "pointer", fontSize: 20, lineHeight: 1,
                      }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category */}
            <div style={cardStyle}>
              <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Categorize Report</h3>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>Help us organize your health records</p>
              <label style={{ color: COLORS.muted, fontSize: 13, display: "block", marginBottom: 8 }}>Report Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Upload Button */}
            <div style={cardStyle}>
              {!isProcessing ? (
                <button
                  onClick={handleUpload}
                  disabled={uploadedFiles.length === 0 || !category}
                  style={{
                    width: "100%", padding: "14px",
                    background: uploadedFiles.length === 0 || !category
                      ? COLORS.cardBorder
                      : `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                    border: "none", color: "#fff", fontSize: 16, fontWeight: 700,
                    borderRadius: 12,
                    cursor: uploadedFiles.length === 0 || !category ? "not-allowed" : "pointer",
                  }}
                >
                  ☁️ Upload & Generate AI Summary
                </button>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ color: COLORS.text, fontSize: 14, fontWeight: 600 }}>Processing your reports...</span>
                    <span style={{ color: COLORS.muted, fontSize: 14 }}>{processingProgress}%</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 8, background: COLORS.cardBorder, borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                    <div style={{
                      height: "100%", borderRadius: 4,
                      width: `${processingProgress}%`,
                      background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accent2})`,
                      transition: "width 0.2s",
                    }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.muted, fontSize: 13 }}>
                    <span style={{ color: COLORS.accent }}>✨</span>
                    AI is analyzing your medical report...
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Success */}
            <div style={{ ...cardStyle, textAlign: "center", padding: 40, marginBottom: 20 }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: `${COLORS.green}20`, border: `2px solid ${COLORS.green}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 34, margin: "0 auto 16px",
              }}>✅</div>
              <h3 style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Upload Successful!</h3>
              <p style={{ color: COLORS.muted }}>Your report has been uploaded and analyzed by our AI</p>
            </div>

            {/* AI Summary */}
            <AISummaryCard summary={mockAISummary} />

            {/* Actions */}
            <div style={{ display: "flex", gap: 14 }}>
              <Link to="/patient/dashboard" style={{
                flex: 1, display: "block", textAlign: "center",
                padding: "13px", borderRadius: 11,
                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none",
              }}>View All Reports</Link>
              <button
                onClick={() => { setUploadedFiles([]); setCategory(""); setShowAISummary(false); setProcessingProgress(0); }}
                style={{
                  flex: 1, padding: "13px", borderRadius: 11,
                  border: `1px solid ${COLORS.cardBorder}`,
                  background: "transparent", color: COLORS.muted,
                  fontSize: 15, fontWeight: 600, cursor: "pointer",
                }}
              >Upload Another</button>
            </div>
          </>
        )}

        {/* Info Card */}
        <div style={{
          ...cardStyle,
          marginTop: 28,
          background: `${COLORS.accent}08`,
          border: `1px solid ${COLORS.accent}20`,
        }}>
          <div style={{ display: "flex", gap: 14 }}>
            <span style={{ fontSize: 22 }}>✨</span>
            <div>
              <h4 style={{ color: COLORS.accent, fontWeight: 700, marginBottom: 10 }}>How AI Summary Works</h4>
              {[
                "Our AI scans your medical report for key information",
                "Complex medical terms are translated to plain language",
                "Important findings are highlighted for easy understanding",
                "Recommended next steps are provided based on results",
              ].map(item => (
                <p key={item} style={{ color: COLORS.muted, fontSize: 13, marginBottom: 6 }}>• {item}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatientUploadPage;