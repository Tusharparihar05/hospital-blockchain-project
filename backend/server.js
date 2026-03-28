const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

const STORE_FILE = path.join(__dirname, "medichain-store.json");
let persistTimer = null;
function persistState() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      fs.writeFileSync(
        STORE_FILE,
        JSON.stringify({ records, appointments, doctorLicenseVerifications }, null, 2)
      );
    } catch (e) {
      console.error("persistState:", e.message);
    }
  }, 400);
}
function loadState() {
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const d = JSON.parse(raw);
    if (Array.isArray(d.records)) records.splice(0, records.length, ...d.records);
    if (Array.isArray(d.appointments)) appointments.splice(0, appointments.length, ...d.appointments);
    if (Array.isArray(d.doctorLicenseVerifications)) {
      doctorLicenseVerifications.splice(0, doctorLicenseVerifications.length, ...d.doctorLicenseVerifications);
    }
  } catch (_) { /* no file yet */ }
}

app.use(cors());
app.use(express.json());

// ─── In-memory data stores ────────────────────────────────────────────────────

const users = [];

const patients = [
  { id: "HLT-0x72A91B", name: "Arjun Sharma",  age: 34, blood: "B+", dept: "Cardiology",  status: "Checked In",      queue: 3 },
  { id: "HLT-0x45F23C", name: "Priya Mehta",   age: 28, blood: "O+", dept: "Dermatology", status: "Waiting",         queue: 7 },
  { id: "HLT-0x91D78E", name: "Ravi Kumar",    age: 52, blood: "A-", dept: "Orthopedics", status: "In Consultation", queue: 1 },
];

// ✅ FIXED: doctors now include all fields that PatientDashboard expects
const doctors = [
  {
    id: "DOC-001", name: "Dr. Ananya Singh", specialty: "Cardiology", dept: "Cardiology",
    hospital: "AIIMS Delhi", rating: 4.8, reviewCount: 247,
    experience: "12 yrs", education: "MBBS, MD (Cardiology)",
    fee: 800, image: "👩‍⚕️", available: true, slots: 3,
    bio: "Senior Cardiologist specializing in interventional cardiology, heart failure management, and preventive cardiac care.",
    tags: ["Heart Failure", "Interventional", "Preventive Care", "ECG"],
    languages: ["English", "Hindi", "Punjabi"],
    availability: ["9:00 AM", "10:30 AM", "2:00 PM", "4:00 PM"],
    reviews: [
      { name: "Ramesh K.", rating: 5, comment: "Excellent doctor. Explained everything very clearly." },
      { name: "Sunita M.", rating: 5, comment: "Very thorough and caring. Highly recommend." },
    ],
  },
  {
    id: "DOC-002", name: "Dr. Vikram Patel", specialty: "Dermatology", dept: "Dermatology",
    hospital: "Fortis Hospital", rating: 4.5, reviewCount: 183,
    experience: "8 yrs", education: "MBBS, DVD (Dermatology)",
    fee: 600, image: "👨‍⚕️", available: true, slots: 6,
    bio: "Expert in acne management, eczema, psoriasis, skin cancer screening, and cosmetic dermatology.",
    tags: ["Acne", "Eczema", "Skin Cancer", "Cosmetic"],
    languages: ["English", "Gujarati", "Hindi"],
    availability: ["11:00 AM", "1:00 PM", "3:30 PM", "5:00 PM"],
    reviews: [
      { name: "Priya S.", rating: 5, comment: "My acne cleared up within 2 months. Amazing results!" },
      { name: "Karan T.", rating: 4, comment: "Very knowledgeable doctor." },
    ],
  },
  {
    id: "DOC-003", name: "Dr. Meena Roy", specialty: "Orthopedics", dept: "Orthopedics",
    hospital: "Apollo Hospital", rating: 4.9, reviewCount: 312,
    experience: "15 yrs", education: "MBBS, MS (Ortho), FRCS",
    fee: 1000, image: "👩‍⚕️", available: false, slots: 0,
    bio: "Renowned orthopedic surgeon specializing in joint replacement, sports injuries, and spine disorders.",
    tags: ["Joint Replacement", "Spine", "Sports Injury", "Arthroscopy"],
    languages: ["English", "Bengali", "Hindi"],
    availability: ["9:30 AM", "11:30 AM", "2:30 PM"],
    reviews: [
      { name: "Anand V.", rating: 5, comment: "My knee replacement surgery was a huge success!" },
      { name: "Lakshmi N.", rating: 5, comment: "Best orthopedic surgeon in Delhi." },
    ],
  },
  {
    id: "DOC-004", name: "Dr. Suresh Nair", specialty: "Neurology", dept: "Neurology",
    hospital: "Medanta Hospital", rating: 4.7, reviewCount: 198,
    experience: "10 yrs", education: "MBBS, DM (Neurology)",
    fee: 900, image: "👨‍⚕️", available: true, slots: 2,
    bio: "Specialist in movement disorders, epilepsy, stroke management, and neuro-rehabilitation.",
    tags: ["Epilepsy", "Stroke", "Movement Disorders", "Migraine"],
    languages: ["English", "Malayalam", "Hindi"],
    availability: ["10:00 AM", "12:00 PM", "3:00 PM", "5:30 PM"],
    reviews: [
      { name: "Rohit G.", rating: 5, comment: "Correctly diagnosed my condition when others couldn't!" },
      { name: "Fatima S.", rating: 4, comment: "Very patient and explains everything clearly." },
    ],
  },
  {
    id: "DOC-005", name: "Dr. Priya Sharma", specialty: "Pediatrics", dept: "Pediatrics",
    hospital: "Rainbow Children's Hospital", rating: 4.6, reviewCount: 156,
    experience: "9 yrs", education: "MBBS, MD (Pediatrics)",
    fee: 500, image: "👩‍⚕️", available: true, slots: 4,
    bio: "Dedicated pediatrician with expertise in child nutrition, developmental disorders, and neonatal care.",
    tags: ["Neonatal Care", "Child Nutrition", "Vaccinations", "Development"],
    languages: ["English", "Hindi", "Marathi"],
    availability: ["9:00 AM", "11:00 AM", "2:00 PM", "4:30 PM"],
    reviews: [
      { name: "Neha K.", rating: 5, comment: "Dr. Priya is amazing with kids!" },
      { name: "Sanjay M.", rating: 5, comment: "Very thorough with vaccinations and follow-ups." },
    ],
  },
];

// ✅ FIXED: records now use fileName, category, uploadDate (matching what PatientDashboard expects)
const records = [
  {
    id: "REC-001", patientId: "HLT-0x72A91B",
    fileName: "Blood_Test_March2026.pdf", category: "Blood Test",
    uploadDate: "2026-03-01",
    doctor: "Dr. Ananya Singh", hash: "0xabc123def456", dept: "Cardiology",
    aiSummary: {
      keyFindings: ["Cholesterol slightly elevated at 210 mg/dL", "Blood glucose normal at 95 mg/dL", "Hemoglobin within range at 14.5 g/dL"],
      plainLanguage: "Your blood test shows mostly good results. Blood sugar and red blood cells are healthy. Cholesterol is slightly high — manageable with diet and exercise.",
      recommendedSteps: ["Reduce saturated fat intake", "30 min daily exercise", "Follow-up in 3 months"],
    },
  },
  {
    id: "REC-002", patientId: "HLT-0x72A91B",
    fileName: "Chest_Xray_Feb2026.pdf", category: "X-Ray",
    uploadDate: "2026-02-14",
    doctor: "Dr. Meena Roy", hash: "0xdef456ghi789", dept: "Orthopedics",
    aiSummary: {
      keyFindings: ["No abnormalities detected", "Lung fields clear", "Heart size normal"],
      plainLanguage: "Your chest X-ray looks completely normal. Lungs are clear and heart is a healthy size.",
      recommendedSteps: ["No immediate action required", "Routine check in 1 year"],
    },
  },
  {
    id: "REC-003", patientId: "HLT-0x72A91B",
    fileName: "Prescription_Jan2026.pdf", category: "Prescription",
    uploadDate: "2026-01-20",
    doctor: "Dr. Vikram Patel", hash: "0xghi789jkl012", dept: "Dermatology",
    aiSummary: null,
  },
];

const appointments = [];

/** Doctor license checks (demo). Production: swap mock validation for NMC / state medical council API. */
const doctorLicenseVerifications = [];

loadState();

const queueData = [
  { dept: "Cardiology",  wait: 30, level: "medium" },
  { dept: "Dermatology", wait: 10, level: "low"    },
  { dept: "Orthopedics", wait: 90, level: "high"   },
  { dept: "Neurology",   wait: 20, level: "low"    },
  { dept: "Pediatrics",  wait: 45, level: "medium" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomHex(len = 8) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join("").toUpperCase();
}

function generateToken() {
  return `token_${randomHex(16)}`;
}

// ─── Health check ─────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "MediChain Blockchain Backend Running" });
});

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────

app.post("/api/auth/signup", (req, res) => {
  const { name, email, password, phone, role, walletAddress, specialty, licenseNumber } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required" });
  }
  const existing = users.find(u => u.email === email);
  if (existing) return res.status(409).json({ error: "Email already registered" });

  let patientId = null;
  if (role === "patient") {
    patientId = `HLT-0x${randomHex(6)}`;
    patients.push({ id: patientId, name, age: 0, blood: "Unknown", dept: "General", status: "Registered", queue: patients.length + 1, phone: phone || "" });
  }

  const chainPatientId =
    (role || "patient") === "patient" ? Math.floor(Math.random() * 900000) + 100000 : null;

  const newUser = {
    id: `USR-${randomHex(6)}`, name, email, password,
    role: role || "patient", walletAddress: walletAddress || "",
    patientId, specialty: specialty || "", licenseNumber: licenseNumber || "",
    chainPatientId,
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  const token = generateToken();
  res.status(201).json({
    message: "Account created successfully", token,
    user: {
      id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role,
      patientId: newUser.patientId, walletAddress: newUser.walletAddress,
      specialty: newUser.specialty || "", licenseNumber: newUser.licenseNumber || "",
      chainPatientId: newUser.chainPatientId ?? null,
    },
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    const demoToken = generateToken();
    return res.json({
      message: "Demo login successful", token: demoToken,
      user: {
        id: "USR-DEMO", name: email.split("@")[0], email, role: role || "patient",
        patientId: role === "doctor" ? null : "HLT-0x72A91B", walletAddress: "",
        specialty: role === "doctor" ? "General Medicine" : "", licenseNumber: "",
        chainPatientId: role === "doctor" ? null : 72,
      },
    });
  }
  if (user.role === "patient" && (user.chainPatientId == null || user.chainPatientId === undefined)) {
    user.chainPatientId = Math.floor(Math.random() * 900000) + 100000;
  }
  const token = generateToken();
  res.json({
    message: "Login successful", token,
    user: {
      id: user.id, name: user.name, email: user.email, role: user.role,
      patientId: user.patientId, walletAddress: user.walletAddress,
      specialty: user.specialty || "", licenseNumber: user.licenseNumber || "",
      chainPatientId: user.chainPatientId ?? null,
    },
  });
});

app.post("/api/auth/wallet-login", (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: "walletAddress is required" });
  const user = users.find(u => u.walletAddress?.toLowerCase() === walletAddress.toLowerCase());
  const token = generateToken();
  if (user) {
    return res.json({
      message: "Wallet login successful", token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        patientId: user.patientId, walletAddress: user.walletAddress,
        specialty: user.specialty || "", licenseNumber: user.licenseNumber || "",
        chainPatientId: user.chainPatientId ?? null,
      },
    });
  }
  const nid = `USR-${randomHex(6)}`;
  const cpid = Math.floor(Math.random() * 900000) + 100000;
  res.json({
    message: "New wallet connected",
    token,
    user: {
      id: nid,
      name: `User_${walletAddress.slice(2, 8)}`,
      email: "",
      role: "patient",
      patientId: "HLT-0x72A91B",
      walletAddress,
      chainPatientId: cpid,
    },
  });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

app.get("/api/dashboard", (req, res) => {
  res.json({
    totalPatients: patients.length,
    appointmentsToday: appointments.filter(a => a.date === new Date().toISOString().slice(0, 10)).length,
    onChainRecords: records.length,
    avgWaitMinutes: Math.round(queueData.reduce((s, d) => s + d.wait, 0) / queueData.length),
    queueData,
    recentPatients: patients.slice(0, 5),
  });
});

// ─── Patients ─────────────────────────────────────────────────────────────────

app.get("/api/patients", (req, res) => res.json(patients));
app.get("/api/patients/:id", (req, res) => {
  const patient = patients.find(p => p.id === req.params.id);
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  res.json(patient);
});
app.post("/api/patients", (req, res) => {
  const { name, age, blood, dept } = req.body;
  if (!name || !age || !blood || !dept) return res.status(400).json({ error: "name, age, blood, and dept are required" });
  const newPatient = { id: `HLT-0x${randomHex(6)}`, name, age: Number(age), blood, dept, status: "Waiting", queue: patients.length + 1 };
  patients.push(newPatient);
  res.status(201).json({ message: "Patient registered", patient: newPatient });
});

// ─── Doctors ──────────────────────────────────────────────────────────────────

app.get("/api/doctors", (req, res) => res.json(doctors));
app.get("/api/doctors/dept/:dept", (req, res) => {
  const result = doctors.filter(d => d.dept.toLowerCase() === req.params.dept.toLowerCase());
  res.json(result);
});
app.get("/api/doctors/:id", (req, res) => {
  const doctor = doctors.find(d => d.id === req.params.id);
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  res.json(doctor);
});

// ─── Appointments ─────────────────────────────────────────────────────────────

app.get("/api/appointments", (req, res) => {
  const { patientId } = req.query;
  if (patientId) return res.json(appointments.filter(a => a.patientId === patientId));
  res.json(appointments);
});
app.get("/api/appointments/:patientId", (req, res) => {
  res.json(appointments.filter(a => a.patientId === req.params.patientId));
});
app.post("/api/appointments", (req, res) => {
  const { patientId, dept, doctorName, doctorId, date, time, isEmergency } = req.body;
  if (!patientId || !date || !time) return res.status(400).json({ error: "patientId, date, and time are required" });
  const doctor = doctors.find(d => d.name === doctorName || d.id === doctorId);
  if (doctor && doctor.slots > 0) { doctor.slots -= 1; if (doctor.slots === 0) doctor.available = false; }
  const tokenId = `APT-${randomHex(8)}`;
  const appointment = {
    id: `APPT-${randomHex(6)}`, patientId, dept: dept || doctor?.dept || "General",
    doctorName: doctorName || "TBD", doctorId: doctorId || doctor?.id || "DOC-001",
    date, time, tokenId, isEmergency: isEmergency || false,
    queuePosition: appointments.length + 1, status: "Confirmed", createdAt: new Date().toISOString(),
  };
  appointments.push(appointment);
  persistState();
  res.status(201).json({ message: "Appointment booked", appointment, tokenId });
});
app.put("/api/appointments/:id/complete", (req, res) => {
  const appt = appointments.find(a => a.id === req.params.id);
  if (!appt) return res.status(404).json({ error: "Appointment not found" });
  appt.status = "Completed";
  persistState();
  res.json({ message: "Appointment completed", appointment: appt });
});
app.put("/api/appointments/:id/reschedule", (req, res) => {
  const appt = appointments.find(a => a.id === req.params.id);
  if (!appt) return res.status(404).json({ error: "Appointment not found" });
  appt.status = "Reschedule Requested";
  persistState();
  res.json({ message: "Reschedule requested", appointment: appt });
});

// ─── Health Records ───────────────────────────────────────────────────────────

app.get("/api/records", (req, res) => {
  res.json(records);
});

app.get("/api/records/:patientId", (req, res) => {
  const result = records.filter(r => r.patientId === req.params.patientId);
  res.json(result);
});

app.post("/api/records", (req, res) => {
  const { patientId, type, category, fileName, doctor, dept, fileHash } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId is required" });
  const ipfsHash = fileHash || `0x${randomHex(6)}${randomHex(6)}`;
  const uploadAiSummary = {
    keyFindings: ["Document received and stored", "Hash generated for blockchain anchoring", "Awaiting doctor review"],
    plainLanguage: "Your document has been uploaded successfully. A cryptographic fingerprint has been created and can be anchored on the blockchain for tamper-proof verification.",
    recommendedSteps: ["Wait for doctor to review", "Check back for AI analysis", "Your record is listed in the doctor portal"],
  };
  const newRecord = {
    id: `REC-${randomHex(4)}`,
    patientId,
    // ✅ Support both old (type) and new (fileName/category) field names
    fileName: fileName || type || "Uploaded Document",
    category: category || type || "General",
    uploadDate: new Date().toISOString().slice(0, 10),
    doctor: doctor || "Self Upload",
    dept: dept || "General",
    hash: ipfsHash,
    blockchainHash: fileHash || ipfsHash || "",
    aiSummary: fileHash ? uploadAiSummary : null,
  };
  records.push(newRecord);
  persistState();
  res.status(201).json({ message: "Record saved", record: newRecord, ipfsHash, aiSummary: newRecord.aiSummary });
});

// ✅ FIXED: /api/records/upload now reads FormData fields properly and saves correct fields
app.post("/api/records/upload", express.urlencoded({ extended: true }), (req, res) => {
  // express.json() won't parse multipart, but urlencoded fields come through
  // Frontend sends: category, patientId, fileHash via FormData (text fields)
  const category   = req.body.category   || "General";
  const patientId  = req.body.patientId  || "HLT-0x72A91B";
  const fileHash   = req.body.fileHash   || `0x${randomHex(12)}`;
  // File name won't come through without multer, so we generate one
  const fileName   = `Report_${new Date().toISOString().slice(0, 10)}_${category.replace(/\s+/g, "_")}.pdf`;

  const newRecord = {
    id:             `REC-${randomHex(4)}`,
    patientId,
    fileName,
    category,
    uploadDate:     new Date().toISOString().slice(0, 10),  // ✅ correct field name
    doctor:         "Self Upload",
    dept:           "General",
    hash:           fileHash,
    blockchainHash: fileHash,
    aiSummary: {
      keyFindings:      ["Document received and stored", "Hash generated for blockchain anchoring", "Awaiting doctor review"],
      plainLanguage:    "Your document has been uploaded successfully. A cryptographic fingerprint has been created and will be anchored on the blockchain for tamper-proof verification.",
      recommendedSteps: ["Wait for doctor to review", "Check back for AI analysis", "Your record is now secured on-chain"],
    },
  };
  records.push(newRecord);
  persistState();

  res.status(201).json({
    message:   "File uploaded successfully",
    record:    newRecord,
    ipfsHash:  fileHash,
    aiSummary: newRecord.aiSummary,
  });
});

// ─── Queue ────────────────────────────────────────────────────────────────────

app.get("/api/queue", (req, res) => res.json(queueData));
app.get("/api/queue/:dept", (req, res) => {
  const entry = queueData.find(q => q.dept.toLowerCase() === req.params.dept.toLowerCase());
  if (!entry) return res.status(404).json({ error: "Department not found" });
  res.json(entry);
});

// ─── Emergency ────────────────────────────────────────────────────────────────

app.post("/api/emergency", (req, res) => {
  const { patientId, lat, lng } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId is required" });
  const patient = patients.find(p => p.id === patientId) || patients[0];
  const emergencyToken = `EMR-${randomHex(8)}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  res.status(201).json({
    message: "Emergency protocol activated", emergencyToken, expiresAt,
    patient: { id: patient.id, name: patient.name, blood: patient.blood, age: patient.age },
    location: lat && lng ? { lat, lng } : null,
    nearbyHospital: { name: "City Hospital", distanceKm: 1.2, etaMinutes: 8 },
  });
});

// ─── Doctor license verification (demo registry) ───────────────────────────────
// Production: replace mock checks with HTTPS call to your national medical council
// or third-party KYC API (contract required). This stores decisions in doctorLicenseVerifications.

app.post("/api/verification/doctor-license", (req, res) => {
  const { email, licenseNumber, documentHash } = req.body;
  if (!email || !licenseNumber) {
    return res.status(400).json({ error: "email and licenseNumber are required" });
  }
  const clean = String(licenseNumber).replace(/\s/g, "");
  const formatOk = /^[A-Z0-9-]{6,24}$/i.test(clean);
  const entry = {
    id: `LIC-${randomHex(6)}`,
    email: String(email).toLowerCase().trim(),
    licenseNumber: clean,
    documentHash: documentHash || "",
    status: formatOk ? "verified" : "rejected",
    issuer: "MediChain Demo Verifier (not a real medical council)",
    verifiedAt: formatOk ? new Date().toISOString() : null,
    note: formatOk
      ? "Mock pass: in production, call your institutional API (e.g. state medical register) before setting verified."
      : "License reference failed basic format check (6–24 chars, letters, digits, hyphen).",
    createdAt: new Date().toISOString(),
  };
  doctorLicenseVerifications.push(entry);
  persistState();
  res.status(201).json(entry);
});

app.get("/api/verification/doctor-license", (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "email query param is required" });
  const em = String(email).toLowerCase().trim();
  const matches = doctorLicenseVerifications.filter(v => v.email === em);
  if (!matches.length) {
    return res.json({ status: "none", message: "No verification submitted yet for this email." });
  }
  matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(matches[0]);
});

// ─── Wallet connect ───────────────────────────────────────────────────────────

app.post("/api/wallet/connect", (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: "walletAddress is required" });
  const user = users.find(u => u.walletAddress?.toLowerCase() === walletAddress.toLowerCase());
  const linkedPatient = user ? patients.find(p => p.id === user.patientId) : patients[0];
  res.json({ message: "Wallet connected", walletAddress, patientId: linkedPatient?.id || patients[0].id, patientName: linkedPatient?.name || patients[0].name });
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\nMediChain backend running on http://localhost:${PORT}`);
  console.log("\nAvailable routes:");
  console.log("  POST /api/auth/signup         POST /api/auth/login");
  console.log("  GET  /api/dashboard");
  console.log("  GET  /api/patients            POST /api/patients");
  console.log("  GET  /api/doctors");
  console.log("  GET  /api/appointments        POST /api/appointments");
  console.log("  GET  /api/records              GET  /api/records/:patientId");
  console.log("  POST /api/records");
  console.log("  POST /api/records/upload");
  console.log("  POST /api/emergency");
  console.log("  POST /api/wallet/connect");
  console.log("  POST /api/verification/doctor-license   GET /api/verification/doctor-license?email=");
});