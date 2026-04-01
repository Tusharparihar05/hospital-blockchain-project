import { useState, useRef, useEffect } from "react";

const C = {
  bg: "#0a0f1e", card: "#0f1729", cardBorder: "#1a2540",
  accent: "#00d4ff", accent2: "#7c3aed", green: "#10b981",
  red: "#ef4444", yellow: "#f59e0b", text: "#e2e8f0",
  muted: "#64748b", surface: "#131c35",
};

const LANGUAGES = [
  "English","Hindi","Bengali","French","Chinese (Simplified)",
  "British English","Spanish","German","Arabic","Tamil",
  "Telugu","Marathi","Gujarati","Punjabi","Urdu",
  "Japanese","Korean","Italian","Portuguese","Russian",
];

// BCP-47 codes — used for MyMemory TTS API (works without installing voices)
const LANG_CODES = {
  "English":              "en-US",
  "British English":      "en-GB",
  "Hindi":                "hi-IN",
  "Bengali":              "bn-IN",
  "French":               "fr-FR",
  "Chinese (Simplified)": "zh-CN",
  "Spanish":              "es-ES",
  "German":               "de-DE",
  "Arabic":               "ar-SA",
  "Tamil":                "ta-IN",
  "Telugu":               "te-IN",
  "Marathi":              "mr-IN",
  "Gujarati":             "gu-IN",
  "Punjabi":              "pa-IN",
  "Urdu":                 "ur-PK",
  "Japanese":             "ja-JP",
  "Korean":               "ko-KR",
  "Italian":              "it-IT",
  "Portuguese":           "pt-BR",
  "Russian":              "ru-RU",
};

const REPORT_TYPES = [
  "Blood Test","MRI Scan","CT Scan","X-Ray","Ultrasound",
  "ECG","Prescription","Diagnosis Notes","General Checkup","Other",
];

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

const statusColor = (s = "") => {
  s = s.toLowerCase();
  if (s === "high") return C.red;
  if (s === "low") return C.yellow;
  if (s === "normal") return C.green;
  return C.muted;
};
const statusIcon = (s = "") => {
  s = s.toLowerCase();
  if (s === "high") return "↑";
  if (s === "low") return "↓";
  if (s === "normal") return "✓";
  return "•";
};

// ── MyMemory TTS — free, no API key, works for ALL languages ─────────────────
// Splits long text into chunks (MyMemory limit = 500 chars per request)
async function speakWithMyMemory(text, langCode) {
  const MAX_CHUNK = 450;

  // Split text into sentences first, then chunk
  const sentences = text.match(/[^।\.!\?]+[।\.!\?]*/g) || [text];
  const chunks = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length > MAX_CHUNK) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  const audioUrls = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
    const encoded = encodeURIComponent(chunk);
    const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=${langCode}|${langCode}&mt=1&key=`;
    // MyMemory also has a TTS endpoint
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${langCode.split("-")[0]}&client=tw-ob`;
    audioUrls.push(ttsUrl);
  }
  return audioUrls;
}

// ── Google TTS (free, no key, works in browser) ───────────────────────────────
function buildGoogleTTSUrl(text, langCode) {
  // Use just the base language code (e.g. "hi" from "hi-IN")
  const lang = langCode.split("-")[0];
  const encoded = encodeURIComponent(text.slice(0, 200));
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`;
}

// ── Call backend ──────────────────────────────────────────────────────────────
async function analyzeReport(payload) {
  const MAX_CHARS = 8000;
  let body;
  if (payload.imageBase64) {
    body = {
      imageBase64:       payload.imageBase64,
      imageMimeType:     payload.imageMimeType,
      reportType:        payload.reportType,
      preferredLanguage: payload.preferredLanguage,
      explainLevel:      payload.explainLevel,
      voiceFriendly:     payload.voiceFriendly,
    };
  } else {
    const trimmed = payload.reportText.length > MAX_CHARS
      ? payload.reportText.slice(0, MAX_CHARS) + "\n[Truncated]"
      : payload.reportText;
    body = {
      reportText:        trimmed,
      reportType:        payload.reportType,
      preferredLanguage: payload.preferredLanguage,
      explainLevel:      payload.explainLevel,
      voiceFriendly:     payload.voiceFriendly,
    };
  }
  const res = await fetch(`${BACKEND_URL}/api/analyze-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Server error: ${res.status}`);
  }
  return res.json();
}

// ── File reader ───────────────────────────────────────────────────────────────
async function readFile(file) {
  const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (imageTypes.includes(file.type)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ type: "image", base64: e.target.result, mimeType: file.type, fileName: file.name });
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });
  }
  if (file.type === "text/plain" || file.name.endsWith(".txt")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ type: "text", text: e.target.result, fileName: file.name });
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let text = "";
      try {
        const raw = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(e.target.result));
        const matches = raw.match(/BT[\s\S]*?ET/g) || [];
        const parts = [];
        matches.forEach(block => {
          (block.match(/\(([^)]+)\)\s*Tj/g) || []).forEach(tj => {
            const m = tj.match(/\(([^)]+)\)/);
            if (m && m[1].trim()) parts.push(m[1].trim());
          });
        });
        text = parts.join(" ").trim();
        if (!text) {
          text = raw.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
          text = text.split(/\s{3,}/).filter(l => l.length > 5 && /[a-zA-Z]/.test(l)).slice(0, 80).join("\n");
        }
      } catch { text = ""; }
      if (text.length < 30) {
        resolve({ type: "text", text: `[PDF: ${file.name}]\nCould not extract text. Please paste your report manually.`, fileName: file.name });
      } else {
        const truncated = text.length > 8000 ? text.slice(0, 8000) + "\n[Truncated]" : text;
        resolve({ type: "text", text: `[PDF: ${file.name}]\n\n${truncated}`, fileName: file.name });
      }
    };
    reader.onerror = () => reject(new Error("Failed to read PDF"));
    reader.readAsArrayBuffer(file);
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 10, fontFamily: "monospace" }}>{children}</p>;
}
function Pill({ color, children }) {
  return <span style={{ background: `${color}18`, color, border: `1px solid ${color}35`, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{children}</span>;
}

function AbnormalTable({ values }) {
  if (!values || values.length === 0) return <div style={{ textAlign: "center", padding: "20px 0", color: C.green, fontSize: 14 }}>✅ No abnormal values detected</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
            {["Parameter","Value","Status","Meaning"].map(h => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: C.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {values.map((v, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.cardBorder}20` }}>
              <td style={{ padding: "10px 12px", color: C.text, fontWeight: 600 }}>{v.name}</td>
              <td style={{ padding: "10px 12px", color: C.accent, fontFamily: "monospace" }}>{v.value}</td>
              <td style={{ padding: "10px 12px" }}>
                <span style={{ color: statusColor(v.status), fontWeight: 700, fontSize: 12, background: `${statusColor(v.status)}15`, padding: "2px 8px", borderRadius: 8 }}>
                  {statusIcon(v.status)} {v.status}
                </span>
              </td>
              <td style={{ padding: "10px 12px", color: C.muted, fontSize: 12, lineHeight: 1.5 }}>{v.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── VoicePlayer — uses Google TTS (built-in, works for ALL languages) ─────────
function VoicePlayer({ text, langCode }) {
  const [playing,   setPlaying]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [progress,  setProgress]  = useState(0);   // chunk index
  const [total,     setTotal]     = useState(0);
  const audioRef   = useRef(null);
  const chunksRef  = useRef([]);
  const indexRef   = useRef(0);
  const stoppedRef = useRef(false);

  // Split text into ≤200 char chunks (Google TTS limit per request)
  function splitIntoChunks(txt, maxLen = 180) {
    // Split on sentence endings or commas
    const parts = txt.match(/[^।\.!\?,]+[।\.!\?,]*/g) || [txt];
    const chunks = [];
    let cur = "";
    for (const p of parts) {
      if ((cur + p).length > maxLen) {
        if (cur.trim()) chunks.push(cur.trim());
        cur = p;
      } else {
        cur += p;
      }
    }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks.filter(c => c.length > 0);
  }

  const playChunk = (chunks, idx) => {
    if (stoppedRef.current || idx >= chunks.length) {
      setPlaying(false);
      setLoading(false);
      setProgress(0);
      return;
    }

    const lang = langCode ? langCode.split("-")[0] : "en";
    const encoded = encodeURIComponent(chunks[idx]);
    // Google Translate TTS — free, no API key, supports 100+ languages
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`;

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    setProgress(idx + 1);
    setLoading(false);

    audio.onended = () => {
      if (!stoppedRef.current) {
        setTimeout(() => playChunk(chunks, idx + 1), 200);
      }
    };

    audio.onerror = () => {
      // Fallback to browser TTS if Google TTS fails (e.g. blocked by browser)
      console.warn("Google TTS failed, falling back to browser TTS");
      const utt = new SpeechSynthesisUtterance(chunks[idx]);
      utt.lang = langCode || "en-US";
      utt.rate = 0.88;
      utt.onend = () => {
        if (!stoppedRef.current) setTimeout(() => playChunk(chunks, idx + 1), 200);
      };
      window.speechSynthesis.speak(utt);
    };

    audio.play().catch(() => {
      // Autoplay blocked — fallback
      const utt = new SpeechSynthesisUtterance(chunks[idx]);
      utt.lang = langCode || "en-US";
      utt.rate = 0.88;
      utt.onend = () => {
        if (!stoppedRef.current) setTimeout(() => playChunk(chunks, idx + 1), 200);
      };
      window.speechSynthesis.speak(utt);
    });

    audio.src = url;
    audio.load();
  };

  const handlePlay = () => {
    if (playing || loading) {
      // Stop
      stoppedRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      window.speechSynthesis.cancel();
      setPlaying(false);
      setLoading(false);
      setProgress(0);
      return;
    }

    stoppedRef.current = false;
    const chunks = splitIntoChunks(text);
    chunksRef.current = chunks;
    indexRef.current = 0;
    setTotal(chunks.length);
    setPlaying(true);
    setLoading(true);
    playChunk(chunks, 0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (audioRef.current) audioRef.current.pause();
      window.speechSynthesis.cancel();
    };
  }, []);

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div style={{ background: `${C.accent2}10`, border: `1px solid ${C.accent2}30`, borderRadius: 12, padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🎙️</span>
          <div>
            <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>Voice Summary</span>
            <span style={{ marginLeft: 8, background: `${C.accent}15`, color: C.accent, border: `1px solid ${C.accent}30`, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
              {langCode || "en-US"}
            </span>
          </div>
        </div>
        <button
          onClick={handlePlay}
          style={{
            padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
            background: (playing || loading) ? `${C.red}22` : `${C.accent2}22`,
            color: (playing || loading) ? C.red : C.accent2,
            fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {loading ? "⏳ Loading…" : playing ? "⏹ Stop" : "▶ Play"}
        </button>
      </div>

      {/* Progress bar while playing */}
      {(playing || loading) && total > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ height: 4, background: C.cardBorder, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${C.accent2}, ${C.accent})`, transition: "width 0.3s ease", borderRadius: 4 }} />
          </div>
          <p style={{ color: C.muted, fontSize: 10, marginTop: 4 }}>Speaking part {progress} of {total}…</p>
        </div>
      )}

      <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7, fontStyle: "italic" }}>{text}</p>
    </div>
  );
}

// ── ResultCard ────────────────────────────────────────────────────────────────
function ResultCard({ result }) {
  const [tab, setTab] = useState("summary");
  const langCode = LANG_CODES[result.language] || "en-US";

  const tabs = [
    { key: "summary",  label: "Summary" },
    { key: "findings", label: `Findings (${(result.keyFindings||[]).length})` },
    { key: "abnormal", label: `Abnormal (${(result.abnormalValues||[]).length})` },
    { key: "actions",  label: "Actions" },
  ];

  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", background: `linear-gradient(135deg, ${C.accent}12, ${C.accent2}12)`, borderBottom: `1px solid ${C.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>✨</span>
          <div>
            <p style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>AI Medical Analysis</p>
            <p style={{ color: C.muted, fontSize: 11 }}>Powered by Groq LLaMA · Language: {result.language} · Voice: {langCode}</p>
          </div>
        </div>
        <Pill color={C.green}>Analysis Complete</Pill>
      </div>

      <div style={{ display: "flex", gap: 2, padding: "10px 12px", background: C.bg, borderBottom: `1px solid ${C.cardBorder}`, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", background: tab===t.key ? C.card : "transparent", color: tab===t.key ? C.text : C.muted, fontWeight: tab===t.key ? 700 : 400, borderBottom: tab===t.key ? `2px solid ${C.accent}` : "2px solid transparent" }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        {tab === "summary" && (
          <div>
            <SectionLabel>Plain Language Summary</SectionLabel>
            <p style={{ color: C.text, fontSize: 14, lineHeight: 1.8, background: C.bg, padding: 16, borderRadius: 12, border: `1px solid ${C.cardBorder}`, marginBottom: 16 }}>{result.summary}</p>
            {result.detailedExplanation && <>
              <SectionLabel>Detailed Explanation</SectionLabel>
              <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.8, background: C.bg, padding: 14, borderRadius: 12, border: `1px solid ${C.cardBorder}`, marginBottom: 16 }}>{result.detailedExplanation}</p>
            </>}
            {result.voiceText && <VoicePlayer text={result.voiceText} langCode={langCode} />}
            <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: `${C.yellow}10`, border: `1px solid ${C.yellow}25`, display: "flex", gap: 10 }}>
              <span style={{ fontSize: 14 }}>⚕️</span>
              <p style={{ color: C.yellow, fontSize: 12, lineHeight: 1.6 }}>This is an AI-generated summary. Please consult a healthcare professional for medical decisions.</p>
            </div>
          </div>
        )}
        {tab === "findings" && (
          <div>
            <SectionLabel>Key Findings</SectionLabel>
            {(result.keyFindings||[]).length === 0
              ? <p style={{ color: C.muted, fontSize: 13 }}>No key findings listed.</p>
              : (result.keyFindings||[]).map((f,i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "10px 14px", borderRadius: 10, marginBottom: 8, background: C.bg, border: `1px solid ${C.cardBorder}` }}>
                  <span style={{ color: C.accent, fontWeight: 800, fontFamily: "monospace", fontSize: 12, minWidth: 20 }}>{String(i+1).padStart(2,"0")}</span>
                  <p style={{ color: C.text, fontSize: 14, lineHeight: 1.6 }}>{f}</p>
                </div>
              ))
            }
          </div>
        )}
        {tab === "abnormal" && <div><SectionLabel>Abnormal Values</SectionLabel><AbnormalTable values={result.abnormalValues} /></div>}
        {tab === "actions" && (
          <div>
            <SectionLabel>Recommended Actions</SectionLabel>
            {(result.recommendedActions||[]).map((a,i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "10px 14px", borderRadius: 10, marginBottom: 8, background: `${C.green}08`, border: `1px solid ${C.green}20` }}>
                <span style={{ color: C.green, fontSize: 14 }}>✅</span>
                <p style={{ color: C.text, fontSize: 14 }}>{a}</p>
              </div>
            ))}
            {(result.precautions||[]).length > 0 && <>
              <SectionLabel style={{ marginTop: 20 }}>Precautions</SectionLabel>
              {(result.precautions||[]).map((p,i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "10px 14px", borderRadius: 10, marginBottom: 8, background: `${C.yellow}08`, border: `1px solid ${C.yellow}20` }}>
                  <span style={{ color: C.yellow, fontSize: 14 }}>⚠️</span>
                  <p style={{ color: C.text, fontSize: 14 }}>{p}</p>
                </div>
              ))}
            </>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Upload Box ────────────────────────────────────────────────────────────────
function UploadBox({ onFileRead, onError }) {
  const [dragOver,   setDragOver]   = useState(false);
  const [fileName,   setFileName]   = useState("");
  const [preview,    setPreview]    = useState(null);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    const allowed = ["application/pdf","text/plain","image/jpeg","image/png","image/webp","image/gif"];
    if (!allowed.includes(file.type) && !file.name.endsWith(".txt") && !file.name.endsWith(".pdf")) {
      onError("Please upload a PDF, PNG, JPG, or TXT file."); return;
    }
    if (file.size > 10 * 1024 * 1024) { onError("File too large. Max 10MB."); return; }
    setFileName(file.name); setExtracting(true); setPreview(null);
    if (file.type.startsWith("image/")) setPreview(URL.createObjectURL(file));
    try {
      const result = await readFile(file);
      onFileRead(result);
    } catch (err) {
      onError("Could not read file: " + err.message);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
      onClick={() => fileInputRef.current?.click()}
      style={{ border: `2px dashed ${dragOver ? C.accent : C.cardBorder}`, borderRadius: 12, padding: "24px 20px", textAlign: "center", cursor: "pointer", background: dragOver ? `${C.accent}08` : C.bg, transition: "all 0.2s", marginBottom: 14 }}
    >
      <input ref={fileInputRef} type="file" accept=".pdf,.txt,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
      {extracting ? (
        <div><div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div><p style={{ color: C.accent, fontSize: 13, fontWeight: 600 }}>Reading file…</p></div>
      ) : fileName ? (
        <div>
          {preview && <img src={preview} alt="preview" style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 8, marginBottom: 8, objectFit: "contain" }} />}
          <div style={{ fontSize: 24, marginBottom: 4 }}>📄</div>
          <p style={{ color: C.green, fontSize: 13, fontWeight: 700 }}>✅ {fileName}</p>
          <p style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>File ready — click to change</p>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
          <p style={{ color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Upload Medical Report</p>
          <p style={{ color: C.muted, fontSize: 12 }}>Drag & drop or click · PDF, PNG, JPG, TXT · Max 10MB</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
            {["📄 PDF","🖼️ PNG","🖼️ JPG","📝 TXT"].map(t => (
              <span key={t} style={{ background: `${C.accent}12`, color: C.accent, border: `1px solid ${C.accent}30`, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MedicalReportAnalyzer() {
  const [reportText,    setReportText]    = useState("");
  const [imageData,     setImageData]     = useState(null);
  const [reportType,    setReportType]    = useState("Blood Test");
  const [language,      setLanguage]      = useState("English");
  const [explainLevel,  setExplainLevel]  = useState("simple");
  const [voiceFriendly, setVoiceFriendly] = useState(true);
  const [loading,       setLoading]       = useState(false);
  const [result,        setResult]        = useState(null);
  const [error,         setError]         = useState("");
  const [progress,      setProgress]      = useState(0);
  const [inputMode,     setInputMode]     = useState("text");
  const progressRef = useRef(null);

  const handleFileRead = (fileResult) => {
    setError("");
    if (fileResult.type === "image") {
      setImageData({ base64: fileResult.base64, mimeType: fileResult.mimeType, fileName: fileResult.fileName });
      setReportText(`[Image uploaded: ${fileResult.fileName}]\nGroq AI will analyze this image.`);
    } else {
      setImageData(null);
      setReportText(fileResult.text);
    }
  };

  const handleAnalyze = async () => {
    const hasImage = !!imageData;
    const hasText  = reportText.trim() && !reportText.startsWith("[Image uploaded:");
    if (!hasImage && !hasText) { setError("Please upload a file or paste your medical report text."); return; }

    setError(""); setResult(null); setLoading(true); setProgress(0);
    let pct = 0;
    progressRef.current = setInterval(() => { pct = Math.min(pct + 3, 88); setProgress(pct); }, 200);

    try {
      const parsed = await analyzeReport({
        reportText:        hasText ? reportText : "",
        imageBase64:       hasImage ? imageData.base64 : null,
        imageMimeType:     hasImage ? imageData.mimeType : null,
        reportType,
        preferredLanguage: language,
        explainLevel,
        voiceFriendly,
      });
      clearInterval(progressRef.current);
      setProgress(100);
      setTimeout(() => { setLoading(false); setResult(parsed); }, 300);
    } catch (err) {
      clearInterval(progressRef.current);
      setLoading(false); setProgress(0);
      if (err.message.includes("fetch") || err.message.includes("Failed to fetch")) {
        setError("❌ Cannot connect to backend.\n\nRun: cd backend && node server.js");
      } else if (err.message.includes("GROQ_API_KEY")) {
        setError("❌ Groq API key missing in backend/.env\n\nGet a free key: https://console.groq.com/keys");
      } else if (err.message.includes("429")) {
        setError("❌ Rate limit hit. Wait a moment and try again.");
      } else {
        setError("Analysis failed: " + err.message);
      }
    }
  };

  const handleReset = () => {
    setReportText(""); setImageData(null); setResult(null); setError(""); setProgress(0);
  };

  const inputStyle = { width: "100%", background: C.bg, border: `1px solid ${C.cardBorder}`, color: C.text, padding: "10px 14px", borderRadius: 9, fontSize: 13, outline: "none", fontFamily: "inherit" };
  const canAnalyze  = imageData || (reportText.trim() && !reportText.startsWith("[Image uploaded:"));

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI', -apple-system, sans-serif", color: C.text }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0a0f1e; } ::-webkit-scrollbar-thumb { background: #1a2540; border-radius: 3px; } select option { background: #0f1729; color: #e2e8f0; }`}</style>

      {/* Navbar */}
      <div style={{ background: "#080d1a", borderBottom: `1px solid ${C.cardBorder}`, padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⛓️</div>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 15, fontFamily: "monospace" }}>MediChain</div>
            <div style={{ color: C.muted, fontSize: 10 }}>AI Medical Report Analyzer</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: `${C.green}15`, color: C.green, border: `1px solid ${C.green}30`, padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>🟢 Groq AI</span>
          <span style={{ background: `${C.accent2}15`, color: C.accent2, border: `1px solid ${C.accent2}30`, padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>🌍 {LANGUAGES.length} Languages</span>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: C.text, fontSize: 28, fontWeight: 800, marginBottom: 6 }}>🩺 AI Report Analyzer</h1>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6 }}>Upload a PDF, PNG, JPG or paste text. Groq AI analyzes your report and reads the summary aloud in your language — no setup needed.</p>
        </div>

        {!result && (
          <>
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <p style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 16 }}>⚙️ Analysis Settings</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Report Type</label>
                  <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    {REPORT_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Preferred Language</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Explanation Level</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["simple","detailed"].map(lvl => (
                      <button key={lvl} onClick={() => setExplainLevel(lvl)} style={{ padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, border: `1px solid ${explainLevel===lvl ? C.accent : C.cardBorder}`, background: explainLevel===lvl ? `${C.accent}15` : "transparent", color: explainLevel===lvl ? C.accent : C.muted, textTransform: "capitalize" }}>{lvl}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Voice Summary</label>
                  <div onClick={() => setVoiceFriendly(v => !v)} style={{ width: 48, height: 26, borderRadius: 13, position: "relative", cursor: "pointer", background: voiceFriendly ? C.accent2 : C.cardBorder, transition: "background 0.2s" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: voiceFriendly ? 25 : 3, transition: "left 0.2s" }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                <button onClick={() => setInputMode("text")} style={{ padding: "8px 18px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600, border: `1px solid ${inputMode==="text" ? C.accent : C.cardBorder}`, background: inputMode==="text" ? `${C.accent}15` : "transparent", color: inputMode==="text" ? C.accent : C.muted }}>📝 Paste Text</button>
                <button onClick={() => setInputMode("file")} style={{ padding: "8px 18px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600, border: `1px solid ${inputMode==="file" ? C.accent2 : C.cardBorder}`, background: inputMode==="file" ? `${C.accent2}15` : "transparent", color: inputMode==="file" ? C.accent2 : C.muted }}>📁 Upload File</button>
              </div>

              {inputMode === "file" && <UploadBox onFileRead={handleFileRead} onError={setError} />}

              {(inputMode === "text" || (inputMode === "file" && !imageData)) && (
                <>
                  <p style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>📄 Medical Report Text</p>
                  <p style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>
                    {inputMode === "file" ? "Extracted text — edit before analyzing" : "Paste from lab report, prescription, or medical document"}
                  </p>
                  <textarea
                    value={reportText}
                    onChange={e => setReportText(e.target.value)}
                    placeholder={"Example:\nHemoglobin: 10 g/dL (Low)\nWBC Count: 8,500 /μL (Normal)\nBlood Glucose: 180 mg/dL (High)\n\nOr paste any medical report text here..."}
                    rows={10}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7, fontFamily: "monospace", fontSize: 13 }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ color: reportText.length > 8000 ? C.red : C.muted, fontSize: 11 }}>
                      {reportText.length} characters {reportText.length > 8000 && "⚠️ will be trimmed to 8000"}
                    </span>
                    {reportText.length > 0 && (
                      <button onClick={() => { setReportText(""); setImageData(null); }} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 12 }}>✕ Clear</button>
                    )}
                  </div>
                </>
              )}

              {inputMode === "file" && imageData && (
                <div style={{ padding: 14, borderRadius: 10, background: `${C.green}08`, border: `1px solid ${C.green}25`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ color: C.green, fontWeight: 700, fontSize: 13 }}>🖼️ Image ready for AI analysis</p>
                    <p style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>{imageData.fileName}</p>
                  </div>
                  <button onClick={() => { setImageData(null); setReportText(""); }} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✕ Remove</button>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20, textAlign: "center" }}>
              <button onClick={() => {
                setInputMode("text"); setImageData(null);
                setReportText(`Patient: John Doe | Age: 45 | Date: ${new Date().toLocaleDateString()}\nReport Type: Complete Blood Count (CBC)\n\nHemoglobin: 10.2 g/dL [Normal: 13.5-17.5 g/dL] - LOW\nRBC Count: 3.8 million/μL [Normal: 4.5-5.5] - LOW\nWBC Count: 11,500 /μL [Normal: 4,500-11,000] - HIGH\nPlatelet Count: 145,000 /μL [Normal: 150,000-400,000] - BORDERLINE LOW\nMCV: 72 fL [Normal: 80-100 fL] - LOW\nHematocrit: 31% [Normal: 41-53%] - LOW\n\nDoctor's Note: Patient reports fatigue and shortness of breath.`);
              }} style={{ padding: "8px 20px", borderRadius: 10, cursor: "pointer", fontSize: 12, border: `1px solid ${C.accent}40`, background: `${C.accent}10`, color: C.accent, fontWeight: 600 }}>
                📋 Load Sample Blood Report
              </button>
            </div>

            {error && (
              <div style={{ padding: 14, borderRadius: 10, marginBottom: 16, background: `${C.red}10`, border: `1px solid ${C.red}30`, color: C.red, fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-line" }}>⚠️ {error}</div>
            )}

            {!loading ? (
              <button onClick={handleAnalyze} disabled={!canAnalyze} style={{ width: "100%", padding: 16, border: "none", color: "#fff", fontSize: 16, fontWeight: 700, borderRadius: 12, cursor: canAnalyze ? "pointer" : "not-allowed", background: canAnalyze ? `linear-gradient(135deg, ${C.accent}, ${C.accent2})` : C.cardBorder, opacity: canAnalyze ? 1 : 0.6 }}>
                ✨ Analyze with Groq AI
              </button>
            ) : (
              <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>
                    {progress < 30 ? "Reading file…" : progress < 60 ? "Analyzing with Groq AI…" : progress < 85 ? "Generating summary…" : "Translating response…"}
                  </span>
                  <span style={{ color: C.muted, fontSize: 13 }}>{progress}%</span>
                </div>
                <div style={{ height: 8, background: C.cardBorder, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 4, width: `${progress}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`, transition: "width 0.25s ease" }} />
                </div>
                <p style={{ color: C.muted, fontSize: 12, marginTop: 8, textAlign: "center" }}>Groq AI is analyzing your report in {language}…</p>
              </div>
            )}
          </>
        )}

        {result && (
          <>
            <ResultCard result={result} />
            <div style={{ display: "flex", gap: 14, marginTop: 20 }}>
              <button onClick={handleReset} style={{ flex: 1, padding: 14, borderRadius: 11, border: `1px solid ${C.cardBorder}`, background: "transparent", color: C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>← Analyze Another Report</button>
              <button onClick={() => {
                const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob); a.download = "medichain-analysis.json"; a.click();
              }} style={{ flex: 1, padding: 14, borderRadius: 11, border: "none", background: `linear-gradient(135deg, ${C.green}, #059669)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>⬇ Download Analysis (JSON)</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}