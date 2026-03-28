// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PatientRecords
 * @notice Stores tamper-proof keccak256 hashes of medical records on-chain.
 *         The actual files live in MongoDB/IPFS; this contract proves they
 *         haven't been altered since upload.
 */
contract PatientRecords is AccessControl, Pausable {
    // ── Roles ──────────────────────────────────────────────────────────────
    bytes32 public constant WRITER_ROLE = keccak256("WRITER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ── Data structures ────────────────────────────────────────────────────
    struct Record {
        bytes32  fileHash;       // keccak256 of raw file bytes
        string   category;       // "lab_report" | "prescription" | "scan" …
        string   fileName;       // original file name (metadata only)
        uint256  timestamp;      // block.timestamp when anchored
        address  uploadedBy;     // backend wallet or patient wallet
        bool     exists;
    }

    // patientId (numeric, set at signup) → array of records
    mapping(uint256 => Record[]) private _records;

    // global hash → already anchored? (prevents duplicate anchoring)
    mapping(bytes32 => bool) private _hashAnchored;

    // ── Events ─────────────────────────────────────────────────────────────
    event RecordAnchored(
        uint256 indexed patientId,
        bytes32 indexed fileHash,
        string  category,
        string  fileName,
        uint256 timestamp,
        address uploadedBy
    );

    event RecordRevoked(
        uint256 indexed patientId,
        uint256 indexed recordIndex,
        bytes32 fileHash
    );

    // ── Constructor ────────────────────────────────────────────────────────
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(WRITER_ROLE,        admin);
        _grantRole(PAUSER_ROLE,        admin);
    }

    // ── Write ──────────────────────────────────────────────────────────────

    /**
     * @notice Anchor a medical record hash on-chain.
     * @param patientId   Numeric patient ID (stored in MongoDB User.chainPatientId)
     * @param fileHash    keccak256 hash of the file bytes
     * @param category    Category string (e.g. "lab_report")
     * @param fileName    Original filename for reference
     */
    function anchorRecord(
        uint256 patientId,
        bytes32 fileHash,
        string  calldata category,
        string  calldata fileName
    ) external onlyRole(WRITER_ROLE) whenNotPaused {
        require(fileHash != bytes32(0),      "PatientRecords: empty hash");
        require(!_hashAnchored[fileHash],    "PatientRecords: hash already anchored");
        require(patientId != 0,             "PatientRecords: invalid patientId");

        _hashAnchored[fileHash] = true;

        _records[patientId].push(Record({
            fileHash:   fileHash,
            category:   category,
            fileName:   fileName,
            timestamp:  block.timestamp,
            uploadedBy: msg.sender,
            exists:     true
        }));

        emit RecordAnchored(
            patientId,
            fileHash,
            category,
            fileName,
            block.timestamp,
            msg.sender
        );
    }

    /**
     * @notice Soft-revoke a record (marks exists = false, does NOT delete hash).
     *         Useful for GDPR "right to erasure" — the hash stays but is
     *         flagged as revoked so UIs can hide it.
     */
    function revokeRecord(uint256 patientId, uint256 recordIndex)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        whenNotPaused
    {
        require(recordIndex < _records[patientId].length, "PatientRecords: index out of bounds");
        Record storage rec = _records[patientId][recordIndex];
        require(rec.exists, "PatientRecords: already revoked");

        rec.exists = false;
        emit RecordRevoked(patientId, recordIndex, rec.fileHash);
    }

    // ── Read ───────────────────────────────────────────────────────────────

    /**
     * @notice Verify whether a given hash is anchored and not revoked.
     * @return valid      true if the hash exists and is not revoked
     * @return patientId  0 if not found (caller must pass known patientId)
     */
    function verifyRecord(uint256 patientId, bytes32 fileHash)
        external
        view
        returns (bool valid, uint256 recordIndex)
    {
        Record[] storage recs = _records[patientId];
        for (uint256 i = 0; i < recs.length; i++) {
            if (recs[i].fileHash == fileHash && recs[i].exists) {
                return (true, i);
            }
        }
        return (false, 0);
    }

    /// @notice Get a single record by patient + index.
    function getRecord(uint256 patientId, uint256 index)
        external
        view
        returns (
            bytes32 fileHash,
            string memory category,
            string memory fileName,
            uint256 timestamp,
            address uploadedBy,
            bool    exists
        )
    {
        require(index < _records[patientId].length, "PatientRecords: index out of bounds");
        Record storage r = _records[patientId][index];
        return (r.fileHash, r.category, r.fileName, r.timestamp, r.uploadedBy, r.exists);
    }

    /// @notice Get total record count for a patient (includes revoked).
    function recordCount(uint256 patientId) external view returns (uint256) {
        return _records[patientId].length;
    }

    /// @notice Quick existence check without knowing the patient.
    function isAnchored(bytes32 fileHash) external view returns (bool) {
        return _hashAnchored[fileHash];
    }

    // ── Admin ──────────────────────────────────────────────────────────────
    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
