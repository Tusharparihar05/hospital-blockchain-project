import { ethers } from "ethers";

// ── ABI matching the DEPLOYED PatientRecords.sol exactly ─────────────────────
// The deployed contract uses anchorRecord(uint256, bytes32, string, string)
// NOT addRecord(uint256, bytes32) — that was the old contract.
const PATIENT_RECORDS_ABI = [
  "function anchorRecord(uint256 patientId, bytes32 fileHash, string calldata category, string calldata fileName) external",
  "function verifyRecord(uint256 patientId, bytes32 fileHash) external view returns (bool valid, uint256 recordIndex)",
  "function recordCount(uint256 patientId) external view returns (uint256)",
  "function isAnchored(bytes32 fileHash) external view returns (bool)",
  "function getRecord(uint256 patientId, uint256 index) external view returns (bytes32 fileHash, string memory category, string memory fileName, uint256 timestamp, address uploadedBy, bool exists)",
  "event RecordAnchored(uint256 indexed patientId, bytes32 indexed fileHash, string category, string fileName, address uploadedBy, uint256 timestamp)",
];

const APPOINTMENT_TOKEN_ABI = [
  "function mintAppointmentToken(address to, uint256 patientId, address patientWallet, address doctorWallet, string calldata doctorName, string calldata specialty, uint256 appointmentDate, string calldata appointmentId) external returns (uint256 tokenId)",
  "function getTokenByAppointmentId(string calldata appointmentId) external view returns (bool minted, uint256 tokenId)",
  "function getPatientTokens(uint256 patientId) external view returns (uint256[] memory)",
  "function totalMinted() external view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

// ── Contract addresses from frontend .env ─────────────────────────────────────
// Make sure your frontend/.env has:
//   REACT_APP_PATIENT_RECORDS_ADDRESS=0x...
//   REACT_APP_APPOINTMENT_ADDRESS=0x...
const PATIENT_RECORDS_ADDRESS = process.env.REACT_APP_PATIENT_RECORDS_ADDRESS || "";
const APPOINTMENT_ADDRESS     = process.env.REACT_APP_APPOINTMENT_ADDRESS     || "";

// ── Provider & Signer ─────────────────────────────────────────────────────────
export async function getProvider() {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed. Please install MetaMask to use blockchain features.");
  }
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = await getProvider();
  await provider.send("eth_requestAccounts", []); // triggers MetaMask popup
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
  if (!PATIENT_RECORDS_ADDRESS) {
    throw new Error(
      "REACT_APP_PATIENT_RECORDS_ADDRESS is not set in your frontend .env file.\n" +
      "Add: REACT_APP_PATIENT_RECORDS_ADDRESS=0xYourContractAddress"
    );
  }
  const provider = await getProvider();
  if (readOnly) {
    return new ethers.Contract(PATIENT_RECORDS_ADDRESS, PATIENT_RECORDS_ABI, provider);
  }
  const signer = await getSigner(); // triggers MetaMask popup
  return new ethers.Contract(PATIENT_RECORDS_ADDRESS, PATIENT_RECORDS_ABI, signer);
}

export async function getAppointmentContract(readOnly = false) {
  if (!APPOINTMENT_ADDRESS) {
    throw new Error(
      "REACT_APP_APPOINTMENT_ADDRESS is not set in your frontend .env file.\n" +
      "Add: REACT_APP_APPOINTMENT_ADDRESS=0xYourContractAddress"
    );
  }
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

// ── Anchor a record hash on-chain (triggers MetaMask popup) ──────────────────
// FIX: was calling addRecord() which doesn't exist on the deployed contract.
//      Now calls anchorRecord(patientId, fileHash, category, fileName) correctly.
export async function anchorRecordOnChain(patientId, fileHash, category, fileName) {
  if (!window.ethereum) throw new Error("MetaMask not installed");

  // Ensure fileHash is a valid bytes32 hex string
  let bytes32Hash = fileHash;
  if (!fileHash.startsWith("0x") || fileHash.length !== 66) {
    bytes32Hash = ethers.keccak256(ethers.toUtf8Bytes(fileHash));
  }

  const contract = await getPatientRecordsContract(false); // triggers MetaMask
  const tx = await contract.anchorRecord(
    Number(patientId),
    bytes32Hash,
    category  || "General",
    fileName  || "unknown"
  );
  const receipt = await tx.wait();
  return { txHash: tx.hash, blockNumber: receipt.blockNumber };
}

// ── Keep old name as alias so nothing else breaks ────────────────────────────
export async function writeRecordOnChain(patientId, dataHash) {
  return anchorRecordOnChain(patientId, dataHash, "General", "record");
}

// ── Check if a hash is already anchored (read-only, no MetaMask popup) ────────
export async function isRecordAnchored(fileHash) {
  try {
    const contract = await getPatientRecordsContract(true);
    let bytes32Hash = fileHash;
    if (!fileHash.startsWith("0x") || fileHash.length !== 66) {
      bytes32Hash = ethers.keccak256(ethers.toUtf8Bytes(fileHash));
    }
    return await contract.isAnchored(bytes32Hash);
  } catch {
    return false;
  }
}

// ── Fetch all on-chain records for a patient (read-only) ──────────────────────
export async function fetchChainRecords(patientId) {
  try {
    const contract = await getPatientRecordsContract(true);
    const count = await contract.recordCount(Number(patientId));
    const records = [];
    for (let i = 0; i < Number(count); i++) {
      const r = await contract.getRecord(Number(patientId), i);
      records.push({
        fileHash:   r.fileHash,
        category:   r.category,
        fileName:   r.fileName,
        timestamp:  Number(r.timestamp),
        uploadedBy: r.uploadedBy,
      });
    }
    return records;
  } catch {
    return [];
  }
}

// ── Verify that a file hash exists on-chain for a patient ────────────────────
export async function verifyRecord(patientId, fileHashOrRecord) {
  try {
    const contract = await getPatientRecordsContract(true);

    // Accept either a raw hash string or a record object
    let hashToCheck = fileHashOrRecord;
    if (typeof fileHashOrRecord === "object" && fileHashOrRecord !== null) {
      hashToCheck = fileHashOrRecord.fileHash || fileHashOrRecord.blockchainHash || fileHashOrRecord.hash || "";
    }

    if (!hashToCheck) return false;

    let bytes32Hash = hashToCheck;
    if (!hashToCheck.startsWith("0x") || hashToCheck.length !== 66) {
      bytes32Hash = ethers.keccak256(ethers.toUtf8Bytes(hashToCheck));
    }

    const [valid] = await contract.verifyRecord(Number(patientId), bytes32Hash);
    return valid;
  } catch {
    return false;
  }
}

// ── Issue an appointment token on-chain ───────────────────────────────────────
export async function issueAppointmentToken(patientId, doctorId, dateString) {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const contract    = await getAppointmentContract(false);
  const scheduledTs = Math.floor(new Date(dateString).getTime() / 1000);
  const tx          = await contract.mintAppointmentToken(
    await (await getSigner()).getAddress(),
    Number(patientId),
    ethers.ZeroAddress,
    ethers.ZeroAddress,
    "Doctor",
    "General",
    scheduledTs,
    String(doctorId)
  );
  const receipt = await tx.wait();
  const iface   = new ethers.Interface(APPOINTMENT_TOKEN_ABI);
  const event   = receipt.logs
    .map(log => { try { return iface.parseLog(log); } catch { return null; } })
    .find(e => e && e.name === "Transfer");
  return event ? Number(event.args.tokenId) : null;
}

// ── Short display of wallet address ──────────────────────────────────────────
export function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}