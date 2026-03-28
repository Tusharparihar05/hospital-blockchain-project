// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title AppointmentToken
 * @notice Soulbound (non-transferable) NFT minted when a doctor marks
 *         an appointment as completed.  Each token is an immutable proof
 *         that a specific patient–doctor appointment happened on a
 *         specific date — useful for insurance claims and medical-legal disputes.
 */
contract AppointmentToken is ERC721, AccessControl, Pausable {
    using Strings for uint256;

    // ── Roles ──────────────────────────────────────────────────────────────
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ── Token counter (no OZ dep needed — simple uint) ─────────────────────
    uint256 private _nextTokenId;

    // ── Appointment metadata stored per token ──────────────────────────────
    struct AppointmentData {
        uint256 patientId;      // numeric patient ID
        address patientWallet;  // patient's wallet (may be zero if not linked)
        address doctorWallet;   // doctor's wallet
        string  doctorName;
        string  specialty;
        uint256 appointmentDate;  // unix timestamp of the scheduled slot
        uint256 completedAt;      // block.timestamp when token was minted
        string  appointmentId;    // MongoDB _id for back-reference
    }

    mapping(uint256 => AppointmentData) private _appointmentData;

    // appointmentId (MongoDB string) → tokenId (prevents double-minting)
    mapping(string => uint256) private _appointmentToToken;
    mapping(string => bool)    private _appointmentMinted;

    // patientId → list of tokenIds
    mapping(uint256 => uint256[]) private _patientTokens;

    // base URI for off-chain metadata JSON
    string private _baseTokenURI;

    // ── Events ─────────────────────────────────────────────────────────────
    event AppointmentTokenMinted(
        uint256 indexed tokenId,
        uint256 indexed patientId,
        address indexed doctorWallet,
        string  appointmentId,
        uint256 completedAt
    );

    // ── Constructor ────────────────────────────────────────────────────────
    constructor(address admin, string memory baseURI)
        ERC721("MediChain Appointment", "MCAPPT")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE,        admin);
        _grantRole(PAUSER_ROLE,        admin);
        _baseTokenURI = baseURI;
        _nextTokenId  = 1;
    }

    // ── Mint ───────────────────────────────────────────────────────────────

    /**
     * @notice Mint a soulbound appointment completion token.
     * @param to              Recipient wallet (patient or contract itself if patient has no wallet)
     * @param patientId       Numeric patient ID
     * @param patientWallet   Patient's linked wallet (pass address(0) if none)
     * @param doctorWallet    Doctor's wallet
     * @param doctorName      Doctor display name
     * @param specialty       Doctor's specialty
     * @param appointmentDate Unix timestamp of the appointment slot
     * @param appointmentId   MongoDB _id string of the appointment document
     */
    function mintAppointmentToken(
        address to,
        uint256 patientId,
        address patientWallet,
        address doctorWallet,
        string  calldata doctorName,
        string  calldata specialty,
        uint256 appointmentDate,
        string  calldata appointmentId
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256 tokenId) {
        require(to != address(0),                               "AppointmentToken: mint to zero address");
        require(!_appointmentMinted[appointmentId],             "AppointmentToken: already minted for this appointment");
        require(bytes(appointmentId).length > 0,                "AppointmentToken: empty appointmentId");

        tokenId = _nextTokenId++;

        _safeMint(to, tokenId);

        _appointmentData[tokenId] = AppointmentData({
            patientId:       patientId,
            patientWallet:   patientWallet,
            doctorWallet:    doctorWallet,
            doctorName:      doctorName,
            specialty:       specialty,
            appointmentDate: appointmentDate,
            completedAt:     block.timestamp,
            appointmentId:   appointmentId
        });

        _appointmentMinted[appointmentId] = true;
        _appointmentToToken[appointmentId] = tokenId;
        _patientTokens[patientId].push(tokenId);

        emit AppointmentTokenMinted(tokenId, patientId, doctorWallet, appointmentId, block.timestamp);
    }

    // ── Soulbound: block all transfers ─────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        // Allow minting (from == address(0)) but block all transfers
        require(from == address(0), "AppointmentToken: soulbound — non-transferable");
        return super._update(to, tokenId, auth);
    }

    // ── Read ───────────────────────────────────────────────────────────────

    function getAppointmentData(uint256 tokenId)
        external
        view
        returns (AppointmentData memory)
    {
        require(_ownerOf(tokenId) != address(0), "AppointmentToken: token does not exist");
        return _appointmentData[tokenId];
    }

    function getTokenByAppointmentId(string calldata appointmentId)
        external
        view
        returns (bool minted, uint256 tokenId)
    {
        minted  = _appointmentMinted[appointmentId];
        tokenId = _appointmentToToken[appointmentId];
    }

    function getPatientTokens(uint256 patientId)
        external
        view
        returns (uint256[] memory)
    {
        return _patientTokens[patientId];
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // ── Metadata ───────────────────────────────────────────────────────────

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string calldata newURI)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _baseTokenURI = newURI;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_ownerOf(tokenId) != address(0), "AppointmentToken: token does not exist");
        string memory base = _baseURI();
        if (bytes(base).length == 0) {
            return _buildOnChainURI(tokenId);
        }
        return string(abi.encodePacked(base, tokenId.toString()));
    }

    /// @dev Minimal on-chain JSON when no baseURI is set.
    function _buildOnChainURI(uint256 tokenId)
        internal
        view
        returns (string memory)
    {
        AppointmentData storage d = _appointmentData[tokenId];
        return string(abi.encodePacked(
            '{"name":"MediChain Appointment #', tokenId.toString(),
            '","description":"Proof of completed medical appointment",',
            '"attributes":[',
            '{"trait_type":"Doctor","value":"', d.doctorName, '"},',
            '{"trait_type":"Specialty","value":"', d.specialty, '"},',
            '{"trait_type":"Appointment ID","value":"', d.appointmentId, '"},',
            '{"trait_type":"Completed At","value":', d.completedAt.toString(),
            '}]}'
        ));
    }

    // ── Admin ──────────────────────────────────────────────────────────────
    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // Required override for multiple inheritance
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
