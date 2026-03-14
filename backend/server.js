const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// ─── In-memory mock data (replace with DB in production) ──────────────────────

const patients = [
  { id: "HLT-0x72A91B", name: "Arjun Sharma",  age: 34, blood: "B+", dept: "Cardiology",   status: "Checked In",       queue: 3 },
  { id: "HLT-0x45F23C", name: "Priya Mehta",   age: 28, blood: "O+", dept: "Dermatology",  status: "Waiting",          queue: 7 },
  { id: "HLT-0x91D78E", name: "Ravi Kumar",    age: 52, blood: "A-", dept: "Orthopedics",  status: "In Consultation",  queue: 1 },
];

const doctors = [
  { id: "DOC-001", name: "Dr. Ananya Singh", dept: "Cardiology",   rating: 4.8, available: true,  slots: 3 },
  { id: "DOC-002", name: "Dr. Vikram Patel", dept: "Dermatology",  rating: 4.5, available: true,  slots: 6 },
  { id: "DOC-003", name: "Dr. Meena Roy",    dept: "Orthopedics",  rating: 4.9, available: false, slots: 0 },
  { id: "DOC-004", name: "Dr. Suresh Nair",  dept: "Neurology",    rating: 4.7, available: true,  slots: 2 },
];

const records = [
  { id: "REC-001", patientId: "HLT-0x72A91B", date: "2024-03-12", type: "Prescription",     doctor: "Dr. Ananya Singh", hash: "0xabc123def456", dept: "Cardiology"   },
  { id: "REC-002", patientId: "HLT-0x72A91B", date: "2024-07-05", type: "Lab Report",        doctor: "Dr. Vikram Patel", hash: "0xdef456ghi789", dept: "Dermatology"  },
  { id: "REC-003", patientId: "HLT-0x72A91B", date: "2025-01-20", type: "X-Ray",             doctor: "Dr. Meena Roy",    hash: "0xghi789jkl012", dept: "Orthopedics"  },
  { id: "REC-004", patientId: "HLT-0x72A91B", date: "2025-11-08", type: "Discharge Summary", doctor: "Dr. Suresh Nair",  hash: "0xjkl012mno345", dept: "Neurology"    },
];

const appointments = [];

const queueData = [
  { dept: "Cardiology",   wait: 30, level: "medium" },
  { dept: "Dermatology",  wait: 10, level: "low"    },
  { dept: "Orthopedics",  wait: 90, level: "high"   },
  { dept: "Neurology",    wait: 20, level: "low"    },
  { dept: "Pediatrics",   wait: 45, level: "medium" },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function randomHex(len = 8) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join("").toUpperCase();
}

// ─── Health check ─────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "MediChain Blockchain Backend Running" });
});

// ─── Dashboard stats ──────────────────────────────────────────────────────────
// GET /api/dashboard
// Returns top-level stats shown on the Dashboard tab

app.get("/api/dashboard", (req, res) => {
  res.json({
    totalPatients:      patients.length,
    appointmentsToday:  appointments.filter(a => a.date === new Date().toISOString().slice(0, 10)).length,
    onChainRecords:     records.length,
    avgWaitMinutes:     Math.round(queueData.reduce((s, d) => s + d.wait, 0) / queueData.length),
    queueData,
    recentPatients:     patients.slice(0, 5),
  });
});

// ─── Patients ─────────────────────────────────────────────────────────────────
// GET  /api/patients          — list all patients
// GET  /api/patients/:id      — single patient profile
// POST /api/patients          — register new patient

app.get("/api/patients", (req, res) => {
  res.json(patients);
});

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
    name,
    age:    Number(age),
    blood,
    dept,
    status: "Waiting",
    queue:  patients.length + 1,
  };
  patients.push(newPatient);
  res.status(201).json({ message: "Patient registered", patient: newPatient });
});

// ─── Doctors ──────────────────────────────────────────────────────────────────
// GET /api/doctors              — list all doctors
// GET /api/doctors/:id          — single doctor
// GET /api/doctors/dept/:dept   — doctors by department

app.get("/api/doctors", (req, res) => {
  res.json(doctors);
});

app.get("/api/doctors/dept/:dept", (req, res) => {
  const result = doctors.filter(
    d => d.dept.toLowerCase() === req.params.dept.toLowerCase()
  );
  res.json(result);
});

app.get("/api/doctors/:id", (req, res) => {
  const doctor = doctors.find(d => d.id === req.params.id);
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  res.json(doctor);
});

// ─── Appointments ─────────────────────────────────────────────────────────────
// GET  /api/appointments              — all appointments
// GET  /api/appointments/:patientId   — appointments for one patient
// POST /api/appointments              — book a new appointment (mints NFT token)

app.get("/api/appointments", (req, res) => {
  res.json(appointments);
});

app.get("/api/appointments/:patientId", (req, res) => {
  const result = appointments.filter(a => a.patientId === req.params.patientId);
  res.json(result);
});

app.post("/api/appointments", (req, res) => {
  const { patientId, dept, doctorName, date, time } = req.body;
  if (!patientId || !dept || !doctorName || !date || !time) {
    return res.status(400).json({ error: "patientId, dept, doctorName, date, and time are required" });
  }

  // Decrement available slots for the doctor
  const doctor = doctors.find(d => d.name === doctorName);
  if (doctor) {
    if (!doctor.available || doctor.slots <= 0) {
      return res.status(409).json({ error: "Doctor has no available slots" });
    }
    doctor.slots -= 1;
    if (doctor.slots === 0) doctor.available = false;
  }

  const tokenId = `APT-${randomHex(8)}`;
  const appointment = {
    id:        `APPT-${randomHex(6)}`,
    patientId,
    dept,
    doctorName,
    date,
    time,
    tokenId,
    queuePosition: appointments.length + 1,
    status:    "Confirmed",
    createdAt: new Date().toISOString(),
  };
  appointments.push(appointment);

  res.status(201).json({
    message:     "Appointment booked & NFT token minted",
    appointment,
    tokenId,
  });
});

// ─── Health Records ───────────────────────────────────────────────────────────
// GET  /api/records/:patientId   — all records for a patient
// POST /api/records              — upload a new document (simulate IPFS hash)

app.get("/api/records/:patientId", (req, res) => {
  const result = records.filter(r => r.patientId === req.params.patientId);
  if (!result.length) return res.status(404).json({ error: "No records found for this patient" });
  res.json(result);
});

app.post("/api/records", (req, res) => {
  const { patientId, type, doctor, dept } = req.body;
  if (!patientId || !type || !doctor || !dept) {
    return res.status(400).json({ error: "patientId, type, doctor, and dept are required" });
  }

  // Simulate IPFS hash generation
  const ipfsHash = `0x${randomHex(6)}${randomHex(6)}`;
  const newRecord = {
    id:        `REC-${randomHex(4)}`,
    patientId,
    date:      new Date().toISOString().slice(0, 10),
    type,
    doctor,
    dept,
    hash:      ipfsHash,
  };
  records.push(newRecord);

  res.status(201).json({
    message: "Document uploaded to IPFS & recorded on-chain",
    record:  newRecord,
    ipfsHash,
  });
});

// ─── Queue ────────────────────────────────────────────────────────────────────
// GET /api/queue              — live queue across all departments
// GET /api/queue/:dept        — queue for a specific department

app.get("/api/queue", (req, res) => {
  res.json(queueData);
});

app.get("/api/queue/:dept", (req, res) => {
  const entry = queueData.find(
    q => q.dept.toLowerCase() === req.params.dept.toLowerCase()
  );
  if (!entry) return res.status(404).json({ error: "Department not found" });
  res.json(entry);
});

// ─── Emergency SOS ────────────────────────────────────────────────────────────
// POST /api/emergency   — activate emergency protocol & return a one-time token
//   body: { patientId, lat?, lng? }

app.post("/api/emergency", (req, res) => {
  const { patientId, lat, lng } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId is required" });

  const patient = patients.find(p => p.id === patientId);
  if (!patient) return res.status(404).json({ error: "Patient not found" });

  const emergencyToken = `EMR-${randomHex(8)}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hrs

  res.status(201).json({
    message:        "Emergency protocol activated",
    emergencyToken,
    expiresAt,
    patient: {
      id:       patient.id,
      name:     patient.name,
      blood:    patient.blood,
      age:      patient.age,
    },
    location:       lat && lng ? { lat, lng } : null,
    nearbyHospital: { name: "City Hospital", distanceKm: 1.2, etaMinutes: 8 },
  });
});

// ─── Wallet / Auth (stub) ─────────────────────────────────────────────────────
// POST /api/wallet/connect   — verify wallet address & return patient link
//   body: { walletAddress }

app.post("/api/wallet/connect", (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: "walletAddress is required" });

  // In production: verify signature / ENS lookup
  const linkedPatient = patients[0]; // mock — always links to first patient
  res.json({
    message:       "Wallet connected",
    walletAddress,
    patientId:     linkedPatient.id,
    patientName:   linkedPatient.name,
  });
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`MediChain backend running on http://localhost:${PORT}`);
  console.log("Available routes:");
  console.log("  GET  /api/dashboard");
  console.log("  GET  /api/patients            POST /api/patients");
  console.log("  GET  /api/patients/:id");
  console.log("  GET  /api/doctors             GET  /api/doctors/:id");
  console.log("  GET  /api/doctors/dept/:dept");
  console.log("  GET  /api/appointments/:pid   POST /api/appointments");
  console.log("  GET  /api/records/:pid        POST /api/records");
  console.log("  GET  /api/queue               GET  /api/queue/:dept");
  console.log("  POST /api/emergency");
  console.log("  POST /api/wallet/connect");
});