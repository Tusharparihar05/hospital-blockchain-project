import { ethers } from "ethers";

// ── ABI stubs (replace with actual ABI from Hardhat artifacts after deploy) ────
const PATIENT_RECORDS_ABI = [
  "function addRecord(uint256 patientId, bytes32 dataHash) public",
  "function getRecords(uint256 patientId) public view returns (tuple(bytes32 dataHash, uint256 timestamp, address addedBy)[])",
  "event RecordAdded(uint256 indexed patientId, bytes32 dataHash, address addedBy)",
];

const APPOINTMENT_TOKEN_ABI = [
  "function issueToken(uint256 patientId, uint256 doctorId, uint256 scheduledTime) public returns (uint256)",
  "function invalidateToken(uint256 tokenId) public",
  "function appointments(uint256 tokenId) public view returns (uint256,uint256,uint256,uint256,bool)",
  "event TokenIssued(uint256 tokenId, uint256 patientId, uint256 doctorId)",
];

const PATIENT_RECORDS_ADDRESS = process.env.REACT_APP_PATIENT_RECORDS_ADDRESS || "";
const APPOINTMENT_ADDRESS     = process.env.REACT_APP_APPOINTMENT_ADDRESS     || "";

// ── Provider & Signer ──────────────────────────────────────────────────────────
export async function getProvider() {
  if (!window.ethereum) throw new Error("MetaMask not installed. Please install it to use blockchain features.");
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = await getProvider();
  return provider.getSigner();
}

// ── Contract helpers ───────────────────────────────────────────────────────────
export async function getPatientRecordsContract(readOnly = false) {
  const provider = await getProvider();
  const signerOrProvider = readOnly ? provider : await provider.getSigner();
  return new ethers.Contract(PATIENT_RECORDS_ADDRESS, PATIENT_RECORDS_ABI, signerOrProvider);
}

export async function getAppointmentContract(readOnly = false) {
  const provider = await getProvider();
  const signerOrProvider = readOnly ? provider : await provider.getSigner();
  return new ethers.Contract(APPOINTMENT_ADDRESS, APPOINTMENT_TOKEN_ABI, signerOrProvider);
}

// ── Hashing ────────────────────────────────────────────────────────────────────
export function hashData(obj) {
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(obj)));
}

// ── Hash a File (browser File object) ─────────────────────────────────────────
export async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const bytes   = new Uint8Array(buffer);
  return ethers.keccak256(bytes);
}

// ── Connect wallet & return address ───────────────────────────────────────────
export async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts[0];
}

// ── Write a record hash on-chain ───────────────────────────────────────────────
// patientId: numeric (pass parseInt of your HLT id digits)
// dataHash : ethers.keccak256 hex string
export async function writeRecordOnChain(patientId, dataHash) {
  const contract = await getPatientRecordsContract(false);
  const tx = await contract.addRecord(patientId, dataHash);
  const receipt = await tx.wait();
  return receipt;
}

// ── Fetch all on-chain records for a patient ───────────────────────────────────
export async function fetchChainRecords(patientId) {
  const contract = await getPatientRecordsContract(true);
  const records  = await contract.getRecords(patientId);
  return records.map(r => ({
    dataHash:  r.dataHash,
    timestamp: Number(r.timestamp),
    addedBy:   r.addedBy,
  }));
}

// ── Verify that a local record exists on-chain ─────────────────────────────────
export async function verifyRecord(patientId, recordData) {
  const localHash    = hashData(recordData);
  const chainRecords = await fetchChainRecords(patientId);
  return chainRecords.some(r => r.dataHash === localHash);
}

// ── Issue an appointment token on-chain ────────────────────────────────────────
export async function issueAppointmentToken(patientId, doctorId, dateString) {
  const contract     = await getAppointmentContract(false);
  const scheduledTs  = Math.floor(new Date(dateString).getTime() / 1000);
  const tx           = await contract.issueToken(patientId, doctorId, scheduledTs);
  const receipt      = await tx.wait();
  // parse TokenIssued event to get tokenId
  const event = receipt.logs
    .map(log => { try { return contract.interface.parseLog(log); } catch { return null; } })
    .find(e => e && e.name === "TokenIssued");
  return event ? Number(event.args.tokenId) : null;
}

// ── Short display of wallet address ───────────────────────────────────────────
export function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}