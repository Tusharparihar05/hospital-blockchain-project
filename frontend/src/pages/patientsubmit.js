import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns ONLY the Authorization header — NO Content-Type.
 * When uploading FormData the browser MUST set Content-Type itself so it can
 * include the multipart boundary string. If we set Content-Type manually
 * the boundary is missing and multer rejects the request.
 */
function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch (_) { return {}; }
}
function getStoredPatientId() {
  return getStoredUser().patientId || null;
}

/**
 * Pure browser SHA-256 hash — uses SubtleCrypto API.
 */
async function hashFileSHA256(file) {
  const buf    = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex    = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  return "0x" + hex;
}

function notifyRecordsChanged() {
  try { new BroadcastChannel("medichain-sync").postMessage({ type: "records-changed" }); } catch (_) {}
  try { localStorage.setItem("medichain-records-bump", String(Date.now())); } catch (_) {}
}

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0f1e", card: "#0f1729", border: "#1a2540",
  accent: "#00d4ff", accent2: "#7c3aed",
  green: "#10b981", red: "#ef4444", yellow: "#f59e0b",
  text: "#e2e8f0", muted: "#64748b",
};

const CATEGORIES = [
  "Blood Test","X-Ray","MRI Scan","CT Scan","Ultrasound",
  "ECG","Prescription","Diagnosis Notes","General Checkup","Other",
];

const card  = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 20 };
const input = { width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "11px 14px", borderRadius: 9, fontSize: 14, outline: "none", boxSizing: "border-box" };

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function TopBar() {
  return (
    <div style={{ background:"#080d1a", borderBottom:`1px solid ${C.border}`, padding:"0 32px", height:64, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${C.accent},${C.accent2})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>⛓️</div>
        <div>
          <div style={{ color:C.text, fontWeight:700, fontSize:15, fontFamily:"monospace" }}>MediChain</div>
          <div style={{ color:C.muted, fontSize:10 }}>Patient Portal</div>
        </div>
      </div>
      <Link to="/patient/dashboard" style={{ color:C.muted, fontSize:13, textDecoration:"none", padding:"6px 14px", borderRadius:8, border:`1px solid ${C.border}` }}>← Dashboard</Link>
    </div>
  );
}

function AISummaryCard({ summary }) {
  if (!summary) return null;
  return (
    <div style={{ background:`${C.accent2}0d`, border:`1px solid ${C.accent2}30`, borderRadius:14, padding:24, marginBottom:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
        <span style={{ fontSize:20 }}>✨</span>
        <h4 style={{ color:C.text, fontWeight:700, fontSize:16 }}>AI Summary</h4>
        <span style={{ marginLeft:"auto", background:`${C.green}20`, color:C.green, border:`1px solid ${C.green}30`, padding:"2px 10px", borderRadius:20, fontSize:11 }}>Auto-Generated</span>
      </div>
      {summary.plainLanguage && (
        <div style={{ marginBottom:16 }}>
          <p style={{ color:C.muted, fontSize:11, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>Plain Language</p>
          <p style={{ color:C.text, fontSize:14, lineHeight:1.7, background:C.bg, padding:14, borderRadius:10 }}>{summary.plainLanguage}</p>
        </div>
      )}
      {(summary.keyFindings||[]).length > 0 && (
        <div style={{ marginBottom:16 }}>
          <p style={{ color:C.muted, fontSize:11, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>Key Findings</p>
          {summary.keyFindings.map((f,i) => (
            <div key={i} style={{ display:"flex", gap:10, marginBottom:6 }}>
              <span style={{ color:C.yellow }}>⚡</span>
              <span style={{ color:C.text, fontSize:14 }}>{f}</span>
            </div>
          ))}
        </div>
      )}
      {(summary.recommendedSteps||[]).length > 0 && (
        <div>
          <p style={{ color:C.muted, fontSize:11, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>Recommended Steps</p>
          {summary.recommendedSteps.map((s,i) => (
            <div key={i} style={{ display:"flex", gap:10, marginBottom:6 }}>
              <span style={{ color:C.green }}>✅</span>
              <span style={{ color:C.text, fontSize:14 }}>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FileViewer({ url, fileName, onClose }) {
  if (!url) return null;
  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(fileName||"");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.93)", zIndex:500, display:"flex", flexDirection:"column" }}>
      <div style={{ height:56, background:"#080d1a", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", flexShrink:0 }}>
        <span style={{ color:C.text, fontSize:14, fontWeight:600 }}>📄 {fileName||"Report"}</span>
        <div style={{ display:"flex", gap:10 }}>
          <a href={url} download={fileName} style={{ padding:"6px 14px", borderRadius:8, background:`${C.green}20`, color:C.green, border:`1px solid ${C.green}30`, fontSize:13, fontWeight:600, textDecoration:"none" }}>⬇ Download</a>
          <button onClick={onClose} style={{ padding:"6px 14px", borderRadius:8, background:"transparent", color:C.muted, border:`1px solid ${C.border}`, fontSize:13, cursor:"pointer" }}>✕ Close</button>
        </div>
      </div>
      <div style={{ flex:1, overflow:"hidden" }}>
        {isImage
          ? <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
              <img src={url} alt={fileName} style={{ maxWidth:"100%", maxHeight:"100%", borderRadius:12, objectFit:"contain" }} />
            </div>
          : <iframe src={url} title={fileName} style={{ width:"100%", height:"100%", border:"none", background:"#fff" }} />
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function PatientUploadPage() {
  const navigate = useNavigate();

  const [files,       setFiles]       = useState([]);
  const [category,    setCategory]    = useState("");
  const [busy,        setBusy]        = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [done,        setDone]        = useState(false);
  const [savedRecord, setSavedRecord] = useState(null);
  const [aiSummary,   setAiSummary]   = useState(null);
  const [fileHash,    setFileHash]    = useState("");
  const [viewerUrl,   setViewerUrl]   = useState("");
  const [viewerOpen,  setViewerOpen]  = useState(false);
  const [bcStatus,    setBcStatus]    = useState("saved");

  // ── FIX: guard ref prevents double-submission (StrictMode / rapid clicks) ──
  const uploadingRef = useRef(false);
  const fileInputRef = useRef(null);
  const patientId    = getStoredPatientId();

  useEffect(() => {
    if (!patientId) {
      toast.error("Please log in to upload reports");
      navigate("/");
    }
  }, [patientId, navigate]);

  // ── File helpers ──────────────────────────────────────────────────────────
  const addFiles = (incoming) => {
    const valid = [], big = [];
    Array.from(incoming).forEach(f => f.size > MAX_SIZE ? big.push(f.name) : valid.push(f));
    if (big.length)   toast.error(`Too large (max 20 MB): ${big.join(", ")}`);
    if (valid.length) { setFiles(p => [...p, ...valid]); toast.success(`${valid.length} file(s) added`); }
  };

  const handleChange   = (e) => { if (e.target.files) addFiles(e.target.files); e.target.value=""; };
  const handleDrop     = (e) => { e.preventDefault(); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); };
  const handleDragOver = (e) => e.preventDefault();
  const removeFile     = (i) => setFiles(p => p.filter((_,idx) => idx!==i));

  // ── UPLOAD ────────────────────────────────────────────────────────────────
  // FIX: wrapped in useCallback + uploadingRef guard to prevent duplicate POSTs
  const handleUpload = useCallback(async () => {
    // ── Guard: bail out if already uploading ──────────────────────────────
    if (uploadingRef.current) return;

    if (!patientId)   { toast.error("Not logged in"); navigate("/"); return; }
    if (!files.length){ toast.error("Please select a file");           return; }
    if (!category)    { toast.error("Please select a category");        return; }

    uploadingRef.current = true;
    setBusy(true);
    setProgress(0);

    // Smooth progress ticker
    let pct = 0;
    const ticker = setInterval(() => {
      pct = Math.min(pct + 4, 85);
      setProgress(pct);
    }, 250);

    try {
      // ── 1. Hash in browser
      let fHash = "";
      try {
        fHash = await hashFileSHA256(files[0]);
        setFileHash(fHash);
      } catch (_) {
        // Non-fatal — upload still works without a hash
      }

      // ── 2. Build FormData
      const form = new FormData();
      form.append("file",      files[0]);
      form.append("patientId", patientId);
      form.append("category",  category);
      form.append("doctor",    "Self Upload");
      form.append("dept",      category);
      if (fHash) form.append("fileHash", fHash);

      // ── 3. Fetch — ONLY Authorization header, never Content-Type
      const res = await fetch(`${API}/records`, {
        method:  "POST",
        headers: authHeader(),
        body:    form,
      });

      // ── 4. Parse response
      let data = {};
      try { data = await res.json(); } catch (_) {}

      if (!res.ok) {
        // FIX: surface the actual server error message when available
        const serverMsg = data?.error || data?.message || data?.details || "";
        throw new Error(serverMsg || `Server error ${res.status}`);
      }

      // ── 5. Store results
      const rec     = data.record || data;
      const summary = data.aiSummary || rec?.aiSummary;
      setSavedRecord(rec);
      if (summary) setAiSummary(summary);
      setBcStatus(rec?.anchoredOnChain ? "anchored" : "saved");

      const rid  = rec?._id || rec?.id;
      const vUrl = rid ? `${API}/records/file/${rid}` : (data.ipfsUrl || rec?.ipfsUrl || "");
      setViewerUrl(vUrl);

      notifyRecordsChanged();
      clearInterval(ticker);
      setProgress(100);
      setTimeout(() => { setBusy(false); setDone(true); uploadingRef.current = false; }, 350);

    } catch (err) {
      clearInterval(ticker);
      setBusy(false);
      setProgress(0);
      uploadingRef.current = false;  // FIX: always reset the guard on error

      const msg = err.message || "";
      if (msg.includes("Failed to fetch") || msg.includes("ERR_CONNECTION_REFUSED") || msg.includes("NetworkError")) {
        toast.error("Cannot reach the server. Make sure the backend is running on port 5000.");
      } else if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("Not logged in") || msg.includes("jwt")) {
        // FIX: clear the stale token so the user can log in fresh
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        toast.error("Session expired — please log in again.");
        navigate("/");
      } else if (msg.includes("500") || msg.includes("Internal Server Error")) {
        // FIX: show a more helpful message for backend 500s
        toast.error("Server error — check the backend logs for details. The file may be too large or the database connection failed.");
      } else {
        toast.error("Upload failed: " + (msg || "Unknown error"));
      }
      console.error("[Upload error]", err);
    }
  }, [files, category, patientId, navigate]);

  const handleReset = () => {
    setFiles([]); setCategory(""); setDone(false); setProgress(0);
    setBcStatus("saved"); setFileHash(""); setViewerUrl("");
    setSavedRecord(null); setAiSummary(null);
    uploadingRef.current = false;
  };

  const fileIcon = (f) => f.type.includes("image") ? "🖼️" : f.type.includes("pdf") ? "📄" : "📁";
  const fmtSize  = (b) => { if (!b) return "0 B"; const k=1024,s=["B","KB","MB","GB"]; const i=Math.floor(Math.log(b)/Math.log(k)); return (b/Math.pow(k,i)).toFixed(1)+" "+s[i]; };
  const canUpload = files.length > 0 && !!category && !!patientId && !busy;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Segoe UI',sans-serif", color:C.text }}>
      <style>{`* { box-sizing:border-box; margin:0; padding:0; }`}</style>
      <TopBar />

      {viewerOpen && viewerUrl && (
        <FileViewer url={viewerUrl} fileName={savedRecord?.fileName} onClose={() => setViewerOpen(false)} />
      )}

      <div style={{ maxWidth:860, margin:"0 auto", padding:"32px 24px" }}>

        {/* Page header */}
        <div style={{ marginBottom:28 }}>
          <Link to="/patient/dashboard" style={{ color:C.accent, fontSize:13, textDecoration:"none" }}>← Back to Dashboard</Link>
          <h1 style={{ color:C.text, fontSize:28, fontWeight:800, marginTop:10, marginBottom:4 }}>Upload Health Report</h1>
          <p style={{ color:C.muted, fontSize:14 }}>Upload your medical documents — secured and stored in MediChain</p>
          {patientId && (
            <p style={{ color:C.muted, fontSize:12, marginTop:6 }}>
              Patient ID: <span style={{ fontFamily:"monospace", color:C.accent }}>{patientId}</span>
            </p>
          )}
        </div>

        {/* ── FORM ── */}
        {!done && (
          <>
            {/* Drop zone */}
            <div style={card}>
              <h3 style={{ color:C.text, fontWeight:700, fontSize:16, marginBottom:4 }}>Select Files</h3>
              <p style={{ color:C.muted, fontSize:13, marginBottom:16 }}>PDF or image, max 20 MB per file</p>

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                style={{ border:`2px dashed ${C.border}`, borderRadius:14, padding:"48px 20px", textAlign:"center", cursor:"pointer", background:C.bg, transition:"border-color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <div style={{ fontSize:48, marginBottom:12 }}>☁️</div>
                <p style={{ color:C.text, fontWeight:700, fontSize:16, marginBottom:6 }}>Drag and drop files here</p>
                <p style={{ color:C.muted, fontSize:13, marginBottom:12 }}>or click to browse</p>
                <span style={{ background:`${C.accent}15`, color:C.accent, border:`1px solid ${C.accent}30`, padding:"4px 14px", borderRadius:20, fontSize:12, fontWeight:600 }}>PDF, JPG, PNG · max 20 MB</span>
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} style={{ display:"none" }} />
              </div>

              {files.length > 0 && (
                <div style={{ marginTop:20 }}>
                  <p style={{ color:C.muted, fontSize:13, marginBottom:10 }}>Selected ({files.length})</p>
                  {files.map((f,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 14px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, marginBottom:8 }}>
                      <span style={{ fontSize:28 }}>{fileIcon(f)}</span>
                      <div style={{ flex:1 }}>
                        <p style={{ color:C.text, fontSize:13, fontWeight:600 }}>{f.name}</p>
                        <p style={{ color:C.muted, fontSize:11 }}>{fmtSize(f.size)}</p>
                      </div>
                      <button onClick={() => removeFile(i)} style={{ background:"transparent", border:"none", color:C.red, cursor:"pointer", fontSize:22, lineHeight:1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category */}
            <div style={card}>
              <h3 style={{ color:C.text, fontWeight:700, fontSize:16, marginBottom:4 }}>Categorize Report</h3>
              <p style={{ color:C.muted, fontSize:13, marginBottom:16 }}>Help us organize your health records</p>
              <label style={{ color:C.muted, fontSize:13, display:"block", marginBottom:8 }}>Report Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...input, cursor:"pointer" }}>
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Security info */}
            <div style={{ ...card, background:`${C.accent}08`, border:`1px solid ${C.accent}20`, display:"flex", gap:14, alignItems:"flex-start" }}>
              <span style={{ fontSize:22, flexShrink:0 }}>⛓️</span>
              <div>
                <h4 style={{ color:C.accent, fontWeight:700, marginBottom:6 }}>How Your File Is Secured</h4>
                <p style={{ color:C.muted, fontSize:13, lineHeight:1.6 }}>Your file is hashed using SHA-256 directly in your browser before uploading. The hash creates an immutable proof — if the file is ever altered, the hash won't match. Both you and your doctor can view the original file.</p>
              </div>
            </div>

            {/* Upload button */}
            <div style={card}>
              {!busy ? (
                <button
                  onClick={handleUpload}
                  disabled={!canUpload}
                  style={{
                    width:"100%", padding:"15px", border:"none", color:"#fff",
                    fontSize:16, fontWeight:700, borderRadius:12,
                    cursor: canUpload ? "pointer" : "not-allowed",
                    background: canUpload ? `linear-gradient(135deg,${C.accent},${C.accent2})` : C.border,
                    opacity: canUpload ? 1 : 0.6,
                    transition:"opacity 0.2s, background 0.2s",
                  }}
                >
                  {!patientId ? "⚠️ Please log in to upload" : "⛓️ Upload & Anchor on Blockchain"}
                </button>
              ) : (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                    <span style={{ color:C.text, fontSize:14, fontWeight:600 }}>
                      {progress < 85 ? "Uploading file to server…" : "Finalizing…"}
                    </span>
                    <span style={{ color:C.muted, fontSize:14 }}>{progress}%</span>
                  </div>
                  <div style={{ height:8, background:C.border, borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:4, width:`${progress}%`, background:`linear-gradient(90deg,${C.accent},${C.accent2})`, transition:"width 0.25s ease" }} />
                  </div>
                  <p style={{ color:C.muted, fontSize:12, marginTop:8, textAlign:"center" }}>Please wait — do not close this tab</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── SUCCESS ── */}
        {done && (
          <>
            <div style={{ ...card, textAlign:"center", padding:40, marginBottom:20 }}>
              <div style={{ width:72, height:72, borderRadius:"50%", background:`${C.green}20`, border:`2px solid ${C.green}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:34, margin:"0 auto 16px" }}>✅</div>
              <h3 style={{ color:C.text, fontSize:22, fontWeight:800, marginBottom:8 }}>Upload Successful!</h3>
              <p style={{ color:C.muted, marginBottom:16 }}>Your report has been saved and an AI summary was generated.</p>

              <div style={{ padding:"12px 16px", borderRadius:10, marginBottom:16, background:`${C.green}11`, border:`1px solid ${C.green}33` }}>
                <p style={{ color:C.green, fontSize:13, fontWeight:600 }}>
                  {bcStatus === "anchored" ? "⛓️ Hash anchored on blockchain!" : "✅ Saved to MediChain database"}
                </p>
              </div>

              {fileHash && (
                <div style={{ marginBottom:16, padding:12, background:C.bg, borderRadius:10, border:`1px solid ${C.accent}30`, textAlign:"left" }}>
                  <p style={{ color:C.muted, fontSize:11, marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>SHA-256 File Hash</p>
                  <p style={{ color:C.accent, fontSize:11, fontFamily:"monospace", wordBreak:"break-all" }}>{fileHash}</p>
                </div>
              )}

              {viewerUrl && (
                <button onClick={() => setViewerOpen(true)} style={{ width:"100%", marginBottom:12, padding:"12px 20px", borderRadius:10, border:`1px solid ${C.accent}40`, background:`${C.accent}15`, color:C.accent, fontSize:14, fontWeight:700, cursor:"pointer" }}>
                  📄 View Uploaded Report
                </button>
              )}
            </div>

            {aiSummary && <AISummaryCard summary={aiSummary} />}

            <div style={{ display:"flex", gap:14 }}>
              <Link to="/patient/dashboard" style={{ flex:1, display:"block", textAlign:"center", padding:"13px", borderRadius:11, background:`linear-gradient(135deg,${C.accent},${C.accent2})`, color:"#fff", fontSize:15, fontWeight:700, textDecoration:"none" }}>
                View All Reports
              </Link>
              <button onClick={handleReset} style={{ flex:1, padding:"13px", borderRadius:11, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:15, fontWeight:600, cursor:"pointer" }}>
                Upload Another
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PatientUploadPage;