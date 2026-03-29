// ─────────────────────────────────────────────────────────────────────────────
//  backend/routes/auth.js
//  Real JWT auth — signup, login, wallet-login.
//  Replaces the in-memory auth endpoints that were inline in server.js.
// ─────────────────────────────────────────────────────────────────────────────
const router = require("express").Router();
const jwt    = require("jsonwebtoken");
const User   = require("../models/User");

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    const {
      name, email, password, role, phone,
      specialty, licenseNumber, walletAddress,
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
      passwordHash:  password,       // pre-save hook will bcrypt this
      role:          role || "patient",
      phone:         phone || "",
      specialty:     specialty || "",
      licenseNumber: licenseNumber || "",
      walletAddress: walletAddress || "",
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ token, user: user.toSafeObject() });
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

    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/wallet-login ───────────────────────────────────────────────
router.post("/wallet-login", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });

    const user = await User.findOne({
      walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") },
    });

    if (!user) {
      // New wallet — create a patient account
      const newUser = await User.create({
        name:          `User_${walletAddress.slice(2, 8)}`,
        email:         `wallet_${walletAddress.slice(2, 10).toLowerCase()}@medichain.local`,
        passwordHash:  `WalletLogin_${walletAddress}`,
        role:          "patient",
        walletAddress,
      });
      const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
      return res.status(201).json({ token, user: newUser.toSafeObject() });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;