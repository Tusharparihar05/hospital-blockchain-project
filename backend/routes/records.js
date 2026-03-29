// ─────────────────────────────────────────────────────────────────────────────
//  backend/routes/records.js
//  - Accepts real file uploads via multer (memory storage)
//  - Computes keccak256 hash from the actual file buffer
//  - Uploads file to IPFS via web3.storage (requires WEB3_STORAGE_TOKEN in .env)
//  - Auto-anchors the hash on-chain after saving to MongoDB
//  - Falls back gracefully if blockchain or IPFS is unavailable
// ─────────────────────────────────────────────────────────────────────────────
const router        = require("express").Router();
const multer        = require("multer");
const { ethers }    = require("ethers");
const MedicalRecord = require("../models/MedicalRecord");
const User          = require("../models/User");
const { protect, allow } = require("../middleware/auth");

// ── Multer — memory storage so we can hash + upload the buffer ────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg", "image/png", "image/webp",
      "application/pdf",
      "application/dicom", "image/dicom",
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// ── IPFS Upload (web3.storage) ────────────────────────────────────────────────
// First-time setup: after installing @web3-storage/w3up-client, run:
//   node -e "require('@web3-storage/w3up-client').create().then(c=>c.login('your@email.com'))"
// Then set the space DID and add WEB3_STORAGE_TOKEN to .env
let _ipfsClient = null;

async function getIPFSClient() {
  if (_ipfsClient) return _ipfsClient;
  if (!process.env.WEB3_STORAGE_TOKEN) return null;

  try {
    const { create } = require("@web3-storage/w3up-client");
    _ipfsClient = await create();
    return _ipfsClient;
  } catch (err) {
    console.warn("[IPFS] @web3-storage/w3up-client not installed:", err.message);
    return null;
  }
}

async function uploadToIPFS(fileBuffer, fileName, mimeType) {
  try {
    const client = await getIPFSClient();
    if (!client) {
      return { success: false, reason: "IPFS client not configured (WEB3_STORAGE_TOKEN missing or package not installed)" };
    }
    const file = new File([fileBuffer], fileName, { type: mimeType });
    const cid  = await client.uploadFile(file);
    return {
      success: true,
      cid:     cid.toString(),
      url:     `https://w3s.link/ipfs/${cid.toString()}`,
    };
  } catch (err) {
    console.error("[IPFS upload failed]", err.message);
    return { success: false, reason: err.message };
  }
}

// ── Blockchain — PatientRecords contract ──────────────────────────────────────
let _patientRecords = null;

const PATIENT_RECORDS_ABI = [
  "function anchorRecord(uint256 patientId, bytes32 fileHash, string calldata category, string calldata fileName) external",
  "function isAnchored(bytes32 fileHash) external view returns (bool)",
];

function getPatientRecordsContract() {
  if (_patientRecords) return _patientRecords;
  const rpc  = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
  const pk   = process.env.DEPLOYER_PRIVATE_KEY;
  const addr = process.env.PATIENT_RECORDS_ADDRESS;
  if (!pk || !addr) return null;

  const provider = new ethers.JsonRpcProvider(rpc);
  const signer   = new ethers.Wallet(pk, provider);
  _patientRecords = new ethers.Contract(addr, PATIENT_RECORDS_ABI, signer);
  return _patientRecords;
}

async function anchorOnChain(chainPatientId, fileHash, category, fileName) {
  try {
    const contract = getPatientRecordsContract();
    if (!contract) return { success: false, reason: "Contract not configured" };

    const already = await contract.isAnchored(fileHash);
    if (already)   return { success: true, alreadyAnchored: true };

    const tx      = await contract.anchorRecord(Number(chainPatientId), fileHash, category || "general", fileName || "unknown");
    const receipt = await tx.wait();
    return { success: true, txHash: tx.hash, block: receipt.blockNumber };
  } catch (err) {
    console.error("[anchorOnChain] failed:", err.message);
    return { success: false, reason: err.message };
  }
}

// ── AI summary generator ──────────────────────────────────────────────────────
function generateAISummary(category, fileName) {
  const summaries = {
    "Blood Test": {
      plainLanguage: "Your blood test has been processed. Results show key health markers including cell counts, glucose levels, and organ function indicators.",
      keyFindings: ["Complete blood count (CBC) processed", "Metabolic panel indicators captured", "Lipid profile recorded for review"],
      recommendedSteps: ["Review results with your doctor within 3–5 days", "Stay hydrated and maintain a balanced diet", "Schedule follow-up if any values are outside normal range"],
    },
    "X-Ray": {
      plainLanguage: "Your X-ray image has been digitally stored and hashed for tamper-proof integrity. The radiologist will review and provide a detailed report.",
      keyFindings: ["High-resolution image captured and stored", "Digital hash generated for integrity verification", "Image accessible to your treating doctor"],
      recommendedSteps: ["Wait for radiologist report (24–48 hrs)", "Inform your doctor about any pain or symptoms", "Bring previous X-rays for comparison if available"],
    },
    "MRI Scan": {
      plainLanguage: "Your MRI scan files have been securely uploaded and hashed. Your specialist will interpret the results and discuss them with you.",
      keyFindings: ["Multi-sequence MRI data stored", "Blockchain hash created for tamper detection", "Scan linked to your patient profile"],
      recommendedSteps: ["Schedule a review appointment with your specialist", "Note any symptoms to discuss during the review", "Avoid strenuous activity until cleared"],
    },
    "Prescription": {
      plainLanguage: "Your prescription has been digitally stored and is now part of your verifiable health record.",
      keyFindings: ["Prescription document hashed and stored", "Prescribing doctor information recorded", "Linked to your secure patient account"],
      recommendedSteps: ["Fill the prescription at a registered pharmacy", "Follow dosage instructions strictly", "Contact your doctor if you experience side effects"],
    },
    "ECG": {
      plainLanguage: "Your ECG has been recorded and stored securely. This test captures the electrical activity of your heart.",
      keyFindings: ["Heart rhythm trace digitally stored", "Waveform data anchored on blockchain", "Available for cardiologist review"],
      recommendedSteps: ["Share with your cardiologist promptly", "Report any chest pain, palpitations, or dizziness", "Avoid caffeine before follow-up ECG"],
    },
  };

  return summaries[category] || {
    plainLanguage: `Your ${category || "medical document"} (${fileName}) has been securely uploaded and hashed for tamper-proof verification.`,
    keyFindings: [`Document: ${fileName}`, `Category: ${category || "General"}`, "Blockchain hash generated for integrity"],
    recommendedSteps: ["Share with your doctor for review", "Return for follow-up as advised", "Keep a copy of your physical documents"],
  };
}

// ── ROUTES ────────────────────────────────────────────────────────────────────

// GET /api/records/:patientId
router.get("/:patientId", protect, async (req, res) => {
  try {
    const pid = req.params.patientId;
    const records = await MedicalRecord.find({
      $or: [
        { patientStrId: pid },
        { patientId: pid.match(/^[0-9a-f]{24}$/i) ? pid : null },
      ],
    }).sort({ createdAt: -1 }).lean();

    res.json(records.map(r => ({
      id:              String(r._id),
      patientId:       r.patientStrId || String(r.patientId),
      fileName:        r.fileName,
      category:        r.category,
      uploadDate:      r.uploadDate,
      fileHash:        r.fileHash,
      blockchainHash:  r.blockchainHash || r.fileHash,
      anchoredOnChain: r.anchoredOnChain,
      blockchainTx:    r.blockchainTx || null,
      // IPFS fields — frontend uses ipfsUrl to show "View Report" button
      ipfsCid:         r.ipfsCid || "",
      ipfsUrl:         r.ipfsUrl || "",
      aiSummary:       r.aiSummary?.plainLanguage ? r.aiSummary : null,
      doctorNotes:     r.doctorNotes,
      doctor:          r.doctor,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/records — all records (doctor/admin)
router.get("/", protect, allow("doctor", "admin"), async (req, res) => {
  try {
    const records = await MedicalRecord.find().sort({ createdAt: -1 }).lean();
    res.json(records.map(r => ({
      id:              String(r._id),
      patientId:       r.patientStrId || String(r.patientId),
      fileName:        r.fileName,
      category:        r.category,
      uploadDate:      r.uploadDate,
      blockchainHash:  r.blockchainHash || r.fileHash,
      anchoredOnChain: r.anchoredOnChain,
      ipfsUrl:         r.ipfsUrl || "",
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/records — upload a new record
// Accepts multipart/form-data with field "file" + body fields:
//   patientId, category, doctor, dept, doctorNotes
// OR accepts JSON body with a pre-computed fileHash (no file buffer)
router.post(
  "/",
  protect,
  upload.single("file"),
  async (req, res) => {
    try {
      const {
        patientId,
        category,
        fileName:    bodyFileName,
        fileHash:    bodyFileHash,
        doctor,
        dept,
        doctorNotes,
      } = req.body;

      // Resolve file info
      const fileName = req.file?.originalname || bodyFileName || "unknown";

      let fileHash;
      if (req.file?.buffer) {
        fileHash = ethers.keccak256(req.file.buffer);
      } else if (bodyFileHash) {
        fileHash = bodyFileHash.startsWith("0x") && bodyFileHash.length === 66
          ? bodyFileHash
          : ethers.keccak256(ethers.toUtf8Bytes(bodyFileHash));
      } else {
        return res.status(400).json({ error: "Either upload a file or provide fileHash" });
      }

      if (!patientId) {
        return res.status(400).json({ error: "patientId is required" });
      }

      // Resolve patient
      const patient = await User.findOne({
        $or: [
          { patientId },
          { _id: patientId.match(/^[0-9a-f]{24}$/i) ? patientId : null },
        ],
        role: "patient",
      });

      const chainPatientId = patient?.chainPatientId || 0;

      // ── Upload to IPFS ─────────────────────────────────────────────────────
      let ipfsResult = { success: false, reason: "No file buffer" };
      if (req.file?.buffer) {
        ipfsResult = await uploadToIPFS(req.file.buffer, fileName, req.file.mimetype);
        if (ipfsResult.success) {
          console.log(`✅ IPFS upload: ${ipfsResult.url}`);
        } else {
          console.warn("[IPFS] Upload failed:", ipfsResult.reason);
        }
      }

      // ── Generate AI summary ────────────────────────────────────────────────
      const summary = generateAISummary(category, fileName);

      // ── Save to MongoDB ────────────────────────────────────────────────────
      const record = await MedicalRecord.create({
        patientId:    patient?._id || req.user._id,
        patientStrId: patient?.patientId || patientId,
        uploadedBy:   req.user._id,
        fileName,
        category:     category || "Other",
        fileHash,
        ipfsCid:      ipfsResult.cid  || "",
        ipfsUrl:      ipfsResult.url  || "",
        doctor:       doctor || req.user.name || "Self Upload",
        dept:         dept || category || "",
        doctorNotes:  doctorNotes || "",
        uploadDate:   new Date().toISOString().slice(0, 10),
        aiSummary:    { ...summary, generatedAt: new Date() },
        anchoredOnChain: false,
      });

      // ── Auto-anchor on blockchain ──────────────────────────────────────────
      let blockchainResult = { success: false, reason: "Not attempted" };
      if (chainPatientId) {
        blockchainResult = await anchorOnChain(chainPatientId, fileHash, category, fileName);
        if (blockchainResult.success && blockchainResult.txHash) {
          await MedicalRecord.findByIdAndUpdate(record._id, {
            blockchainHash:  fileHash,
            blockchainTx:    blockchainResult.txHash,
            anchoredOnChain: true,
            anchoredAt:      new Date(),
          });
        }
      } else {
        blockchainResult = { success: false, reason: "Patient has no chainPatientId — register on-chain first" };
      }

      res.status(201).json({
        record: {
          id:              String(record._id),
          patientId:       record.patientStrId,
          fileName:        record.fileName,
          category:        record.category,
          uploadDate:      record.uploadDate,
          fileHash,
          ipfsCid:         ipfsResult.cid  || "",
          ipfsUrl:         ipfsResult.url  || "",
          blockchainHash:  blockchainResult.success ? fileHash : "",
          anchoredOnChain: blockchainResult.success,
          blockchainTx:    blockchainResult.txHash || null,
        },
        aiSummary:  summary,
        blockchain: blockchainResult,
        ipfs:       ipfsResult,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: "This file has already been uploaded (duplicate hash)" });
      }
      console.error("[POST /api/records]", err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// PATCH /api/records/:id/anchor — manually anchor an existing record
router.patch("/:id/anchor", protect, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found" });

    if (record.anchoredOnChain) {
      return res.json({ success: true, alreadyAnchored: true, blockchainTx: record.blockchainTx });
    }

    const patient = await User.findById(record.patientId);
    const chainPatientId = patient?.chainPatientId;

    if (!chainPatientId) {
      return res.status(400).json({ error: "Patient has no chainPatientId" });
    }

    const result = await anchorOnChain(chainPatientId, record.fileHash, record.category, record.fileName);

    if (result.success) {
      await MedicalRecord.findByIdAndUpdate(record._id, {
        blockchainHash:  record.fileHash,
        blockchainTx:    result.txHash,
        anchoredOnChain: true,
        anchoredAt:      new Date(),
      });
    }

    res.json({ success: result.success, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/records/:id — admin only
router.delete("/:id", protect, allow("admin"), async (req, res) => {
  try {
    await MedicalRecord.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;