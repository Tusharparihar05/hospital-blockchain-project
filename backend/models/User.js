// Paste your User schema code hereconst mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name:          { type: String, required: true, trim: true },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash:  { type: String, required: true },
    role:          { type: String, enum: ["patient", "doctor", "admin"], default: "patient" },

    // ── Contact ───────────────────────────────────────────────────────────────
    phone:         { type: String, default: "" },

    // ── Patient-specific ─────────────────────────────────────────────────────
    patientId:     { type: String, unique: true, sparse: true },   // e.g. HLT-0x72A91B
    chainPatientId:{ type: Number },                               // numeric on-chain ID
    dateOfBirth:   { type: Date },
    gender:        { type: String, enum: ["Male", "Female", "Other", ""], default: "" },
    bloodGroup:    { type: String, default: "" },

    // ── Doctor-specific ───────────────────────────────────────────────────────
    specialty:     { type: String, default: "" },
    licenseNumber: { type: String, default: "" },
    licenseVerified: { type: Boolean, default: false },
    hospital:      { type: String, default: "" },
    experience:    { type: Number, default: 0 },            // years
    fee:           { type: Number, default: 500 },          // ₹ per consultation
    rating:        { type: Number, default: 0 },
    reviewCount:   { type: Number, default: 0 },
    bio:           { type: String, default: "" },
    education:     { type: String, default: "" },
    languages:     [{ type: String }],
    tags:          [{ type: String }],                      // conditions treated
    availability:  [{ type: String }],                      // time slots e.g. ["9:00 AM","11:00 AM"]
    status:        { type: String, enum: ["online", "busy", "offline"], default: "online" },

    // ── Blockchain ────────────────────────────────────────────────────────────
    walletAddress: { type: String, default: "" },

    // ── Auth ─────────────────────────────────────────────────────────────────
    isActive:      { type: Boolean, default: true },
    lastLogin:     { type: Date },
  },
  { timestamps: true }
);

// ── Hash password before save ─────────────────────────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// ── Compare password ──────────────────────────────────────────────────────────
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// ── Auto-generate patientId for patients ─────────────────────────────────────
userSchema.pre("save", function (next) {
  if (this.role === "patient" && !this.patientId) {
    const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, "0");
    this.patientId     = `HLT-0x${hex}`;
    this.chainPatientId = parseInt(hex, 16) % 900000 + 100000;
  }
  next();
});

// ── Strip sensitive fields when converting to JSON ────────────────────────────
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
