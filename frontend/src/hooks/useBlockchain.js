import { ethers } from "ethers";

// ── Real ABI from deployed contracts ──────────────────────────────────────────
// These match your actual deployed PatientRecords.sol and AppointmentToken.sol
const PATIENT_RECORDS_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "uint256", "name": "patientId", "type": "uint256" },
      { "indexed": false, "internalType": "bytes32",  "name": "dataHash",  "type": "bytes32"  },
      { "indexed": false, "internalType": "address",  "name": "addedBy",   "type": "address"  }
    ],
    "name": "RecordAdded",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "patientId", "type": "uint256" },
      { "internalType": "bytes32", "name": "dataHash",  "type": "bytes32"  }
    ],
    "name": "addRecord",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "doctor", "type": "address" }
    ],
    "name": "authorizeDoctor",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "name": "authorizedDoctors",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "patientId", "type": "uint256" }
    ],
    "name": "getRecordCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "patientId", "type": "uint256" }
    ],
    "name": "getRecords",
    "outputs": [
      {
        "components": [
          { "internalType": "bytes32", "name": "dataHash",  "type": "bytes32" },
          { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
          { "internalType": "address", "name": "addedBy",   "type": "address" }
        ],
        "internalType": "struct PatientRecords.Record[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "doctor", "type": "address" }
    ],
    "name": "revokeDoctor",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const APPOINTMENT_TOKEN_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "tokenId",   "type": "uint256" },
      { "indexed": true, "internalType": "uint256", "name": "patientId", "type": "uint256" },
      { "indexed": false,"internalType": "uint256", "name": "doctorId",  "type": "uint256" }
    ],
    "name": "TokenIssued",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "TokenInvalidated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "AppointmentCompleted",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "appointments",
    "outputs": [
      { "internalType": "uint256", "name": "tokenId",       "type": "uint256" },
      { "internalType": "uint256", "name": "patientId",     "type": "uint256" },
      { "internalType": "uint256", "name": "doctorId",      "type": "uint256" },
      { "internalType": "uint256", "name": "scheduledTime", "type": "uint256" },
      { "internalType": "bool",    "name": "isValid",       "type": "bool"    },
      { "internalType": "bool",    "name": "isCompleted",   "type": "bool"    }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "completeAppointment",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "patientId", "type": "uint256" }],
    "name": "getPatientTokens",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "invalidateToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "isTokenValid",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "patientId",     "type": "uint256" },
      { "internalType": "uint256", "name": "doctorId",      "type": "uint256" },
      { "internalType": "uint256", "name": "scheduledTime", "type": "uint256" }
    ],
    "name": "issueToken",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "patientTokens",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "tokenCounter",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// ── Contract addresses from .env ───────────────────────────────────────────────
const PATIENT_RECORDS_ADDRESS = process.env.REACT_APP_PATIENT_RECORDS_ADDRESS || "";
const APPOINTMENT_ADDRESS     = process.env.REACT_APP_APPOINTMENT_ADDRESS     || "";

// ── Provider & Signer ─────────────────────────────────────────────────────────
export async function getProvider() {
  if (!window.ethereum) throw new Error("MetaMask not installed. Please install MetaMask to use blockchain features.");
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = await getProvider();
  await provider.send("eth_requestAccounts", []); // ✅ always request accounts before getting signer
  return provider.getSigner();
}

// ── Connect wallet & return address ───────────────────────────────────────────
export async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts[0];
}

// ── Contract helpers ──────────────────────────────────────────────────────────
export async function getPatientRecordsContract(readOnly = false) {
  if (!PATIENT_RECORDS_ADDRESS) throw new Error("Patient Records contract address not set in .env");
  const provider = await getProvider();
  if (readOnly) {
    return new ethers.Contract(PATIENT_RECORDS_ADDRESS, PATIENT_RECORDS_ABI, provider);
  }
  const signer = await getSigner();
  return new ethers.Contract(PATIENT_RECORDS_ADDRESS, PATIENT_RECORDS_ABI, signer);
}

export async function getAppointmentContract(readOnly = false) {
  if (!APPOINTMENT_ADDRESS) throw new Error("Appointment Token contract address not set in .env");
  const provider = await getProvider();
  if (readOnly) {
    return new ethers.Contract(APPOINTMENT_ADDRESS, APPOINTMENT_TOKEN_ABI, provider);
  }
  const signer = await getSigner();
  return new ethers.Contract(APPOINTMENT_ADDRESS, APPOINTMENT_TOKEN_ABI, signer);
}

// ── Hashing ───────────────────────────────────────────────────────────────────
export function hashData(obj) {
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(obj)));
}

export async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return ethers.keccak256(bytes);
}

// ── Write a record hash on-chain ──────────────────────────────────────────────
export async function writeRecordOnChain(patientId, dataHash) {
  // ✅ Always request MetaMask accounts first so popup appears
  await window.ethereum.request({ method: "eth_requestAccounts" });
  const contract = await getPatientRecordsContract(false);
  const tx = await contract.addRecord(patientId, dataHash);
  const receipt = await tx.wait();
  return receipt;
}

// ── Fetch all on-chain records for a patient ──────────────────────────────────
export async function fetchChainRecords(patientId) {
  const contract = await getPatientRecordsContract(true);
  const records = await contract.getRecords(patientId);
  return records.map(r => ({
    dataHash:  r.dataHash,
    timestamp: Number(r.timestamp),
    addedBy:   r.addedBy,
  }));
}

/** Same shape the app hashes at upload (matches backend `record` object key order). */
export function canonicalRecordForChainVerify(record) {
  if (!record || typeof record !== "object") return record;
  return {
    id: record.id,
    patientId: record.patientId,
    fileName: reportFileName(record),
    category: reportCategory(record),
    uploadDate: record.uploadDate,
    doctor: record.doctor != null ? record.doctor : "Self Upload",
    dept: record.dept != null ? record.dept : "General",
    hash: reportHash(record),
    blockchainHash: reportBlockchainHash(record),
    aiSummary: record.aiSummary !== undefined ? record.aiSummary : null,
  };
}

function reportFileName(r) {
  return r.fileName || r.type || "Uploaded Document";
}
function reportCategory(r) {
  return r.category || r.type || "General";
}
function reportHash(r) {
  return r.hash || "";
}
function reportBlockchainHash(r) {
  return r.blockchainHash || r.hash || "";
}

// ── Verify that a local record exists on-chain ────────────────────────────────
export async function verifyRecord(patientId, recordData) {
  try {
    const payload =
      recordData && typeof recordData === "object" && recordData.id != null
        ? canonicalRecordForChainVerify(recordData)
        : recordData;
    const localHash    = hashData(payload);
    const chainRecords = await fetchChainRecords(patientId);
    return chainRecords.some(r => r.dataHash === localHash);
  } catch {
    return false;
  }
}

// ── Issue an appointment token on-chain ───────────────────────────────────────
export async function issueAppointmentToken(patientId, doctorId, dateString) {
  await window.ethereum.request({ method: "eth_requestAccounts" });
  const contract    = await getAppointmentContract(false);
  const scheduledTs = Math.floor(new Date(dateString).getTime() / 1000);
  const tx          = await contract.issueToken(patientId, doctorId, scheduledTs);
  const receipt     = await tx.wait();
  const event = receipt.logs
    .map(log => { try { return contract.interface.parseLog(log); } catch { return null; } })
    .find(e => e && e.name === "TokenIssued");
  return event ? Number(event.args.tokenId) : null;
}

// ── Short display of wallet address ──────────────────────────────────────────
export function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}