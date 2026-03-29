// ─────────────────────────────────────────────────────────────────────────────
//  backend/models/MedicalRecord.js
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");

const recordSchema = new mongoose.Schema(
  {
    patientId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    patientStrId:   { type: String },                          // HLT-0x... for fast lookup
    uploadedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    fileName:       { type: String, required: true },
    category:       { type: String, default: "Other" },

    // Integrity
    fileHash:       { type: String, required: true, unique: true }, // keccak256

    // IPFS
    ipfsCid:        { type: String, default: "" },  // content identifier
    ipfsUrl:        { type: String, default: "" },  // https://w3s.link/ipfs/<cid>

    // Blockchain anchoring
    blockchainHash:  { type: String, default: "" },
    blockchainTx:    { type: String, default: "" },
    anchoredOnChain: { type: Boolean, default: false },
    anchoredAt:      { type: Date },

    // Metadata
    doctor:      { type: String, default: "" },
    dept:        { type: String, default: "" },
    doctorNotes: { type: String, default: "" },
    uploadDate:  { type: String },

    // AI summary (generated server-side)
    aiSummary: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────────
recordSchema.index({ patientId: 1, createdAt: -1 });
recordSchema.index({ patientStrId: 1 });
recordSchema.index({ fileHash: 1 }, { unique: true });
recordSchema.index({ anchoredOnChain: 1 });

module.exports = mongoose.model("MedicalRecord", recordSchema);