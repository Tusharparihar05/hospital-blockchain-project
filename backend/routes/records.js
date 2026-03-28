// ─────────────────────────────────────────────────────────────────────────────
//  backend/routes/records.js
//  - Accepts real file uploads via multer (memory storage)
//  - Computes keccak256 hash from the actual file buffer
//  - Auto-anchors the hash on-chain after saving to MongoDB
//  - Falls back gracefully if blockchain is unavailable
// ─────────────────────────────────────────────────────────────────────────────
const router        = require("express").Router();
const multer        = require("multer");
const { ethers }    = require("ethers");
const MedicalRecord = require("../models/MedicalRecord");
const User          = require("../models/User");
const { protect, allow } = require("../middleware/auth");

// ── Multer — store file in memory so we can hash the buffer ──────────────────
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

// ── Blockchain helper — reuse the same provider/signer pattern ────────────────
let _patientRecords = null;

const PATIENT_RECORDS_ABI = [
  "function anchorRecord(uint256 patientId, bytes32 fileHash, string calldata category, string calldata fileName) external",
  "function isAnchored(bytes32 fileHash) external view returns (bool)",
];

function getPatientRecordsContract() {
  if (_patientRecords) return _patientRecords;

  const rpc = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
  const pk  = process.env.DEPLOYER_PRIVATE_KEY;
  const addr = process.env.PATIENT_RECORDS_ADDRESS;

  if (!pk || !addr) return null;

  const provider = new ethers.JsonRpcProvider(rpc);
  const signer   = new ethers.Wallet(pk, provider);
  _patientRecords = new ethers.Contract(addr, PATIENT_RECORDS_ABI, signer);
  return _patientRecords;
}

// ── Auto-anchor helper (called after MongoDB save) ────────────────────────────
async function anchorOnChain(chainPatientId, fileHash, category, fileName) {
  try {
    const contract = getPatientRecordsContract();
    if (!contract) {
      return { success: false, reason: "Contract not configured" };
    }

    // Check if already anchored (avoids wasted gas)
    const already = await contract.isAnchored(fileHash);
    if (already) {
      return { success: true, alreadyAnchored: true };
    }

    const tx      = await contract.anchorRecord(
      Number(chainPatientId),
      fileHash,
      category || "general",
      fileName || "unknown"
    );
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
      keyFindings: [
        "Complete blood count (CBC) processed",
        "Metabolic panel indicators captured",
        "Lipid profile recorded for review",
      ],
      recommendedSteps: [
        "Review results with your doctor within 3–5 days",
        "Stay hydrated and maintain a balanced diet",
        "Schedule follow-up if any values are outside normal range",
      ],
    },
    "X-Ray": {
      plainLanguage: "Your X-ray image has been digitally stored and hashed for tamper-proof integrity. The radiologist will review and provide a detailed report.",
      keyFindings: [
        "High-resolution image captured and stored",
        "Digital hash generated for integrity verification",
        "Image accessible to your treating doctor",
      ],
      recommendedSteps: [
        "Wait for radiologist report (24–48 hrs)",
        "Inform your doctor about any pain or symptoms",
        "Bring previous X-rays for comparison if available",
      ],
    },
    "MRI Scan": {
      plainLanguage: "Your MRI scan files have been securely uploaded and hashed. Your specialist will interpret the results and discuss them with you.",
      keyFindings: [
        "Multi-sequence MRI data stored",
        "Blockchain hash created for tamper detection",
        "Scan linked to your patient profile",
      ],
      recommendedSteps: [
        "Schedule a review appointment with your specialist",
        "Note any symptoms to discuss during the review",
        "Avoid strenuous activity until cleared",
      ],
    },
    "Prescription": {
      plainLanguage: "Your prescription has been digitally stored and is now part of your verifiable health record.",
      keyFindings: [
        "Prescription document hashed and stored",
        "Prescribing doctor information recorded",
        "Linked to your secure patient account",
      ],
      recommendedSteps: [
        "Fill the prescription at a registered pharmacy",
        "Follow dosage instructions strictly",
        "Contact your doctor if you experience side effects",
      ],
    },
    "ECG": {
      plainLanguage: "Your ECG has been recorded and stored securely. This test captures the electrical activity of your heart.",
      keyFindings: [
        "Heart rhythm trace digitally stored",
        "Waveform data anchored on blockchain",
        "Available for cardiologist review",
      ],
      recommendedSteps: [
        "Share with your cardiologist promptly",
        "Report any chest pain, palpitations, or dizziness",
        "Avoid caffeine before follow-up ECG",
      ],
    },
  };

  return summaries[category] || {
    plainLanguage: `Your ${category || "medical document"} (${fileName}) has been securely uploaded and hashed for tamper-proof verification.`,
    keyFindings: [
      `Document: ${fileName}`,
      `Category: ${category || "General"}`,
      "Blockchain hash generated for integrity",
    ],
    recommendedSteps: [
      "Share with your doctor for review",
      "Return for follow-up as advised",
      "Keep a copy of your physical documents",
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/records/:patientId ───────────────────────────────────────────────
router.get("/:patientId", protect, async (req, res) => {
  try {
    const pid = req.params.patientId;
    const records = await MedicalRecord.find({
      $or: [
        { patientStrId: pid },
        { patientId: pid.match(/^[0-9a-f]{24}$/i) ? pid : null },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

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
      aiSummary:       r.aiSummary?.plainLanguage ? r.aiSummary : null,
      doctorNotes:     r.doctorNotes,
      doctor:          r.doctor,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/records — all records (doctor / admin view) ──────────────────────
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
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/records — upload a new record ────────────────────────────────────
//  Accepts multipart/form-data with field "file" + body fields:
//    patientId, category, doctor, dept, doctorNotes
//  OR accepts JSON body with a pre-computed fileHash (no file buffer)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/",
  protect,
  upload.single("file"),   // "file" is the form-data field name from frontend
  async (req, res) => {
    try {
      const {
        patientId,
        category,
        fileName:   bodyFileName,
        fileHash:   bodyFileHash,
        doctor,
        dept,
        doctorNotes,
      } = req.body;

      // ── Resolve file info ──────────────────────────────────────────────────
      const fileName = req.file?.originalname || bodyFileName || "unknown";

      // Compute hash from buffer (most accurate) or fall back to provided hash
      let fileHash;
      if (req.file?.buffer) {
        fileHash = ethers.keccak256(req.file.buffer);
      } else if (bodyFileHash) {
        // Ensure it's properly formatted bytes32
        fileHash = bodyFileHash.startsWith("0x") && bodyFileHash.length === 66
          ? bodyFileHash
          : ethers.keccak256(ethers.toUtf8Bytes(bodyFileHash));
      } else {
        return res.status(400).json({ error: "Either upload a file or provide fileHash" });
      }

      if (!patientId) {
        return res.status(400).json({ error: "patientId is required" });
      }

      // ── Resolve patient from DB ────────────────────────────────────────────
      const patient = await User.findOne({
        $or: [
          { patientId },
          { _id: patientId.match(/^[0-9a-f]{24}$/i) ? patientId : null },
        ],
        role: "patient",
      });

      const chainPatientId = patient?.chainPatientId || 0;

      // ── Generate AI summary ───────────────────────────────────────────────
      const summary = generateAISummary(category, fileName);

      // ── Save to MongoDB ───────────────────────────────────────────────────
      const record = await MedicalRecord.create({
        patientId:    patient?._id || req.user._id,
        patientStrId: patient?.patientId || patientId,
        uploadedBy:   req.user._id,
        fileName,
        category:     category || "Other",
        fileHash,
        doctor:       doctor || req.user.name || "Self Upload",
        dept:         dept || category || "",
        doctorNotes:  doctorNotes || "",
        uploadDate:   new Date().toISOString().slice(0, 10),
        aiSummary:    { ...summary, generatedAt: new Date() },
        anchoredOnChain: false,
      });

      // ── Auto-anchor on blockchain ─────────────────────────────────────────
      let blockchainResult = { success: false, reason: "Not attempted" };

      if (chainPatientId) {
        blockchainResult = await anchorOnChain(chainPatientId, fileHash, category, fileName);

        if (blockchainResult.success && blockchainResult.txHash) {
          // Update MongoDB record with tx info
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

      // ── Respond ───────────────────────────────────────────────────────────
      res.status(201).json({
        record: {
          id:              String(record._id),
          patientId:       record.patientStrId,
          fileName:        record.fileName,
          category:        record.category,
          uploadDate:      record.uploadDate,
          fileHash,
          blockchainHash:  blockchainResult.success ? fileHash : "",
          anchoredOnChain: blockchainResult.success,
          blockchainTx:    blockchainResult.txHash || null,
        },
        aiSummary:        summary,
        blockchain:       blockchainResult,
      });
    } catch (err) {
      console.error("[POST /api/records]", err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PATCH /api/records/:id/anchor — manually anchor an existing record ────────
//  Use this if auto-anchor failed during upload
router.patch("/:id/anchor", protect, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found" });

    if (record.anchoredOnChain) {
      return res.json({ success: true, alreadyAnchored: true, blockchainTx: record.blockchainTx });
    }

    // Resolve chainPatientId
    const patient = await User.findById(record.patientId);
    const chainPatientId = patient?.chainPatientId;

    if (!chainPatientId) {
      return res.status(400).json({ error: "Patient has no chainPatientId" });
    }

    const result = await anchorOnChain(
      chainPatientId,
      record.fileHash,
      record.category,
      record.fileName
    );

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

// ── DELETE /api/records/:id ───────────────────────────────────────────────────
router.delete("/:id", protect, allow("admin"), async (req, res) => {
  try {
    await MedicalRecord.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;