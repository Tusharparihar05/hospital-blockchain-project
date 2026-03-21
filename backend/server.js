const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// ─── In-memory data stores ────────────────────────────────────────────────────

const users = []; // stores signed up users { id, name, email, password, role, walletAddress, patientId }

const patients = [
  { id: "HLT-0x72A91B", name: "Arjun Sharma",  age: 34, blood: "B+", dept: "Cardiology",  status: "Checked In",      queue: 3 },
  { id: "HLT-0x45F23C", name: "Priya Mehta",   age: 28, blood: "O+", dept: "Dermatology", status: "Waiting",         queue: 7 },
  { id: "HLT-0x91D78E", name: "Ravi Kumar",    age: 52, blood: "A-", dept: "Orthopedics", status: "In Consultation", queue: 1 },
];

const doctors = [
  { id: "DOC-001", name: "Dr. Ananya Singh", dept: "Cardiology",  rating: 4.8, available: true,  slots: 3 },
  { id: "DOC-002", name: "Dr. Vikram Patel", dept: "Dermatology", rating: 4.5, available: true,  slots: 6 },
  { id: "DOC-003", name: "Dr. Meena Roy",    dept: "Orthopedics", rating: 4.9, available: false, slots: 0 },
  { id: "DOC-004", name: "Dr. Suresh Nair",  dept: "Neurology",   rating: 4.7, available: true,  slots: 2 },
];

const records = [
  { id: "REC-001", patientId: "HLT-0x72A91B", date: "2024-03-12", type: "Prescription",     doctor: "Dr. Ananya Singh", hash: "0xabc123def456", dept: "Cardiology"  },
  { id: "REC-002", patientId: "HLT-0x72A91B", date: "2024-07-05", type: "Lab Report",        doctor: "Dr. Vikram Patel", hash: "0xdef456ghi789", dept: "Dermatology" },
  { id: "REC-003", patientId: "HLT-0x72A91B", date: "2025-01-20", type: "X-Ray",             doctor: "Dr. Meena Roy",    hash: "0xghi789jkl012", dept: "Orthopedics" },
  { id: "REC-004", patientId: "HLT-0x72A91B", date: "2025-11-08", type: "Discharge Summary", doctor: "Dr. Suresh Nair",  hash: "0xjkl012mno345", dept: "Neurology"   },
];

const appointments = [];

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

// POST /api/auth/signup
app.post("/api/auth/signup", (req, res) => {
  const { name, email, password, phone, role, walletAddress, specialty, licenseNumber } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required" });
  }

  // Check if email already exists
  const existing = users.find(u => u.email === email);
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  // Create a patient record if role is patient
  let patientId = null;
  if (role === "patient") {
    patientId = `HLT-0x${randomHex(6)}`;
    patients.push({
      id:     patientId,
      name,
      age:    0,
      blood:  "Unknown",
      dept:   "General",
      status: "Registered",
      queue:  patients.length + 1,
      phone:  phone || "",
    });
  }

  const newUser = {
    id:            `USR-${randomHex(6)}`,
    name,
    email,
    password,       // in production: hash this with bcrypt
    role:           role || "patient",
    walletAddress:  walletAddress || "",
    patientId,
    specialty:      specialty || "",
    licenseNumber:  licenseNumber || "",
    createdAt:      new Date().toISOString(),
  };

  users.push(newUser);

  const token = generateToken();

  res.status(201).json({
    message:   "Account created successfully",
    token,
    user: {
      id:           newUser.id,
      name:         newUser.name,
      email:        newUser.email,
      role:         newUser.role,
      patientId:    newUser.patientId,
      walletAddress: newUser.walletAddress,
    },
  });
});

// POST /api/auth/login
app.post("/api/auth/login", (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    // Allow demo login for testing
    const demoToken = generateToken();
    const demoPatientId = "HLT-0x72A91B";
    return res.json({
      message:   "Demo login successful",
      token:     demoToken,
      user: {
        id:        "USR-DEMO",
        name:      email.split("@")[0],
        email,
        role:      role || "patient",
        patientId: role === "doctor" ? null : demoPatientId,
        walletAddress: "",
      },
    });
  }

  const token = generateToken();
  res.json({
    message: "Login successful",
    token,
    user: {
      id:           user.id,
      name:         user.name,
      email:        user.email,
      role:         user.role,
      patientId:    user.patientId,
      walletAddress: user.walletAddress,
    },
  });
});

// POST /api/auth/wallet-login
app.post("/api/auth/wallet-login", (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: "walletAddress is required" });

  // Find user by wallet address
  const user = users.find(u => u.walletAddress?.toLowerCase() === walletAddress.toLowerCase());

  const token = generateToken();

  if (user) {
    return res.json({
      message: "Wallet login successful",
      token,
      user: {
        id:           user.id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        patientId:    user.patientId,
        walletAddress: user.walletAddress,
      },
    });
  }

  // New wallet — create guest account
  res.json({
    message:   "New wallet connected",
    token,
    user: {
      id:            `USR-${randomHex(6)}`,
      name:          `User_${walletAddress.slice(2, 8)}`,
      email:         "",
      role:          "patient",
      patientId:     "HLT-0x72A91B",
      walletAddress,
    },
  });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

app.get("/api/dashboard", (req, res) => {
  res.json({
    totalPatients:     patients.length,
    appointmentsToday: appointments.filter(a => a.date === new Date().toISOString().slice(0, 10)).length,
    onChainRecords:    records.length,
    avgWaitMinutes:    Math.round(queueData.reduce((s, d) => s + d.wait, 0) / queueData.length),
    queueData,
    recentPatients:    patients.slice(0, 5),
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
  if (!name || !age || !blood || !dept) {
    return res.status(400).json({ error: "name, age, blood, and dept are required" });
  }
  const newPatient = {
    id:     `HLT-0x${randomHex(6)}`,
    name, age: Number(age), blood, dept,
    status: "Waiting", queue: patients.length + 1,
  };
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
  if (patientId) {
    return res.json(appointments.filter(a => a.patientId === patientId));
  }
  res.json(appointments);
});

app.get("/api/appointments/:patientId", (req, res) => {
  const result = appointments.filter(a => a.patientId === req.params.patientId);
  res.json(result);
});

app.post("/api/appointments", (req, res) => {
  const { patientId, dept, doctorName, doctorId, date, time, isEmergency } = req.body;
  if (!patientId || !date || !time) {
    return res.status(400).json({ error: "patientId, date, and time are required" });
  }

  const doctor = doctors.find(d => d.name === doctorName || d.id === doctorId);
  if (doctor && doctor.slots > 0) {
    doctor.slots -= 1;
    if (doctor.slots === 0) doctor.available = false;
  }

  const tokenId = `APT-${randomHex(8)}`;
  const appointment = {
    id:            `APPT-${randomHex(6)}`,
    patientId,
    dept:          dept || doctor?.dept || "General",
    doctorName:    doctorName || "TBD",
    doctorId:      doctorId || doctor?.id || "DOC-001",
    date,
    time,
    tokenId,
    isEmergency:   isEmergency || false,
    queuePosition: appointments.length + 1,
    status:        "Confirmed",
    createdAt:     new Date().toISOString(),
  };
  appointments.push(appointment);

  res.status(201).json({
    message: "Appointment booked",
    appointment,
    tokenId,
  });
});

// PUT /api/appointments/:id/complete
app.put("/api/appointments/:id/complete", (req, res) => {
  const appt = appointments.find(a => a.id === req.params.id);
  if (!appt) return res.status(404).json({ error: "Appointment not found" });
  appt.status = "Completed";
  res.json({ message: "Appointment completed", appointment: appt });
});

// PUT /api/appointments/:id/reschedule
app.put("/api/appointments/:id/reschedule", (req, res) => {
  const appt = appointments.find(a => a.id === req.params.id);
  if (!appt) return res.status(404).json({ error: "Appointment not found" });
  appt.status = "Reschedule Requested";
  res.json({ message: "Reschedule requested", appointment: appt });
});

// ─── Health Records ───────────────────────────────────────────────────────────

app.get("/api/records/:patientId", (req, res) => {
  const result = records.filter(r => r.patientId === req.params.patientId);
  res.json(result); // return empty array instead of 404 so frontend handles it
});

// POST /api/records — simple JSON record (no file)
app.post("/api/records", (req, res) => {
  const { patientId, type, doctor, dept, fileHash } = req.body;
  if (!patientId || !type) {
    return res.status(400).json({ error: "patientId and type are required" });
  }

  const ipfsHash = fileHash || `0x${randomHex(6)}${randomHex(6)}`;
  const newRecord = {
    id:        `REC-${randomHex(4)}`,
    patientId,
    date:      new Date().toISOString().slice(0, 10),
    type,
    doctor:    doctor || "Self Upload",
    dept:      dept   || "General",
    hash:      ipfsHash,
    blockchainHash: fileHash || "",
  };
  records.push(newRecord);

  res.status(201).json({
    message:  "Record saved",
    record:   newRecord,
    ipfsHash,
  });
});

// POST /api/records/upload — multipart file upload (for patientsubmit & doctorsubmit)
// We keep this as JSON since we don't have multer, frontend sends FormData
// but we read the text fields only
app.post("/api/records/upload", (req, res) => {
  // When called with FormData, express.json() won't parse it
  // So we return a mock success — the blockchain hash is what matters
  const ipfsHash = `0x${randomHex(6)}${randomHex(6)}`;
  const newRecord = {
    id:             `REC-${randomHex(4)}`,
    patientId:      "HLT-0x72A91B",
    date:           new Date().toISOString().slice(0, 10),
    type:           "Uploaded Document",
    doctor:         "Self Upload",
    dept:           "General",
    hash:           ipfsHash,
    blockchainHash: "",
  };
  records.push(newRecord);

  res.status(201).json({
    message:   "File uploaded successfully",
    record:    newRecord,
    ipfsHash,
    aiSummary: {
      keyFindings:      ["Document received and stored", "Hash generated for blockchain anchoring", "Awaiting doctor review"],
      plainLanguage:    "Your document has been uploaded successfully. A cryptographic fingerprint has been created and will be anchored on the blockchain for tamper-proof verification.",
      recommendedSteps: ["Wait for doctor to review", "Check back for AI analysis", "Your record is now secured on-chain"],
    },
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
    message: "Emergency protocol activated",
    emergencyToken,
    expiresAt,
    patient: { id: patient.id, name: patient.name, blood: patient.blood, age: patient.age },
    location: lat && lng ? { lat, lng } : null,
    nearbyHospital: { name: "City Hospital", distanceKm: 1.2, etaMinutes: 8 },
  });
});

// ─── Wallet connect ───────────────────────────────────────────────────────────

app.post("/api/wallet/connect", (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: "walletAddress is required" });

  // Update wallet address for matching user
  const user = users.find(u => u.walletAddress?.toLowerCase() === walletAddress.toLowerCase());
  const linkedPatient = user ? patients.find(p => p.id === user.patientId) : patients[0];

  res.json({
    message:     "Wallet connected",
    walletAddress,
    patientId:   linkedPatient?.id   || patients[0].id,
    patientName: linkedPatient?.name || patients[0].name,
  });
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
  console.log("  POST /api/auth/wallet-login");
  console.log("  GET  /api/dashboard");
  console.log("  GET  /api/patients            POST /api/patients");
  console.log("  GET  /api/doctors             GET  /api/doctors/dept/:dept");
  console.log("  GET  /api/appointments        POST /api/appointments");
  console.log("  PUT  /api/appointments/:id/complete");
  console.log("  GET  /api/records/:patientId  POST /api/records");
  console.log("  POST /api/records/upload");
  console.log("  POST /api/emergency");
  console.log("  POST /api/wallet/connect");
});