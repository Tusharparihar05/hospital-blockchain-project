// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PatientRegistry
 * @notice On-chain registry of patients and their doctor access grants.
 *
 * ABI consumed by backend/routes/blockchain.js
 *
 * Functions:
 *   registerPatient(uint256, address, string, string)
 *   isRegistered(uint256) → bool
 *   hasAccess(uint256, address) → bool
 *   getWalletByPatientId(uint256) → address
 */
contract PatientRegistry {

    // ── Admin ─────────────────────────────────────────────────────────────────

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ── Structs ───────────────────────────────────────────────────────────────

    struct Patient {
        uint256 patientId;
        address wallet;
        string  mongoId;       // MongoDB _id
        string  patientCode;   // HLT-0x... string code
        bool    registered;
        uint256 registeredAt;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    // chainPatientId → Patient
    mapping(uint256 => Patient) private _patients;

    // chainPatientId → doctor wallet → access granted
    mapping(uint256 => mapping(address => bool)) private _access;

    // ── Events ────────────────────────────────────────────────────────────────

    event PatientRegistered(uint256 indexed patientId, address wallet, string patientCode, uint256 at);
    event AccessGranted(uint256 indexed patientId, address indexed doctorWallet, uint256 at);
    event AccessRevoked(uint256 indexed patientId, address indexed doctorWallet, uint256 at);

    // ── Functions ─────────────────────────────────────────────────────────────

    /**
     * @notice Register a patient on-chain.
     * @param patientId   numeric chainPatientId from MongoDB
     * @param wallet      patient's Ethereum wallet (zero address if no wallet yet)
     * @param mongoId     MongoDB _id string
     * @param patientCode HLT-0x... code for display
     */
    function registerPatient(
        uint256         patientId,
        address         wallet,
        string calldata mongoId,
        string calldata patientCode
    ) external onlyOwner {
        require(patientId > 0,                    "Invalid patientId");
        require(!_patients[patientId].registered, "Already registered");
        require(bytes(mongoId).length > 0,        "Empty mongoId");

        _patients[patientId] = Patient({
            patientId:    patientId,
            wallet:       wallet,
            mongoId:      mongoId,
            patientCode:  patientCode,
            registered:   true,
            registeredAt: block.timestamp
        });

        emit PatientRegistered(patientId, wallet, patientCode, block.timestamp);
    }

    /**
     * @notice Check if a numeric patient ID is registered.
     */
    function isRegistered(uint256 patientId) external view returns (bool) {
        return _patients[patientId].registered;
    }

    /**
     * @notice Check if a doctor wallet has access to a patient's records.
     */
    function hasAccess(uint256 patientId, address doctorWallet) external view returns (bool) {
        return _access[patientId][doctorWallet];
    }

    /**
     * @notice Get the wallet address linked to a chainPatientId.
     */
    function getWalletByPatientId(uint256 patientId) external view returns (address) {
        return _patients[patientId].wallet;
    }

    // ── Access control (called by patient or owner) ───────────────────────────

    /**
     * @notice Grant a doctor wallet access to your records.
     *         Must be called by the patient's registered wallet OR the contract owner.
     */
    function grantAccess(uint256 patientId, address doctorWallet) external {
        require(_patients[patientId].registered, "Patient not registered");
        require(
            msg.sender == _patients[patientId].wallet || msg.sender == owner,
            "Not authorized"
        );
        _access[patientId][doctorWallet] = true;
        emit AccessGranted(patientId, doctorWallet, block.timestamp);
    }

    /**
     * @notice Revoke a doctor wallet's access.
     */
    function revokeAccess(uint256 patientId, address doctorWallet) external {
        require(_patients[patientId].registered, "Patient not registered");
        require(
            msg.sender == _patients[patientId].wallet || msg.sender == owner,
            "Not authorized"
        );
        _access[patientId][doctorWallet] = false;
        emit AccessRevoked(patientId, doctorWallet, block.timestamp);
    }

    /**
     * @notice Update a patient's wallet address (if they connect MetaMask later).
     */
    function updateWallet(uint256 patientId, address newWallet) external onlyOwner {
        require(_patients[patientId].registered, "Patient not registered");
        _patients[patientId].wallet = newWallet;
    }
}
