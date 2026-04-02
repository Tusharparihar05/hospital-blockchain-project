require("dotenv").config();
const mongoose = require("mongoose");
const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) { console.error("❌ MONGODB_URI not set in .env"); process.exit(1); }
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET not set in .env");
  process.exit(1);
}

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
  patientStrId:    { type: String, default: "" },
  uploadedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  fileName:        { type: String, default: "" },
  category:        { type: String, default: "General" },
  uploadDate:      { type: String, default: () => new Date().toISOString().slice(0, 10) },
  doctor:          { type: String, default: "Self Upload" },
  dept:            { type: String, default: "" },
  fileHash:        { type: String, default: "" },
  blockchainHash:  { type: String, default: "" },
  blockchainTx:    { type: String, default: "" },
  ipfsCid:         { type: String, default: "" },
  ipfsUrl:         { type: String, default: "" },
  anchoredOnChain: { type: Boolean, default: false },
  anchoredAt:      { type: Date },
  doctorNotes:     { type: String, default: "" },
  aiSummary:       { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

const MedicalRecord = mongoose.model("MedicalRecord", recordSchema);

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
// BLOCKCHAIN — PatientRecords contract (optional)
// ══════════════════════════════════════════════════════════════════════════════
let _patientRecordsContract = null;

const PATIENT_RECORDS_ABI = [
  "function anchorRecord(uint256 patientId, bytes32 fileHash, string calldata category, string calldata fileName) external",
  "function isAnchored(bytes32 fileHash) external view returns (bool)",
];

function getPatientRecordsContract() {
  if (_patientRecordsContract) return _patientRecordsContract;
  const rpc  = process.env.BLOCKCHAIN_RPC_URL;
  const pk   = process.env.DEPLOYER_PRIVATE_KEY;
  const addr = process.env.PATIENT_RECORDS_ADDRESS;
  if (!rpc || !pk || !addr) return null;
  try {
    const { ethers } = require("ethers");
    const provider   = new ethers.JsonRpcProvider(rpc);
    const signer     = new ethers.Wallet(pk, provider);
    _patientRecordsContract = new ethers.Contract(addr, PATIENT_RECORDS_ABI, signer);
    return _patientRecordsContract;
  } catch (err) {
    console.warn("[blockchain] contract init failed:", err.message);
    return null;
  }
}

async function anchorOnChain(chainPatientId, fileHash, category, fileName) {
  try {
    const contract = getPatientRecordsContract();
    if (!contract) {
      return { success: false, anchored: false, reason: "Blockchain not configured" };
    }
    const { ethers } = require("ethers");
    const already = await contract.isAnchored(fileHash);
    if (already) return { success: true, anchored: true, alreadyAnchored: true };
    const tx      = await contract.anchorRecord(
      Number(chainPatientId), fileHash, category || "general", fileName || "unknown"
    );
    const receipt = await tx.wait();
    return { success: true, anchored: true, txHash: tx.hash, block: receipt.blockNumber };
  } catch (err) {
    console.error("[anchorOnChain]", err.message);
    return { success: false, anchored: false, reason: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ✅ WAV HEADER BUILDER — converts raw PCM from Gemini TTS to playable WAV
// ══════════════════════════════════════════════════════════════════════════════
function buildWavBuffer(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate    = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign  = numChannels * (bitsPerSample / 8);
  const dataSize    = pcmBuffer.length;
  const headerSize  = 44;
  const wavBuffer   = Buffer.alloc(headerSize + dataSize);

  // RIFF chunk
  wavBuffer.write("RIFF", 0);
  wavBuffer.writeUInt32LE(36 + dataSize, 4);
  wavBuffer.write("WAVE", 8);

  // fmt sub-chunk
  wavBuffer.write("fmt ", 12);
  wavBuffer.writeUInt32LE(16, 16);           // PCM sub-chunk size
  wavBuffer.writeUInt16LE(1, 20);            // AudioFormat = PCM
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(blockAlign, 32);
  wavBuffer.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  wavBuffer.write("data", 36);
  wavBuffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(wavBuffer, 44);

  return wavBuffer;
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ══════════════════════════════════════════════════════════════════════════════
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return res.status(401).json({ error: "No token provided" });
    const token   = header.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select("-passwordHash");
    if (!user || !user.isActive) return res.status(401).json({ error: "User not found or deactivated" });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ✅ GROQ AI HELPER
// ══════════════════════════════════════════════════════════════════════════════
async function analyzeWithGroq({ reportText, imageBase64, reportType, preferredLanguage, explainLevel, voiceFriendly }) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not set in .env");

  const imageNote = imageBase64
    ? "\n\nNote: The user uploaded an image. Please analyze it as a medical report image and extract all visible medical values, test results, and findings."
    : "";

  const prompt = `You are an advanced AI medical assistant. Analyze the following medical report and respond ONLY with a valid JSON object. No markdown, no backticks, no explanation outside the JSON.

Report Type: ${reportType || "General"}
Preferred Language: ${preferredLanguage || "English"}
Explanation Level: ${explainLevel || "simple"}

The JSON must have EXACTLY these fields:
{
  "language": "${preferredLanguage || "English"}",
  "summary": "A ${explainLevel === "simple" ? "simple, plain-language" : "detailed medical"} summary in ${preferredLanguage || "English"}. 3-5 sentences.",
  "detailedExplanation": "A deeper explanation in ${preferredLanguage || "English"}. 2-4 sentences.",
  "voiceText": ${voiceFriendly !== false ? `"A short, friendly voice summary in ${preferredLanguage || "English"}. 2-3 sentences."` : "null"},
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "abnormalValues": [
    { "name": "Parameter name", "value": "e.g. 10 g/dL", "status": "High | Low | Normal", "meaning": "Plain-language meaning in ${preferredLanguage || "English"}" }
  ],
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "precautions": ["precaution 1", "precaution 2"]
}

Rules:
- All text must be in ${preferredLanguage || "English"}
- abnormalValues: ONLY include values that are NOT normal
- keyFindings: 3-6 important observations
- recommendedActions: 3-5 practical steps
- precautions: 2-4 warnings
- Always end summary with: "Please consult a healthcare professional for medical decisions."
- Respond with ONLY the JSON object, nothing else.

Medical Report to analyze:
${reportText}${imageNote}`;

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: "You are a medical report analyst. Always respond with ONLY a valid JSON object. No markdown, no backticks, no explanation outside the JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!groqRes.ok) {
    const errData = await groqRes.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Groq API error: ${groqRes.status}`);
  }

  const data    = await groqRes.json();
  const rawText = data.choices?.[0]?.message?.content || "";
  const cleaned = rawText.replace(/```json|```/gi, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Groq returned invalid JSON. Please try again.");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SERVER
// ══════════════════════════════════════════════════════════════════════════════
function startServer() {
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  function randomHex(len = 8) {
    return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join("").toUpperCase();
  }

  function generateToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
  }

  app.get("/", (req, res) => res.json({ status: "ok", message: "MediChain Backend Running ✅" }));

  // ══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const {
        name, email, password, phone, role,
        walletAddress, specialty, licenseNumber,
        hospital, experience, fee, bio, education, languages, availability,
      } = req.body;

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
        languages:     Array.isArray(languages)    ? languages    : (languages    ? [languages]    : []),
        availability:  Array.isArray(availability) ? availability : [],
        status:        "online",
        isActive:      true,
      });

      await newUser.save();
      const token = generateToken(newUser._id);

      return res.status(201).json({
        message: "Account created successfully",
        token,
        user: {
          id:             String(newUser._id),
          name:           newUser.name,
          email:          newUser.email,
          role:           newUser.role,
          patientId:      newUser.patientId      || null,
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

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, role } = req.body;
      if (!email || !password) return res.status(400).json({ error: "email and password are required" });

      const query = { email: email.toLowerCase().trim(), isActive: true };
      if (role && ["patient", "doctor", "admin"].includes(role)) query.role = role;

      const user = await User.findOne(query);
      if (!user) return res.status(401).json({ error: "Invalid email or password" });

      const ok = await user.comparePassword(password);
      if (!ok) return res.status(401).json({ error: "Invalid email or password" });

      user.lastLogin = new Date();
      await user.save();

      const token = generateToken(user._id);
      return res.json({
        message: "Login successful",
        token,
        user: {
          id:             String(user._id),
          name:           user.name,
          email:          user.email,
          role:           user.role,
          patientId:      user.patientId      || null,
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
      const user = await User.findOne({
        walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") },
        isActive: true,
      });
      if (!user) return res.status(404).json({ error: "No account found for this wallet" });
      const token = generateToken(user._id);
      return res.json({
        message: "Wallet login successful",
        token,
        user: {
          id:             String(user._id),
          name:           user.name,
          email:          user.email,
          role:           user.role,
          patientId:      user.patientId,
          chainPatientId: user.chainPatientId,
          walletAddress:  user.walletAddress,
          specialty:      user.specialty,
          licenseNumber:  user.licenseNumber,
        },
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
      res.json(patients.map(p => ({
        id:     p.patientId || String(p._id),
        name:   p.name,
        email:  p.email,
        phone:  p.phone  || "",
        gender: p.gender || "Unknown",
        blood:  p.bloodGroup || "",
        age:    p.age    || 0,
      })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/patients/:id", async (req, res) => {
    try {
      const patient = await User.findOne({
        $or: [
          { patientId: req.params.id },
          { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null },
        ],
        role: "patient",
      }).lean();
      if (!patient) return res.status(404).json({ error: "Patient not found" });
      res.json({
        id:     patient.patientId || String(patient._id),
        name:   patient.name,
        phone:  patient.phone,
        gender: patient.gender,
        age:    patient.age || 0,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DOCTORS
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/doctors", async (req, res) => {
    try {
      const doctors = await User.find({ role: "doctor", isActive: true })
        .select("-passwordHash -__v").lean();
      res.json(doctors.map(d => ({
        id:           String(d._id),
        name:         d.name,
        email:        d.email,
        specialty:    d.specialty    || "General",
        hospital:     d.hospital     || "",
        experience:   d.experience   || 0,
        fee:          d.fee          || 500,
        rating:       d.rating       || 0,
        reviewCount:  d.reviewCount  || 0,
        bio:          d.bio          || "",
        education:    d.education    || "",
        languages:    d.languages    || [],
        tags:         d.tags         || [],
        availability: d.availability || [],
        status:       d.status       || "online",
        image:        "👨‍⚕️",
        available:    d.status !== "offline",
        slots:        d.availability?.length || 0,
        reviews:      [],
        conditions:   d.tags || [],
        patients:     0,
        todayAppts:   0,
      })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/doctors/:id", async (req, res) => {
    try {
      const doctor = await User.findOne({ _id: req.params.id, role: "doctor" })
        .select("-passwordHash -__v").lean();
      if (!doctor) return res.status(404).json({ error: "Doctor not found" });
      res.json({ ...doctor, id: String(doctor._id) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/doctors/:id", protect, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid doctor ID" });
      if (String(req.user._id) !== id && req.user.role !== "admin")
        return res.status(403).json({ error: "Can only update your own profile" });

      const allowedFields = ["bio", "hospital", "education", "experience", "fee", "specialty", "phone", "availability", "languages", "tags"];
      const update = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) update[key] = req.body[key];
      }
      if (Object.keys(update).length === 0) return res.status(400).json({ error: "No valid fields to update" });
      if (update.experience !== undefined) update.experience = Number(update.experience);
      if (update.fee        !== undefined) update.fee        = Number(update.fee);

      const doctor = await User.findOneAndUpdate(
        { _id: id, role: "doctor" }, { $set: update }, { new: true, runValidators: true }
      ).select("-passwordHash -__v").lean();

      if (!doctor) return res.status(404).json({ error: "Doctor not found" });
      return res.json({ message: "Profile updated", doctor: { ...doctor, id: String(doctor._id) } });
    } catch (err) {
      console.error("doctor update error:", err);
      res.status(500).json({ error: err.message });
    }
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
      if (!date || !time)  return res.status(400).json({ error: "date and time are required" });
      if (!patientId)      return res.status(400).json({ error: "patientId is required" });

      const patientUser = await User.findOne({ patientId }).lean();
      const doctorUser  = doctorId ? await User.findById(doctorId).lean() : null;
      const tokenId     = `APT-${randomHex(8)}`;

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
        phone:         patientUser?.phone  || "",
        blockchain:    tokenId,
      });

      res.status(201).json({
        message:     "Appointment booked",
        appointment: { ...appt.toObject(), id: String(appt._id) },
        tokenId,
        blockchain:  tokenId,
      });
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
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/records", async (req, res) => {
    try {
      const records = await MedicalRecord.find().sort({ createdAt: -1 }).lean();
      res.json(records.map(r => ({ ...r, id: String(r._id) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/records/file/:recordId", async (req, res) => {
    try {
      const record = await MedicalRecord.findById(req.params.recordId).lean();
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

  app.get("/api/records/:patientId", async (req, res) => {
    try {
      const pid     = req.params.patientId;
      const records = await MedicalRecord.find({
        $or: [
          { patientStrId: pid },
          { patientId: mongoose.isValidObjectId(pid) ? pid : undefined },
        ],
      }).sort({ createdAt: -1 }).lean();
      res.json(records.map(r => ({ ...r, id: String(r._id) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

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
        ipfsUrl = `data:${mime};base64,${file.buffer.toString("base64")}`;
      } else {
        fileName = fileName || `Report_${new Date().toISOString().slice(0, 10)}_${category.replace(/\s+/g, "_")}.pdf`;
        fileHash = fileHash || `0x${randomHex(12)}`;
        ipfsUrl  = body.ipfsUrl || "";
      }

      const aiSummary = {
        keyFindings: ["Document received and stored", "Hash generated for integrity verification", "Awaiting doctor review"],
        plainLanguage: "Your document has been uploaded successfully.",
        recommendedSteps: ["Wait for doctor to review", "Your record is securely stored in MediChain"],
      };

      const newRecord = await MedicalRecord.create({
        patientId, patientStrId: patientId, fileName, category,
        uploadDate: new Date().toISOString().slice(0, 10),
        doctor, dept, fileHash, blockchainHash: "", blockchainTx: "",
        ipfsUrl, anchoredOnChain: false, aiSummary,
      });

      let blockchainResult = { success: false, anchored: false, reason: "No chainPatientId" };

      const patient = await User.findOne({
        $or: [
          { patientId },
          { _id: mongoose.isValidObjectId(patientId) ? patientId : null },
        ],
        role: "patient",
      }).lean();

      if (patient?.chainPatientId) {
        blockchainResult = await anchorOnChain(patient.chainPatientId, fileHash, category, fileName);
        if (blockchainResult.success && blockchainResult.txHash) {
          await MedicalRecord.findByIdAndUpdate(newRecord._id, {
            blockchainHash: fileHash, blockchainTx: blockchainResult.txHash,
            anchoredOnChain: true, anchoredAt: new Date(),
          });
        }
      }

      const finalAnchored = blockchainResult.success && !!blockchainResult.txHash;

      res.status(201).json({
        message: "Record saved",
        record: { ...newRecord.toObject(), id: String(newRecord._id), anchoredOnChain: finalAnchored, blockchainTx: blockchainResult.txHash || null },
        ipfsHash: fileHash, ipfsUrl, aiSummary,
        blockchain: {
          attempted: !!patient?.chainPatientId, anchored: finalAnchored,
          txHash: blockchainResult.txHash || null, alreadyAnchored: blockchainResult.alreadyAnchored || false,
          reason: finalAnchored ? null : (blockchainResult.reason || "Not anchored"),
        },
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
        MedicalRecord.countDocuments(),
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
        message: "Emergency protocol activated",
        emergencyToken,
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
          : "License reference failed basic format check.",
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
      const user = await User.findOne({
        walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") },
      }).lean();
      res.json({
        message: "Wallet connected", walletAddress,
        patientId:   user?.patientId || null,
        patientName: user?.name      || null,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ✅ AI MEDICAL REPORT ANALYSIS — Powered by Groq (FREE)
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/analyze-report", async (req, res) => {
    try {
      const { reportText, imageBase64, imageMimeType, reportType, preferredLanguage, explainLevel, voiceFriendly } = req.body;

      if (!reportText?.trim() && !imageBase64)
        return res.status(400).json({ error: "reportText or imageBase64 is required" });

      if (!process.env.GROQ_API_KEY)
        return res.status(503).json({
          error: "GROQ_API_KEY not set in backend/.env. Get a free key at https://console.groq.com/keys",
        });

      const result = await analyzeWithGroq({
        reportText:        reportText?.trim() || "",
        imageBase64:       imageBase64        || null,
        imageMimeType:     imageMimeType      || "image/jpeg",
        reportType:        reportType         || "General",
        preferredLanguage: preferredLanguage  || "English",
        explainLevel:      explainLevel       || "simple",
        voiceFriendly:     voiceFriendly      !== false,
      });

      return res.json(result);

    } catch (err) {
      console.error("[analyze-report] Groq error:", err.message);
      if (err.message.includes("401") || err.message.includes("invalid_api_key"))
        return res.status(401).json({ error: "Invalid Groq API key. Check GROQ_API_KEY in backend/.env" });
      if (err.message.includes("429"))
        return res.status(429).json({ error: "Groq rate limit hit. Wait a moment and try again." });
      return res.status(500).json({ error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ✅ GEMINI TTS — FIXED: converts raw PCM → proper WAV with headers
  //
  //  Root cause of "no supported source was found":
  //  Gemini TTS returns raw 16-bit PCM audio at 24 kHz.
  //  The browser cannot play raw PCM — it needs a WAV file with a RIFF
  //  header.  buildWavBuffer() prepends the 44-byte header so the browser
  //  can decode it natively as audio/wav.
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, langCode } = req.body;
      if (!text?.trim()) return res.status(400).json({ error: "text is required" });

      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY)
        return res.status(503).json({
          error: "GEMINI_API_KEY not set in backend/.env. Get free key at https://aistudio.google.com/app/apikey",
        });

      // ── 1. Call Gemini TTS ──────────────────────────────────────────────
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: text.slice(0, 1000) }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Kore" },
                },
              },
            },
          }),
        }
      );

      if (!geminiRes.ok) {
        const errData = await geminiRes.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Gemini TTS error ${geminiRes.status}`);
      }

      const data     = await geminiRes.json();
      const part     = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const audioB64 = part?.data;
      const mimeType = part?.mimeType || "audio/L16;rate=24000";   // raw PCM fallback

      if (!audioB64) throw new Error("No audio returned from Gemini TTS");

      const rawBuffer = Buffer.from(audioB64, "base64");

      // ── 2. Wrap raw PCM in a WAV container so browsers can play it ──────
      //    Gemini returns audio/L16 (signed 16-bit little-endian PCM) at
      //    24 000 Hz, mono.  We detect this from the mimeType and wrap it.
      let responseBuffer;
      let responseMime;

      if (mimeType.startsWith("audio/L16") || mimeType.startsWith("audio/pcm") || mimeType === "audio/wav") {
        // Parse sample rate from mimeType if present, e.g. "audio/L16;rate=24000"
        const rateMatch  = mimeType.match(/rate=(\d+)/i);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

        responseBuffer = buildWavBuffer(rawBuffer, sampleRate, 1, 16);
        responseMime   = "audio/wav";
        console.log(`[tts] Wrapped ${rawBuffer.length} bytes PCM → ${responseBuffer.length} bytes WAV (${sampleRate} Hz)`);
      } else {
        // Already a container format (mp3, ogg, etc.) — send as-is
        responseBuffer = rawBuffer;
        responseMime   = mimeType;
        console.log(`[tts] Passing through ${mimeType} audio (${rawBuffer.length} bytes)`);
      }

      // ── 3. Send the audio to the client ────────────────────────────────
      res.set("Content-Type",   responseMime);
      res.set("Content-Length", responseBuffer.length);
      res.set("Cache-Control",  "no-cache");
      return res.send(responseBuffer);

    } catch (err) {
      console.error("[tts] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n✅ MediChain backend running → http://localhost:${PORT}`);
    console.log("\n🤖 AI Engine: Groq LLaMA 3.3 70B (FREE)");
    console.log("   GROQ_API_KEY:",   process.env.GROQ_API_KEY   ? "✅ set" : "❌ NOT SET — get one free at https://console.groq.com/keys");
    console.log("   GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "✅ set" : "❌ NOT SET — get one free at https://aistudio.google.com/app/apikey");
    console.log("\n⛓  Blockchain:");
    console.log("   BLOCKCHAIN_RPC_URL:     ", process.env.BLOCKCHAIN_RPC_URL      ? "✅ set" : "❌ not set");
    console.log("   PATIENT_RECORDS_ADDRESS:", process.env.PATIENT_RECORDS_ADDRESS ? "✅ set" : "❌ not set");
    console.log("\n📡 Routes ready:");
    console.log("   POST /api/analyze-report  ← Groq AI analysis");
    console.log("   POST /api/tts             ← Gemini TTS (PCM → WAV fixed)");
    console.log("   POST /api/auth/signup | login | wallet-login");
    console.log("   GET  /api/patients | doctors | appointments | records\n");
  });
}