// backend/routes/doctors.js
// UPDATED — adds PUT /api/doctors/:id/location  +  GET nearby support
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
      id:              String(d._id),
      _id:             String(d._id),
      name:            d.name             || "",
      specialty:       d.specialty        || "",
      hospital:        d.hospital         || "Not specified",
      experience:      d.experience       || 0,
      rating:          d.rating           || 4.0,
      reviewCount:     d.reviewCount      || 0,
      fee:             d.fee              || 500,
      bio:             d.bio              || "",
      education:       d.education        || "",
      languages:       d.languages        || [],
      tags:            d.tags             || [],
      availability:    d.availability     || [],
      status:          d.status           || "online",
      walletAddress:   d.walletAddress    || "",
      licenseVerified: d.licenseVerified  || false,
      licenseNumber:   d.licenseNumber    || "",
      conditions:      d.tags             || [],
      patients:        d.reviewCount * 3  || 0,
      todayAppts:      d.availability?.length || 0,
      reviews:         [],
      // ── NEW location fields ──────────────────────────────────────────────
      location: d.location || { lat: null, lng: null, address: "" },
      isOnline:  d.isOnline !== undefined ? d.isOnline : true,
    }));
    res.json(shaped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/doctors/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const d = await User.findOne({ _id: req.params.id, role: "doctor" })
      .select("-passwordHash")
      .lean();
    if (!d) return res.status(404).json({ error: "Doctor not found" });
    res.json({
      id:              String(d._id),
      _id:             String(d._id),
      name:            d.name,
      specialty:       d.specialty,
      hospital:        d.hospital,
      experience:      d.experience,
      rating:          d.rating,
      reviewCount:     d.reviewCount,
      fee:             d.fee,
      bio:             d.bio,
      education:       d.education,
      languages:       d.languages,
      tags:            d.tags,
      availability:    d.availability,
      status:          d.status,
      walletAddress:   d.walletAddress,
      licenseVerified: d.licenseVerified,
      licenseNumber:   d.licenseNumber,
      conditions:      d.tags || [],
      // ── NEW ──
      location: d.location || { lat: null, lng: null, address: "" },
      isOnline:  d.isOnline !== undefined ? d.isOnline : true,
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
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-passwordHash -__v").lean();

    if (!updated) return res.status(404).json({ error: "Doctor not found" });
    res.json({ ...updated, id: String(updated._id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/doctors/:id/location — doctor saves their clinic location ────────
//    Body: { lat, lng, address }   (GPS) OR { address }  (text — geocoded on frontend)
//    The frontend sends lat+lng after geocoding the text address via Nominatim.
router.put("/:id/location", protect, allow("doctor", "admin"), async (req, res) => {
  try {
    if (String(req.user._id) !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { lat, lng, address } = req.body;

    // Basic validation
    if (lat == null || lng == null) {
      return res.status(400).json({ error: "lat and lng are required" });
    }
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({ error: "lat and lng must be numbers" });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { location: { lat: latNum, lng: lngNum, address: address || "" } } },
      { new: true }
    ).select("name location").lean();

    if (!updated) return res.status(404).json({ error: "Doctor not found" });
    res.json({ success: true, location: updated.location });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/doctors/:id/online-status ───────────────────────────────────────
router.put("/:id/online-status", protect, allow("doctor", "admin"), async (req, res) => {
  try {
    if (String(req.user._id) !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { isOnline } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isOnline: !!isOnline } },
      { new: true }
    ).select("name isOnline").lean();

    if (!updated) return res.status(404).json({ error: "Doctor not found" });
    res.json({ success: true, isOnline: updated.isOnline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

/*
═══════════════════════════════════════════════════════════════════
  ADD THESE FIELDS TO YOUR User.js / Doctor.js MONGOOSE SCHEMA
═══════════════════════════════════════════════════════════════════

  Inside your existing schema definition, add:

    location: {
      lat:     { type: Number, default: null },
      lng:     { type: Number, default: null },
      address: { type: String, default: ""   },
    },
    isOnline: { type: Boolean, default: true },

  That's it — Mongoose will automatically create these fields.
═══════════════════════════════════════════════════════════════════
*/