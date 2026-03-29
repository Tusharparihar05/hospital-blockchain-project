// ─────────────────────────────────────────────────────────────────────────────
//  backend/routes/verification.js
//  Doctor license verification — persists to MongoDB.
//  Includes auto blockchain registration after successful verification.
// ─────────────────────────────────────────────────────────────────────────────
const router = require("express").Router();
const User   = require("../models/User");

// ── NMC-style verification (swap mock for real API in production) ──────────────
async function verifyWithNMC(licenseNumber, doctorName) {
  // Production: replace with fetch("https://nmc.org.in/api/verify", { ... })
  const formatOk = /^[A-Z]{2,4}\d{6,}$/i.test(licenseNumber.trim());
  if (!formatOk) {
    return {
      valid:  false,
      reason: "Invalid license format. Expected e.g. MCI123456 or KMC654321",
    };
  }
  // Simulated NMC API response
  return {
    valid:      true,
    name:       doctorName,
    council:    "Demo Medical Council of India",
    issueDate:  "2015-06-01",
    expiryDate: "2030-06-01",
  };
}

// ── GET /api/verification/doctor-license?email= ───────────────────────────────
router.get("/doctor-license", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "email required" });

    const user = await User.findOne({ email: email.toLowerCase(), role: "doctor" });
    if (!user) return res.status(404).json({ error: "Doctor not found" });

    if (user.licenseVerified) {
      return res.json({
        status:     "verified",
        issuer:     "Demo Medical Council of India",
        verifiedAt: user.updatedAt,
        note:       "License previously verified",
      });
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

    const doctor = await User.findOne({ email: email.toLowerCase(), role: "doctor" });
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    const result = await verifyWithNMC(licenseNumber, doctor.name);

    if (result.valid) {
      // ── Persist verification to MongoDB ────────────────────────────────────
      await User.updateOne(
        { email: email.toLowerCase(), role: "doctor" },
        { licenseVerified: true, licenseNumber }
      );

      // ── Auto-register on DoctorRegistry blockchain contract ────────────────
      // Only attempt if doctor has a wallet address configured
      if (doctor.walletAddress) {
        setImmediate(async () => {
          try {
            const regRes = await fetch(`http://localhost:${process.env.PORT || 5000}/api/blockchain/register-doctor`, {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({
                wallet:        doctor.walletAddress,
                name:          doctor.name,
                specialty:     doctor.specialty,
                licenseNumber,
                mongoId:       String(doctor._id),
              }),
            });
            const regData = await regRes.json();
            if (regData.success) {
              console.log(`✅ Doctor ${doctor.name} registered on-chain: ${regData.txHash}`);
            }
          } catch (e) {
            console.warn("[verification] On-chain registration skipped:", e.message);
          }
        });
      }

      return res.json({
        status:     "verified",
        issuer:     result.council,
        verifiedAt: new Date().toISOString(),
        note:       "License verified against demo registry",
      });
    }

    res.json({
      status: "rejected",
      note:   result.reason,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;