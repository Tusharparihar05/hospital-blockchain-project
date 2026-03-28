const router      = require("express").Router();
const Appointment = require("../models/Appointment");
const User        = require("../models/User");
const { protect, allow } = require("../middleware/auth");

// ── Shared shape helper ───────────────────────────────────────────────────────
function shapeAppt(a) {
  return {
    id:          String(a._id),
    _id:         a._id,
    patientId:   a.patientStrId || String(a.patientId),
    doctorId:    String(a.doctorId),
    patientName: a.patientName || "Patient",
    doctorName:  a.doctorName  || "Doctor",
    date:        a.date,
    time:        a.time,
    type:        a.type,
    specialty:   a.specialty || "",
    notes:       a.notes || "",
    status:      a.status,
    isEmergency: a.isEmergency,
    fee:         a.fee,
    feePaid:     a.feePaid,
    blockchain:  a.blockchain || "",
    blockchainTokenId: a.blockchainTokenId,
  };
}

// ── GET /api/appointments ─────────────────────────────────────────────────────
router.get("/", protect, async (req, res) => {
  try {
    const { patientId, doctorId, date, status } = req.query;
    const q = {};

    if (req.user.role === "patient") {
      // Patients can only see their own
      const user = await User.findById(req.user._id);
      q.$or = [{ patientId: req.user._id }, { patientStrId: user.patientId }];
    } else if (req.user.role === "doctor") {
      q.doctorId = req.user._id;
    }

    // Admin / explicit filters override
    if (patientId) q.$or = [{ patientStrId: patientId }];
    if (doctorId)  q.doctorId = doctorId;
    if (date)      q.date = date;
    if (status)    q.status = status;

    const appts = await Appointment.find(q).sort({ date: 1, time: 1 }).lean();
    res.json(appts.map(shapeAppt));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/appointments — book a new appointment ───────────────────────────
router.post("/", protect, async (req, res) => {
  try {
    const { doctorId, date, time, type, notes, isEmergency, fee, feePaid, paymentMethod } = req.body;
    if (!doctorId || !date || !time) {
      return res.status(400).json({ error: "doctorId, date, time required" });
    }

    const patient = await User.findById(req.user._id);
    const doctor  = await User.findById(doctorId);
    if (!doctor || doctor.role !== "doctor") return res.status(404).json({ error: "Doctor not found" });

    const appt = await Appointment.create({
      patientId:   req.user._id,
      patientStrId:patient.patientId,
      doctorId:    doctor._id,
      patientName: patient.name,
      doctorName:  doctor.name,
      date, time,
      type:        type || "Consultation",
      specialty:   doctor.specialty || "",
      notes:       notes || "",
      isEmergency: !!isEmergency,
      fee:         fee || doctor.fee || 0,
      feePaid:     !!feePaid,
      paymentMethod: paymentMethod || "",
      status:      feePaid ? "confirmed" : "pending",
    });

    res.status(201).json(shapeAppt(appt));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/appointments/:id/complete ─────────────────────────────────────────
router.put("/:id/complete", protect, allow("doctor", "admin"), async (req, res) => {
  try {
    const { blockchain, blockchainTokenId } = req.body;
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      {
        status: "completed",
        blockchain:        blockchain || "",
        blockchainTokenId: blockchainTokenId,
        mintedAt:          blockchain ? new Date() : undefined,
      },
      { new: true }
    );
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
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
    );
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
    );
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

module.exports = router;// Paste your appointment system code here
