// ─────────────────────────────────────────────────────────────────────────────
//  backend/server.js
//  MediChain — MongoDB-backed server. Replaces the old in-memory version.
//  All data lives in MongoDB Atlas. Routes are in the /routes folder.
// ─────────────────────────────────────────────────────────────────────────────
require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const mongoose = require("mongoose");

const app = express();


const app = express();

// MongoDB connection
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("❌ MONGODB_URI not set in .env file");
  process.exit(1);
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log("✅ MongoDB connected");
    startServer();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

function startServer() {

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

>>>>>>> Stashed changes
app.use(cors());
app.use(express.json());

// ── Connect MongoDB ───────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "MediChain Blockchain Backend Running" });
});

    });

    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const emergencyToken = `EMR-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    res.status(201).json({
      message: "Emergency protocol activated",
      emergencyToken,
      expiresAt,
      patient: {
        id:     patient.patientId,
        name:   patient.name,
        blood:  patient.bloodGroup || "Unknown",
        age:    patient.dateOfBirth
          ? Math.floor((Date.now() - new Date(patient.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365))
          : null,
      },
      location: lat && lng ? { lat, lng } : null,
      nearbyHospital: { name: "City Hospital", distanceKm: 1.2, etaMinutes: 8 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Wallet connect ────────────────────────────────────────────────────────────
app.post("/api/wallet/connect", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "walletAddress is required" });

    const User = require("./models/User");
    const user = await User.findOne({ walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") } });
    if (!user) return res.json({ message: "Wallet not linked to any account", walletAddress });

    res.json({
      message:     "Wallet connected",
      walletAddress,
      patientId:   user.patientId,
      patientName: user.name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
=======
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
  // If user not found, create a new patient user (optional, or return error)
  // For now, return error
  return res.status(404).json({ error: "User not found for this wallet address" });

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
>>>>>>> Stashed changes
  }
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

<<<<<<< Updated upstream
// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\nMediChain backend running on http://localhost:${PORT}`);
  console.log("\nRoutes:");
  console.log("  POST /api/auth/signup            POST /api/auth/login");
  console.log("  GET  /api/dashboard              GET  /api/queue");
  console.log("  GET  /api/patients               GET  /api/patients/:id");
  console.log("  GET  /api/doctors                GET  /api/doctors/:id");
  console.log("  GET  /api/appointments           POST /api/appointments");
  console.log("  GET  /api/records/:patientId     POST /api/records");
  console.log("  GET  /api/blockchain/status");
  console.log("  POST /api/emergency              POST /api/wallet/connect");
  console.log("  POST /api/verification/doctor-license");
});
=======
// (Server start moved to startServer() after MongoDB connects)
// Ensure the file ends cleanly
}
>>>>>>> Stashed changes
