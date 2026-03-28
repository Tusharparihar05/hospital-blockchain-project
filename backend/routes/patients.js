const router   = require("express").Router();
const User     = require("../models/User");
const { protect, allow } = require("../middleware/auth");

// GET /api/patients — list all patients (doctors only)
router.get("/", protect, allow("doctor", "admin"), async (req, res) => {
  try {
    const { search } = req.query;
    const query = { role: "patient", isActive: true };
    if (search) {
      const re = new RegExp(search, "i");
      query.$or = [{ name: re }, { email: re }, { patientId: re }, { phone: re }];
    }
    const patients = await User.find(query)
      .select("name email phone patientId chainPatientId gender dateOfBirth bloodGroup walletAddress")
      .lean();

    // Shape for frontend compatibility
    const shaped = patients.map(p => ({
      id:     p.patientId || String(p._id),
      _id:    p._id,
      name:   p.name,
      email:  p.email,
      phone:  p.phone || "",
      age:    p.dateOfBirth
        ? Math.floor((Date.now() - new Date(p.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365))
        : null,
      gender: p.gender || "—",
      patientId:     p.patientId,
      chainPatientId:p.chainPatientId,
      walletAddress: p.walletAddress,
    }));

    res.json(shaped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/patients/:id
router.get("/:id", protect, async (req, res) => {
  try {
    const p = await User.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-f]{24}$/) ? req.params.id : null },
            { patientId: req.params.id }],
      role: "patient",
    }).select("-passwordHash");
    if (!p) return res.status(404).json({ error: "Patient not found" });
    res.json(p.toSafeObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;// Paste your patient routes code here
