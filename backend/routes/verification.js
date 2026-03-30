// backend/routes/verification.js
const router = require("express").Router();
const User   = require("../models/User");

// ── Simulated NMC verification (replace with real API in production) ──────────
async function verifyWithNMC(licenseNumber, doctorName) {
  // Production: replace the block below with:
  //   const r = await fetch("https://nmc.org.in/api/verify", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json", "X-API-Key": process.env.NMC_API_KEY },
  //     body: JSON.stringify({ licenseNumber, name: doctorName })
  //   });
  //   const d = await r.json();
  //   return { valid: d.verified, name: d.name, council: d.council, ... };

  const formatOk = /^[A-Z]{2,4}\d{6,}$/i.test(licenseNumber.trim());
  if (!formatOk) {
    return {
      valid:  false,
      reason: "Invalid format — expected e.g. MCI123456 or KMC654321",
    };
  }
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
        onChain:    !!user.walletAddress,
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

    if (!result.valid) {
      return res.json({ status: "rejected", note: result.reason });
    }

    // ── Persist verification to MongoDB ──────────────────────────────────────
    await User.updateOne(
      { email: email.toLowerCase(), role: "doctor" },
      { licenseVerified: true, licenseNumber }
    );

    // ── Auto-register + verify on DoctorRegistry contract ────────────────────
    // Only fires if the doctor has a wallet address AND the contract is configured
    if (doctor.walletAddress && process.env.DOCTOR_REGISTRY_ADDRESS) {
      setImmediate(async () => {
        try {
          // Step 1: register
          const regRes = await fetch(
            `http://localhost:${process.env.PORT || 5000}/api/blockchain/register-doctor`,
            {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                wallet:        doctor.walletAddress,
                name:          doctor.name,
                specialty:     doctor.specialty || "General",
                licenseNumber,
                mongoId:       String(doctor._id),
              }),
            }
          );
          const regData = await regRes.json();

          if (regData.success) {
            console.log(`✅ Doctor ${doctor.name} registered on-chain: ${regData.txHash}`);

            // Step 2: verify on-chain
            const verRes = await fetch(
              `http://localhost:${process.env.PORT || 5000}/api/blockchain/verify-doctor`,
              {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet: doctor.walletAddress }),
              }
            );
            const verData = await verRes.json();
            if (verData.success) {
              console.log(`✅ Doctor ${doctor.name} verified on-chain: ${verData.txHash}`);
            }
          } else {
            console.warn(`[verification] on-chain registration failed: ${regData.error}`);
          }
        } catch (e) {
          console.warn("[verification] on-chain steps skipped:", e.message);
        }
      });
    } else if (!doctor.walletAddress) {
      console.info(`[verification] Doctor ${doctor.name} has no wallet — skipping on-chain registration`);
    } else {
      console.info("[verification] DOCTOR_REGISTRY_ADDRESS not set — skipping on-chain registration");
    }

    return res.json({
      status:     "verified",
      issuer:     result.council,
      verifiedAt: new Date().toISOString(),
      note:       "License verified against demo registry",
      onChain:    !!(doctor.walletAddress && process.env.DOCTOR_REGISTRY_ADDRESS),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;