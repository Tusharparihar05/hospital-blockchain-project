const router = require("express").Router();
const User   = require("../models/User");
const { protect, allow } = require("../middleware/auth");

// ── GET /api/doctors — public list ───────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { specialty, search } = req.query;
    const query = { role: "doctor", isActive: true };
    if (specialty && specialty !== "All") query.specialty = specialty;
    if (search) {
      const re = new RegExp(search, "i");
      query.$or = [{ name: re }, { specialty: re }, { hospital: re }];
    }
    const doctors = await User.find(query).select("-passwordHash -email -phone").lean();
    const shaped = doctors.map(d => ({
      id:             String(d._id),
      _id:            String(d._id),
      name:           d.name             || "",
      specialty:      d.specialty        || "",
      hospital:       d.hospital         || "Not specified",
      experience:     d.experience       || 0,
      rating:         d.rating           || 4.0,
      reviewCount:    d.reviewCount      || 0,
      fee:            d.fee              || 500,
      bio:            d.bio              || "",
      education:      d.education        || "",
      languages:      d.languages        || [],
      tags:           d.tags             || [],
      availability:   d.availability     || [],
      status:         d.status           || "online",
      walletAddress:  d.walletAddress    || "",
      licenseVerified:d.licenseVerified  || false,
      licenseNumber:  d.licenseNumber    || "",
      conditions:     d.tags             || [],
      patients:       d.reviewCount * 3  || 0,
      todayAppts:     d.availability?.length || 0,
      reviews:        [],
    }));
    res.json(shaped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/doctors/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const d = await User.findOne({ _id: req.params.id, role: "doctor" }).select("-passwordHash");
    if (!d) return res.status(404).json({ error: "Doctor not found" });
    res.json({
      id: String(d._id), _id: String(d._id),
      name: d.name, specialty: d.specialty, hospital: d.hospital,
      experience: d.experience, rating: d.rating, reviewCount: d.reviewCount,
      fee: d.fee, bio: d.bio, education: d.education,
      languages: d.languages, tags: d.tags, availability: d.availability,
      status: d.status, walletAddress: d.walletAddress,
      licenseVerified: d.licenseVerified, licenseNumber: d.licenseNumber,
      conditions: d.tags || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/doctors/:id — doctor updates own profile ──────────────────────
router.patch("/:id", protect, allow("doctor", "admin"), async (req, res) => {
  try {
    if (String(req.user._id) !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Can only update your own profile" });
    }
    const allowed = [
      "name", "bio", "hospital", "education", "experience", "fee",
      "languages", "tags", "availability", "status", "phone",
      "specialty", "rating", "reviewCount",
    ];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    const updated = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select("-passwordHash");
    if (!updated) return res.status(404).json({ error: "Doctor not found" });
    res.json(updated.toSafeObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;