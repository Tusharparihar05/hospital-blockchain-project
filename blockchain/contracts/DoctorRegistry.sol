// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DoctorRegistry
 * @notice On-chain registry that maps verified doctor wallets to their
 *         license hashes and specialty. The hospital admin verifies a
 *         doctor once; after that, any smart contract or frontend can
 *         confirm the doctor's status without trusting the database.
 */
contract DoctorRegistry is AccessControl, Pausable {
    // ── Roles ──────────────────────────────────────────────────────────────
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");

    // ── Data structures ────────────────────────────────────────────────────
    enum DoctorStatus { NotRegistered, Pending, Verified, Revoked }

    struct Doctor {
        string      name;
        string      specialty;
        string      licenseNumber;      // raw string for UI display
        bytes32     licenseHash;        // keccak256(licenseNumber) stored on-chain
        address     wallet;
        uint256     registeredAt;
        uint256     verifiedAt;         // 0 if not yet verified
        DoctorStatus status;
        string      mongoId;            // MongoDB _id for back-reference
    }

    // wallet → Doctor
    mapping(address => Doctor) private _doctors;

    // licenseHash → already registered? (prevent duplicates)
    mapping(bytes32 => bool) private _licenseRegistered;

    // mongoId → wallet (for backend lookups)
    mapping(string => address) private _mongoIdToWallet;

    // all registered wallets (for enumeration)
    address[] private _allDoctors;

    // ── Events ─────────────────────────────────────────────────────────────
    event DoctorRegistered(
        address indexed wallet,
        string  name,
        string  specialty,
        bytes32 licenseHash,
        string  mongoId
    );

    event DoctorVerified(
        address indexed wallet,
        address indexed verifiedBy,
        uint256 timestamp
    );

    event DoctorRevoked(
        address indexed wallet,
        address indexed revokedBy,
        string  reason
    );

    event DoctorUpdated(
        address indexed wallet,
        string  field
    );

    // ── Constructor ────────────────────────────────────────────────────────
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE,      admin);
        _grantRole(PAUSER_ROLE,        admin);
    }

    // ── Registration (called by backend on doctor signup) ──────────────────

    /**
     * @notice Register a new doctor. Status starts as Pending until verified.
     * @param wallet        Doctor's MetaMask wallet
     * @param name          Full name
     * @param specialty     Medical specialty
     * @param licenseNumber Raw license number string
     * @param mongoId       MongoDB _id of the doctor's User document
     */
    function registerDoctor(
        address wallet,
        string  calldata name,
        string  calldata specialty,
        string  calldata licenseNumber,
        string  calldata mongoId
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        require(wallet != address(0),                           "DoctorRegistry: zero address");
        require(_doctors[wallet].status == DoctorStatus.NotRegistered,
                                                                "DoctorRegistry: already registered");
        require(bytes(name).length > 0,                         "DoctorRegistry: empty name");
        require(bytes(licenseNumber).length > 0,                "DoctorRegistry: empty license");

        bytes32 licenseHash = keccak256(bytes(licenseNumber));
        require(!_licenseRegistered[licenseHash],               "DoctorRegistry: license already registered");

        _licenseRegistered[licenseHash] = true;
        _mongoIdToWallet[mongoId]       = wallet;
        _allDoctors.push(wallet);

        _doctors[wallet] = Doctor({
            name:          name,
            specialty:     specialty,
            licenseNumber: licenseNumber,
            licenseHash:   licenseHash,
            wallet:        wallet,
            registeredAt:  block.timestamp,
            verifiedAt:    0,
            status:        DoctorStatus.Pending,
            mongoId:       mongoId
        });

        emit DoctorRegistered(wallet, name, specialty, licenseHash, mongoId);
    }

    // ── Verification ───────────────────────────────────────────────────────

    /**
     * @notice Verify a pending doctor (hospital admin action).
     */
    function verifyDoctor(address wallet)
        external
        onlyRole(VERIFIER_ROLE)
        whenNotPaused
    {
        require(_doctors[wallet].status == DoctorStatus.Pending,
                "DoctorRegistry: not in Pending state");

        _doctors[wallet].status     = DoctorStatus.Verified;
        _doctors[wallet].verifiedAt = block.timestamp;

        emit DoctorVerified(wallet, msg.sender, block.timestamp);
    }

    /**
     * @notice Revoke a doctor's verification (license expired, misconduct, etc.).
     */
    function revokeDoctor(address wallet, string calldata reason)
        external
        onlyRole(VERIFIER_ROLE)
        whenNotPaused
    {
        require(
            _doctors[wallet].status == DoctorStatus.Verified ||
            _doctors[wallet].status == DoctorStatus.Pending,
            "DoctorRegistry: not registered"
        );

        _doctors[wallet].status = DoctorStatus.Revoked;
        emit DoctorRevoked(wallet, msg.sender, reason);
    }

    // ── Update ─────────────────────────────────────────────────────────────

    /**
     * @notice Update a doctor's specialty (e.g., after further certification).
     */
    function updateSpecialty(address wallet, string calldata specialty)
        external
        onlyRole(VERIFIER_ROLE)
        whenNotPaused
    {
        require(_doctors[wallet].status != DoctorStatus.NotRegistered,
                "DoctorRegistry: not registered");
        _doctors[wallet].specialty = specialty;
        emit DoctorUpdated(wallet, "specialty");
    }

    // ── Read ───────────────────────────────────────────────────────────────

    /// @notice Full doctor struct for a wallet.
    function getDoctor(address wallet)
        external
        view
        returns (Doctor memory)
    {
        return _doctors[wallet];
    }

    /// @notice Quick verified check — used by AppointmentToken before minting.
    function isVerified(address wallet) external view returns (bool) {
        return _doctors[wallet].status == DoctorStatus.Verified;
    }

    /// @notice Check status as uint (0=NotReg,1=Pending,2=Verified,3=Revoked).
    function getDoctorStatus(address wallet) external view returns (DoctorStatus) {
        return _doctors[wallet].status;
    }

    /// @notice Verify a license hash directly (without knowing the wallet).
    function verifyLicenseHash(bytes32 licenseHash) external view returns (bool) {
        return _licenseRegistered[licenseHash];
    }

    /// @notice Look up a wallet from a MongoDB doctor ID.
    function getWalletByMongoId(string calldata mongoId)
        external
        view
        returns (address)
    {
        return _mongoIdToWallet[mongoId];
    }

    /// @notice Total registered doctors (including revoked).
    function totalDoctors() external view returns (uint256) {
        return _allDoctors.length;
    }

    /// @notice Get wallet at index (for off-chain enumeration).
    function getDoctorAtIndex(uint256 index) external view returns (address) {
        require(index < _allDoctors.length, "DoctorRegistry: index out of bounds");
        return _allDoctors[index];
    }

    // ── Admin ──────────────────────────────────────────────────────────────
    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
