// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DoctorRegistry
 * @notice On-chain registry of verified doctors.
 *         Admin registers → Admin verifies → Anyone can check isVerified().
 *         Revocation is permanent and auditable.
 *
 * ABI consumed by backend/routes/blockchain.js
 *
 * Functions:
 *   registerDoctor(address, string, string, string, string)
 *   verifyDoctor(address)
 *   revokeDoctor(address, string)
 *   isVerified(address) → bool
 *   getDoctorStatus(address) → uint8
 */
contract DoctorRegistry {

    // ── Roles ─────────────────────────────────────────────────────────────────

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ── Status enum ───────────────────────────────────────────────────────────

    // 0 = None (not registered)
    // 1 = Registered (pending verification)
    // 2 = Verified
    // 3 = Revoked

    // ── Structs ───────────────────────────────────────────────────────────────

    struct Doctor {
        address wallet;
        string  name;
        string  specialty;
        string  licenseNumber;
        string  mongoId;        // MongoDB _id as string
        uint8   status;         // 0 none | 1 registered | 2 verified | 3 revoked
        uint256 registeredAt;
        uint256 verifiedAt;
        string  revokeReason;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    mapping(address => Doctor) private _doctors;
    address[] private _doctorList;

    // ── Events ────────────────────────────────────────────────────────────────

    event DoctorRegistered(address indexed wallet, string name, string licenseNumber, uint256 at);
    event DoctorVerified(address indexed wallet, uint256 at);
    event DoctorRevoked(address indexed wallet, string reason, uint256 at);

    // ── Functions ─────────────────────────────────────────────────────────────

    /**
     * @notice Register a doctor on-chain. Called by backend after MongoDB verification.
     * @param wallet        doctor's Ethereum wallet address
     * @param name          doctor's full name
     * @param specialty     medical specialty
     * @param licenseNumber medical council license number
     * @param mongoId       MongoDB _id string for cross-referencing
     */
    function registerDoctor(
        address         wallet,
        string calldata name,
        string calldata specialty,
        string calldata licenseNumber,
        string calldata mongoId
    ) external onlyOwner {
        require(wallet != address(0),              "Invalid wallet");
        require(bytes(name).length > 0,            "Empty name");
        require(bytes(licenseNumber).length > 0,   "Empty licenseNumber");
        require(_doctors[wallet].status == 0,      "Already registered");

        _doctors[wallet] = Doctor({
            wallet:        wallet,
            name:          name,
            specialty:     specialty,
            licenseNumber: licenseNumber,
            mongoId:       mongoId,
            status:        1,
            registeredAt:  block.timestamp,
            verifiedAt:    0,
            revokeReason:  ""
        });

        _doctorList.push(wallet);

        emit DoctorRegistered(wallet, name, licenseNumber, block.timestamp);
    }

    /**
     * @notice Verify a registered doctor. Sets status to 2 (Verified).
     */
    function verifyDoctor(address wallet) external onlyOwner {
        require(_doctors[wallet].status == 1, "Doctor not registered or already processed");
        _doctors[wallet].status     = 2;
        _doctors[wallet].verifiedAt = block.timestamp;
        emit DoctorVerified(wallet, block.timestamp);
    }

    /**
     * @notice Revoke a doctor's verification. Permanent and auditable.
     * @param reason Human-readable reason (stored on-chain forever)
     */
    function revokeDoctor(address wallet, string calldata reason) external onlyOwner {
        require(_doctors[wallet].status == 2, "Doctor not verified");
        _doctors[wallet].status       = 3;
        _doctors[wallet].revokeReason = reason;
        emit DoctorRevoked(wallet, reason, block.timestamp);
    }

    /**
     * @notice Check if a doctor's wallet is currently verified.
     * @return true only if status == 2 (Verified)
     */
    function isVerified(address wallet) external view returns (bool) {
        return _doctors[wallet].status == 2;
    }

    /**
     * @notice Get raw status code for a wallet.
     * @return 0 = not registered, 1 = registered, 2 = verified, 3 = revoked
     */
    function getDoctorStatus(address wallet) external view returns (uint8) {
        return _doctors[wallet].status;
    }

    /**
     * @notice Get full doctor record (owner/admin use).
     */
    function getDoctor(address wallet) external view onlyOwner returns (Doctor memory) {
        return _doctors[wallet];
    }

    /**
     * @notice Total number of registered doctors.
     */
    function doctorCount() external view returns (uint256) {
        return _doctorList.length;
    }
}
