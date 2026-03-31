const router        = require("express").Router();
const multer        = require("multer");
const { ethers }    = require("ethers");
const mongoose      = require("mongoose");                          // FIX 1: was missing — caused ReferenceError on mongoose.isValidObjectId
const MedicalRecord = require("../models/MedicalRecord");
const User          = require("../models/User");
const { protect, allow } = require("../middleware/auth");

// ── Multer — memory storage ───────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg","image/png","image/webp","application/pdf"];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

// ── IPFS upload via Pinata ────────────────────────────────────────────────────
async function uploadToIPFS(fileBuffer, fileName, mimeType) {
  const jwtToken = process.env.PINATA_JWT;
  if (!jwtToken) {
    console.warn("[IPFS] PINATA_JWT not set — skipping IPFS upload");
    return { success: false, reason: "PINATA_JWT not set in .env" };
  }

  try {
    const { FormData, Blob } = await import("formdata-node");

    const form = new FormData();
    form.append("file", new Blob([fileBuffer], { type: mimeType }), fileName);
    form.append("pinataMetadata", JSON.stringify({ name: fileName }));
    form.append("pinataOptions",  JSON.stringify({ cidVersion: 1 }));

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method:  "POST",
      headers: { Authorization: `Bearer ${jwtToken}` },
      body:    form,
    });

    if (!res.ok) {
      const txt = await res.text();
      return { success: false, reason: `Pinata error ${res.status}: ${txt}` };
    }

    const data = await res.json();
    const cid  = data.IpfsHash;
    return { success: true, cid, url: `https://gateway.pinata.cloud/ipfs/${cid}` };
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
  const provider  = new ethers.JsonRpcProvider(rpc);
  const signer    = new ethers.Wallet(pk, provider);
  _patientRecords = new ethers.Contract(addr, PATIENT_RECORDS_ABI, signer);
  return _patientRecords;
}

async function anchorOnChain(chainPatientId, fileHash, category, fileName) {
  try {
    const contract = getPatientRecordsContract();
    if (!contract) return { success: false, reason: "Contract not configured" };
    const already = await contract.isAnchored(fileHash);
    if (already)   return { success: true, alreadyAnchored: true };
    const tx      = await contract.anchorRecord(
      Number(chainPatientId), fileHash, category || "general", fileName || "unknown"
    );
    const receipt = await tx.wait();
    return { success: true, txHash: tx.hash, block: receipt.blockNumber };
  } catch (err) {
    console.error("[anchorOnChain]", err.message);
    return { success: false, reason: err.message };
  }
}

// ── AI summary ────────────────────────────────────────────────────────────────
function generateAISummary(category, fileName) {
  const summaries = {
    "Blood Test": {
      plainLanguage: "Your blood test has been processed. Results show key health markers including cell counts, glucose levels, and organ function indicators.",
      keyFindings: ["Complete blood count (CBC) processed","Metabolic panel indicators captured","Lipid profile recorded for review"],
      recommendedSteps: ["Review results with your doctor within 3–5 days","Stay hydrated","Schedule follow-up if values are outside normal range"],
    },
    "X-Ray": {
      plainLanguage: "Your X-ray image has been digitally stored and hashed for tamper-proof integrity.",
      keyFindings: ["High-resolution image captured","Digital hash generated","Accessible to treating doctor"],
      recommendedSteps: ["Wait for radiologist report (24–48 hrs)","Inform doctor about symptoms","Bring previous X-rays for comparison"],
    },
    "MRI Scan": {
      plainLanguage: "Your MRI scan files have been securely uploaded and hashed.",
      keyFindings: ["Multi-sequence MRI data stored","Blockchain hash created","Scan linked to patient profile"],
      recommendedSteps: ["Schedule review with specialist","Note symptoms to discuss","Avoid strenuous activity until cleared"],
    },
    "Prescription": {
      plainLanguage: "Your prescription has been digitally stored as part of your verifiable health record.",
      keyFindings: ["Prescription hashed and stored","Prescribing doctor recorded","Linked to your patient account"],
      recommendedSteps: ["Fill at a registered pharmacy","Follow dosage strictly","Contact doctor if side effects occur"],
    },
    "ECG": {
      plainLanguage: "Your ECG has been recorded and stored securely.",
      keyFindings: ["Heart rhythm trace stored","Waveform anchored on blockchain","Available for cardiologist review"],
      recommendedSteps: ["Share with cardiologist promptly","Report chest pain or palpitations","Avoid caffeine before follow-up ECG"],
    },
  };
  return summaries[category] || {
    plainLanguage: `Your ${category || "medical document"} (${fileName}) has been securely uploaded and hashed.`,
    keyFindings:   [`Document: ${fileName}`, `Category: ${category || "General"}`, "Blockchain hash generated"],
    recommendedSteps: ["Share with your doctor for review","Return for follow-up as advised","Keep a copy of physical documents"],
  };
}

// ── GET /api/records/file/:recordId — stream stored file ─────────────────────
// FIX 2: This MUST be registered BEFORE /:patientId — otherwise "file" is
//         matched as a patientId param and the route never fires.
router.get("/file/:recordId", protect, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.recordId).lean();
    if (!record)         return res.status(404).json({ error: "Record not found" });
    if (!record.ipfsUrl) return res.status(404).json({ error: "No file stored for this record" });

    if (record.ipfsUrl.startsWith("data:")) {
      const [header, b64] = record.ipfsUrl.split(",");
      const mime = header.replace("data:", "").replace(";base64", "");
      const buf  = Buffer.from(b64, "base64");
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", `inline; filename="${record.fileName}"`);
      res.setHeader("Content-Length", buf.length);
      return res.send(buf);
    }
    res.redirect(record.ipfsUrl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/records — all records (doctor/admin) ─────────────────────────────
// FIX 3: Must also come BEFORE /:patientId or it will never match
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

// ── GET /api/records/:patientId ───────────────────────────────────────────────
router.get("/:patientId", protect, async (req, res) => {
  try {
    const pid = req.params.patientId;

    // FIX 4: Build the $or query safely — only include ObjectId clause when valid
    const orClauses = [{ patientStrId: pid }];
    if (mongoose.isValidObjectId(pid)) {
      orClauses.push({ patientId: pid });
    }

    const records = await MedicalRecord.find({ $or: orClauses })
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

// ── POST /api/records — upload ────────────────────────────────────────────────
router.post("/", protect, upload.single("file"), async (req, res) => {
  try {
    const {
      patientId, category,
      fileName: bodyFileName,
      fileHash: bodyFileHash,
      doctor, dept, doctorNotes,
    } = req.body;

    const fileName = req.file?.originalname || bodyFileName || "unknown";

    // Compute hash
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

    if (!patientId) return res.status(400).json({ error: "patientId is required" });

    // FIX 5: Resolve patient safely without crashing on non-ObjectId patientId strings
    const orClauses = [{ patientId }];
    if (mongoose.isValidObjectId(patientId)) {
      orClauses.push({ _id: patientId });
    }
    const patient = await User.findOne({ $or: orClauses, role: "patient" });

    const chainPatientId = patient?.chainPatientId || 0;

    // Upload to IPFS (Pinata) — non-blocking on failure
    let ipfsResult = { success: false, reason: "No file buffer" };
    if (req.file?.buffer) {
      ipfsResult = await uploadToIPFS(req.file.buffer, fileName, req.file.mimetype);
      if (ipfsResult.success) console.log(`✅ IPFS: ${ipfsResult.url}`);
      else                    console.warn("[IPFS skipped]", ipfsResult.reason);
    }

    const summary = generateAISummary(category, fileName);

    // Save to MongoDB
    const record = await MedicalRecord.create({
      patientId:    patient?._id || req.user._id,
      patientStrId: patient?.patientId || patientId,
      uploadedBy:   req.user._id,
      fileName,
      category:     category || "Other",
      fileHash,
      ipfsCid:      ipfsResult.cid || "",
      ipfsUrl:      ipfsResult.url || "",
      doctor:       doctor || req.user.name || "Self Upload",
      dept:         dept || category || "",
      doctorNotes:  doctorNotes || "",
      uploadDate:   new Date().toISOString().slice(0, 10),
      aiSummary:    { ...summary, generatedAt: new Date() },
      anchoredOnChain: false,
    });

    // Anchor on blockchain (non-blocking on failure)
    let blockchainResult = { success: false, reason: "No chainPatientId" };
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
    if (err.code === 11000) return res.status(409).json({ error: "File already uploaded (duplicate hash)" });
    console.error("[POST /api/records]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/records/:id/anchor ─────────────────────────────────────────────
router.patch("/:id/anchor", protect, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found" });
    if (record.anchoredOnChain) return res.json({ success: true, alreadyAnchored: true });
    const patient = await User.findById(record.patientId);
    if (!patient?.chainPatientId) return res.status(400).json({ error: "Patient has no chainPatientId" });
    const result = await anchorOnChain(patient.chainPatientId, record.fileHash, record.category, record.fileName);
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

module.exports = router;const router        = require("express").Router();
const multer        = require("multer");
const { ethers }    = require("ethers");
const mongoose      = require("mongoose");                          // FIX 1: was missing — caused ReferenceError on mongoose.isValidObjectId
const MedicalRecord = require("../models/MedicalRecord");
const User          = require("../models/User");
const { protect, allow } = require("../middleware/auth");

// ── Multer — memory storage ───────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg","image/png","image/webp","application/pdf"];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

// ── IPFS upload via Pinata ────────────────────────────────────────────────────
async function uploadToIPFS(fileBuffer, fileName, mimeType) {
  const jwtToken = process.env.PINATA_JWT;
  if (!jwtToken) {
    console.warn("[IPFS] PINATA_JWT not set — skipping IPFS upload");
    return { success: false, reason: "PINATA_JWT not set in .env" };
  }

  try {
    const { FormData, Blob } = await import("formdata-node");

    const form = new FormData();
    form.append("file", new Blob([fileBuffer], { type: mimeType }), fileName);
    form.append("pinataMetadata", JSON.stringify({ name: fileName }));
    form.append("pinataOptions",  JSON.stringify({ cidVersion: 1 }));

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method:  "POST",
      headers: { Authorization: `Bearer ${jwtToken}` },
      body:    form,
    });

    if (!res.ok) {
      const txt = await res.text();
      return { success: false, reason: `Pinata error ${res.status}: ${txt}` };
    }

    const data = await res.json();
    const cid  = data.IpfsHash;
    return { success: true, cid, url: `https://gateway.pinata.cloud/ipfs/${cid}` };
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
  const provider  = new ethers.JsonRpcProvider(rpc);
  const signer    = new ethers.Wallet(pk, provider);
  _patientRecords = new ethers.Contract(addr, PATIENT_RECORDS_ABI, signer);
  return _patientRecords;
}

async function anchorOnChain(chainPatientId, fileHash, category, fileName) {
  try {
    const contract = getPatientRecordsContract();
    if (!contract) return { success: false, reason: "Contract not configured" };
    const already = await contract.isAnchored(fileHash);
    if (already)   return { success: true, alreadyAnchored: true };
    const tx      = await contract.anchorRecord(
      Number(chainPatientId), fileHash, category || "general", fileName || "unknown"
    );
    const receipt = await tx.wait();
    return { success: true, txHash: tx.hash, block: receipt.blockNumber };
  } catch (err) {
    console.error("[anchorOnChain]", err.message);
    return { success: false, reason: err.message };
  }
}

// ── AI summary ────────────────────────────────────────────────────────────────
function generateAISummary(category, fileName) {
  const summaries = {
    "Blood Test": {
      plainLanguage: "Your blood test has been processed. Results show key health markers including cell counts, glucose levels, and organ function indicators.",
      keyFindings: ["Complete blood count (CBC) processed","Metabolic panel indicators captured","Lipid profile recorded for review"],
      recommendedSteps: ["Review results with your doctor within 3–5 days","Stay hydrated","Schedule follow-up if values are outside normal range"],
    },
    "X-Ray": {
      plainLanguage: "Your X-ray image has been digitally stored and hashed for tamper-proof integrity.",
      keyFindings: ["High-resolution image captured","Digital hash generated","Accessible to treating doctor"],
      recommendedSteps: ["Wait for radiologist report (24–48 hrs)","Inform doctor about symptoms","Bring previous X-rays for comparison"],
    },
    "MRI Scan": {
      plainLanguage: "Your MRI scan files have been securely uploaded and hashed.",
      keyFindings: ["Multi-sequence MRI data stored","Blockchain hash created","Scan linked to patient profile"],
      recommendedSteps: ["Schedule review with specialist","Note symptoms to discuss","Avoid strenuous activity until cleared"],
    },
    "Prescription": {
      plainLanguage: "Your prescription has been digitally stored as part of your verifiable health record.",
      keyFindings: ["Prescription hashed and stored","Prescribing doctor recorded","Linked to your patient account"],
      recommendedSteps: ["Fill at a registered pharmacy","Follow dosage strictly","Contact doctor if side effects occur"],
    },
    "ECG": {
      plainLanguage: "Your ECG has been recorded and stored securely.",
      keyFindings: ["Heart rhythm trace stored","Waveform anchored on blockchain","Available for cardiologist review"],
      recommendedSteps: ["Share with cardiologist promptly","Report chest pain or palpitations","Avoid caffeine before follow-up ECG"],
    },
  };
  return summaries[category] || {
    plainLanguage: `Your ${category || "medical document"} (${fileName}) has been securely uploaded and hashed.`,
    keyFindings:   [`Document: ${fileName}`, `Category: ${category || "General"}`, "Blockchain hash generated"],
    recommendedSteps: ["Share with your doctor for review","Return for follow-up as advised","Keep a copy of physical documents"],
  };
}

// ── GET /api/records/file/:recordId — stream stored file ─────────────────────
// FIX 2: This MUST be registered BEFORE /:patientId — otherwise "file" is
//         matched as a patientId param and the route never fires.
router.get("/file/:recordId", protect, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.recordId).lean();
    if (!record)         return res.status(404).json({ error: "Record not found" });
    if (!record.ipfsUrl) return res.status(404).json({ error: "No file stored for this record" });

    if (record.ipfsUrl.startsWith("data:")) {
      const [header, b64] = record.ipfsUrl.split(",");
      const mime = header.replace("data:", "").replace(";base64", "");
      const buf  = Buffer.from(b64, "base64");
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", `inline; filename="${record.fileName}"`);
      res.setHeader("Content-Length", buf.length);
      return res.send(buf);
    }
    res.redirect(record.ipfsUrl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/records — all records (doctor/admin) ─────────────────────────────
// FIX 3: Must also come BEFORE /:patientId or it will never match
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

// ── GET /api/records/:patientId ───────────────────────────────────────────────
router.get("/:patientId", protect, async (req, res) => {
  try {
    const pid = req.params.patientId;

    // FIX 4: Build the $or query safely — only include ObjectId clause when valid
    const orClauses = [{ patientStrId: pid }];
    if (mongoose.isValidObjectId(pid)) {
      orClauses.push({ patientId: pid });
    }

    const records = await MedicalRecord.find({ $or: orClauses })
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

// ── POST /api/records — upload ────────────────────────────────────────────────
router.post("/", protect, upload.single("file"), async (req, res) => {
  try {
    const {
      patientId, category,
      fileName: bodyFileName,
      fileHash: bodyFileHash,
      doctor, dept, doctorNotes,
    } = req.body;

    const fileName = req.file?.originalname || bodyFileName || "unknown";

    // Compute hash
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

    if (!patientId) return res.status(400).json({ error: "patientId is required" });

    // FIX 5: Resolve patient safely without crashing on non-ObjectId patientId strings
    const orClauses = [{ patientId }];
    if (mongoose.isValidObjectId(patientId)) {
      orClauses.push({ _id: patientId });
    }
    const patient = await User.findOne({ $or: orClauses, role: "patient" });

    const chainPatientId = patient?.chainPatientId || 0;

    // Upload to IPFS (Pinata) — non-blocking on failure
    let ipfsResult = { success: false, reason: "No file buffer" };
    if (req.file?.buffer) {
      ipfsResult = await uploadToIPFS(req.file.buffer, fileName, req.file.mimetype);
      if (ipfsResult.success) console.log(`✅ IPFS: ${ipfsResult.url}`);
      else                    console.warn("[IPFS skipped]", ipfsResult.reason);
    }

    const summary = generateAISummary(category, fileName);

    // Save to MongoDB
    const record = await MedicalRecord.create({
      patientId:    patient?._id || req.user._id,
      patientStrId: patient?.patientId || patientId,
      uploadedBy:   req.user._id,
      fileName,
      category:     category || "Other",
      fileHash,
      ipfsCid:      ipfsResult.cid || "",
      ipfsUrl:      ipfsResult.url || "",
      doctor:       doctor || req.user.name || "Self Upload",
      dept:         dept || category || "",
      doctorNotes:  doctorNotes || "",
      uploadDate:   new Date().toISOString().slice(0, 10),
      aiSummary:    { ...summary, generatedAt: new Date() },
      anchoredOnChain: false,
    });

    // Anchor on blockchain (non-blocking on failure)
    let blockchainResult = { success: false, reason: "No chainPatientId" };
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
    if (err.code === 11000) return res.status(409).json({ error: "File already uploaded (duplicate hash)" });
    console.error("[POST /api/records]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/records/:id/anchor ─────────────────────────────────────────────
router.patch("/:id/anchor", protect, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found" });
    if (record.anchoredOnChain) return res.json({ success: true, alreadyAnchored: true });
    const patient = await User.findById(record.patientId);
    if (!patient?.chainPatientId) return res.status(400).json({ error: "Patient has no chainPatientId" });
    const result = await anchorOnChain(patient.chainPatientId, record.fileHash, record.category, record.fileName);
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