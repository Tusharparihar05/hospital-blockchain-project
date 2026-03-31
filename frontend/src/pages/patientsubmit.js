import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { anchorRecordOnChain, isRecordAnchored } from "../hooks/useBlockchain";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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
function getChainPatientId() {
  const u = getStoredUser();
  return u.chainPatientId != null ? Number(u.chainPatientId) : null;
}

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

const MAX_SIZE = 20 * 1024 * 1024;

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

// ── Blockchain status badge ────────────────────────────────────────────────────
function BlockchainBadge({ status }) {
  const configs = {
    idle:       { color: C.muted,   bg: `${C.muted}15`,   border: `${C.muted}30`,   icon: "⛓️",  text: "Not anchored yet" },
    checking:   { color: C.yellow,  bg: `${C.yellow}15`,  border: `${C.yellow}30`,  icon: "🔍",  text: "Checking chain..." },
    requesting: { color: C.yellow,  bg: `${C.yellow}15`,  border: `${C.yellow}30`,  icon: "🦊",  text: "Waiting for MetaMask..." },
    pending:    { color: C.accent,  bg: `${C.accent}15`,  border: `${C.accent}30`,  icon: "⏳",  text: "Transaction pending..." },
    anchored:   { color: C.green,   bg: `${C.green}15`,   border: `${C.green}30`,   icon: "✅",  text: "Anchored on blockchain!" },
    skipped:    { color: C.yellow,  bg: `${C.yellow}15`,  border: `${C.yellow}30`,  icon: "⚠️",  text: "Already anchored" },
    error:      { color: C.red,     bg: `${C.red}15`,     border: `${C.red}30`,     icon: "❌",  text: "Blockchain anchor failed" },
    no_wallet:  { color: C.muted,   bg: `${C.muted}15`,   border: `${C.muted}30`,   icon: "🦊",  text: "MetaMask not connected" },
    no_address: { color: C.muted,   bg: `${C.muted}15`,   border: `${C.muted}30`,   icon: "⚙️",  text: "Contract address not set in .env" },
    saved:      { color: C.green,   bg: `${C.green}15`,   border: `${C.green}30`,   icon: "✅",  text: "Saved to MediChain" },
  };
  const cfg = configs[status] || configs.idle;
  return (
    <div style={{ padding:"12px 16px", borderRadius:10, marginBottom:16, background:cfg.bg, border:`1px solid ${cfg.border}` }}>
      <p style={{ color:cfg.color, fontSize:13, fontWeight:600 }}>{cfg.icon} {cfg.text}</p>
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
  const [progressMsg, setProgressMsg] = useState("Uploading file to server…");
  const [done,        setDone]        = useState(false);
  const [savedRecord, setSavedRecord] = useState(null);
  const [aiSummary,   setAiSummary]   = useState(null);
  const [fileHash,    setFileHash]    = useState("");
  const [txHash,      setTxHash]      = useState("");
  const [viewerUrl,   setViewerUrl]   = useState("");
  const [viewerOpen,  setViewerOpen]  = useState(false);
  const [bcStatus,    setBcStatus]    = useState("idle");

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

  // ── UPLOAD + BLOCKCHAIN ANCHOR ────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (uploadingRef.current) return;
    if (!patientId)   { toast.error("Not logged in"); navigate("/"); return; }
    if (!files.length){ toast.error("Please select a file");           return; }
    if (!category)    { toast.error("Please select a category");        return; }

    uploadingRef.current = true;
    setBusy(true);
    setProgress(0);
    setBcStatus("idle");
    setTxHash("");

    let pct = 0;
    const ticker = setInterval(() => {
      pct = Math.min(pct + 4, 75); // only go to 75% — blockchain step takes it to 100
      setProgress(pct);
    }, 250);

    try {
      // ── STEP 1: Hash file in browser ──────────────────────────────────────
      setProgressMsg("Hashing file…");
      let fHash = "";
      try {
        fHash = await hashFileSHA256(files[0]);
        setFileHash(fHash);
      } catch (_) {}

      // ── STEP 2: Upload to backend (saves to MongoDB + IPFS) ───────────────
      setProgressMsg("Uploading to server…");
      const form = new FormData();
      form.append("file",      files[0]);
      form.append("patientId", patientId);
      form.append("category",  category);
      form.append("doctor",    "Self Upload");
      form.append("dept",      category);
      if (fHash) form.append("fileHash", fHash);

      const res = await fetch(`${API}/records`, {
        method:  "POST",
        headers: authHeader(),
        body:    form,
      });

      let data = {};
      try { data = await res.json(); } catch (_) {}

      if (!res.ok) {
        const serverMsg = data?.error || data?.message || "";
        throw new Error(serverMsg || `Server error ${res.status}`);
      }

      const rec     = data.record || data;
      const summary = data.aiSummary || rec?.aiSummary;
      setSavedRecord(rec);
      if (summary) setAiSummary(summary);

      const rid  = rec?._id || rec?.id;
      const vUrl = rid ? `${API}/records/file/${rid}` : (data.ipfsUrl || rec?.ipfsUrl || "");
      setViewerUrl(vUrl);

      clearInterval(ticker);
      setProgress(80);

      // ── STEP 3: Anchor on blockchain via MetaMask ─────────────────────────
      // This is the part that was missing — now it triggers MetaMask popup!
      const chainPatientId = getChainPatientId();
      const hashToAnchor   = rec?.fileHash || fHash;

      if (!chainPatientId) {
        // Patient has no chainPatientId — skip blockchain silently
        setBcStatus("saved");
        setProgress(100);
      } else if (!process.env.REACT_APP_PATIENT_RECORDS_ADDRESS) {
        // Contract address not set in .env
        toast.warning("⚙️ Contract address not set — saved to database only");
        setBcStatus("no_address");
        setProgress(100);
      } else if (!window.ethereum) {
        // MetaMask not installed
        toast.warning("🦊 MetaMask not found — saved to database only");
        setBcStatus("no_wallet");
        setProgress(100);
      } else {
        // ── Check if already anchored (avoids a wasted MetaMask popup) ───
        setProgressMsg("Checking blockchain…");
        setBcStatus("checking");
        const alreadyAnchored = hashToAnchor ? await isRecordAnchored(hashToAnchor) : false;

        if (alreadyAnchored) {
          toast.success("⛓️ Already anchored on blockchain!");
          setBcStatus("skipped");
          setProgress(100);
        } else {
          // ── THIS is where MetaMask popup appears ─────────────────────────
          setProgressMsg("Waiting for MetaMask approval…");
          setBcStatus("requesting");
          toast.info("🦊 MetaMask will open — please approve the transaction");

          try {
            const result = await anchorRecordOnChain(
              chainPatientId,
              hashToAnchor,
              category,
              files[0].name
            );

            setTxHash(result.txHash);
            setBcStatus("anchored");
            setProgress(100);
            toast.success(`✅ Anchored on blockchain! Block #${result.blockNumber}`);

            // Notify backend to update anchoredOnChain flag
            try {
              if (rid) {
                await fetch(`${API}/records/${rid}/anchor`, {
                  method:  "PATCH",
                  headers: { ...authHeader(), "Content-Type": "application/json" },
                });
              }
            } catch (_) {
              // Non-fatal — record is still anchored on chain
            }
          } catch (bcErr) {
            console.warn("[blockchain anchor]", bcErr.message);
            if (bcErr.message?.includes("user rejected") || bcErr.code === 4001) {
              toast.warning("Transaction rejected — file saved to database only");
              setBcStatus("error");
            } else if (bcErr.message?.includes("Already anchored")) {
              toast.success("⛓️ Already anchored on blockchain!");
              setBcStatus("skipped");
            } else {
              toast.warning("Blockchain anchor failed — file saved to database. " + bcErr.message);
              setBcStatus("error");
            }
            setProgress(100);
          }
        }
      }

      notifyRecordsChanged();
      setTimeout(() => { setBusy(false); setDone(true); uploadingRef.current = false; }, 350);

    } catch (err) {
      clearInterval(ticker);
      setBusy(false);
      setProgress(0);
      uploadingRef.current = false;

      const msg = err.message || "";
      if (msg.includes("Failed to fetch") || msg.includes("ERR_CONNECTION_REFUSED")) {
        toast.error("Cannot reach the server. Make sure the backend is running on port 5000.");
      } else if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("jwt")) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        toast.error("Session expired — please log in again.");
        navigate("/");
      } else {
        toast.error("Upload failed: " + (msg || "Unknown error"));
      }
      console.error("[Upload error]", err);
    }
  }, [files, category, patientId, navigate]);

  const handleReset = () => {
    setFiles([]); setCategory(""); setDone(false); setProgress(0);
    setBcStatus("idle"); setFileHash(""); setViewerUrl(""); setTxHash("");
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
          <p style={{ color:C.muted, fontSize:14 }}>Upload your medical documents — secured and anchored on blockchain</p>
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
                <p style={{ color:C.muted, fontSize:13, lineHeight:1.6 }}>
                  Your file is hashed in your browser, uploaded to our servers, then anchored on-chain via MetaMask.
                  The blockchain stores an immutable proof — if the file is ever altered, the hash won't match.
                  MetaMask will ask for your approval before writing to the blockchain.
                </p>
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
                    <span style={{ color:C.text, fontSize:14, fontWeight:600 }}>{progressMsg}</span>
                    <span style={{ color:C.muted, fontSize:14 }}>{progress}%</span>
                  </div>
                  <div style={{ height:8, background:C.border, borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:4, width:`${progress}%`, background:`linear-gradient(90deg,${C.accent},${C.accent2})`, transition:"width 0.25s ease" }} />
                  </div>
                  <p style={{ color:C.muted, fontSize:12, marginTop:8, textAlign:"center" }}>
                    {bcStatus === "requesting"
                      ? "🦊 Check MetaMask — approval required"
                      : "Please wait — do not close this tab"}
                  </p>
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

              <BlockchainBadge status={bcStatus} />

              {txHash && (
                <div style={{ marginBottom:16, padding:12, background:C.bg, borderRadius:10, border:`1px solid ${C.green}30`, textAlign:"left" }}>
                  <p style={{ color:C.muted, fontSize:11, marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>Transaction Hash</p>
                  <p style={{ color:C.green, fontSize:11, fontFamily:"monospace", wordBreak:"break-all" }}>{txHash}</p>
                </div>
              )}

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