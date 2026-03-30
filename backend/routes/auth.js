// backend/routes/auth.js
const router = require("express").Router();
const jwt    = require("jsonwebtoken");
const User   = require("../models/User");

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    const {
      name, email, password, role, phone,
      specialty, licenseNumber, walletAddress,
      hospital, experience, fee, bio,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, password required" });
    }

    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const user = await User.create({
      name,
      email,
      passwordHash:  password,       // pre-save hook bcrypts this
      role:          role || "patient",
      phone:         phone          || "",
      specialty:     specialty      || "",
      licenseNumber: licenseNumber  || "",
      walletAddress: walletAddress  || "",
      hospital:      hospital       || "",
      experience:    experience     || 0,
      fee:           fee            || 0,
      bio:           bio            || "",
    });

    // ── Auto-register patient on-chain (non-blocking) ────────────────────────
    if (user.role === "patient" && user.chainPatientId) {
      setImmediate(async () => {
        try {
          await fetch(
            `http://localhost:${process.env.PORT || 5000}/api/blockchain/register-patient`,
            {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                patientId:   user.chainPatientId,
                wallet:      user.walletAddress || "",
                mongoId:     String(user._id),
                patientCode: user.patientId || "",
              }),
            }
          );
          console.log(`✅ Patient ${user.name} queued for on-chain registration`);
        } catch (e) {
          console.warn("[register-patient] skipped:", e.message);
        }
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    // Return full profile so frontend localStorage has all needed fields
    res.status(201).json({ token, user: buildUserResponse(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, user: buildUserResponse(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/wallet-login ───────────────────────────────────────────────
router.post("/wallet-login", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });

    let user = await User.findOne({
      walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") },
    });

    if (!user) {
      user = await User.create({
        name:          `User_${walletAddress.slice(2, 8)}`,
        email:         `wallet_${walletAddress.slice(2, 10).toLowerCase()}@medichain.local`,
        passwordHash:  `WalletLogin_${walletAddress}`,
        role:          "patient",
        walletAddress,
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: buildUserResponse(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Lets the frontend refresh its stored user object
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token" });
    }
    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: buildUserResponse(user) });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// ── Helper — build safe user object returned to client ───────────────────────
// Includes ALL fields the frontend needs to store in localStorage
function buildUserResponse(user) {
  const base = {
    id:            String(user._id),
    name:          user.name,
    email:         user.email,
    role:          user.role,
    phone:         user.phone          || "",
    walletAddress: user.walletAddress  || "",
    licenseNumber: user.licenseNumber  || "",
    hospital:      user.hospital       || "",
    specialty:     user.specialty      || "",
    experience:    user.experience     || 0,
    fee:           user.fee            || 0,
    bio:           user.bio            || "",
    isActive:      user.isActive       !== false,
  };

  if (user.role === "patient") {
    base.patientId      = user.patientId      || "";   // HLT-0x... string
    base.chainPatientId = user.chainPatientId || null; // numeric for contract calls
  }

  if (user.role === "doctor") {
    base.licenseVerified = !!user.licenseVerified;
    base.rating          = user.rating       || 0;
    base.reviews         = user.reviewCount  || 0;
    base.languages       = user.languages    || [];
    base.education       = user.education    || "";
    base.conditions      = user.tags         || [];
  }

  return base;
}

module.exports = router;