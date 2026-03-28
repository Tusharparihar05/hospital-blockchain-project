// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PatientRegistry
 * @notice On-chain patient identity registry.
 *         Links a numeric patientId (from MongoDB) to a wallet address,
 *         allowing patients to prove ownership of their records and to
 *         grant/revoke access to specific doctors.
 */
contract PatientRegistry is AccessControl, Pausable {
    // ── Roles ──────────────────────────────────────────────────────────────
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant PAUSER_ROLE    = keccak256("PAUSER_ROLE");

    // ── Data structures ────────────────────────────────────────────────────
    struct Patient {
        uint256 patientId;         // numeric ID — matches MongoDB chainPatientId
        address wallet;            // linked MetaMask wallet (may be address(0))
        string  mongoId;           // MongoDB _id string
        string  patientCode;       // e.g. "HLT-0x…" display code
        uint256 registeredAt;
        bool    active;
    }

    // wallet → Patient
    mapping(address  => Patient) private _patientByWallet;

    // patientId → wallet
    mapping(uint256  => address)  private _walletByPatientId;

    // mongoId → patientId
    mapping(string   => uint256)  private _patientIdByMongoId;

    // patientId → (doctorWallet => accessGranted)
    mapping(uint256  => mapping(address => bool)) private _accessGrants;

    // all registered patientIds
    uint256[] private _allPatientIds;

    // ── Events ─────────────────────────────────────────────────────────────
    event PatientRegistered(
        uint256 indexed patientId,
        address indexed wallet,
        string  mongoId,
        string  patientCode
    );

    event WalletLinked(
        uint256 indexed patientId,
        address indexed oldWallet,
        address indexed newWallet
    );

    event AccessGranted(
        uint256 indexed patientId,
        address indexed doctorWallet
    );

    event AccessRevoked(
        uint256 indexed patientId,
        address indexed doctorWallet
    );

    event PatientDeactivated(uint256 indexed patientId);
    event PatientReactivated(uint256 indexed patientId);

    // ── Constructor ────────────────────────────────────────────────────────
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE,     admin);
        _grantRole(PAUSER_ROLE,        admin);
    }

    // ── Registration ───────────────────────────────────────────────────────

    /**
     * @notice Register a patient on-chain. Called by backend at signup.
     * @param patientId   Numeric chainPatientId stored in MongoDB
     * @param wallet      Patient's wallet (pass address(0) if not linked yet)
     * @param mongoId     MongoDB _id
     * @param patientCode Display code like "HLT-0x1a2b"
     */
    function registerPatient(
        uint256 patientId,
        address wallet,
        string  calldata mongoId,
        string  calldata patientCode
    ) external onlyRole(REGISTRAR_ROLE) whenNotPaused {
        require(patientId != 0,                               "PatientRegistry: invalid patientId");
        require(_walletByPatientId[patientId] == address(0), "PatientRegistry: patientId already registered");
        require(bytes(mongoId).length > 0,                    "PatientRegistry: empty mongoId");

        // If wallet provided, it must not be already used
        if (wallet != address(0)) {
            require(!_patientByWallet[wallet].active,         "PatientRegistry: wallet already registered");
        }

        _patientIdByMongoId[mongoId] = patientId;
        _walletByPatientId[patientId] = wallet == address(0) ? address(this) : wallet;
        _allPatientIds.push(patientId);

        if (wallet != address(0)) {
            _patientByWallet[wallet] = Patient({
                patientId:    patientId,
                wallet:       wallet,
                mongoId:      mongoId,
                patientCode:  patientCode,
                registeredAt: block.timestamp,
                active:       true
            });
        }

        emit PatientRegistered(patientId, wallet, mongoId, patientCode);
    }

    // ── Wallet linking ─────────────────────────────────────────────────────

    /**
     * @notice Link or update the wallet for an existing patient.
     *         Can be called by the REGISTRAR (backend) or by the patient
     *         themselves if they already have a linked wallet.
     */
    function linkWallet(uint256 patientId, address newWallet)
        external
        whenNotPaused
    {
        require(newWallet != address(0),                      "PatientRegistry: zero address");
        require(!_patientByWallet[newWallet].active,          "PatientRegistry: wallet already in use");

        address currentWallet = _walletByPatientId[patientId];
        bool callerIsRegistrar = hasRole(REGISTRAR_ROLE, msg.sender);
        bool callerIsPatient   = (currentWallet == msg.sender && currentWallet != address(0));

        require(callerIsRegistrar || callerIsPatient,         "PatientRegistry: not authorized");

        // Deactivate old wallet record
        if (currentWallet != address(0) && currentWallet != address(this)) {
            _patientByWallet[currentWallet].active = false;
        }

        Patient memory oldPatient = _patientByWallet[currentWallet];

        _walletByPatientId[patientId] = newWallet;
        _patientByWallet[newWallet]   = Patient({
            patientId:    patientId,
            wallet:       newWallet,
            mongoId:      oldPatient.mongoId,
            patientCode:  oldPatient.patientCode,
            registeredAt: oldPatient.registeredAt,
            active:       true
        });

        emit WalletLinked(patientId, currentWallet, newWallet);
    }

    // ── Access control ─────────────────────────────────────────────────────

    /**
     * @notice Grant a doctor access to this patient's records.
     *         Must be called by the patient's own wallet.
     */
    function grantAccess(uint256 patientId, address doctorWallet)
        external
        whenNotPaused
    {
        require(doctorWallet != address(0), "PatientRegistry: zero doctor address");
        require(
            _walletByPatientId[patientId] == msg.sender ||
            hasRole(REGISTRAR_ROLE, msg.sender),
            "PatientRegistry: not authorized"
        );

        _accessGrants[patientId][doctorWallet] = true;
        emit AccessGranted(patientId, doctorWallet);
    }

    /**
     * @notice Revoke a doctor's access to this patient's records.
     */
    function revokeAccess(uint256 patientId, address doctorWallet)
        external
        whenNotPaused
    {
        require(
            _walletByPatientId[patientId] == msg.sender ||
            hasRole(REGISTRAR_ROLE, msg.sender),
            "PatientRegistry: not authorized"
        );

        _accessGrants[patientId][doctorWallet] = false;
        emit AccessRevoked(patientId, doctorWallet);
    }

    // ── Admin ──────────────────────────────────────────────────────────────

    function deactivatePatient(uint256 patientId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        address wallet = _walletByPatientId[patientId];
        if (wallet != address(0) && wallet != address(this)) {
            _patientByWallet[wallet].active = false;
        }
        emit PatientDeactivated(patientId);
    }

    function reactivatePatient(uint256 patientId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        address wallet = _walletByPatientId[patientId];
        if (wallet != address(0) && wallet != address(this)) {
            _patientByWallet[wallet].active = true;
        }
        emit PatientReactivated(patientId);
    }

    // ── Read ───────────────────────────────────────────────────────────────

    function getPatientByWallet(address wallet)
        external
        view
        returns (Patient memory)
    {
        return _patientByWallet[wallet];
    }

    function getWalletByPatientId(uint256 patientId)
        external
        view
        returns (address)
    {
        return _walletByPatientId[patientId];
    }

    function getPatientIdByMongoId(string calldata mongoId)
        external
        view
        returns (uint256)
    {
        return _patientIdByMongoId[mongoId];
    }

    function hasAccess(uint256 patientId, address doctorWallet)
        external
        view
        returns (bool)
    {
        return _accessGrants[patientId][doctorWallet];
    }

    function isRegistered(uint256 patientId) external view returns (bool) {
        return _walletByPatientId[patientId] != address(0);
    }

    function totalPatients() external view returns (uint256) {
        return _allPatientIds.length;
    }

    function getPatientIdAtIndex(uint256 index) external view returns (uint256) {
        require(index < _allPatientIds.length, "PatientRegistry: index out of bounds");
        return _allPatientIds[index];
    }

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
