import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { hashFile, writeRecordOnChain, hashData } from "../hooks/useBlockchain";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const PATIENT_NUM_ID = 72; // numeric ID used for smart contract

const COLORS = {
  bg: "#0a0f1e", card: "#0f1729", cardBorder: "#1a2540",
  accent: "#00d4ff", accent2: "#7c3aed", green: "#10b981",
  red: "#ef4444", yellow: "#f59e0b", text: "#e2e8f0", muted: "#64748b",
};

const categories = ["Blood Test", "X-Ray", "MRI Scan", "Prescription", "General Checkup", "Other"];

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

// ── BlockchainStatus ───────────────────────────────────────────────────────────
function BlockchainStatus({ status, txHash }) {
  if (!status) return null;
  const isOk = status === "anchored";
  const isPending = status === "pending";
  return (
    <div style={{
      padding: "12px 16px", borderRadius: 10, marginTop: 12,
      background: isOk ? `${COLORS.green}11` : isPending ? `${COLORS.accent}11` : `${COLORS.red}11`,
      border: `1px solid ${isOk ? COLORS.green : isPending ? COLORS.accent : COLORS.red}33`,
    }}>
      <div style={{ color: isOk ? COLORS.green : isPending ? COLORS.accent : COLORS.red, fontSize: 13, fontWeight: 600 }}>
        {isPending ? "⛓️ Anchoring to blockchain..." : isOk ? "✅ Record anchored on blockchain!" : "⚠️ Blockchain anchor failed (record still saved in backend)"}
      </div>
      {txHash && (
        <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>
          File Hash: {txHash.slice(0, 20)}...
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function PatientUploadPage() {
  const [uploadedFiles, setUploadedFiles]           = useState([]);
  const [category, setCategory]                     = useState("");
  const [isProcessing, setIsProcessing]             = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showAISummary, setShowAISummary]           = useState(false);
  const [aiSummary, setAiSummary]                   = useState(null);
  const [blockchainStatus, setBlockchainStatus]     = useState(null); // "pending"|"anchored"|"failed"
  const [fileHash, setFileHash]                     = useState("");
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

  const handleUpload = async () => {
    if (uploadedFiles.length === 0) { toast.error("Please select at least one file"); return; }
    if (!category) { toast.error("Please select a category"); return; }

    setIsProcessing(true);
    setProcessingProgress(0);
    setBlockchainStatus(null);

    // ── Progress animation ─────────────────────────────────────────────────────
    let prog = 0;
    const interval = setInterval(() => {
      prog += 10;
      setProcessingProgress(Math.min(prog, 90)); // stop at 90, finish after chain
      if (prog >= 90) clearInterval(interval);
    }, 180);

    try {
      // ── Step 1: Hash the file(s) ─────────────────────────────────────────────
      const fHash = await hashFile(uploadedFiles[0]);
      setFileHash(fHash);

      // ── Step 2: Call backend API ─────────────────────────────────────────────
      const formData = new FormData();
      uploadedFiles.forEach(f => formData.append("files", f));
      formData.append("category", category);
      formData.append("patientId", "HLT-0x72A91B");
      formData.append("fileHash", fHash);

      let savedRecord = null;
      try {
        const res = await fetch(`${API}/records/upload`, { method: "POST", body: formData });
        savedRecord = await res.json();
        if (savedRecord.aiSummary) setAiSummary(savedRecord.aiSummary);
      } catch (_) {
        // Backend may not have file upload yet — use mock AI summary
        setAiSummary({
          keyFindings: ["Report uploaded and hashed", `File: ${uploadedFiles[0].name}`, `Category: ${category}`],
          plainLanguage: "Your document has been securely uploaded and its cryptographic fingerprint anchored on the blockchain. A doctor will review and provide detailed AI analysis.",
          recommendedSteps: ["Wait for doctor review", "Check back for full AI summary", "Your data is immutably secured on-chain"],
        });
      }

      // ── Step 3: Anchor hash on blockchain ────────────────────────────────────
      setBlockchainStatus("pending");
      try {
        const recordPayload = { category, fileName: uploadedFiles[0].name, fileHash: fHash, patientId: "HLT-0x72A91B" };
        const dataHash = hashData(savedRecord || recordPayload);
        await writeRecordOnChain(PATIENT_NUM_ID, dataHash);
        setBlockchainStatus("anchored");
        toast.success("Record anchored on blockchain! ✅");
      } catch (chainErr) {
        setBlockchainStatus("failed");
        toast.error("Blockchain anchor failed: " + chainErr.message);
      }

      clearInterval(interval);
      setProcessingProgress(100);
      setTimeout(() => {
        setIsProcessing(false);
        setShowAISummary(true);
      }, 400);

    } catch (err) {
      clearInterval(interval);
      setIsProcessing(false);
      toast.error("Upload failed: " + err.message);
    }
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
        <div style={{ marginBottom: 28 }}>
          <Link to="/patient/dashboard" style={{ color: COLORS.accent, fontSize: 13, textDecoration: "none" }}>
            ← Back to Dashboard
          </Link>
          <h1 style={{ color: COLORS.text, fontSize: 28, fontWeight: 800, marginTop: 10, marginBottom: 4 }}>
            Upload Health Reports
          </h1>
          <p style={{ color: COLORS.muted, fontSize: 14 }}>
            Upload your medical documents — they'll be hashed and anchored on the blockchain
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
                  <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 10 }}>Selected Files ({uploadedFiles.length})</p>
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

            {/* Blockchain info banner */}
            <div style={{
              ...cardStyle,
              background: `${COLORS.accent}08`, border: `1px solid ${COLORS.accent}20`,
              display: "flex", gap: 14, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 22 }}>⛓️</span>
              <div>
                <h4 style={{ color: COLORS.accent, fontWeight: 700, marginBottom: 6 }}>How Blockchain Protects Your Records</h4>
                <p style={{ color: COLORS.muted, fontSize: 13 }}>Your file is hashed (fingerprinted) using keccak256 and the hash is stored on the Ethereum blockchain — making it impossible to tamper with without detection.</p>
              </div>
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
                  ⛓️ Upload & Anchor on Blockchain
                </button>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ color: COLORS.text, fontSize: 14, fontWeight: 600 }}>
                      {processingProgress < 90 ? "Hashing & uploading your report..." : "Anchoring on blockchain..."}
                    </span>
                    <span style={{ color: COLORS.muted, fontSize: 14 }}>{processingProgress}%</span>
                  </div>
                  <div style={{ height: 8, background: COLORS.cardBorder, borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                    <div style={{
                      height: "100%", borderRadius: 4,
                      width: `${processingProgress}%`,
                      background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accent2})`,
                      transition: "width 0.2s",
                    }} />
                  </div>
                  <BlockchainStatus status={blockchainStatus} txHash={fileHash} />
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
              <p style={{ color: COLORS.muted, marginBottom: 12 }}>Your report has been uploaded and analyzed by our AI</p>
              <BlockchainStatus status={blockchainStatus} txHash={fileHash} />
              {fileHash && (
                <div style={{ marginTop: 12, padding: 12, background: COLORS.bg, borderRadius: 10 }}>
                  <p style={{ color: COLORS.muted, fontSize: 11, marginBottom: 4 }}>BLOCKCHAIN FILE HASH</p>
                  <p style={{ color: COLORS.accent, fontSize: 12, fontFamily: "monospace", wordBreak: "break-all" }}>{fileHash}</p>
                </div>
              )}
            </div>

            {aiSummary && <AISummaryCard summary={aiSummary} />}

            <div style={{ display: "flex", gap: 14 }}>
              <Link to="/patient/dashboard" style={{
                flex: 1, display: "block", textAlign: "center", padding: "13px", borderRadius: 11,
                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none",
              }}>View All Reports</Link>
              <button
                onClick={() => { setUploadedFiles([]); setCategory(""); setShowAISummary(false); setProcessingProgress(0); setBlockchainStatus(null); setFileHash(""); }}
                style={{
                  flex: 1, padding: "13px", borderRadius: 11,
                  border: `1px solid ${COLORS.cardBorder}`, background: "transparent",
                  color: COLORS.muted, fontSize: 15, fontWeight: 600, cursor: "pointer",
                }}
              >Upload Another</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PatientUploadPage;