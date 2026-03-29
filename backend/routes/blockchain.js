// ─────────────────────────────────────────────────────────────────────────────
//  backend/routes/blockchain.js
//  All function signatures match the deployed .sol contracts exactly.
// ─────────────────────────────────────────────────────────────────────────────
const router          = require("express").Router();
const { ethers }      = require("ethers");
const { protect }     = require("../middleware/auth");

// ── ABI fragments — must match .sol function signatures EXACTLY ───────────────

const PATIENT_RECORDS_ABI = [
  // function anchorRecord(uint256 patientId, bytes32 fileHash, string category, string fileName)
  "function anchorRecord(uint256 patientId, bytes32 fileHash, string calldata category, string calldata fileName) external",
  // function verifyRecord(uint256 patientId, bytes32 fileHash) view returns (bool valid, uint256 recordIndex)
  "function verifyRecord(uint256 patientId, bytes32 fileHash) external view returns (bool valid, uint256 recordIndex)",
  // function recordCount(uint256 patientId) view returns (uint256)
  "function recordCount(uint256 patientId) external view returns (uint256)",
  // function isAnchored(bytes32 fileHash) view returns (bool)
  "function isAnchored(bytes32 fileHash) external view returns (bool)",
  // function getRecord(uint256 patientId, uint256 index) view returns (...)
  "function getRecord(uint256 patientId, uint256 index) external view returns (bytes32 fileHash, string memory category, string memory fileName, uint256 timestamp, address uploadedBy, bool exists)",
];

const APPOINTMENT_TOKEN_ABI = [
  // function mintAppointmentToken(address to, uint256 patientId, address patientWallet, address doctorWallet, string doctorName, string specialty, uint256 appointmentDate, string appointmentId)
  "function mintAppointmentToken(address to, uint256 patientId, address patientWallet, address doctorWallet, string calldata doctorName, string calldata specialty, uint256 appointmentDate, string calldata appointmentId) external returns (uint256 tokenId)",
  // function getTokenByAppointmentId(string appointmentId) view returns (bool minted, uint256 tokenId)
  "function getTokenByAppointmentId(string calldata appointmentId) external view returns (bool minted, uint256 tokenId)",
  // function getPatientTokens(uint256 patientId) view returns (uint256[])
  "function getPatientTokens(uint256 patientId) external view returns (uint256[] memory)",
  // function totalMinted() view returns (uint256)
  "function totalMinted() external view returns (uint256)",
  // ERC721 transfer event — needed to parse tokenId from receipt
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

const DOCTOR_REGISTRY_ABI = [
  // function registerDoctor(address wallet, string name, string specialty, string licenseNumber, string mongoId)
  "function registerDoctor(address wallet, string calldata name, string calldata specialty, string calldata licenseNumber, string calldata mongoId) external",
  // function verifyDoctor(address wallet)
  "function verifyDoctor(address wallet) external",
  // function revokeDoctor(address wallet, string reason)
  "function revokeDoctor(address wallet, string calldata reason) external",
  // function isVerified(address wallet) view returns (bool)
  "function isVerified(address wallet) external view returns (bool)",
  // function getDoctor(address wallet) view returns (Doctor)
  "function getDoctorStatus(address wallet) external view returns (uint8)",
];

const PATIENT_REGISTRY_ABI = [
  // function registerPatient(uint256 patientId, address wallet, string mongoId, string patientCode)
  "function registerPatient(uint256 patientId, address wallet, string calldata mongoId, string calldata patientCode) external",
  // function isRegistered(uint256 patientId) view returns (bool)
  "function isRegistered(uint256 patientId) external view returns (bool)",
  // function hasAccess(uint256 patientId, address doctorWallet) view returns (bool)
  "function hasAccess(uint256 patientId, address doctorWallet) external view returns (bool)",
  // function getWalletByPatientId(uint256 patientId) view returns (address)
  "function getWalletByPatientId(uint256 patientId) external view returns (address)",
];

// ── Lazy-init provider + signer + contracts ───────────────────────────────────
let _chain = null;

function getChain() {
  if (_chain) return _chain;

  const rpc = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpc);

  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
  const signer = new ethers.Wallet(pk, provider);

  const PR  = process.env.PATIENT_RECORDS_ADDRESS;
  const AT  = process.env.APPOINTMENT_TOKEN_ADDRESS;
  const DR  = process.env.DOCTOR_REGISTRY_ADDRESS;
  const PRG = process.env.PATIENT_REGISTRY_ADDRESS;

  _chain = {
    provider,
    signer,
    patientRecords:   PR  ? new ethers.Contract(PR,  PATIENT_RECORDS_ABI,   signer) : null,
    appointmentToken: AT  ? new ethers.Contract(AT,  APPOINTMENT_TOKEN_ABI, signer) : null,
    doctorRegistry:   DR  ? new ethers.Contract(DR,  DOCTOR_REGISTRY_ABI,   signer) : null,
    patientRegistry:  PRG ? new ethers.Contract(PRG, PATIENT_REGISTRY_ABI,  signer) : null,
  };

  return _chain;
}

// Reset cached chain (call after redeployment)
function resetChain() { _chain = null; }

// ── Helper: safely convert any hash string to bytes32 ────────────────────────
function toBytes32(hash) {
  // Already a full 32-byte hex string
  if (typeof hash === "string" && hash.startsWith("0x") && hash.length === 66) {
    return hash;
  }
  // Plain string — hash it
  return ethers.keccak256(ethers.toUtf8Bytes(hash));
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/blockchain/status ────────────────────────────────────────────────
router.get("/status", async (req, res) => {
  try {
    const { provider } = getChain();
    const block = await provider.getBlockNumber();
    res.json({
      connected: true,
      block,
      contracts: {
        patientRecords:   !!process.env.PATIENT_RECORDS_ADDRESS,
        appointmentToken: !!process.env.APPOINTMENT_TOKEN_ADDRESS,
        doctorRegistry:   !!process.env.DOCTOR_REGISTRY_ADDRESS,
        patientRegistry:  !!process.env.PATIENT_REGISTRY_ADDRESS,
      },
    });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

// ── POST /api/blockchain/anchor-record ───────────────────────────────────────
//  Body: { patientId: number, fileHash: "0x...", category: string, fileName: string }
//
//  fileHash should be the keccak256 of the raw file buffer — compute in records.js:
//    const fileHash = ethers.keccak256(req.file.buffer);
router.post("/anchor-record", protect, async (req, res) => {
  try {
    const { patientId, fileHash, category, fileName } = req.body;

    if (!patientId || !fileHash) {
      return res.status(400).json({ error: "patientId and fileHash are required" });
    }

    const { patientRecords } = getChain();
    if (!patientRecords) {
      return res.status(503).json({ error: "PatientRecords contract address not configured" });
    }

    const bytes32Hash = toBytes32(fileHash);

    const tx      = await patientRecords.anchorRecord(
      Number(patientId),
      bytes32Hash,
      category  || "general",
      fileName  || "unknown"
    );
    const receipt = await tx.wait();

    res.json({
      success:   true,
      txHash:    tx.hash,
      block:     receipt.blockNumber,
      fileHash:  bytes32Hash,
    });
  } catch (err) {
    console.error("[anchor-record]", err.message);
    // Friendly message for duplicate hash
    if (err.message.includes("already anchored")) {
      return res.status(409).json({ error: "This file hash is already anchored on-chain" });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/blockchain/verify-record?patientId=&fileHash= ───────────────────
router.get("/verify-record", protect, async (req, res) => {
  try {
    const { patientId, fileHash } = req.query;

    if (!patientId || !fileHash) {
      return res.status(400).json({ error: "patientId and fileHash are required" });
    }

    const { patientRecords } = getChain();
    if (!patientRecords) {
      return res.json({ verified: false, error: "Contract not configured" });
    }

    const bytes32Hash = toBytes32(fileHash);
    const [valid, recordIndex] = await patientRecords.verifyRecord(
      Number(patientId),
      bytes32Hash
    );

    res.json({ verified: valid, recordIndex: Number(recordIndex) });
  } catch (err) {
    console.error("[verify-record]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/blockchain/is-anchored?fileHash= ────────────────────────────────
//  Quick check without needing patientId
router.get("/is-anchored", protect, async (req, res) => {
  try {
    const { fileHash } = req.query;
    const { patientRecords } = getChain();
    if (!patientRecords) return res.json({ anchored: false });

    const anchored = await patientRecords.isAnchored(toBytes32(fileHash));
    res.json({ anchored });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/blockchain/mint-appointment ────────────────────────────────────
//  Body: { patientId, patientWallet?, doctorWallet, doctorName, specialty,
//          appointmentDate (unix ms or ISO string), appointmentId (MongoDB _id) }
router.post("/mint-appointment", protect, async (req, res) => {
  try {
    const {
      patientId,
      patientWallet,
      doctorWallet,
      doctorName,
      specialty,
      appointmentDate,
      appointmentId,
    } = req.body;

    if (!patientId || !doctorWallet || !appointmentId) {
      return res.status(400).json({ error: "patientId, doctorWallet, and appointmentId are required" });
    }

    const { appointmentToken, signer } = getChain();
    if (!appointmentToken) {
      return res.status(503).json({ error: "AppointmentToken contract not configured" });
    }

    // Token goes to patient wallet if linked, otherwise to deployer (backend holds it)
    const recipient    = patientWallet && ethers.isAddress(patientWallet) ? patientWallet : await signer.getAddress();
    const pWallet      = patientWallet && ethers.isAddress(patientWallet) ? patientWallet : ethers.ZeroAddress;
    const dWallet      = ethers.isAddress(doctorWallet) ? doctorWallet : ethers.ZeroAddress;

    // Convert date to unix seconds
    let unixDate = 0;
    if (appointmentDate) {
      unixDate = typeof appointmentDate === "number"
        ? Math.floor(appointmentDate / 1000)   // ms → s
        : Math.floor(new Date(appointmentDate).getTime() / 1000);
    }

    const tx      = await appointmentToken.mintAppointmentToken(
      recipient,
      Number(patientId),
      pWallet,
      dWallet,
      doctorName   || "Unknown Doctor",
      specialty    || "General",
      unixDate,
      appointmentId
    );
    const receipt = await tx.wait();

    // Extract tokenId from Transfer event log
    const iface   = new ethers.Interface(APPOINTMENT_TOKEN_ABI);
    let tokenId   = null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "Transfer") {
          tokenId = Number(parsed.args.tokenId);
          break;
        }
      } catch (_) {}
    }

    res.json({ success: true, txHash: tx.hash, tokenId, block: receipt.blockNumber });
  } catch (err) {
    console.error("[mint-appointment]", err.message);
    if (err.message.includes("already minted")) {
      return res.status(409).json({ error: "Token already minted for this appointment" });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/blockchain/register-doctor ─────────────────────────────────────
//  Body: { wallet, name, specialty, licenseNumber, mongoId }
router.post("/register-doctor", protect, async (req, res) => {
  try {
    const { wallet, name, specialty, licenseNumber, mongoId } = req.body;

    if (!wallet || !name || !licenseNumber || !mongoId) {
      return res.status(400).json({ error: "wallet, name, licenseNumber, mongoId required" });
    }
    if (!ethers.isAddress(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const { doctorRegistry } = getChain();
    if (!doctorRegistry) return res.status(503).json({ error: "DoctorRegistry not configured" });

    const tx = await doctorRegistry.registerDoctor(wallet, name, specialty || "General", licenseNumber, mongoId);
    await tx.wait();

    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("[register-doctor]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/blockchain/verify-doctor ───────────────────────────────────────
//  Body: { wallet }
router.post("/verify-doctor", protect, async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!ethers.isAddress(wallet)) return res.status(400).json({ error: "Invalid wallet address" });

    const { doctorRegistry } = getChain();
    if (!doctorRegistry) return res.status(503).json({ error: "DoctorRegistry not configured" });

    const tx = await doctorRegistry.verifyDoctor(wallet);
    await tx.wait();

    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("[verify-doctor]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/blockchain/is-doctor-verified?wallet= ───────────────────────────
router.get("/is-doctor-verified", async (req, res) => {
  try {
    const { wallet } = req.query;
    if (!ethers.isAddress(wallet)) return res.status(400).json({ error: "Invalid wallet" });

    const { doctorRegistry } = getChain();
    if (!doctorRegistry) return res.json({ verified: false });

    const verified = await doctorRegistry.isVerified(wallet);
    res.json({ verified });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/blockchain/register-patient ────────────────────────────────────
//  Body: { patientId, wallet?, mongoId, patientCode }
router.post("/register-patient", protect, async (req, res) => {
  try {
    const { patientId, wallet, mongoId, patientCode } = req.body;

    if (!patientId || !mongoId) {
      return res.status(400).json({ error: "patientId and mongoId required" });
    }

    const { patientRegistry } = getChain();
    if (!patientRegistry) return res.status(503).json({ error: "PatientRegistry not configured" });

    const walletAddr = wallet && ethers.isAddress(wallet) ? wallet : ethers.ZeroAddress;

    const tx = await patientRegistry.registerPatient(
      Number(patientId),
      walletAddr,
      mongoId,
      patientCode || ""
    );
    await tx.wait();

    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("[register-patient]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/blockchain/reset-chain ─────────────────────────────────────────
//  Call after redeploying contracts so cached instances are refreshed
router.post("/reset-chain", protect, (req, res) => {
  resetChain();
  res.json({ success: true, message: "Chain cache reset — will reinitialise on next request" });
});

module.exports = router;