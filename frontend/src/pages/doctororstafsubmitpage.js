import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const COLORS = {
  bg: "#0a0f1e", card: "#0f1729", cardBorder: "#1a2540",
  accent: "#00d4ff", accent2: "#7c3aed", green: "#10b981",
  red: "#ef4444", yellow: "#f59e0b", text: "#e2e8f0", muted: "#64748b",
};

const mockPatients = [
  { id: "HLT-0x72A91B", name: "Arjun Sharma",  age: 34, gender: "Male",   phone: "+91 9876543210", email: "arjun@email.com",  blood: "B+" },
  { id: "HLT-0x45F23C", name: "Priya Mehta",   age: 28, gender: "Female", phone: "+91 9812345678", email: "priya@email.com",  blood: "O+" },
  { id: "HLT-0x91D78E", name: "Ravi Kumar",    age: 52, gender: "Male",   phone: "+91 9834567890", email: "ravi@email.com",   blood: "A-" },
  { id: "HLT-0xB3C21F", name: "Sneha Patel",   age: 31, gender: "Female", phone: "+91 9856789012", email: "sneha@email.com",  blood: "AB+" },
  { id: "HLT-0xD4E56A", name: "Mohan Verma",   age: 45, gender: "Male",   phone: "+91 9878901234", email: "mohan@email.com",  blood: "O-" },
];

const categories = [
  "Blood Test", "X-Ray", "MRI Scan", "CT Scan",
  "Ultrasound", "ECG", "Prescription", "Diagnosis Notes",
  "General Checkup", "Other",
];

const inputStyle = {
  width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`,
  color: COLORS.text, padding: "11px 14px", borderRadius: 9,
  fontSize: 14, outline: "none", boxSizing: "border-box",
};

const cardStyle = {
  background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: 16, padding: 24, marginBottom: 20,
};

export function DoctorSubmitPage() {
  const [searchQuery, setSearchQuery]     = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [category, setCategory]           = useState("");
  const [notes, setNotes]                 = useState("");
  const [isSubmitted, setIsSubmitted]     = useState(false);
  const fileInputRef = useRef(null);

  const filteredPatients = mockPatients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone.includes(searchQuery)
  );

  const handleFileSelect = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} file(s) selected`);
    }
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!selectedPatient) { toast.error("Please select a patient"); return; }
    if (uploadedFiles.length === 0 && !notes) { toast.error("Please upload files or add notes"); return; }
    if (!category) { toast.error("Please select a category"); return; }
    setIsSubmitted(true);
    toast.success(`Report submitted for ${selectedPatient.name}`);
  };

  const handleReset = () => {
    setSearchQuery(""); setSelectedPatient(null);
    setUploadedFiles([]); setCategory("");
    setNotes(""); setIsSubmitted(false);
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

  // ── Success Screen ──────────────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Segoe UI', sans-serif" }}>
        <TopBar />
        <div style={{ maxWidth: 600, margin: "60px auto", padding: "0 24px" }}>
          <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: `${COLORS.green}22`, border: `2px solid ${COLORS.green}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36, margin: "0 auto 20px",
            }}>✅</div>
            <h2 style={{ color: COLORS.text, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              Report Submitted Successfully!
            </h2>
            <p style={{ color: COLORS.muted, marginBottom: 6 }}>
              Report uploaded to <span style={{ color: COLORS.accent }}>{selectedPatient?.name}</span>'s health records
            </p>
            <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 32 }}>
              Patient will receive a notification and AI summary will be generated
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Link to="/doctor" style={{
                padding: "11px 24px", borderRadius: 10,
                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none",
              }}>Back to Dashboard</Link>
              <button onClick={handleReset} style={{
                padding: "11px 24px", borderRadius: 10,
                background: "transparent", border: `1px solid ${COLORS.cardBorder}`,
                color: COLORS.muted, fontWeight: 600, fontSize: 14, cursor: "pointer",
              }}>Submit Another</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Form ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Segoe UI', sans-serif" }}>
      <TopBar />
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <Link to="/doctor" style={{ color: COLORS.accent, fontSize: 13, textDecoration: "none" }}>
            ← Back to Dashboard
          </Link>
          <h1 style={{ color: COLORS.text, fontSize: 28, fontWeight: 800, marginTop: 10, marginBottom: 4 }}>
            Submit Patient Report
          </h1>
          <p style={{ color: COLORS.muted, fontSize: 14 }}>
            Search for a patient and upload their test results or medical documents
          </p>
        </div>

        {/* ── Patient Search ── */}
        <div style={cardStyle}>
          <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🔍 Search Patient</h3>
          <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>Find patient by name, ID, or phone number</p>

          <div style={{ position: "relative", marginBottom: 16 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: COLORS.muted }}>🔍</span>
            <input
              placeholder="Search patient..."
              style={{ ...inputStyle, paddingLeft: 36 }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {searchQuery && (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {filteredPatients.length === 0 ? (
                <p style={{ color: COLORS.muted, textAlign: "center", padding: 20, fontSize: 14 }}>No patients found</p>
              ) : (
                filteredPatients.map(patient => (
                  <div
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    style={{
                      padding: 16, borderRadius: 12, marginBottom: 10, cursor: "pointer",
                      border: `2px solid ${selectedPatient?.id === patient.id ? COLORS.accent : COLORS.cardBorder}`,
                      background: selectedPatient?.id === patient.id ? `${COLORS.accent}0d` : COLORS.bg,
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ color: COLORS.text, fontWeight: 700, marginBottom: 6 }}>{patient.name}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12, color: COLORS.muted }}>
                          <span>👤 {patient.id}</span>
                          <span>📞 {patient.phone}</span>
                          <span>✉️ {patient.email}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          {[`${patient.age} yrs`, patient.gender, patient.blood].map(tag => (
                            <span key={tag} style={{
                              background: `${COLORS.accent}15`, color: COLORS.accent,
                              border: `1px solid ${COLORS.accent}30`,
                              padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                            }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                      {selectedPatient?.id === patient.id && (
                        <span style={{ color: COLORS.green, fontSize: 20 }}>✅</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Upload + Details (only when patient selected) ── */}
        {selectedPatient && (
          <>
            {/* Upload Files */}
            <div style={cardStyle}>
              <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>📤 Upload Files</h3>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>
                Upload documents for <span style={{ color: COLORS.accent }}>{selectedPatient.name}</span>
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${COLORS.cardBorder}`, borderRadius: 12,
                  padding: "36px 20px", textAlign: "center", cursor: "pointer",
                  background: COLORS.bg, transition: "border-color 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.cardBorder}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>☁️</div>
                <p style={{ color: COLORS.text, fontWeight: 600, marginBottom: 4 }}>Click to upload files</p>
                <p style={{ color: COLORS.muted, fontSize: 13 }}>PDF, JPG, PNG, DICOM accepted</p>
                <input
                  ref={fileInputRef} type="file" multiple
                  accept=".pdf,.jpg,.jpeg,.png,.dcm"
                  onChange={handleFileSelect} style={{ display: "none" }}
                />
              </div>

              {uploadedFiles.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 10 }}>
                    Uploaded Files ({uploadedFiles.length})
                  </p>
                  {uploadedFiles.map((file, index) => (
                    <div key={index} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", background: COLORS.bg,
                      border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, marginBottom: 8,
                    }}>
                      <span style={{ fontSize: 22 }}>{getFileIcon(file)}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{file.name}</p>
                        <p style={{ color: COLORS.muted, fontSize: 11 }}>{formatFileSize(file.size)}</p>
                      </div>
                      <button onClick={() => handleRemoveFile(index)} style={{
                        background: "transparent", border: "none",
                        color: COLORS.red, cursor: "pointer", fontSize: 18, lineHeight: 1,
                      }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Report Details */}
            <div style={cardStyle}>
              <h3 style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, marginBottom: 20 }}>📋 Report Details</h3>

              <label style={{ color: COLORS.muted, fontSize: 13, display: "block", marginBottom: 6 }}>
                Report Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{ ...inputStyle, marginBottom: 20, cursor: "pointer" }}
              >
                <option value="">Select category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <label style={{ color: COLORS.muted, fontSize: 13, display: "block", marginBottom: 6 }}>
                Diagnosis Notes (Optional)
              </label>
              <textarea
                placeholder="Enter any additional notes, diagnosis, or instructions for the patient..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={5}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
              />
            </div>

            {/* Submit Button */}
            <div style={cardStyle}>
              <button onClick={handleSubmit} style={{
                width: "100%", padding: "14px",
                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
                border: "none", color: "#fff", fontSize: 16, fontWeight: 700,
                borderRadius: 12, cursor: "pointer",
              }}>
                📤 Submit Report to Patient Record
              </button>
            </div>
          </>
        )}

        {/* Guide card when no patient selected */}
        {!selectedPatient && !searchQuery && (
          <div style={{
            ...cardStyle,
            background: `${COLORS.accent}08`,
            border: `1px solid ${COLORS.accent}25`,
          }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{ fontSize: 22 }}>🔍</span>
              <div>
                <h4 style={{ color: COLORS.accent, fontWeight: 700, marginBottom: 10 }}>Quick Guide</h4>
                {[
                  "Search for the patient using their name, ID, or phone number",
                  "Upload test results, scans, or medical documents",
                  "Add diagnosis notes or instructions if needed",
                  "Reports are instantly added to the patient's record and AI summary is generated",
                ].map(item => (
                  <p key={item} style={{ color: COLORS.muted, fontSize: 13, marginBottom: 6 }}>• {item}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared TopBar ─────────────────────────────────────────────────────────────
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
          <div style={{ color: COLORS.muted, fontSize: 10 }}>Doctor Portal</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Link to="/doctor" style={{
          color: COLORS.muted, fontSize: 13, textDecoration: "none",
          padding: "6px 14px", borderRadius: 8, border: `1px solid ${COLORS.cardBorder}`,
        }}>Dashboard</Link>
        <Link to="/doctor/submit" style={{
          color: COLORS.accent, fontSize: 13, textDecoration: "none",
          padding: "6px 14px", borderRadius: 8,
          background: `${COLORS.accent}15`, border: `1px solid ${COLORS.accent}30`,
        }}>Submit Report</Link>
      </div>
    </div>
  );
}

export default DoctorSubmitPage;