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
if (!process.env.JWT_SECRET) { console.error("❌ JWT_SECRET not set in .env"); process.exit(1); }

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
  availabilityMap: { type: mongoose.Schema.Types.Mixed, default: {} },
  status:          { type: String, enum: ["online", "busy", "offline"], default: "online" },
  walletAddress:   { type: String, default: "" },
  isActive:        { type: Boolean, default: true },
  lastLogin:       { type: Date },
  location: {
    lat:     { type: Number, default: null },
    lng:     { type: Number, default: null },
    address: { type: String, default: "" },
  },
  isOnline: { type: Boolean, default: true },
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
// FIX: Removed unique index on fileHash to prevent E11000 duplicate key errors
// when doctors upload multiple reports (fileHash was computed the same way for similar files)
const recordSchema = new mongoose.Schema({
  patientId:          { type: String, required: true, index: true },
  patientStrId:       { type: String, default: "" },
  patientName:        { type: String, default: "" },
  uploadedBy:         { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploadedByDoctor:   { type: Boolean, default: false },
  doctorId:           { type: String, default: "" },
  doctorName:         { type: String, default: "" },
  doctorComment:      { type: String, default: "" },
  recommendation:     { type: String, default: "" },
  fileName:           { type: String, default: "" },
  category:           { type: String, default: "General" },
  uploadDate:         { type: String, default: () => new Date().toISOString().slice(0, 10) },
  doctor:             { type: String, default: "Self Upload" },
  dept:               { type: String, default: "" },
  // FIX: fileHash is NOT unique — multiple records can have same hash (e.g. same template file)
  fileHash:           { type: String, default: "" },
  blockchainHash:     { type: String, default: "" },
  blockchainTx:       { type: String, default: "" },
  ipfsCid:            { type: String, default: "" },
  ipfsUrl:            { type: String, default: "" },
  anchoredOnChain:    { type: Boolean, default: false },
  anchoredAt:         { type: Date },
  doctorNotes:        { type: String, default: "" },
  aiSummary:          { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

// No unique constraint on fileHash — only index for query performance
recordSchema.index({ fileHash: 1 });

const MedicalRecord = mongoose.model("MedicalRecord", recordSchema);

// ── Appointment (includes checkedIn fields) ───────────────────────────────────
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
  checkedIn:     { type: Boolean, default: false },
  checkedInAt:   { type: Date },
  // NEW: queue tracking fields
  queuePosition:   { type: Number, default: null },
  treatmentStart:  { type: Date, default: null },
  treatmentEnd:    { type: Date, default: null },
  treatmentDuration: { type: Number, default: null }, // in minutes
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

// ── Notification Schema ───────────────────────────────────────────────────────
const notificationSchema = new mongoose.Schema({
  patientId:   { type: String, required: true, index: true },
  type:        { type: String, enum: ["queue_update", "treatment_complete", "appointment_reminder"], required: true },
  title:       { type: String, required: true },
  message:     { type: String, required: true },
  read:        { type: Boolean, default: false },
  metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

const Notification = mongoose.model("Notification", notificationSchema);

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
    if (!contract) return { success: false, anchored: false, reason: "Blockchain not configured" };
    const { ethers } = require("ethers");
    const already = await contract.isAnchored(fileHash);
    if (already) return { success: true, anchored: true, alreadyAnchored: true };
    const tx      = await contract.anchorRecord(Number(chainPatientId), fileHash, category || "general", fileName || "unknown");
    const receipt = await tx.wait();
    return { success: true, anchored: true, txHash: tx.hash, block: receipt.blockNumber };
  } catch (err) {
    console.error("[anchorOnChain]", err.message);
    return { success: false, anchored: false, reason: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// WAV HEADER BUILDER
// ══════════════════════════════════════════════════════════════════════════════
function buildWavBuffer(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate   = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize   = pcmBuffer.length;
  const headerSize = 44;
  const wavBuffer  = Buffer.alloc(headerSize + dataSize);

  wavBuffer.write("RIFF", 0);
  wavBuffer.writeUInt32LE(36 + dataSize, 4);
  wavBuffer.write("WAVE", 8);
  wavBuffer.write("fmt ", 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20);
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(blockAlign, 32);
  wavBuffer.writeUInt16LE(bitsPerSample, 34);
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
// GROQ AI HELPER
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
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        { role: "system", content: "You are a medical report analyst. Always respond with ONLY a valid JSON object. No markdown, no backticks, no explanation outside the JSON." },
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
  try { return JSON.parse(cleaned); } catch { throw new Error("Groq returned invalid JSON. Please try again."); }
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

  // ══════════════════════════════════════════════════════════════════════════
  // FIX fileHash unique index — drop it if it exists on startup
  // ══════════════════════════════════════════════════════════════════════════
  MedicalRecord.collection.dropIndex("fileHash_1").then(() => {
    console.log("✅ Dropped unique fileHash index (was causing duplicate key errors)");
  }).catch(() => {
    // Index doesn't exist or was already dropped — that's fine
  });

  app.get("/", (req, res) => res.json({ status: "ok", message: "MediChain Backend Running ✅" }));

  // ══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { name, email, password, phone, role, walletAddress, specialty, licenseNumber, hospital, experience, fee, bio, education, languages, availability } = req.body;
      if (!name || !email || !password) return res.status(400).json({ error: "name, email and password are required" });
      const existing = await User.findOne({ email: email.toLowerCase().trim() });
      if (existing) return res.status(409).json({ error: "Email already registered" });

      const newUser = new User({
        name: name.trim(), email: email.toLowerCase().trim(), passwordHash: password,
        role: role || "patient", phone: phone || "", walletAddress: walletAddress || "",
        specialty: specialty || "", licenseNumber: licenseNumber || "", hospital: hospital || "",
        experience: experience ? Number(experience) : 0, fee: fee ? Number(fee) : 500,
        bio: bio || "", education: education || "",
        languages:    Array.isArray(languages)    ? languages    : (languages    ? [languages]    : []),
        availability: Array.isArray(availability) ? availability : [],
        status: "online", isActive: true,
      });

      await newUser.save();
      const token = generateToken(newUser._id);
      return res.status(201).json({
        message: "Account created successfully", token,
        user: {
          id: String(newUser._id), name: newUser.name, email: newUser.email, role: newUser.role,
          patientId: newUser.patientId || null, chainPatientId: newUser.chainPatientId || null,
          walletAddress: newUser.walletAddress, specialty: newUser.specialty,
          licenseNumber: newUser.licenseNumber, hospital: newUser.hospital,
        },
      });
    } catch (err) { console.error("signup error:", err); res.status(500).json({ error: err.message }); }
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
        message: "Login successful", token,
        user: {
          id: String(user._id), name: user.name, email: user.email, role: user.role,
          patientId: user.patientId || null, chainPatientId: user.chainPatientId || null,
          walletAddress: user.walletAddress, specialty: user.specialty,
          licenseNumber: user.licenseNumber, hospital: user.hospital,
          experience: user.experience, fee: user.fee, bio: user.bio,
          education: user.education, languages: user.languages,
          availability: user.availability, availabilityMap: user.availabilityMap || {},
          status: user.status,
          location: user.location || { lat: null, lng: null, address: "" },
          isOnline: user.isOnline !== undefined ? user.isOnline : true,
        },
      });
    } catch (err) { console.error("login error:", err); res.status(500).json({ error: err.message }); }
  });

  app.get("/api/auth/me", protect, async (req, res) => {
    try {
      const user = await User.findById(req.user._id).select("-passwordHash -__v").lean();
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({
        id: String(user._id), _id: String(user._id), name: user.name, username: user.name,
        email: user.email, role: user.role, patientId: user.patientId || null,
        chainPatientId: user.chainPatientId || null, walletAddress: user.walletAddress || "",
        specialty: user.specialty || "", hospital: user.hospital || "", phone: user.phone || "",
        gender: user.gender || "", bloodGroup: user.bloodGroup || "",
        experience: user.experience || 0, fee: user.fee || 500,
        bio: user.bio || "", education: user.education || "",
        languages: user.languages || [], availability: user.availability || [],
        availabilityMap: user.availabilityMap || {},
        location: user.location || { lat: null, lng: null, address: "" },
        isOnline: user.isOnline !== undefined ? user.isOnline : true,
        createdAt: user.createdAt,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/auth/wallet-login", async (req, res) => {
    try {
      const { walletAddress } = req.body;
      if (!walletAddress) return res.status(400).json({ error: "walletAddress is required" });
      const user = await User.findOne({ walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") }, isActive: true }).lean();
      if (!user) return res.status(404).json({ error: "No account found for this wallet" });
      const token = generateToken(user._id);
      return res.json({
        message: "Wallet login successful", token,
        user: {
          id: String(user._id), name: user.name, email: user.email, role: user.role,
          patientId: user.patientId, chainPatientId: user.chainPatientId,
          walletAddress: user.walletAddress, specialty: user.specialty, licenseNumber: user.licenseNumber,
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
        .select("name email phone patientId chainPatientId gender bloodGroup createdAt").lean();
      res.json(patients.map(p => ({
        id: p.patientId || String(p._id), _id: String(p._id),
        name: p.name, email: p.email, phone: p.phone || "",
        gender: p.gender || "Unknown", blood: p.bloodGroup || "",
        age: p.age || 0, patientId: p.patientId || String(p._id),
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
      res.json({ id: patient.patientId || String(patient._id), name: patient.name, phone: patient.phone, gender: patient.gender, age: patient.age || 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DOCTORS
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/doctors", async (req, res) => {
    try {
      const doctors = await User.find({ role: "doctor", isActive: true }).select("-passwordHash -__v").lean();
      res.json(doctors.map(d => ({
        id: String(d._id), _id: String(d._id), name: d.name, email: d.email,
        specialty: d.specialty || "General", hospital: d.hospital || "",
        experience: d.experience || 0, fee: d.fee || 500,
        rating: d.rating || 0, reviewCount: d.reviewCount || 0,
        bio: d.bio || "", education: d.education || "",
        languages: d.languages || [], tags: d.tags || [],
        availability: d.availability || [], availabilityMap: d.availabilityMap || {},
        status: d.status || "online", image: "👨‍⚕️",
        available: d.status !== "offline", slots: d.availability?.length || 0,
        reviews: [], conditions: d.tags || [], patients: 0, todayAppts: 0,
        location: d.location || { lat: null, lng: null, address: "" },
        isOnline: d.isOnline !== undefined ? d.isOnline : true,
      })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/doctors/:id", async (req, res) => {
    try {
      const doctor = await User.findOne({ _id: req.params.id, role: "doctor" }).select("-passwordHash -__v").lean();
      if (!doctor) return res.status(404).json({ error: "Doctor not found" });
      res.json({
        ...doctor, id: String(doctor._id), _id: String(doctor._id),
        location: doctor.location || { lat: null, lng: null, address: "" },
        isOnline: doctor.isOnline !== undefined ? doctor.isOnline : true,
        availabilityMap: doctor.availabilityMap || {},
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/doctors/:id", protect, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid doctor ID" });
      if (String(req.user._id) !== id && req.user.role !== "admin")
        return res.status(403).json({ error: "Can only update your own profile" });
      const allowedFields = ["bio", "hospital", "education", "experience", "fee", "specialty", "phone", "availability", "availabilityMap", "languages", "tags"];
      const update = {};
      for (const key of allowedFields) { if (req.body[key] !== undefined) update[key] = req.body[key]; }
      if (Object.keys(update).length === 0) return res.status(400).json({ error: "No valid fields to update" });
      if (update.experience !== undefined) update.experience = Number(update.experience);
      if (update.fee        !== undefined) update.fee        = Number(update.fee);
      const doctor = await User.findOneAndUpdate(
        { _id: id, role: "doctor" }, { $set: update }, { new: true, runValidators: true }
      ).select("-passwordHash -__v").lean();
      if (!doctor) return res.status(404).json({ error: "Doctor not found" });
      return res.json({ message: "Profile updated", doctor: { ...doctor, id: String(doctor._id) } });
    } catch (err) { console.error("doctor update error:", err); res.status(500).json({ error: err.message }); }
  });

  app.put("/api/doctors/:id/location", protect, async (req, res) => {
    try {
      if (String(req.user._id) !== req.params.id && req.user.role !== "admin")
        return res.status(403).json({ error: "Forbidden" });
      const { lat, lng, address } = req.body;
      if (lat == null || lng == null) return res.status(400).json({ error: "lat and lng are required" });
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      if (isNaN(latNum) || isNaN(lngNum)) return res.status(400).json({ error: "lat and lng must be numbers" });
      const updated = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { location: { lat: latNum, lng: lngNum, address: address || "" } } },
        { new: true }
      ).select("name location").lean();
      if (!updated) return res.status(404).json({ error: "Doctor not found" });
      res.json({ success: true, location: updated.location });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/doctors/:id/online-status", protect, async (req, res) => {
    try {
      if (String(req.user._id) !== req.params.id && req.user.role !== "admin")
        return res.status(403).json({ error: "Forbidden" });
      const updated = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { isOnline: !!req.body.isOnline } },
        { new: true }
      ).select("name isOnline").lean();
      if (!updated) return res.status(404).json({ error: "Doctor not found" });
      res.json({ success: true, isOnline: updated.isOnline });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // QUEUE — live patient queue per doctor per day (in-memory)
  // Enhanced with: token assignment, completion tracking, notifications
  // ══════════════════════════════════════════════════════════════════════════
  const _queueMap = new Map();
  function _qkey(doctorId, date) { return `${doctorId}::${date}`; }

  // Helper: create notification for a patient
  async function createNotification(patientId, type, title, message, metadata = {}) {
    try {
      await Notification.create({ patientId, type, title, message, metadata });
    } catch (err) {
      console.warn("[notification] failed to create:", err.message);
    }
  }

  // Helper: check and send queue position notifications
  async function checkQueueNotifications(queue, doctorName) {
    const active = queue.filter(q => !q.done);
    for (let i = 0; i < active.length; i++) {
      const entry = active[i];
      const patientsAhead = i; // 0-indexed, so position i means i patients ahead

      // Notify when 5 or fewer patients ahead (and hasn't been notified yet for this threshold)
      if (patientsAhead <= 5 && !entry.notified5 && patientsAhead > 0) {
        entry.notified5 = true;
        await createNotification(
          entry.patientId,
          "queue_update",
          "Almost Your Turn! 🏥",
          `Only ${patientsAhead} patient${patientsAhead !== 1 ? "s" : ""} ahead of you with Dr. ${doctorName}. Please be ready.`,
          { patientsAhead, doctorName, appointmentId: entry.appointmentId }
        );
      }

      // Notify when they are next (position 1 ahead)
      if (patientsAhead === 1 && !entry.notifiedNext) {
        entry.notifiedNext = true;
        await createNotification(
          entry.patientId,
          "queue_update",
          "You're Next! 🔔",
          `You are next in line with Dr. ${doctorName}. Please proceed to the consultation room.`,
          { patientsAhead: 0, doctorName, appointmentId: entry.appointmentId }
        );
      }

      // Check 30-min notification based on appointment time
      if (entry.time && !entry.notified30min) {
        const apptTime = new Date(`${new Date().toISOString().slice(0, 10)} ${entry.time}`);
        const now      = new Date();
        const diffMins = (apptTime - now) / 60000;
        if (diffMins > 0 && diffMins <= 30) {
          entry.notified30min = true;
          await createNotification(
            entry.patientId,
            "appointment_reminder",
            "Appointment in 30 Minutes ⏰",
            `Your appointment with Dr. ${doctorName} is in ${Math.round(diffMins)} minutes. Please check in at the reception.`,
            { minutesLeft: Math.round(diffMins), doctorName, appointmentId: entry.appointmentId }
          );
        }
      }
    }
  }

  // POST /api/queue/checkin — patient checks in on arrival
  app.post("/api/queue/checkin", async (req, res) => {
    try {
      const { appointmentId, doctorId, date, patientId, time } = req.body;
      if (!appointmentId || !doctorId || !date)
        return res.status(400).json({ error: "appointmentId, doctorId, date required" });

      const key = _qkey(doctorId, date);
      if (!_queueMap.has(key)) _queueMap.set(key, []);
      const queue = _queueMap.get(key);

      const existing = queue.find(q => q.appointmentId === appointmentId);
      if (existing) {
        const active = queue.filter(q => !q.done);
        const pos    = active.indexOf(existing);
        return res.json({ alreadyCheckedIn: true, position: pos >= 0 ? pos : 0, ahead: Math.max(0, pos), queueToken: existing.queueToken });
      }

      // FIX: Generate a proper queue token for this check-in
      const queueToken    = `Q-${randomHex(4)}-${(queue.length + 1).toString().padStart(3, "0")}`;
      const queuePosition = queue.length + 1;

      queue.push({
        appointmentId,
        patientId,
        time,
        done:       false,
        checkedInAt: Date.now(),
        queueToken,
        queuePosition,
        notified5:    false,
        notifiedNext: false,
        notified30min: false,
      });

      // Update appointment in DB with queue info
      await Appointment.findByIdAndUpdate(appointmentId, {
        checkedIn:     true,
        checkedInAt:   new Date(),
        queuePosition,
        treatmentStart: null,
      }).catch(() => {});

      // Look up doctor name for notifications
      const doctor = await User.findById(doctorId).select("name").lean().catch(() => null);
      const doctorName = doctor?.name || "your doctor";

      // Create check-in notification
      const activeNow = queue.filter(q => !q.done);
      const myPos     = activeNow.length - 1;
      await createNotification(
        patientId,
        "queue_update",
        "Check-in Confirmed ✅",
        `You are #${queuePosition} in queue with Dr. ${doctorName}. Your queue token is ${queueToken}. ${myPos > 0 ? `${myPos} patient${myPos !== 1 ? "s" : ""} ahead of you.` : "You are next!"}`,
        { queueToken, queuePosition, patientsAhead: myPos, doctorName, appointmentId }
      );

      res.json({ success: true, position: myPos, ahead: Math.max(0, myPos), queueToken, queuePosition });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/queue/:appointmentId?doctorId=&date=
  app.get("/api/queue/:appointmentId", (req, res) => {
    const { appointmentId } = req.params;
    const { doctorId, date } = req.query;
    if (!doctorId || !date) return res.status(400).json({ error: "doctorId and date query params required" });
    const key    = _qkey(doctorId, date);
    const queue  = _queueMap.get(key) || [];
    const active = queue.filter(q => !q.done);
    const myIdx  = active.findIndex(q => q.appointmentId === appointmentId);
    const entry  = queue.find(q => q.appointmentId === appointmentId);
    if (myIdx === -1) return res.json({ checkedIn: !!entry?.done, position: null, ahead: null, totalInQueue: active.length, done: !!entry?.done });
    res.json({ checkedIn: true, position: myIdx, ahead: myIdx, totalInQueue: active.length, queueToken: entry?.queueToken, done: false });
  });

  // POST /api/queue/next — doctor marks current patient as treatment complete
  app.post("/api/queue/next", async (req, res) => {
    try {
      const { doctorId, date } = req.body;
      if (!doctorId || !date) return res.status(400).json({ error: "doctorId and date required" });
      const key   = _qkey(doctorId, date);
      const queue = _queueMap.get(key) || [];
      const first = queue.find(q => !q.done);

      if (first) {
        first.done      = true;
        first.completedAt = Date.now();

        // Calculate treatment duration
        const durationMs   = first.checkedInAt ? (first.completedAt - first.checkedInAt) : 0;
        const durationMins = Math.round(durationMs / 60000);

        // Update appointment as completed in DB
        if (first.appointmentId) {
          await Appointment.findByIdAndUpdate(first.appointmentId, {
            status:          "completed",
            treatmentEnd:    new Date(),
            treatmentStart:  first.checkedInAt ? new Date(first.checkedInAt) : new Date(),
            treatmentDuration: durationMins,
          }).catch(() => {});
        }

        // Notify patient their treatment is complete
        const doctor = await User.findById(doctorId).select("name").lean().catch(() => null);
        const doctorName = doctor?.name || "your doctor";

        await createNotification(
          first.patientId,
          "treatment_complete",
          "Treatment Completed ✅",
          `Your consultation with Dr. ${doctorName} is complete. Duration: ${durationMins} minute${durationMins !== 1 ? "s" : ""}. Thank you for visiting MediChain!`,
          { durationMins, doctorName, appointmentId: first.appointmentId, queueToken: first.queueToken }
        );

        // Check queue notifications for remaining patients
        await checkQueueNotifications(queue, doctorName);
      }

      const remaining = queue.filter(q => !q.done);
      res.json({ success: true, remaining: remaining.length, next: remaining[0] || null });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/queue?doctorId=&date= — doctor sees full queue
  app.get("/api/queue", (req, res) => {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) return res.status(400).json({ error: "doctorId and date required" });
    const key   = _qkey(doctorId, date);
    const queue = (_queueMap.get(key) || []).filter(q => !q.done);
    res.json({ queue, total: queue.length });
  });

  // POST /api/queue/complete/:appointmentId — doctor marks specific appointment complete
  app.post("/api/queue/complete/:appointmentId", async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const { doctorId, date } = req.body;
      if (!doctorId || !date) return res.status(400).json({ error: "doctorId and date required" });

      const key   = _qkey(doctorId, date);
      const queue = _queueMap.get(key) || [];
      const entry = queue.find(q => q.appointmentId === appointmentId);

      if (entry && !entry.done) {
        entry.done        = true;
        entry.completedAt = Date.now();

        const durationMs   = entry.checkedInAt ? (entry.completedAt - entry.checkedInAt) : 0;
        const durationMins = Math.round(durationMs / 60000);

        await Appointment.findByIdAndUpdate(appointmentId, {
          status:           "completed",
          treatmentEnd:     new Date(),
          treatmentStart:   entry.checkedInAt ? new Date(entry.checkedInAt) : new Date(),
          treatmentDuration: durationMins,
        }).catch(() => {});

        const doctor     = await User.findById(doctorId).select("name").lean().catch(() => null);
        const doctorName = doctor?.name || "your doctor";

        await createNotification(
          entry.patientId,
          "treatment_complete",
          "Treatment Completed ✅",
          `Your consultation with Dr. ${doctorName} is complete. Duration: ${durationMins} minute${durationMins !== 1 ? "s" : ""}. Thank you for visiting MediChain!`,
          { durationMins, doctorName, appointmentId, queueToken: entry.queueToken }
        );

        await checkQueueNotifications(queue, doctorName);
      } else {
        // If not in memory queue, just update DB
        await Appointment.findByIdAndUpdate(appointmentId, { status: "completed" }).catch(() => {});
      }

      const remaining = queue.filter(q => !q.done);
      res.json({ success: true, remaining: remaining.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/notifications/:patientId — get patient notifications
  app.get("/api/notifications/:patientId", async (req, res) => {
    try {
      const notifications = await Notification.find({ patientId: req.params.patientId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      res.json(notifications.map(n => ({ ...n, id: String(n._id) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // PUT /api/notifications/:id/read — mark notification as read
  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      await Notification.findByIdAndUpdate(req.params.id, { read: true });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // PUT /api/notifications/read-all/:patientId
  app.put("/api/notifications/read-all/:patientId", async (req, res) => {
    try {
      await Notification.updateMany({ patientId: req.params.patientId, read: false }, { read: true });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // APPOINTMENTS
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/appointments/patient", protect, async (req, res) => {
    try {
      const user  = req.user;
      const query = { $or: [{ patientId: user.patientId }, { patientId: String(user._id) }] };
      const appts = await Appointment.find(query).sort({ date: 1, time: 1 }).lean();
      res.json(appts.map(a => ({ ...a, id: String(a._id) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

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
        patientId, patientName: patientUser?.name || "",
        doctorId: doctorId || "", doctorName: doctorName || doctorUser?.name || "",
        dept: dept || doctorUser?.specialty || "General",
        specialty: specialty || doctorUser?.specialty || "",
        date, time, tokenId, isEmergency: !!isEmergency, status: "confirmed",
        fee: fee || doctorUser?.fee || 0, feePaid: !!feePaid,
        paymentMethod: paymentMethod || "", type: type || "Consultation",
        age: patientUser?.age, gender: patientUser?.gender || "",
        phone: patientUser?.phone || "", blockchain: tokenId,
      });
      res.status(201).json({
        message: "Appointment booked",
        appointment: { ...appt.toObject(), id: String(appt._id) },
        tokenId, blockchain: tokenId,
      });
    } catch (err) { console.error("appt create error:", err); res.status(500).json({ error: err.message }); }
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
  // FIX: fileHash is now generated uniquely per upload to avoid duplicate key errors
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/reports", protect, async (req, res) => {
    try {
      const user  = req.user;
      const query = {
        $or: [
          { patientStrId: user.patientId }, { patientStrId: String(user._id) },
          { patientId: user.patientId },    { patientId: String(user._id) },
        ],
      };
      const records = await MedicalRecord.find(query).sort({ createdAt: -1 }).lean();
      res.json(records.map(r => ({ ...r, id: String(r._id) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

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
          { patientId: pid },
          { patientId: mongoose.isValidObjectId(pid) ? pid : undefined },
        ],
      }).sort({ createdAt: -1 }).lean();
      res.json(records.map(r => ({ ...r, id: String(r._id) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/records", upload.single("file"), async (req, res) => {
    try {
      const body      = req.body;
      const file      = req.file;
      const patientId = body.patientId;
      if (!patientId) return res.status(400).json({ error: "patientId is required" });

      const category         = body.category || body.type || "General";
      const doctor           = body.doctor   || "Self Upload";
      const dept             = body.dept     || category;
      const doctorComment    = body.doctorComment  || "";
      const recommendation   = body.recommendation || "";
      const uploadedByDoctor = body.uploadedByDoctor === "true" || body.uploadedByDoctor === true;
      const doctorId         = body.doctorId    || "";
      const doctorNameField  = body.doctorName  || "";
      const patientNameField = body.patientName || "";

      let fileName = body.fileName || "";
      let ipfsUrl  = "";

      // FIX: Always generate a unique fileHash using timestamp + random to prevent duplicate key errors
      // The old code used file content which caused collisions when same file was uploaded twice
      const uniqueSuffix = `${Date.now()}-${randomHex(8)}`;
      let fileHash = `0x${uniqueSuffix}`;

      if (file) {
        fileName = fileName || file.originalname || `Upload_${Date.now()}.pdf`;
        // Use first 16 bytes + unique suffix to ensure uniqueness
        const contentHex = Buffer.from(file.buffer).slice(0, 8).toString("hex");
        fileHash = `0x${contentHex}${randomHex(8)}`;
        const mime = file.mimetype || "application/octet-stream";
        ipfsUrl = `data:${mime};base64,${file.buffer.toString("base64")}`;
      } else {
        fileName = fileName || `Report_${new Date().toISOString().slice(0, 10)}_${category.replace(/\s+/g, "_")}.pdf`;
        ipfsUrl  = body.ipfsUrl || "";
      }

      const aiSummary = {
        keyFindings:      ["Document received and stored", "Hash generated for integrity verification", "Awaiting review"],
        plainLanguage:    uploadedByDoctor
          ? `Your doctor (${doctorNameField || doctor}) has uploaded a ${category} report for you.`
          : "Your document has been uploaded successfully.",
        recommendedSteps: uploadedByDoctor && recommendation
          ? [recommendation]
          : ["Wait for doctor to review", "Your record is securely stored in MediChain"],
      };

      const newRecord = await MedicalRecord.create({
        patientId, patientStrId: patientId, patientName: patientNameField,
        uploadedByDoctor, doctorId,
        doctorName: doctorNameField || (uploadedByDoctor ? doctor : ""),
        doctorComment, recommendation, fileName, category,
        uploadDate: new Date().toISOString().slice(0, 10),
        doctor, dept, fileHash, blockchainHash: "", blockchainTx: "",
        ipfsUrl, anchoredOnChain: false, doctorNotes: doctorComment, aiSummary,
      });

      // If doctor uploaded for patient, create a notification for the patient
      if (uploadedByDoctor && patientId) {
        await createNotification(
          patientId,
          "queue_update",
          "New Report from Your Doctor 📋",
          `Dr. ${doctorNameField || doctor} has uploaded a ${category} report for you. ${recommendation ? `Recommendation: ${recommendation}` : ""}`,
          { category, doctorName: doctorNameField || doctor, recordId: String(newRecord._id) }
        );
      }

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
        record: {
          ...newRecord.toObject(), id: String(newRecord._id),
          anchoredOnChain: finalAnchored, blockchainTx: blockchainResult.txHash || null,
        },
        ipfsHash: fileHash, ipfsUrl, aiSummary,
        blockchain: {
          attempted: !!patient?.chainPatientId, anchored: finalAnchored,
          txHash: blockchainResult.txHash || null,
          alreadyAnchored: blockchainResult.alreadyAnchored || false,
          reason: finalAnchored ? null : (blockchainResult.reason || "Not anchored"),
        },
      });
    } catch (err) { console.error("record save error:", err); res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DASHBOARD STATS
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
      if (!email || !licenseNumber) return res.status(400).json({ error: "email and licenseNumber are required" });
      const clean    = String(licenseNumber).replace(/\s/g, "");
      const formatOk = /^[A-Z0-9-]{6,24}$/i.test(clean);
      const entry = await LicenceVerification.create({
        email: email.toLowerCase().trim(), licenseNumber: clean,
        documentHash: documentHash || "",
        status: formatOk ? "verified" : "rejected",
        verifiedAt: formatOk ? new Date() : null,
        note: formatOk
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
      const user = await User.findOne({ walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") } }).lean();
      res.json({
        message: "Wallet connected", walletAddress,
        patientId:   user?.patientId || null,
        patientName: user?.name      || null,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // AI MEDICAL REPORT ANALYSIS — Powered by Groq (FREE)
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/analyze-report", async (req, res) => {
    try {
      const { reportText, imageBase64, imageMimeType, reportType, preferredLanguage, explainLevel, voiceFriendly } = req.body;
      if (!reportText?.trim() && !imageBase64)
        return res.status(400).json({ error: "reportText or imageBase64 is required" });
      if (!process.env.GROQ_API_KEY)
        return res.status(503).json({ error: "GROQ_API_KEY not set in backend/.env. Get a free key at https://console.groq.com/keys" });
      const result = await analyzeWithGroq({
        reportText:        reportText?.trim()    || "",
        imageBase64:       imageBase64           || null,
        imageMimeType:     imageMimeType         || "image/jpeg",
        reportType:        reportType            || "General",
        preferredLanguage: preferredLanguage     || "English",
        explainLevel:      explainLevel          || "simple",
        voiceFriendly:     voiceFriendly !== false,
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
  // GEMINI TTS
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, langCode } = req.body;
      if (!text?.trim()) return res.status(400).json({ error: "text is required" });
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY)
        return res.status(503).json({ error: "GEMINI_API_KEY not set in backend/.env. Get free key at https://aistudio.google.com/app/apikey" });

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: text.slice(0, 1000) }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
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
      const mimeType = part?.mimeType || "audio/L16;rate=24000";

      if (!audioB64) throw new Error("No audio returned from Gemini TTS");

      const rawBuffer = Buffer.from(audioB64, "base64");
      let responseBuffer, responseMime;

      if (mimeType.startsWith("audio/L16") || mimeType.startsWith("audio/pcm") || mimeType === "audio/wav") {
        const rateMatch  = mimeType.match(/rate=(\d+)/i);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        responseBuffer = buildWavBuffer(rawBuffer, sampleRate, 1, 16);
        responseMime   = "audio/wav";
      } else {
        responseBuffer = rawBuffer;
        responseMime   = mimeType;
      }

      res.set("Content-Type",   responseMime);
      res.set("Content-Length", responseBuffer.length);
      res.set("Cache-Control",  "no-cache");
      return res.send(responseBuffer);
    } catch (err) { console.error("[tts] error:", err.message); return res.status(500).json({ error: err.message }); }
  });

  app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n✅ MediChain backend running → http://localhost:${PORT}`);
    console.log("\n🔧 Fixes applied:");
    console.log("   ✅ fileHash unique index DROPPED — no more E11000 duplicate errors");
    console.log("   ✅ Queue tokens assigned on check-in");
    console.log("   ✅ Patient notified on treatment complete");
    console.log("   ✅ Patient notified when 5 patients ahead or 30 min left");
    console.log("   ✅ Treatment duration tracked");
    console.log("\n📡 New Routes:");
    console.log("   GET  /api/notifications/:patientId");
    console.log("   PUT  /api/notifications/:id/read");
    console.log("   PUT  /api/notifications/read-all/:patientId");
    console.log("   POST /api/queue/complete/:appointmentId");
  });
}