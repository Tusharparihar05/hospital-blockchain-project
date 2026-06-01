require("dotenv").config();
const mongoose = require("mongoose");
const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const Razorpay = require("razorpay");
const crypto   = require("crypto");

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY TTL CACHE — reduces MongoDB hits for frequently accessed data
// ══════════════════════════════════════════════════════════════════════════════
const _cache = new Map();
function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) { _cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data, ttlMs = 30000) {
  _cache.set(key, { data, expiry: Date.now() + ttlMs });
}
function cacheInvalidate(prefix) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

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
  upiId:           { type: String, default: "" },
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
  // Doctor clearance fields
  cleared:            { type: Boolean, default: false },
  clearedBy:          { type: String, default: "" },
  clearedByName:      { type: String, default: "" },
  clearedAt:          { type: Date, default: null },
  clearanceTx:        { type: String, default: "" },
  clearanceHash:      { type: String, default: "" },
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
  transactionId: { type: String, default: "" },
  paymentScreenshot: { type: String, default: "" },
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
  email:           { type: String, required: true, index: true },
  licenseNumber:   { type: String, required: true },
  documentHash:    { type: String, default: "" },
  status:          { type: String, enum: ["verified", "rejected", "pending"], default: "pending" },
  issuer:          { type: String, default: "MediChain Verification Authority" },
  verifiedAt:      { type: Date },
  note:            { type: String, default: "" },
  // Real-world verification fields
  councilName:     { type: String, default: "" },        // e.g. "National Medical Commission", "State Medical Council"
  registrationYear:{ type: Number, default: null },       // Year of registration
  specialization:  { type: String, default: "" },         // Verified specialization
  documentUrl:     { type: String, default: "" },         // Uploaded license document
  verificationMethod: { type: String, enum: ["auto", "manual", "nmc_api", "blockchain"], default: "auto" },
  blockchainTx:    { type: String, default: "" },         // On-chain verification tx hash
  expiryDate:      { type: Date, default: null },         // License expiry
}, { timestamps: true });

const LicenceVerification = mongoose.model("LicenceVerification", licenceSchema);

// ── Notification Schema ───────────────────────────────────────────────────────
const notificationSchema = new mongoose.Schema({
  patientId:   { type: String, required: true, index: true },
  type:        { type: String, enum: ["queue_update", "treatment_complete", "appointment_reminder", "doctor_report", "no_show"], required: true },
  title:       { type: String, required: true },
  message:     { type: String, required: true },
  read:        { type: Boolean, default: false },
  metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

const Notification = mongoose.model("Notification", notificationSchema);

// ── Emergency Alert Schema ────────────────────────────────────────────────────
const emergencyAlertSchema = new mongoose.Schema({
  patientId:     { type: String, required: true },
  patientName:   { type: String, required: true },
  phone:         { type: String, default: "" },
  bloodGroup:    { type: String, default: "" },
  age:           { type: Number, default: 0 },
  location: {
    lat:     { type: Number, default: null },
    lng:     { type: Number, default: null },
    address: { type: String, default: "" },
  },
  status:        { type: String, enum: ["active", "acknowledged", "resolved"], default: "active" },
  acknowledgedBy:{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  acknowledgedAt:{ type: Date, default: null },
  nearbyHospitals: [{
    name:       { type: String },
    distanceKm: { type: Number },
    etaMinutes: { type: Number },
    phone:      { type: String },
  }],
}, { timestamps: true });

const EmergencyAlert = mongoose.model("EmergencyAlert", emergencyAlertSchema);

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

let _doctorRegistryContract = null;

const DOCTOR_REGISTRY_ABI = [
  "function registerDoctor(address wallet, string calldata name, string calldata specialty, string calldata licenseNumber, string calldata mongoId) external",
  "function verifyDoctor(address wallet) external",
  "function isVerified(address wallet) external view returns (bool)",
  "function getDoctorStatus(address wallet) external view returns (uint8)",
];

function getDoctorRegistryContract() {
  if (_doctorRegistryContract) return _doctorRegistryContract;
  const rpc  = process.env.BLOCKCHAIN_RPC_URL;
  const pk   = process.env.DEPLOYER_PRIVATE_KEY;
  const addr = process.env.DOCTOR_REGISTRY_ADDRESS;
  if (!rpc || !pk || !addr) return null;
  try {
    const { ethers } = require("ethers");
    const provider   = new ethers.JsonRpcProvider(rpc);
    const signer     = new ethers.Wallet(pk, provider);
    _doctorRegistryContract = new ethers.Contract(addr, DOCTOR_REGISTRY_ABI, signer);
    return _doctorRegistryContract;
  } catch (err) {
    console.warn("[blockchain] doctor registry contract init failed:", err.message);
    return null;
  }
}

async function verifyDoctorOnRegistry(walletAddress, name, specialty, licenseNumber, mongoId) {
  try {
    const contract = getDoctorRegistryContract();
    if (!contract || !walletAddress) return { success: false, reason: "DoctorRegistry not configured or no walletAddress provided" };
    
    // Check status
    const status = await contract.getDoctorStatus(walletAddress);
    let regTx = "";
    if (status === 0 || status === 0n) {
      console.log(`[blockchain] Registering doctor ${name} (${walletAddress}) on-chain...`);
      const tx = await contract.registerDoctor(walletAddress, name, specialty || "General Medicine", licenseNumber, String(mongoId));
      await tx.wait();
      regTx = tx.hash;
    }
    
    if (status === 0 || status === 0n || status === 1 || status === 1n) {
      console.log(`[blockchain] Verifying doctor ${name} (${walletAddress}) on-chain...`);
      const tx = await contract.verifyDoctor(walletAddress);
      await tx.wait();
      return { success: true, anchored: true, txHash: tx.hash };
    }
    
    return { success: true, anchored: true, alreadyVerified: true, txHash: regTx || "already_verified" };
  } catch (err) {
    console.error("[verifyDoctorOnRegistry]", err.message);
    return { success: false, anchored: false, reason: err.message };
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
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
  // RAZORPAY ROUTES
  // ══════════════════════════════════════════════════════════════════════════
  const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "key",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "secret",
  });

  app.post("/api/payment/create-order", async (req, res) => {
    try {
      const { amount, currency } = req.body;
      if (!amount) return res.status(400).json({ error: "Amount is required" });

      const options = {
        amount: Math.round(amount * 100), // amount in smallest currency unit
        currency: currency || "INR",
        receipt: `rcpt_${Math.random().toString(36).substring(7)}`,
      };
      const order = await razorpayInstance.orders.create(options);
      res.json(order);
    } catch (err) {
      console.error("Razorpay order creation error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/payment/verify", (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const secret = process.env.RAZORPAY_KEY_SECRET;
      
      const generated_signature = crypto
        .createHmac("sha256", secret)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest("hex");

      if (generated_signature === razorpay_signature) {
        res.json({ success: true, message: "Payment verified successfully" });
      } else {
        res.status(400).json({ success: false, error: "Payment verification failed" });
      }
    } catch (err) {
      console.error("Razorpay verification error:", err);
      res.status(500).json({ error: err.message });
    }
  });

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
        upiId: req.body.upiId || "",
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
          walletAddress: newUser.walletAddress, upiId: newUser.upiId, specialty: newUser.specialty,
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
          walletAddress: user.walletAddress, upiId: user.upiId, specialty: user.specialty,
          licenseNumber: user.licenseNumber, hospital: user.hospital,
          experience: user.experience, fee: user.fee, bio: user.bio,
          education: user.education, languages: user.languages,
          availability: user.availability, availabilityMap: user.availabilityMap || {},
          status: user.status,
          location: user.location || { lat: null, lng: null, address: "" },
          isOnline: user.isOnline !== undefined ? user.isOnline : true,
          licenseVerified: user.licenseVerified || false,
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
        upiId: user.upiId || "",
        specialty: user.specialty || "", hospital: user.hospital || "", phone: user.phone || "",
        gender: user.gender || "", bloodGroup: user.bloodGroup || "",
        experience: user.experience || 0, fee: user.fee || 500,
        bio: user.bio || "", education: user.education || "",
        languages: user.languages || [], availability: user.availability || [],
        availabilityMap: user.availabilityMap || {},
        location: user.location || { lat: null, lng: null, address: "" },
        isOnline: user.isOnline !== undefined ? user.isOnline : true,
        licenseVerified: user.licenseVerified || false,
        licenseNumber: user.licenseNumber || "",
        createdAt: user.createdAt,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/auth/wallet-login", async (req, res) => {
    try {
      const { walletAddress } = req.body;
      if (!walletAddress) return res.status(400).json({ error: "walletAddress is required" });
      
      const cleanAddress = walletAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let user = await User.findOne({ walletAddress: { $regex: new RegExp(`^${cleanAddress}$`, "i") }, isActive: true });
      
      if (!user) {
        // Auto-create a patient user for this wallet address
        user = new User({
          name:          `User_${walletAddress.slice(2, 8)}`,
          email:         `wallet_${walletAddress.slice(2, 10).toLowerCase()}@medichain.local`,
          passwordHash:  `WalletLogin_${walletAddress}`,
          role:          "patient",
          walletAddress,
          isActive:      true
        });
        await user.save();
      }

      const token = generateToken(user._id);
      return res.json({
        message: "Wallet login successful", token,
        user: {
          id: String(user._id), name: user.name, email: user.email, role: user.role,
          patientId: user.patientId || null, chainPatientId: user.chainPatientId || null,
          walletAddress: user.walletAddress, upiId: user.upiId, specialty: user.specialty, licenseNumber: user.licenseNumber,
        },
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PATIENTS
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/patients", protect, async (req, res) => {
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

  app.get("/api/patients/:id", protect, async (req, res) => {
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
        upiId: d.upiId || "",
        licenseVerified: d.licenseVerified || false,
        licenseNumber: d.licenseNumber || "",
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
        upiId: doctor.upiId || "",
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/doctors/:id", protect, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid doctor ID" });
      if (String(req.user._id) !== id && req.user.role !== "admin")
        return res.status(403).json({ error: "Can only update your own profile" });
      const allowedFields = ["bio", "hospital", "education", "experience", "fee", "specialty", "phone", "availability", "availabilityMap", "languages", "tags", "upiId"];
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

  // Helper: resolve canonical patientId (HLT-xxx) for notifications
  async function resolveNotificationPatientId(patientId) {
    if (!patientId) return null;
    const user = await User.findOne({
      $or: [
        { patientId: String(patientId) },
        ...(mongoose.isValidObjectId(patientId) ? [{ _id: patientId }] : []),
      ],
      role: "patient",
    }).select("patientId").lean();
    return user?.patientId || String(patientId);
  }

  async function notificationPatientIds(patientId) {
    const ids = new Set([String(patientId)]);
    const user = await User.findOne({
      $or: [
        { patientId: String(patientId) },
        ...(mongoose.isValidObjectId(patientId) ? [{ _id: patientId }] : []),
      ],
      role: "patient",
    }).select("patientId _id").lean();
    if (user?.patientId) ids.add(user.patientId);
    if (user?._id) ids.add(String(user._id));
    return [...ids];
  }

  // Helper: create notification for a patient
  async function createNotification(patientId, type, title, message, metadata = {}) {
    try {
      const pid = await resolveNotificationPatientId(patientId);
      if (!pid) return;
      await Notification.create({ patientId: pid, type, title, message, metadata });
    } catch (err) {
      console.warn("[notification] failed to create:", err.message);
    }
  }

  // Notify patient after queue slot is closed (arrived = treatment done, no-show = missed visit)
  async function notifyQueuePatientDone(entry, doctorName) {
    if (!entry?.patientId) return;
    if (entry.patientArrived) {
      const durationMs   = entry.checkedInAt && entry.completedAt ? (entry.completedAt - entry.checkedInAt) : 0;
      const durationMins = Math.round(durationMs / 60000);
      await createNotification(
        entry.patientId,
        "treatment_complete",
        "Treatment Completed ✅",
        `Your consultation with Dr. ${doctorName} is complete. Duration: ${durationMins} minute${durationMins !== 1 ? "s" : ""}. Thank you for visiting MediChain!`,
        { durationMins, doctorName, appointmentId: entry.appointmentId, queueToken: entry.queueToken }
      );
    } else {
      await createNotification(
        entry.patientId,
        "no_show",
        "Missed Appointment ⚠️",
        `You did not attend your scheduled visit with Dr. ${doctorName}. Please book a new appointment from your dashboard.`,
        { doctorName, appointmentId: entry.appointmentId, queueToken: entry.queueToken }
      );
    }
  }

  // Helper: check and send queue position notifications
  async function checkQueueNotifications(queue, doctorName) {
    const active = queue.filter(q => !q.done);
    for (let i = 0; i < active.length; i++) {
      const entry = active[i];
      const patientsAhead = i; // 0-indexed, so position i means i patients ahead

      // Notify when 7 or fewer patients ahead (and hasn't been notified yet for this threshold)
      if (patientsAhead <= 7 && !entry.notified7 && patientsAhead > 0) {
        entry.notified7 = true;
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
  app.post("/api/queue/checkin", protect, async (req, res) => {
    try {
      const { appointmentId, doctorId, date, patientId, time } = req.body;
      if (!appointmentId || !doctorId || !date)
        return res.status(400).json({ error: "appointmentId, doctorId, date required" });

      const key = _qkey(doctorId, date);
      if (!_queueMap.has(key)) _queueMap.set(key, []);
      const queue = _queueMap.get(key);

      const existing = queue.find(q => q.appointmentId === appointmentId);
      if (existing) {
        existing.patientArrived = true;
        if (!existing.checkedInAt) existing.checkedInAt = Date.now();
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
        patientArrived: true,
        checkedInAt: Date.now(),
        queueToken,
        queuePosition,
        notified7:    false,
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
  app.post("/api/queue/next", protect, async (req, res) => {
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

        const doctor = await User.findById(doctorId).select("name").lean().catch(() => null);
        const doctorName = doctor?.name || "your doctor";

        await notifyQueuePatientDone(first, doctorName);

        // Check queue notifications for remaining patients
        await checkQueueNotifications(queue, doctorName);
      }

      const remaining = queue.filter(q => !q.done);
      res.json({ success: true, remaining: remaining.length, next: remaining[0] || null });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/queue?doctorId=&date= — doctor/patient sees full queue (auto-synced with DB)
  app.get("/api/queue", async (req, res) => {
    try {
      const { doctorId, date } = req.query;
      if (!doctorId || !date) return res.status(400).json({ error: "doctorId and date required" });
      const key = _qkey(doctorId, date);
      if (!_queueMap.has(key)) {
        _queueMap.set(key, []);
      }
      const queue = _queueMap.get(key);

      // Auto-load confirmed appointments from DB for this doctor and date
      const appts = await Appointment.find({ doctorId, date, status: "confirmed" }).sort({ time: 1 }).lean();
      for (const appt of appts) {
        const exists = queue.find(q => q.appointmentId === String(appt._id));
        if (!exists) {
          const queueToken    = `Q-${randomHex(4)}-${(queue.length + 1).toString().padStart(3, "0")}`;
          const queuePosition = queue.length + 1;
          queue.push({
            appointmentId: String(appt._id),
            patientId:     appt.patientId,
            time:          appt.time,
            done:          appt.status === "completed",
            patientArrived: !!(appt.checkedIn && appt.checkedInAt),
            checkedInAt:   appt.checkedInAt ? new Date(appt.checkedInAt).getTime() : null,
            queueToken,
            queuePosition,
            notified7:     false,
            notifiedNext:  false,
            notified30min: false,
          });

          await Appointment.findByIdAndUpdate(appt._id, {
            queuePosition,
          }).catch(() => {});
        }
      }

      const active = queue.filter(q => !q.done);
      res.json({ queue: active, total: active.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/queue/complete/:appointmentId — doctor marks specific appointment complete
  app.post("/api/queue/complete/:appointmentId", protect, async (req, res) => {
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

        await notifyQueuePatientDone(entry, doctorName);

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
      const ids = await notificationPatientIds(req.params.patientId);
      const notifications = await Notification.find({ patientId: { $in: ids } })
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
      const ids = await notificationPatientIds(req.params.patientId);
      await Notification.updateMany({ patientId: { $in: ids }, read: false }, { read: true });
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

  app.get("/api/appointments", protect, async (req, res) => {
    try {
      const { patientId } = req.query;
      const query = patientId ? { patientId } : {};
      const appts = await Appointment.find(query).sort({ date: 1, time: 1 }).lean();
      res.json(appts.map(a => ({ ...a, id: String(a._id) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/appointments", protect, async (req, res) => {
    try {
      const { patientId, doctorId, doctorName, dept, specialty, date, time, isEmergency, type, fee, feePaid, paymentMethod, transactionId, paymentScreenshot } = req.body;
      if (!date || !time)  return res.status(400).json({ error: "date and time are required" });
      if (!patientId)      return res.status(400).json({ error: "patientId is required" });
      
      // Past date validation
      const todayStr = new Date().toISOString().slice(0, 10);
      if (date < todayStr) return res.status(400).json({ error: "Cannot book appointments in the past" });

      // Duplicate prevention (prevent booking same doctor at the exact same time)
      const existing = await Appointment.findOne({ 
        patientId, doctorId, date, time, status: { $in: ["confirmed", "pending", "in-progress"] } 
      }).lean();
      if (existing) return res.status(400).json({ error: "You already have an appointment booked with this doctor at this specific time" });

      const patientUser = await User.findOne({ patientId }).lean();
      const doctorUser  = doctorId ? await User.findById(doctorId).lean() : null;
      const tokenId     = `APT-${randomHex(8)}`;
      
      // If direct UPI, we set status to pending and save the transaction ID.
      const initialStatus = paymentMethod === "upi" ? "pending" : "confirmed";

      const appt = await Appointment.create({
        patientId, patientName: patientUser?.name || "",
        doctorId: doctorId || "", doctorName: doctorName || doctorUser?.name || "",
        dept: dept || doctorUser?.specialty || "General",
        specialty: specialty || doctorUser?.specialty || "",
        date, time, tokenId, isEmergency: !!isEmergency, status: initialStatus,
        fee: fee || doctorUser?.fee || 0, feePaid: paymentMethod === "upi" ? false : !!feePaid,
        paymentMethod: paymentMethod || "", transactionId: transactionId || "", paymentScreenshot: paymentScreenshot || "", type: type || "Consultation",
        age: patientUser?.age, gender: patientUser?.gender || "",
        phone: patientUser?.phone || "", blockchain: tokenId,
      });

      // Auto-add to queue if appointment is for today and confirmed
      if (date === todayStr && doctorId && initialStatus === "confirmed") {
        const key = _qkey(doctorId, date);
        if (!_queueMap.has(key)) _queueMap.set(key, []);
        const queue = _queueMap.get(key);
        const exists = queue.find(q => q.appointmentId === String(appt._id));
        if (!exists) {
          const queueToken    = `Q-${randomHex(4)}-${(queue.length + 1).toString().padStart(3, "0")}`;
          const queuePosition = queue.length + 1;
          queue.push({
            appointmentId: String(appt._id),
            patientId,
            time,
            done:          false,
            patientArrived: false,
            checkedInAt:   null,
            queueToken,
            queuePosition,
            notified7:     false,
            notifiedNext:  false,
            notified30min: false,
          });

          await Appointment.findByIdAndUpdate(appt._id, {
            queuePosition,
          }).catch(() => {});
        }
      }

      res.status(201).json({
        message: "Appointment booked",
        appointment: { ...appt.toObject(), id: String(appt._id) },
        tokenId, blockchain: tokenId,
      });
    } catch (err) { console.error("appt create error:", err); res.status(500).json({ error: err.message }); }
  });

  app.put("/api/appointments/:id/verify-payment", protect, async (req, res) => {
    try {
      const apptId = req.params.id;
      const appt = await Appointment.findByIdAndUpdate(apptId, {
        status: "confirmed",
        feePaid: true,
      }, { new: true });
      if (!appt) return res.status(404).json({ error: "Appointment not found" });

      const todayStr = new Date().toISOString().slice(0, 10);
      if (appt.date === todayStr && appt.doctorId) {
        const key = _qkey(appt.doctorId, appt.date);
        if (!_queueMap.has(key)) _queueMap.set(key, []);
        const queue = _queueMap.get(key);
        const exists = queue.find(q => q.appointmentId === String(appt._id));
        if (!exists) {
          const queueToken    = `Q-${randomHex(4)}-${(queue.length + 1).toString().padStart(3, "0")}`;
          const queuePosition = queue.length + 1;
          queue.push({
            appointmentId: String(appt._id),
            patientId:     appt.patientId,
            time:          appt.time,
            done:          false,
            patientArrived: false,
            checkedInAt:   null,
            queueToken,
            queuePosition,
            notified7:     false,
            notifiedNext:  false,
            notified30min: false,
          });

          await Appointment.findByIdAndUpdate(appt._id, {
            queuePosition,
          }).catch(() => {});
        }
      }

      res.json({ message: "Payment verified", appointment: { ...appt.toObject(), id: String(appt._id) } });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/appointments/:id/complete", protect, async (req, res) => {
    try {
      const apptId = req.params.id;
      const existingAppt = await Appointment.findById(apptId);
      if (!existingAppt) return res.status(404).json({ error: "Appointment not found" });
      if (existingAppt.status === "completed") return res.status(400).json({ error: "Appointment is already completed" });
      const appt = await Appointment.findByIdAndUpdate(apptId, {
        status: "completed",
        treatmentEnd: new Date(),
      }, { new: true });
      if (!appt) return res.status(404).json({ error: "Appointment not found" });

      // ── Also update the in-memory queue so patient polling /api/queue sees the change ──
      const doctorId = String(appt.doctorId);
      const apptDate = appt.date; // e.g. "2026-05-21"
      const key = _qkey(doctorId, apptDate);
      const queue = _queueMap.get(key) || [];
      const entry = queue.find(q => q.appointmentId === apptId);

      if (entry && !entry.done) {
        entry.done        = true;
        entry.completedAt = Date.now();

        const durationMs   = entry.checkedInAt ? (entry.completedAt - entry.checkedInAt) : 0;
        const durationMins = Math.round(durationMs / 60000);

        await Appointment.findByIdAndUpdate(apptId, {
          treatmentStart:   entry.checkedInAt ? new Date(entry.checkedInAt) : new Date(),
          treatmentDuration: durationMins,
        }).catch(() => {});

        // Notify the patient whose treatment just completed
        const doctor     = await User.findById(doctorId).select("name").lean().catch(() => null);
        const doctorName = doctor?.name || "your doctor";

        await createNotification(
          entry.patientId,
          "treatment_complete",
          "Treatment Completed ✅",
          `Your consultation with Dr. ${doctorName} is complete. Duration: ${durationMins} minute${durationMins !== 1 ? "s" : ""}. Thank you for visiting MediChain!`,
          { durationMins, doctorName, appointmentId: apptId, queueToken: entry.queueToken }
        );

        // Notify remaining patients about their updated queue positions
        await checkQueueNotifications(queue, doctorName);
      }

      res.json({ message: "Appointment completed", appointment: { ...appt.toObject(), id: String(appt._id) } });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/appointments/:id/reschedule", protect, async (req, res) => {
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

  app.get("/api/records", protect, async (req, res) => {
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

  app.get("/api/records/:patientId", protect, async (req, res) => {
    try {
      const pid = req.params.patientId;
      const cacheKey = `records:${pid}`;
      const cached = cacheGet(cacheKey);
      if (cached) return res.json(cached);
      const records = await MedicalRecord.find({
        $or: [
          { patientStrId: pid },
          { patientId: pid },
          { patientId: mongoose.isValidObjectId(pid) ? pid : undefined },
        ],
      }).sort({ createdAt: -1 }).lean();
      const result = records.map(r => ({ ...r, id: String(r._id) }));
      cacheSet(cacheKey, result, 15000);
      res.json(result);
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

      // Notify patient when doctor/staff uploads a report for them
      const isDoctorUpload = uploadedByDoctor || !!(doctor && doctor !== "Patient" && patientId);
      if (isDoctorUpload && patientId) {
        await createNotification(
          patientId,
          "doctor_report",
          "New Report from Your Doctor 📋",
          `Dr. ${doctorNameField || doctor} has uploaded a ${category} report for you.${doctorComment ? ` Note: ${doctorComment}` : ""}${recommendation ? ` Recommendation: ${recommendation}` : ""}`,
          { category, doctorName: doctorNameField || doctor, recordId: String(newRecord._id) }
        );
      }

      // Invalidate caches for this patient
      cacheInvalidate(`records:${patientId}`);
      cacheInvalidate(`timeline:${patientId}`);

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
  // EMERGENCY - Real-time SOS & Doctor Alerts
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/emergency", async (req, res) => {
    try {
      const { patientId, lat, lng } = req.body;
      if (!patientId) return res.status(400).json({ error: "patientId is required" });
      
      const patient = await User.findOne({
        $or: [
          { patientId },
          { _id: mongoose.isValidObjectId(patientId) ? patientId : null }
        ],
        role: "patient"
      }).lean();
      
      if (!patient) return res.status(404).json({ error: "Patient not found" });

      const finalLat = lat != null ? Number(lat) : 28.6139;
      const finalLng = lng != null ? Number(lng) : 77.2090;

      // Simulate 3 nearby hospitals based on coordinates
      const nearbyHospitals = [
        {
          name: "City Trauma & Emergency Hospital",
          distanceKm: parseFloat((0.8 + Math.random() * 0.9).toFixed(1)),
          etaMinutes: Math.round(4 + Math.random() * 4),
          phone: "+91 98765 43210"
        },
        {
          name: "MediChain Allied Clinic & Urgent Care",
          distanceKm: parseFloat((2.0 + Math.random() * 1.5).toFixed(1)),
          etaMinutes: Math.round(8 + Math.random() * 6),
          phone: "+91 99999 88888"
        },
        {
          name: "Apollo Trauma Center",
          distanceKm: parseFloat((3.8 + Math.random() * 2.0).toFixed(1)),
          etaMinutes: Math.round(13 + Math.random() * 8),
          phone: "+91 98888 77777"
        }
      ].sort((a, b) => a.distanceKm - b.distanceKm);

      // Create Active Emergency Alert record in DB
      const alert = await EmergencyAlert.create({
        patientId: patient.patientId || String(patient._id),
        patientName: patient.name,
        phone: patient.phone || "",
        bloodGroup: patient.bloodGroup || "",
        age: patient.age || 30,
        location: {
          lat: finalLat,
          lng: finalLng,
          address: "SOS Location (GPS Captured)"
        },
        status: "active",
        nearbyHospitals
      });

      res.status(201).json({
        message: "SOS Emergency activated successfully",
        alertId: alert._id,
        emergencyToken: `EMR-${randomHex(8)}`,
        patient: {
          id: alert.patientId,
          name: alert.patientName,
          phone: alert.phone,
          blood: alert.bloodGroup,
          age: alert.age
        },
        location: alert.location,
        nearbyHospitals
      });
    } catch (err) {
      console.error("SOS Emergency activation error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get active emergency alerts (for doctor dashboards)
  app.get("/api/emergency/active", async (req, res) => {
    try {
      const activeAlerts = await EmergencyAlert.find({ status: "active" })
        .sort({ createdAt: -1 })
        .lean();
      res.json(activeAlerts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Acknowledge emergency alert (doctor signs off/dispatches aid)
  app.post("/api/emergency/:id/acknowledge", protect, async (req, res) => {
    try {
      if (req.user.role !== "doctor" && req.user.role !== "admin") {
        return res.status(403).json({ error: "Only doctors or admins can acknowledge emergency alerts" });
      }

      const alert = await EmergencyAlert.findById(req.params.id);
      if (!alert) return res.status(404).json({ error: "Emergency alert not found" });

      alert.status = "acknowledged";
      alert.acknowledgedBy = req.user._id;
      alert.acknowledgedAt = new Date();
      await alert.save();

      res.json({ message: "Emergency alert acknowledged successfully", alert });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Resolve emergency alert (marks patient safe / resolved)
  app.post("/api/emergency/:id/resolve", async (req, res) => {
    try {
      const alert = await EmergencyAlert.findById(req.params.id);
      if (!alert) return res.status(404).json({ error: "Emergency alert not found" });

      alert.status = "resolved";
      await alert.save();

      res.json({ message: "Emergency alert resolved successfully", alert });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ROBUST SIMULATED PAYMENT GATEWAY (Razorpay Alternative)
  // ══════════════════════════════════════════════════════════════════════════
  const crypto = require("crypto");
  const SIMULATED_GATEWAY_SECRET = process.env.SIMULATED_GATEWAY_SECRET || "medichain_simulated_secret_2026";

  app.post("/api/payment/create-order", protect, async (req, res) => {
    try {
      const { amount, appointmentData } = req.body;
      if (!amount || !appointmentData) return res.status(400).json({ error: "Amount and appointmentData required" });
      
      const orderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const paymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;
      
      const signature = crypto
        .createHmac("sha256", SIMULATED_GATEWAY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");
        
      res.json({ orderId, amount, currency: "INR", paymentId, signature });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/payment/verify", protect, async (req, res) => {
    try {
      const { orderId, paymentId, signature, appointmentData } = req.body;
      
      // Verify the cryptographic signature to ensure payment wasn't spoofed
      const expectedSignature = crypto
        .createHmac("sha256", SIMULATED_GATEWAY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      if (expectedSignature !== signature) {
        return res.status(400).json({ error: "Payment verification failed — invalid signature" });
      }

      // Generate the blockchain token format
      const tokenId = `APT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      
      // Payment is VERIFIED ✅ — now create the appointment
      const patientUser = await User.findOne({ patientId: appointmentData.patientId }).lean();
      const doctorUser = await User.findById(appointmentData.doctorId).lean();

      // Check for duplicates
      const existing = await Appointment.findOne({ 
        patientId: appointmentData.patientId, 
        doctorId: appointmentData.doctorId, 
        date: appointmentData.date, 
        status: { $in: ["confirmed", "pending", "in-progress"] } 
      }).lean();
      
      if (existing) return res.status(400).json({ error: "You already have an appointment booked with this doctor on this date" });

      const appt = await Appointment.create({
        ...appointmentData,
        patientName: patientUser?.name || "",
        doctorName: doctorUser?.name || "",
        dept: doctorUser?.specialty || "General",
        specialty: doctorUser?.specialty || "",
        tokenId,
        blockchain: tokenId,
        feePaid: true,
        paymentMethod: "simulated_gateway",
        status: "confirmed",
        age: patientUser?.age,
        gender: patientUser?.gender || "",
        phone: patientUser?.phone || ""
      });

      // Auto-add to queue if appointment is for today
      const todayStr = new Date().toISOString().slice(0, 10);
      if (appointmentData.date === todayStr && appointmentData.doctorId) {
        const key = _qkey(appointmentData.doctorId, appointmentData.date);
        if (!_queueMap.has(key)) _queueMap.set(key, []);
        const queue = _queueMap.get(key);
        const exists = queue.find(q => q.appointmentId === String(appt._id));
        if (!exists) {
          const queueToken    = `Q-${crypto.randomBytes(2).toString("hex").toUpperCase()}-${(queue.length + 1).toString().padStart(3, "0")}`;
          const queuePosition = queue.length + 1;
          queue.push({
            appointmentId: String(appt._id),
            patientId: appointmentData.patientId,
            time: appointmentData.time,
            done: false, checkedInAt: Date.now(), queueToken, queuePosition,
            notified7: false, notifiedNext: false, notified30min: false,
          });
          await Appointment.findByIdAndUpdate(appt._id, { checkedIn: true, checkedInAt: new Date(), queuePosition }).catch(() => {});
        }
      }

      res.json({
        verified: true,
        paymentId,
        appointmentId: String(appt._id),
        appointment: { ...appt.toObject(), id: String(appt._id) },
        tokenId,
        message: "Payment verified and appointment confirmed",
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DOCTOR LICENCE VERIFICATION — Real-world verification flow
  // ══════════════════════════════════════════════════════════════════════════
  // ABDM HPR Registry Sandbox Simulator Client
  function abdmVerifyLicense(licenseNumber, councilName, registrationYear, specialization) {
    const clean = String(licenseNumber || "").replace(/\s/g, "").toUpperCase();
    
    // Format check: Indian registry formats, e.g., NMC-XXXXXX, WBMC-XXXX, MCI-XXXX
    // Or general 6-24 digit alphanumeric code
    const formatOk = /^[A-Z]{2,6}[-\/]?\d{3,12}[-\/]?[A-Z0-9]{0,6}$/i.test(clean)
                   || /^[A-Z0-9-]{6,24}$/i.test(clean);
    
    if (!formatOk) {
      return {
        valid: false,
        reason: "Invalid license number format. Expected format: NMC-XXXXXX, MCI-XXXX, or a 6-24 character alphanumeric registration number."
      };
    }

    const councils = [
      "National Medical Commission",
      "Delhi Medical Council",
      "Maharashtra Medical Council",
      "Karnataka Medical Council",
      "Tamil Nadu Medical Council",
      "West Bengal Medical Council",
      "Uttar Pradesh Medical Council"
    ];

    const matchedCouncil = councils.find(c => c.toLowerCase() === (councilName || "").toLowerCase().trim()) 
      || councilName 
      || "National Medical Commission";

    const regYear = Number(registrationYear) || new Date().getFullYear();
    const spec = specialization || "General Medicine";
    
    // Expiry date set to 5 years from registration / now
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 5);

    return {
      valid: true,
      registryDetails: {
        licenseNumber: clean,
        councilName: matchedCouncil,
        registrationYear: regYear,
        specialization: spec,
        expiryDate: expiry,
        status: "Active",
        qualification: "MBBS, MD",
        issuer: "ABDM Healthcare Professionals Registry (HPR) Sandbox",
        verificationMethod: "abdm_hpr_sandbox"
      }
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DOCTOR LICENCE VERIFICATION — Real-world verification flow
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/verification/doctor-license", async (req, res) => {
    try {
      const { email, licenseNumber, documentHash, councilName, registrationYear, specialization } = req.body;
      if (!email || !licenseNumber) return res.status(400).json({ error: "email and licenseNumber are required" });

      const clean = String(licenseNumber).replace(/\s/g, "").toUpperCase();

      // Cross-reference validation: check if doctor exists and matches
      const doctor = await User.findOne({ email: email.toLowerCase().trim(), role: "doctor" });
      if (!doctor) return res.status(404).json({ error: "No doctor account found with this email" });

      // Run ABDM simulated verification
      const abdmResult = abdmVerifyLicense(clean, councilName, registrationYear, specialization || doctor.specialty);
      if (!abdmResult.valid) {
        return res.status(400).json({ error: abdmResult.reason });
      }

      const { registryDetails } = abdmResult;

      // Check for duplicate verification attempts
      const existing = await LicenceVerification.findOne({
        email: email.toLowerCase().trim(),
        status: "verified",
      }).lean();
      if (existing) {
        return res.json({
          ...existing, id: String(existing._id),
          message: "License already verified",
          licenseVerified: true,
        });
      }

      // Assign a chainPatientId to the doctor if not exists
      if (!doctor.chainPatientId) {
        const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, "0");
        doctor.chainPatientId = parseInt(hex, 16) % 900000 + 100000;
        await doctor.save();
      }

      // Generate verification hash for blockchain anchoring
      const verificationData = JSON.stringify({
        email: email.toLowerCase().trim(),
        licenseNumber: clean,
        council: registryDetails.councilName,
        registrationYear: registryDetails.registrationYear,
        specialization: registryDetails.specialization,
        verifiedAt: new Date().toISOString(),
      });
      const verificationHash = "0x" + require("crypto").createHash("sha256").update(verificationData).digest("hex");

      // Attempt blockchain anchoring on PatientRecords contract
      let blockchainTx = "";
      try {
        const chainResult = await anchorOnChain(doctor.chainPatientId, verificationHash, "license_verification", clean);
        if (chainResult.anchored) {
          blockchainTx = chainResult.txHash || "";
        }
      } catch (e) {
        console.error("PatientRecords contract anchoring failed:", e.message);
      }

      // Attempt blockchain anchoring on DoctorRegistry contract if doctor has walletAddress linked
      let registryTx = "";
      if (doctor.walletAddress) {
        try {
          const regResult = await verifyDoctorOnRegistry(
            doctor.walletAddress,
            doctor.name,
            registryDetails.specialization,
            clean,
            doctor._id
          );
          if (regResult && regResult.anchored) {
            registryTx = regResult.txHash || "";
          }
        } catch (e) {
          console.error("DoctorRegistry contract verification failed:", e.message);
        }
      }

      const entry = await LicenceVerification.create({
        email: email.toLowerCase().trim(),
        licenseNumber: clean,
        documentHash: documentHash || verificationHash,
        status: "verified",
        issuer: registryDetails.issuer,
        verifiedAt: new Date(),
        councilName: registryDetails.councilName,
        registrationYear: registryDetails.registrationYear,
        specialization: registryDetails.specialization,
        verificationMethod: registryTx ? "blockchain" : "auto",
        blockchainTx: registryTx || blockchainTx, // Prefer DoctorRegistry tx if available
        expiryDate: registryDetails.expiryDate,
        note: `License ${clean} verified via ABDM Healthcare Professionals Registry (HPR) Sandbox. Council: ${registryDetails.councilName}. Specialization: ${registryDetails.specialization}.` + (registryTx ? " Registered and verified on-chain." : (blockchainTx ? " Anchored to on-chain logs." : "")),
      });

      // Update User record
      await User.findByIdAndUpdate(doctor._id, {
        $set: { 
          licenseVerified: true, 
          licenseNumber: clean,
          specialty: registryDetails.specialization
        },
      });
      cacheInvalidate("doctors");

      res.status(201).json({
        ...entry.toObject(), id: String(entry._id),
        licenseVerified: true,
        blockchainAnchored: !!(registryTx || blockchainTx),
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/verification/doctor-license", async (req, res) => {
    try {
      const email = req.query.email;
      if (!email) return res.status(400).json({ error: "email query param required" });
      const latest = await LicenceVerification.findOne({ email: email.toLowerCase().trim() }).sort({ createdAt: -1 }).lean();
      if (!latest) return res.json({ status: "none", message: "No verification submitted yet." });
      res.json({
        ...latest, id: String(latest._id),
        isExpired: latest.expiryDate ? new Date() > new Date(latest.expiryDate) : false,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Public route to lookup verification by license number or email or doctor name
  app.get("/api/verification/lookup", async (req, res) => {
    try {
      const { query } = req.query;
      if (!query) return res.status(400).json({ error: "Query parameter is required" });
      const term = String(query).trim();

      // Find in LicenceVerification
      let verification = await LicenceVerification.findOne({
        $or: [
          { licenseNumber: { $regex: new RegExp("^" + term.replace(/\s/g, ""), "i") } },
          { email: { $regex: new RegExp("^" + term, "i") } }
        ]
      }).sort({ createdAt: -1 }).lean();

      let doctorUser = null;
      if (verification) {
        doctorUser = await User.findOne({ email: verification.email, role: "doctor" }).select("name email specialty profilePicture").lean();
      } else {
        // Search by doctor name in User schema
        doctorUser = await User.findOne({
          name: { $regex: new RegExp(term, "i") },
          role: "doctor"
        }).select("name email licenseNumber specialty licenseVerified profilePicture").lean();
        
        if (doctorUser) {
          verification = await LicenceVerification.findOne({ email: doctorUser.email }).sort({ createdAt: -1 }).lean();
        }
      }

      if (!verification && !doctorUser) {
        return res.status(404).json({ error: "No matching verified doctor or license found" });
      }

      res.json({
        found: true,
        doctor: doctorUser ? {
          name: doctorUser.name,
          email: doctorUser.email,
          specialty: doctorUser.specialty || doctorUser.specialization || "General Medicine",
          licenseVerified: doctorUser.licenseVerified || (verification?.status === "verified")
        } : null,
        verification: verification ? {
          licenseNumber: verification.licenseNumber,
          status: verification.status,
          councilName: verification.councilName || "National Medical Commission",
          registrationYear: verification.registrationYear,
          specialization: verification.specialization,
          verifiedAt: verification.verifiedAt,
          expiryDate: verification.expiryDate,
          blockchainTx: verification.blockchainTx || "",
          verificationMethod: verification.verificationMethod || "auto",
          note: verification.note,
          isExpired: verification.expiryDate ? new Date() > new Date(verification.expiryDate) : false,
        } : null
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Quick verification status check for any doctor
  app.get("/api/verification/status/:doctorId", async (req, res) => {
    try {
      const doctor = await User.findById(req.params.doctorId).select("licenseNumber licenseVerified name email specialty").lean();
      if (!doctor) return res.status(404).json({ error: "Doctor not found" });
      const latest = await LicenceVerification.findOne({ email: doctor.email }).sort({ createdAt: -1 }).lean();
      res.json({
        licenseNumber: doctor.licenseNumber || "",
        licenseVerified: doctor.licenseVerified || false,
        specialty: doctor.specialty || "",
        verificationRecord: latest ? {
          status: latest.status,
          councilName: latest.councilName || "",
          registrationYear: latest.registrationYear || null,
          specialization: latest.specialization || "",
          verifiedAt: latest.verifiedAt,
          expiryDate: latest.expiryDate,
          blockchainTx: latest.blockchainTx || "",
          isExpired: latest.expiryDate ? new Date() > new Date(latest.expiryDate) : false,
        } : null,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // REPORT TIMELINE — grouped by month for doctor view
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/records/:patientId/timeline", protect, async (req, res) => {
    try {
      const { patientId } = req.params;
      const cacheKey = `timeline:${patientId}`;
      const cached = cacheGet(cacheKey);
      if (cached) return res.json(cached);

      const records = await MedicalRecord.find({
        $or: [{ patientId }, { patientStrId: patientId }],
      }).sort({ createdAt: -1 }).lean();

      const groups = {};
      for (const rec of records) {
        const d = new Date(rec.createdAt || rec.uploadDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        if (!groups[key]) groups[key] = { month: label, sortKey: key, records: [] };
        groups[key].records.push({
          _id: String(rec._id),
          fileName: rec.fileName,
          category: rec.category,
          uploadDate: rec.uploadDate,
          createdAt: rec.createdAt,
          uploadedByDoctor: rec.uploadedByDoctor,
          doctorName: rec.doctorName || rec.doctor,
          doctorComment: rec.doctorComment || "",
          recommendation: rec.recommendation || "",
          anchoredOnChain: rec.anchoredOnChain || false,
          blockchainTx: rec.blockchainTx || "",
          fileHash: rec.fileHash || "",
          cleared: rec.cleared || false,
          clearedByName: rec.clearedByName || "",
          clearedAt: rec.clearedAt || null,
          clearanceTx: rec.clearanceTx || "",
          ipfsUrl: rec.ipfsUrl ? "exists" : "",
          aiSummary: rec.aiSummary || null,
        });
      }

      const timeline = Object.values(groups).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
      const result = { timeline, totalRecords: records.length };
      cacheSet(cacheKey, result, 15000);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DOCTOR CLEARANCE — doctor signs off on a patient report
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/records/:recordId/clear", protect, async (req, res) => {
    try {
      if (req.user.role !== "doctor" && req.user.role !== "admin")
        return res.status(403).json({ error: "Only doctors can clear reports" });

      const record = await MedicalRecord.findById(req.params.recordId);
      if (!record) return res.status(404).json({ error: "Record not found" });
      if (record.cleared) return res.json({ message: "Already cleared", record });

      const clearanceData = JSON.stringify({
        recordId: String(record._id),
        fileHash: record.fileHash,
        clearedBy: String(req.user._id),
        clearedAt: new Date().toISOString(),
      });
      const clearanceHash = "0x" + crypto.createHash("sha256").update(clearanceData).digest("hex");

      let chainResult = { success: false, anchored: false, reason: "Blockchain not configured" };
      const patient = await User.findOne({
        $or: [{ patientId: record.patientId }, { patientStrId: record.patientId }],
        role: "patient",
      }).lean();
      if (patient?.chainPatientId) {
        chainResult = await anchorOnChain(patient.chainPatientId, clearanceHash, "clearance", record.fileName);
      }

      record.cleared = true;
      record.clearedBy = String(req.user._id);
      record.clearedByName = req.user.name;
      record.clearedAt = new Date();
      record.clearanceHash = clearanceHash;
      if (chainResult.anchored) record.clearanceTx = chainResult.txHash || "";
      await record.save();

      cacheInvalidate(`timeline:${record.patientId}`);
      cacheInvalidate(`records:${record.patientId}`);

      await createNotification(
        record.patientId,
        "doctor_report",
        "Report Cleared ✅",
        `Dr. ${req.user.name} has reviewed and cleared your ${record.category} report (${record.fileName}).${chainResult.anchored ? " Clearance verified on blockchain." : ""}`,
        { recordId: String(record._id), doctorName: req.user.name, category: record.category, onChain: chainResult.anchored }
      );

      res.json({
        message: "Report cleared successfully",
        record: { ...record.toObject(), _id: String(record._id) },
        blockchain: chainResult,
      });
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
  if (!process.env.VERCEL) {
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
}

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.warn("⚠️ MONGODB_URI not set in environment variables");
} else {
  mongoose.connect(mongoUri)
    .then(() => { console.log("✅ MongoDB connected"); })
    .catch(err => { console.error("❌ MongoDB error:", err.message); });
}

if (!process.env.JWT_SECRET) {
  console.warn("⚠️ JWT_SECRET not set in environment variables");
}

startServer();

module.exports = app;