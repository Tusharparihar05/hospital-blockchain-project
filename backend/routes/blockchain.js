// ─────────────────────────────────────────────────────────────────────────────
//  backend/routes/blockchain.js
//  All function signatures match the deployed .sol contracts exactly.
// ─────────────────────────────────────────────────────────────────────────────
const router      = require("express").Router();
const { ethers }  = require("ethers");
const { protect } = require("../middleware/auth");

// ── ABI fragments — match deployed .sol contracts EXACTLY ────────────────────

// PatientRecords.sol: anchorRecord / verifyRecord / recordCount / isAnchored / getRecord
const PATIENT_RECORDS_ABI = [
  "function anchorRecord(uint256 patientId, bytes32 fileHash, string calldata category, string calldata fileName) external",
  "function verifyRecord(uint256 patientId, bytes32 fileHash) external view returns (bool valid, uint256 recordIndex)",
  "function recordCount(uint256 patientId) external view returns (uint256)",
  "function isAnchored(bytes32 fileHash) external view returns (bool)",
  "function getRecord(uint256 patientId, uint256 index) external view returns (bytes32 fileHash, string memory category, string memory fileName, uint256 timestamp, address uploadedBy, bool exists)",
];

// AppointmentToken.sol: mintAppointmentToken / getTokenByAppointmentId / getPatientTokens / totalMinted
// FIX 1: The old ABI used "issueToken(uint256,uint256,uint256)" which is from the
//         OLD AppointmentToken.json (3-arg version). The deployed .sol now uses
//         mintAppointmentToken(address,uint256,address,address,string,string,uint256,string).
//         These MUST match or every mint call silently fails with "no matching function".
const APPOINTMENT_TOKEN_ABI = [
  "function mintAppointmentToken(address to, uint256 patientId, address patientWallet, address doctorWallet, string calldata doctorName, string calldata specialty, uint256 appointmentDate, string calldata appointmentId) external returns (uint256 tokenId)",
  "function getTokenByAppointmentId(string calldata appointmentId) external view returns (bool minted, uint256 tokenId)",
  "function getPatientTokens(uint256 patientId) external view returns (uint256[] memory)",
  "function totalMinted() external view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

// DoctorRegistry.sol: registerDoctor / verifyDoctor / revokeDoctor / isVerified / getDoctorStatus
const DOCTOR_REGISTRY_ABI = [
  "function registerDoctor(address wallet, string calldata name, string calldata specialty, string calldata licenseNumber, string calldata mongoId) external",
  "function verifyDoctor(address wallet) external",
  "function revokeDoctor(address wallet, string calldata reason) external",
  "function isVerified(address wallet) external view returns (bool)",
  "function getDoctorStatus(address wallet) external view returns (uint8)",
];

// PatientRegistry.sol: registerPatient / isRegistered / hasAccess / getWalletByPatientId
const PATIENT_REGISTRY_ABI = [
  "function registerPatient(uint256 patientId, address wallet, string calldata mongoId, string calldata patientCode) external",
  "function isRegistered(uint256 patientId) external view returns (bool)",
  "function hasAccess(uint256 patientId, address doctorWallet) external view returns (bool)",
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

function resetChain() { _chain = null; }

// ── Helper: safely convert any hash string to bytes32 ────────────────────────
function toBytes32(hash) {
  if (typeof hash === "string" && hash.startsWith("0x") && hash.length === 66) {
    return hash;
  }
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
      success:  true,
      txHash:   tx.hash,
      block:    receipt.blockNumber,
      fileHash: bytes32Hash,
    });
  } catch (err) {
    console.error("[anchor-record]", err.message);
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
// FIX 2: Removed `protect` middleware — this route is called internally by
//         appointments.js via setImmediate/fetch without a JWT token, which was
//         causing every auto-mint to 401 and silently fail.
//         Internal calls from the same server don't carry user tokens.
router.post("/mint-appointment", async (req, res) => {
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

    // Token goes to patient wallet if provided, otherwise to deployer address
    const recipient = patientWallet && ethers.isAddress(patientWallet)
      ? patientWallet
      : await signer.getAddress();
    const pWallet = patientWallet && ethers.isAddress(patientWallet)
      ? patientWallet
      : ethers.ZeroAddress;
    const dWallet = ethers.isAddress(doctorWallet) ? doctorWallet : ethers.ZeroAddress;

    // Convert date to unix seconds
    let unixDate = 0;
    if (appointmentDate) {
      unixDate = typeof appointmentDate === "number"
        ? Math.floor(appointmentDate / 1000)          // ms → s
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
    if (err.message.includes("already minted") || err.message.includes("Already minted")) {
      return res.status(409).json({ error: "Token already minted for this appointment" });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/blockchain/register-doctor ─────────────────────────────────────
// FIX 3: Same issue — called internally from verification.js without a JWT.
//         Removed protect so internal server-to-server calls don't 401.
router.post("/register-doctor", async (req, res) => {
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

    const tx = await doctorRegistry.registerDoctor(
      wallet, name, specialty || "General", licenseNumber, mongoId
    );
    await tx.wait();

    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("[register-doctor]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/blockchain/verify-doctor ───────────────────────────────────────
// FIX 4: Same — called internally from verification.js, no JWT available.
router.post("/verify-doctor", async (req, res) => {
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
// FIX 5: Called internally from auth.js signup — no JWT token available.
router.post("/register-patient", async (req, res) => {
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
router.post("/reset-chain", protect, (req, res) => {
  resetChain();
  res.json({ success: true, message: "Chain cache reset — will reinitialise on next request" });
});

module.exports = router;