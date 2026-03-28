const router = require("express").Router();
const User   = require("../models/User");

// ── Simple in-memory store for demo verifications ─────────────────────────────
// In production: replace with calls to NMC / State Medical Council API
const verificationStore = new Map();

function mockVerifyLicense(licenseNumber) {
  // Real format check: starts with letters, followed by 6+ digits
  const valid = /^[A-Z]{2,4}\d{6,}$/i.test(licenseNumber);
  if (!valid) {
    return { status: "rejected", note: "License format invalid. Expected e.g. MED123456 or AIIMS987654" };
  }
  return {
    status:  "verified",
    issuer:  "Demo Medical Council of India",
    verifiedAt: new Date().toISOString(),
    note:    "License verified against demo registry",
  };
}

// ── GET /api/verification/doctor-license?email=... ────────────────────────────
router.get("/doctor-license", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "email required" });

    const stored = verificationStore.get(email.toLowerCase());
    if (stored) return res.json(stored);

    // Check if already marked verified in DB
    const user = await User.findOne({ email: email.toLowerCase(), role: "doctor" });
    if (user?.licenseVerified) {
      const result = { status: "verified", issuer: "Demo Medical Council of India", note: "Previously verified" };
      verificationStore.set(email.toLowerCase(), result);
      return res.json(result);
    }

    res.json({ status: "none", message: "No verification submitted yet" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/verification/doctor-license ─────────────────────────────────────
router.post("/doctor-license", async (req, res) => {
  try {
    const { email, licenseNumber } = req.body;
    if (!email || !licenseNumber) {
      return res.status(400).json({ error: "email and licenseNumber required" });
    }

    const result = mockVerifyLicense(licenseNumber);
    verificationStore.set(email.toLowerCase(), result);

    // Persist verified status to DB
    if (result.status === "verified") {
      await User.updateOne({ email: email.toLowerCase(), role: "doctor" }, { licenseVerified: true });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;// Paste your doctor verification code here
