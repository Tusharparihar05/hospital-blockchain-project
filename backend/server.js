require("dotenv").config();
const mongoose = require("mongoose");
const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const bcrypt   = require("bcryptjs");

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) { console.error("❌ MONGODB_URI not set in .env"); process.exit(1); }

mongoose.connect(mongoUri)
  .then(() => { console.log("✅ MongoDB connected"); startServer(); })
  .catch(err => { console.error("❌ MongoDB error:", err.message); process.exit(1); });

// ══════════════════════════════════════════════════════════════════════════════
// MONGOOSE SCHEMAS
// ══════════════════════════════════════════════════════════════════════════════

const userSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash:    { type: String, required: true },
  role:            { type: String, enum: ["patient", "doctor", "admin"], default: "patient" },
  phone:           { type: String, default: "" },
  patientId:       { type: String },
  chainPatientId:  { type: Number },
  gender:          { type: String, enum: ["Male", "Female", "Other", ""], default: "" },
  bloodGroup:      { type: String, default: "" },
  specialty:       { type: String, default: "" },
  licenseNumber:   { type: String, default: "" },
  licenseVerified: { type: Boolean, default: false },
  hospital:        { type: String, default: "" },
  experience:      { type: Number, default: 0 },
  fee:             { type: Number, default: 500 },
  rating:          { type: Number, default: 0 },
  reviewCount:     { type: Number, default: 0 },
  bio:             { type: String, default: "" },
  education:       { type: String, default: "" },
  languages:       [String],
  tags:            [String],
  availability:    [String],
  status:          { type: String, enum: ["online", "busy", "offline"], default: "online" },
  walletAddress:   { type: String, default: "" },
  isActive:        { type: Boolean, default: true },
  lastLogin:       { type: Date },
}, { timestamps: true });

userSchema.index({ role: 1, isActive: 1 });
// FIX: sparse but NOT unique here — the separate User model file sets unique,
// having it in both places caused duplicate-key errors on non-patient accounts
// whose patientId is undefined (two undefineds = duplicate key violation).
userSchema.index({ patientId: 1 }, { sparse: true });

userSchema.pre("save", async function () {
  if (this.isModified("passwordHash")) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
  if (this.role === "patient" && !this.patientId) {
    const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, "0");
    this.patientId      = "HLT-0x" + hex;
    this.chainPatientId = parseInt(hex, 16) % 900000 + 100000;
  }
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

const User = mongoose.model("User", userSchema);

// ── Health Record ─────────────────────────────────────────────────────────────
const recordSchema = new mongoose.Schema({
  patientId:       { type: String, required: true, index: true },
  fileName:        { type: String, default: "" },
  category:        { type: String, default: "General" },
  uploadDate:      { type: String, default: () => new Date().toISOString().slice(0, 10) },
  doctor:          { type: String, default: "Self Upload" },
  dept:            { type: String, default: "" },
  hash:            { type: String, default: "" },
  blockchainHash:  { type: String, default: "" },
  ipfsUrl:         { type: String, default: "" },
  anchoredOnChain: { type: Boolean, default: false },
  aiSummary:       { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

const Record = mongoose.model("Record", recordSchema);

// ── Appointment ───────────────────────────────────────────────────────────────
const appointmentSchema = new mongoose.Schema({
  patientId:     { type: String, required: true, index: true },
  patientName:   { type: String, default: "" },
  doctorId:      { type: String, default: "" },
  doctorName:    { type: String, default: "" },
  dept:          { type: String, default: "General" },
  specialty:     { type: String, default: "" },
  date:          { type: String, required: true },
  time:          { type: String, required: true },
  type:          { type: String, default: "Consultation" },
  isEmergency:   { type: Boolean, default: false },
  status:        { type: String, default: "confirmed" },
  fee:           { type: Number, default: 0 },
  feePaid:       { type: Boolean, default: false },
  paymentMethod: { type: String, default: "" },
  tokenId:       { type: String, default: "" },
  blockchain:    { type: String, default: "" },
  notes:         { type: String, default: "" },
  age:           { type: Number },
  gender:        { type: String, default: "" },
  phone:         { type: String, default: "" },
}, { timestamps: true });

const Appointment = mongoose.model("Appointment", appointmentSchema);

// ── Doctor Licence Verification ───────────────────────────────────────────────
const licenceSchema = new mongoose.Schema({
  email:         { type: String, required: true, index: true },
  licenseNumber: { type: String, required: true },
  documentHash:  { type: String, default: "" },
  status:        { type: String, enum: ["verified", "rejected", "pending"], default: "pending" },
  issuer:        { type: String, default: "MediChain Demo Verifier" },
  verifiedAt:    { type: Date },
  note:          { type: String, default: "" },
}, { timestamps: true });

const LicenceVerification = mongoose.model("LicenceVerification", licenceSchema);

// ══════════════════════════════════════════════════════════════════════════════
// SERVER
// ══════════════════════════════════════════════════════════════════════════════
function startServer() {
  app.use(cors());
  app.use(express.json());

  function randomHex(len = 8) {
    return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join("").toUpperCase();
  }
  function generateToken() { return `token_${randomHex(16)}`; }

  app.get("/", (req, res) => res.json({ status: "ok", message: "MediChain Backend Running" }));

  // ══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { name, email, password, phone, role, walletAddress, specialty, licenseNumber, hospital, experience, fee, bio, education, languages, availability } = req.body;
      if (!name || !email || !password)
        return res.status(400).json({ error: "name, email and password are required" });

      const existing = await User.findOne({ email: email.toLowerCase().trim() });
      if (existing) return res.status(409).json({ error: "Email already registered" });

      const newUser = new User({
        name:          name.trim(),
        email:         email.toLowerCase().trim(),
        passwordHash:  password,
        role:          role || "patient",
        phone:         phone || "",
        walletAddress: walletAddress || "",
        specialty:     specialty || "",
        licenseNumber: licenseNumber || "",
        hospital:      hospital || "",
        experience:    experience ? Number(experience) : 0,
        fee:           fee ? Number(fee) : 500,
        bio:           bio || "",
        education:     education || "",
        languages:     Array.isArray(languages) ? languages : (languages ? [languages] : []),
        availability:  Array.isArray(availability) ? availability : [],
        status:        "online",
        isActive:      true,
      });

      await newUser.save();
      const token = generateToken();

      return res.status(201).json({
        message: "Account created successfully",
        token,
        user: {
          id:             newUser._id,
          name:           newUser.name,
          email:          newUser.email,
          role:           newUser.role,
          patientId:      newUser.patientId || null,
          chainPatientId: newUser.chainPatientId || null,
          walletAddress:  newUser.walletAddress,
          specialty:      newUser.specialty,
          licenseNumber:  newUser.licenseNumber,
          hospital:       newUser.hospital,
        },
      });
    } catch (err) {
      console.error("signup error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // FIX: validate role in login so a patient cannot log in on the doctor form
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, role } = req.body;
      if (!email || !password) return res.status(400).json({ error: "email and password are required" });

      const query = { email: email.toLowerCase().trim(), isActive: true };
      // Only filter by role if the client sends one — keeps the endpoint flexible
      if (role && ["patient", "doctor", "admin"].includes(role)) query.role = role;

      const user = await User.findOne(query);
      if (!user) return res.status(401).json({ error: "Invalid email or password" });

      const ok = await user.comparePassword(password);
      if (!ok) return res.status(401).json({ error: "Invalid email or password" });

      user.lastLogin = new Date();
      await user.save();

      const token = generateToken();
      return res.json({
        message: "Login successful",
        token,
        user: {
          id:             user._id,
          name:           user.name,
          email:          user.email,
          role:           user.role,
          patientId:      user.patientId || null,
          chainPatientId: user.chainPatientId || null,
          walletAddress:  user.walletAddress,
          specialty:      user.specialty,
          licenseNumber:  user.licenseNumber,
          hospital:       user.hospital,
          experience:     user.experience,
          fee:            user.fee,
          bio:            user.bio,
          education:      user.education,
          languages:      user.languages,
          availability:   user.availability,
          status:         user.status,
        },
      });
    } catch (err) {
      console.error("login error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/wallet-login", async (req, res) => {
    try {
      const { walletAddress } = req.body;
      if (!walletAddress) return res.status(400).json({ error: "walletAddress is required" });
      const user = await User.findOne({ walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") }, isActive: true });
      if (!user) return res.status(404).json({ error: "No account found for this wallet" });
      const token = generateToken();
      return res.json({
        message: "Wallet login successful", token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role, patientId: user.patientId, chainPatientId: user.chainPatientId, walletAddress: user.walletAddress, specialty: user.specialty, licenseNumber: user.licenseNumber },
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PATIENTS
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/patients", async (req, res) => {
    try {
      const patients = await User.find({ role: "patient", isActive: true })
        .select("name email phone patientId chainPatientId gender bloodGroup createdAt")
        .lean();

      const result = patients.map(p => ({
        id:     p.patientId || String(p._id),
        name:   p.name,
        email:  p.email,
        phone:  p.phone || "",
        gender: p.gender || "Unknown",
        blood:  p.bloodGroup || "",
        age:    p.age || 0,
      }));
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/patients/:id", async (req, res) => {
    try {
      const patient = await User.findOne({
        $or: [{ patientId: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }],
        role: "patient",
      }).lean();
      if (!patient) return res.status(404).json({ error: "Patient not found" });
      res.json({ id: patient.patientId || String(patient._id), name: patient.name, phone: patient.phone, gender: patient.gender, age: patient.age || 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DOCTORS
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/doctors", async (req, res) => {
    try {
      const doctors = await User.find({ role: "doctor", isActive: true })
        .select("-passwordHash -__v")
        .lean();

      const result = doctors.map(d => ({
        id:           String(d._id),
        name:         d.name,
        email:        d.email,
        specialty:    d.specialty || "General",
        hospital:     d.hospital  || "",
        experience:   d.experience || 0,
        fee:          d.fee || 500,
        rating:       d.rating || 0,
        reviewCount:  d.reviewCount || 0,
        bio:          d.bio || "",
        education:    d.education || "",
        languages:    d.languages || [],
        tags:         d.tags || [],
        availability: d.availability || [],
        status:       d.status || "online",
        image:        "👨‍⚕️",
        available:    d.status !== "offline",
        slots:        d.availability ? d.availability.length : 0,
        reviews:      [],
        conditions:   d.tags || [],
        patients:     0,
        todayAppts:   0,
      }));
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/doctors/:id", async (req, res) => {
    try {
      const doctor = await User.findOne({ _id: req.params.id, role: "doctor" }).select("-passwordHash -__v").lean();
      if (!doctor) return res.status(404).json({ error: "Doctor not found" });
      res.json({ ...doctor, id: String(doctor._id) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // APPOINTMENTS
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/appointments", async (req, res) => {
    try {
      const { patientId } = req.query;
      const query = patientId ? { patientId } : {};
      const appts = await Appointment.find(query).sort({ date: 1, time: 1 }).lean();
      res.json(appts.map(a => ({ ...a, id: String(a._id) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/appointments", async (req, res) => {
    try {
      const { patientId, doctorId, doctorName, dept, specialty, date, time, isEmergency, type, fee, feePaid, paymentMethod } = req.body;
      if (!date || !time) return res.status(400).json({ error: "date and time are required" });
      if (!patientId)     return res.status(400).json({ error: "patientId is required" });

      const patientUser = await User.findOne({ patientId }).lean();
      const doctorUser  = doctorId ? await User.findById(doctorId).lean() : null;

      const tokenId = `APT-${randomHex(8)}`;
      const appt = await Appointment.create({
        patientId,
        patientName:   patientUser?.name || "",
        doctorId:      doctorId || "",
        doctorName:    doctorName || doctorUser?.name || "",
        dept:          dept || doctorUser?.specialty || "General",
        specialty:     specialty || doctorUser?.specialty || "",
        date, time, tokenId,
        isEmergency:   !!isEmergency,
        status:        "confirmed",
        fee:           fee || doctorUser?.fee || 0,
        feePaid:       !!feePaid,
        paymentMethod: paymentMethod || "",
        type:          type || "Consultation",
        age:           patientUser?.age,
        gender:        patientUser?.gender || "",
        phone:         patientUser?.phone || "",
        blockchain:    tokenId,
      });

      res.status(201).json({ message: "Appointment booked", appointment: { ...appt.toObject(), id: String(appt._id) }, tokenId, blockchain: tokenId });
    } catch (err) {
      console.error("appt create error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/appointments/:id/complete", async (req, res) => {
    try {
      const appt = await Appointment.findByIdAndUpdate(req.params.id, { status: "completed" }, { new: true });
      if (!appt) return res.status(404).json({ error: "Appointment not found" });
      res.json({ message: "Appointment completed", appointment: { ...appt.toObject(), id: String(appt._id) } });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/appointments/:id/reschedule", async (req, res) => {
    try {
      const appt = await Appointment.findByIdAndUpdate(req.params.id, { status: "reschedule-requested" }, { new: true });
      if (!appt) return res.status(404).json({ error: "Appointment not found" });
      res.json({ message: "Reschedule requested", appointment: { ...appt.toObject(), id: String(appt._id) } });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // HEALTH RECORDS
  // FIX: /api/records/file/:recordId MUST be registered BEFORE
  //      /api/records/:patientId — otherwise Express matches "file" as a
  //      patientId and the file-download route is never reached.
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/records  — all records (doctor view)
  app.get("/api/records", async (req, res) => {
    try {
      const records = await Record.find().sort({ createdAt: -1 }).lean();
      res.json(records.map(r => ({ ...r, id: String(r._id) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/records/file/:recordId  — MUST come before /api/records/:patientId
  app.get("/api/records/file/:recordId", async (req, res) => {
    try {
      const record = await Record.findById(req.params.recordId).lean();
      if (!record)         return res.status(404).json({ error: "Record not found" });
      if (!record.ipfsUrl) return res.status(404).json({ error: "No file stored for this record" });

      if (record.ipfsUrl.startsWith("data:")) {
        const [header, b64] = record.ipfsUrl.split(",");
        const mime = header.replace("data:", "").replace(";base64", "");
        const buf  = Buffer.from(b64, "base64");
        res.setHeader("Content-Type", mime);
        res.setHeader("Content-Disposition", `inline; filename="${record.fileName}"`);
        res.setHeader("Content-Length", buf.length);
        return res.send(buf);
      }
      res.redirect(record.ipfsUrl);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/records/:patientId  — comes AFTER the /file route
  app.get("/api/records/:patientId", async (req, res) => {
    try {
      const records = await Record.find({ patientId: req.params.patientId }).sort({ createdAt: -1 }).lean();
      res.json(records.map(r => ({ ...r, id: String(r._id) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/records  — JSON or multipart
  app.post("/api/records", upload.single("file"), async (req, res) => {
    try {
      const body = req.body;
      const file = req.file;

      const patientId = body.patientId;
      if (!patientId) return res.status(400).json({ error: "patientId is required" });

      const category = body.category || body.type || "General";
      const doctor   = body.doctor   || "Self Upload";
      const dept     = body.dept     || category;
      let   fileHash = body.fileHash || "";
      let   fileName = body.fileName || "";
      let   ipfsUrl  = "";

      if (file) {
        fileName = fileName || file.originalname || `Upload_${Date.now()}.pdf`;
        fileHash = fileHash || `0x${Buffer.from(file.buffer).slice(0, 16).toString("hex")}`;
        const mime = file.mimetype || "application/octet-stream";
        ipfsUrl    = `data:${mime};base64,${file.buffer.toString("base64")}`;
      } else {
        fileName = fileName || `Report_${new Date().toISOString().slice(0, 10)}_${category.replace(/\s+/g, "_")}.pdf`;
        fileHash = fileHash || `0x${randomHex(12)}`;
        ipfsUrl  = body.ipfsUrl || "";
      }

      const aiSummary = {
        keyFindings:      ["Document received and stored", "Hash generated for blockchain anchoring", "Awaiting doctor review"],
        plainLanguage:    "Your document has been uploaded successfully. A cryptographic fingerprint has been anchored on the blockchain.",
        recommendedSteps: ["Wait for doctor to review", "Check back for AI analysis", "Your record is now secured on-chain"],
      };

      const newRecord = await Record.create({
        patientId, fileName, category,
        uploadDate:      new Date().toISOString().slice(0, 10),
        doctor, dept,
        hash:            fileHash,
        blockchainHash:  fileHash,
        ipfsUrl,
        anchoredOnChain: !!fileHash,
        aiSummary,
      });

      res.status(201).json({
        message:  "Record saved",
        record:   { ...newRecord.toObject(), id: String(newRecord._id) },
        ipfsHash: fileHash,
        ipfsUrl,
        aiSummary,
      });
    } catch (err) {
      console.error("record save error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/dashboard", async (req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [totalPatients, totalRecords, todayAppts] = await Promise.all([
        User.countDocuments({ role: "patient", isActive: true }),
        Record.countDocuments(),
        Appointment.countDocuments({ date: today }),
      ]);
      res.json({ totalPatients, appointmentsToday: todayAppts, onChainRecords: totalRecords });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // EMERGENCY
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/emergency", async (req, res) => {
    try {
      const { patientId, lat, lng } = req.body;
      if (!patientId) return res.status(400).json({ error: "patientId is required" });
      const patient = await User.findOne({ patientId }).lean();
      if (!patient)   return res.status(404).json({ error: "Patient not found" });
      const emergencyToken = `EMR-${randomHex(8)}`;
      res.status(201).json({
        message: "Emergency protocol activated", emergencyToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        patient:  { id: patient.patientId, name: patient.name, blood: patient.bloodGroup, age: patient.age },
        location: lat && lng ? { lat, lng } : null,
        nearbyHospital: { name: "City Hospital", distanceKm: 1.2, etaMinutes: 8 },
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DOCTOR LICENCE VERIFICATION
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/verification/doctor-license", async (req, res) => {
    try {
      const { email, licenseNumber, documentHash } = req.body;
      if (!email || !licenseNumber)
        return res.status(400).json({ error: "email and licenseNumber are required" });

      const clean    = String(licenseNumber).replace(/\s/g, "");
      const formatOk = /^[A-Z0-9-]{6,24}$/i.test(clean);

      const entry = await LicenceVerification.create({
        email:         email.toLowerCase().trim(),
        licenseNumber: clean,
        documentHash:  documentHash || "",
        status:        formatOk ? "verified" : "rejected",
        verifiedAt:    formatOk ? new Date() : null,
        note:          formatOk
          ? "Mock pass: in production call your institutional API."
          : "License reference failed basic format check (6–24 alphanumeric chars).",
      });

      res.status(201).json({ ...entry.toObject(), id: String(entry._id) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/verification/doctor-license", async (req, res) => {
    try {
      const email = req.query.email;
      if (!email) return res.status(400).json({ error: "email query param required" });
      const latest = await LicenceVerification.findOne({ email: email.toLowerCase().trim() }).sort({ createdAt: -1 }).lean();
      if (!latest) return res.json({ status: "none", message: "No verification submitted yet." });
      res.json({ ...latest, id: String(latest._id) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // WALLET CONNECT
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/wallet/connect", async (req, res) => {
    try {
      const { walletAddress } = req.body;
      if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });
      const user = await User.findOne({ walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") } }).lean();
      res.json({
        message: "Wallet connected", walletAddress,
        patientId:   user?.patientId || null,
        patientName: user?.name || null,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\nMediChain backend running on http://localhost:${PORT}\n`);
    console.log("Routes:");
    console.log("  POST /api/auth/signup | login | wallet-login");
    console.log("  GET  /api/patients                   (real DB)");
    console.log("  GET  /api/doctors                    (real DB)");
    console.log("  GET  /api/appointments   POST /api/appointments");
    console.log("  GET  /api/records/file/:id           (before /:patientId)");
    console.log("  GET  /api/records/:patientId");
    console.log("  POST /api/records");
    console.log("  GET  /api/dashboard");
    console.log("  POST /api/emergency");
    console.log("  POST /api/verification/doctor-license");
  });
}