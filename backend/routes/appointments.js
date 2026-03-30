// backend/routes/appointments.js
const router      = require("express").Router();
const Appointment = require("../models/Appointment");
const User        = require("../models/User");
const { protect, allow } = require("../middleware/auth");

// ── Shape helper ──────────────────────────────────────────────────────────────
function shapeAppt(a) {
  return {
    id:                String(a._id),
    _id:               a._id,
    patientId:         a.patientStrId || String(a.patientId),
    doctorId:          String(a.doctorId),
    patientName:       a.patientName  || "Patient",
    doctorName:        a.doctorName   || "Doctor",
    date:              a.date,
    time:              a.time,
    type:              a.type         || "Consultation",
    specialty:         a.specialty    || "",
    notes:             a.notes        || "",
    status:            a.status,
    isEmergency:       !!a.isEmergency,
    fee:               a.fee,
    feePaid:           a.feePaid,
    blockchain:        a.blockchain   || "",
    blockchainTokenId: a.blockchainTokenId || null,
  };
}

// ── GET /api/appointments ─────────────────────────────────────────────────────
router.get("/", protect, async (req, res) => {
  try {
    const { patientId, doctorId, date, status } = req.query;
    const q = {};

    if (req.user.role === "patient") {
      // Always resolve the user's patientId string from the DB
      const user = await User.findById(req.user._id).lean();
      const orClauses = [{ patientId: req.user._id }];
      if (user?.patientId) orClauses.push({ patientStrId: user.patientId });
      q.$or = orClauses;
    } else if (req.user.role === "doctor") {
      q.doctorId = req.user._id;
    }
    // admin sees everything — no filter added

    // Explicit query filters (override above for admin)
    if (patientId) q.$or = [{ patientStrId: patientId }, { patientId: patientId }];
    if (doctorId)  q.doctorId = doctorId;
    if (date)      q.date = date;
    if (status)    q.status = status;

    const appts = await Appointment.find(q).sort({ date: 1, time: 1 }).lean();
    res.json(appts.map(shapeAppt));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/appointments — book ─────────────────────────────────────────────
router.post("/", protect, async (req, res) => {
  try {
    const { doctorId, date, time, type, notes, isEmergency, fee, feePaid, paymentMethod } = req.body;
    if (!doctorId || !date || !time) {
      return res.status(400).json({ error: "doctorId, date and time are required" });
    }

    // Pull REAL doctor data from DB — never trust the client's doctorName
    const patient = await User.findById(req.user._id).lean();
    const doctor  = await User.findById(doctorId).lean();
    if (!doctor || doctor.role !== "doctor") {
      return res.status(404).json({ error: "Doctor not found" });
    }

    const appt = await Appointment.create({
      patientId:     req.user._id,
      patientStrId:  patient?.patientId || "",
      doctorId:      doctor._id,
      patientName:   patient?.name   || "Patient",
      doctorName:    doctor.name,          // ← always from DB
      date,
      time,
      type:          type || "Consultation",
      specialty:     doctor.specialty || "",
      notes:         notes || "",
      isEmergency:   !!isEmergency,
      fee:           fee ?? doctor.fee ?? 0,
      feePaid:       !!feePaid,
      paymentMethod: paymentMethod || "",
      status:        feePaid ? "confirmed" : "pending",
    });

    res.status(201).json(shapeAppt(appt));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/appointments/:id/complete ────────────────────────────────────────
// After saving to MongoDB, mints an ERC-721 token via /api/blockchain/mint-appointment
router.put("/:id/complete", protect, allow("doctor", "admin"), async (req, res) => {
  try {
    const { blockchain, blockchainTokenId } = req.body;

    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      {
        status:            "completed",
        blockchain:        blockchain        || "",
        blockchainTokenId: blockchainTokenId ?? undefined,
        mintedAt:          blockchain ? new Date() : undefined,
      },
      { new: true }
    ).lean();
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    // ── Auto-mint blockchain token (fire-and-forget, non-blocking) ───────────
    setImmediate(async () => {
      try {
        // Look up patient's chainPatientId and walletAddress
        const patient = await User.findOne({
          $or: [
            { patientId: appt.patientStrId },
            { _id: appt.patientId },
          ],
        }).lean();

        const doctor = await User.findById(appt.doctorId).lean();

        const mintRes = await fetch(
          `http://localhost:${process.env.PORT || 5000}/api/blockchain/mint-appointment`,
          {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patientId:       patient?.chainPatientId || 0,
              patientWallet:   patient?.walletAddress  || "",
              doctorWallet:    doctor?.walletAddress   || "",
              doctorName:      appt.doctorName,
              specialty:       appt.specialty,
              appointmentDate: appt.date,
              appointmentId:   String(appt._id),
            }),
          }
        );

        const mintData = await mintRes.json();
        if (mintData.success) {
          await Appointment.findByIdAndUpdate(appt._id, {
            blockchain:        mintData.txHash,
            blockchainTokenId: mintData.tokenId,
            mintedAt:          new Date(),
          });
          console.log(`✅ Token #${mintData.tokenId} minted for appt ${appt._id}`);
        } else {
          console.warn(`[mint-appointment] ${mintData.error}`);
        }
      } catch (e) {
        console.warn("[auto-mint] skipped:", e.message);
      }
    });

    res.json(shapeAppt(appt));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/appointments/:id/confirm ─────────────────────────────────────────
router.put("/:id/confirm", protect, allow("doctor", "admin"), async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id, { status: "confirmed" }, { new: true }
    ).lean();
    if (!appt) return res.status(404).json({ error: "Not found" });
    res.json(shapeAppt(appt));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/appointments/:id/reschedule ──────────────────────────────────────
router.put("/:id/reschedule", protect, async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id, { status: "reschedule-requested" }, { new: true }
    ).lean();
    if (!appt) return res.status(404).json({ error: "Not found" });
    res.json(shapeAppt(appt));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/appointments/:id ─────────────────────────────────────────────
router.delete("/:id", protect, async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;