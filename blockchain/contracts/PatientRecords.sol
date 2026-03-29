// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PatientRecords
 * @notice Anchors keccak256 file hashes on-chain for tamper-proof medical record integrity.
 *         Files themselves live on IPFS — only the hash is stored here.
 *
 * ABI consumed by backend/routes/blockchain.js and backend/routes/records.js
 *
 * Functions:
 *   anchorRecord(uint256, bytes32, string, string)
 *   verifyRecord(uint256, bytes32) → (bool valid, uint256 recordIndex)
 *   recordCount(uint256) → uint256
 *   isAnchored(bytes32) → bool
 *   getRecord(uint256, uint256) → (bytes32, string, string, uint256, address, bool)
 */
contract PatientRecords {

    // ── Structs ───────────────────────────────────────────────────────────────

    struct Record {
        bytes32  fileHash;
        string   category;
        string   fileName;
        uint256  timestamp;
        address  uploadedBy;
        bool     exists;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    // patientId → ordered list of records
    mapping(uint256 => Record[]) private _patientRecords;

    // fileHash → already anchored (prevents duplicate gas spend)
    mapping(bytes32 => bool) private _anchored;

    // ── Events ────────────────────────────────────────────────────────────────

    event RecordAnchored(
        uint256 indexed patientId,
        bytes32 indexed fileHash,
        string  category,
        string  fileName,
        address uploadedBy,
        uint256 timestamp
    );

    // ── Core Functions ────────────────────────────────────────────────────────

    /**
     * @notice Anchor a file hash on-chain for a patient.
     * @param patientId      Numeric patient ID (chainPatientId from MongoDB)
     * @param fileHash       keccak256 hash of the raw file buffer
     * @param category       e.g. "Blood Test", "X-Ray", "Prescription"
     * @param fileName       original file name for display
     */
    function anchorRecord(
        uint256 patientId,
        bytes32 fileHash,
        string calldata category,
        string calldata fileName
    ) external {
        require(patientId > 0,          "Invalid patientId");
        require(fileHash != bytes32(0), "Empty fileHash");
        require(!_anchored[fileHash],   "Already anchored");

        _anchored[fileHash] = true;

        _patientRecords[patientId].push(Record({
            fileHash:   fileHash,
            category:   category,
            fileName:   fileName,
            timestamp:  block.timestamp,
            uploadedBy: msg.sender,
            exists:     true
        }));

        emit RecordAnchored(patientId, fileHash, category, fileName, msg.sender, block.timestamp);
    }

    /**
     * @notice Verify that a file hash was anchored for a given patient.
     * @return valid       true if found
     * @return recordIndex position in the patient's record array
     */
    function verifyRecord(
        uint256 patientId,
        bytes32 fileHash
    ) external view returns (bool valid, uint256 recordIndex) {
        Record[] storage records = _patientRecords[patientId];
        for (uint256 i = 0; i < records.length; i++) {
            if (records[i].fileHash == fileHash) {
                return (true, i);
            }
        }
        return (false, 0);
    }

    /**
     * @notice Total records anchored for a patient.
     */
    function recordCount(uint256 patientId) external view returns (uint256) {
        return _patientRecords[patientId].length;
    }

    /**
     * @notice Quick global check — is this hash anchored at all?
     */
    function isAnchored(bytes32 fileHash) external view returns (bool) {
        return _anchored[fileHash];
    }

    /**
     * @notice Retrieve a specific record by patient + index.
     */
    function getRecord(
        uint256 patientId,
        uint256 index
    ) external view returns (
        bytes32 fileHash,
        string  memory category,
        string  memory fileName,
        uint256 timestamp,
        address uploadedBy,
        bool    exists
    ) {
        require(index < _patientRecords[patientId].length, "Index out of bounds");
        Record storage r = _patientRecords[patientId][index];
        return (r.fileHash, r.category, r.fileName, r.timestamp, r.uploadedBy, r.exists);
    }
}
