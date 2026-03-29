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

// ── Mount Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth",         require("./routes/auth"));
app.use("/api/patients",     require("./routes/patients"));
app.use("/api/doctors",      require("./routes/doctors"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/records",      require("./routes/records"));
app.use("/api/blockchain",   require("./routes/blockchain"));
app.use("/api/verification", require("./routes/verification"));

// ── Dashboard — pulls live counts from MongoDB ────────────────────────────────
app.get("/api/dashboard", require("./middleware/auth").protect, async (req, res) => {
  try {
    const User   = require("./models/User");
    const Appt   = require("./models/Appointment");
    const Record = require("./models/MedicalRecord");

    const today = new Date().toISOString().slice(0, 10);

    const [totalPatients, appointmentsToday, onChainRecords, totalDoctors] = await Promise.all([
      User.countDocuments({ role: "patient", isActive: true }),
      Appt.countDocuments({ date: today }),
      Record.countDocuments({ anchoredOnChain: true }),
      User.countDocuments({ role: "doctor",  isActive: true }),
    ]);

    // Queue data is computed per specialty from today's appointments
    const apptsBySpecialty = await Appt.aggregate([
      { $match: { date: today, status: { $in: ["pending", "confirmed"] } } },
      { $group: { _id: "$specialty", count: { $sum: 1 } } },
    ]);

    const queueData = apptsBySpecialty.map(a => ({
      dept:  a._id || "General",
      wait:  a.count * 15,  // rough: 15 min per appointment
      level: a.count > 5 ? "high" : a.count > 2 ? "medium" : "low",
    }));

    res.json({ totalPatients, appointmentsToday, onChainRecords, totalDoctors, queueData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Queue (based on today's appointments) ────────────────────────────────────
app.get("/api/queue", async (req, res) => {
  try {
    const Appt = require("./models/Appointment");
    const today = new Date().toISOString().slice(0, 10);
    const rows  = await Appt.aggregate([
      { $match: { date: today, status: { $in: ["pending", "confirmed"] } } },
      { $group: { _id: "$specialty", count: { $sum: 1 } } },
    ]);
    const result = rows.map(r => ({
      dept:  r._id || "General",
      wait:  r.count * 15,
      level: r.count > 5 ? "high" : r.count > 2 ? "medium" : "low",
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Emergency ─────────────────────────────────────────────────────────────────
app.post("/api/emergency", require("./middleware/auth").protect, async (req, res) => {
  try {
    const { patientId, lat, lng } = req.body;
    if (!patientId) return res.status(400).json({ error: "patientId is required" });

    const User = require("./models/User");
    const patient = await User.findOne({
      $or: [{ patientId }, { _id: patientId.match(/^[0-9a-f]{24}$/i) ? patientId : null }],
      role: "patient",
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
  }
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

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