// ─────────────────────────────────────────────────────────────────────────────
//  backend/models/Appointment.js
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");

const apptSchema = new mongoose.Schema(
  {
    patientId:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    patientStrId: { type: String },   // HLT-0x...
    doctorId:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    patientName: String,
    doctorName:  String,

    date:      String,   // "YYYY-MM-DD"
    time:      String,   // "HH:MM AM/PM"
    type:      { type: String, default: "Consultation" },
    specialty: String,
    notes:     String,

    status:     { type: String, default: "pending" },
    isEmergency:{ type: Boolean, default: false },

    fee:           Number,
    feePaid:       Boolean,
    paymentMethod: String,

    // Blockchain token
    blockchain:        String,   // tx hash
    blockchainTokenId: Number,   // ERC-721 tokenId
    mintedAt:          Date,
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────────
apptSchema.index({ patientId: 1, date: 1 });
apptSchema.index({ doctorId: 1, date: 1, status: 1 });
apptSchema.index({ patientStrId: 1 });
apptSchema.index({ status: 1 });

module.exports = mongoose.model("Appointment", apptSchema);