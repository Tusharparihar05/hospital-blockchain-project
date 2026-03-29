// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AppointmentToken
 * @notice ERC-721 NFT minted for every confirmed appointment.
 *         One token = one appointment. Patients receive the NFT in their wallet.
 *         If no patient wallet is provided, the backend deployer holds it temporarily.
 *
 * ABI consumed by backend/routes/blockchain.js
 *
 * Functions:
 *   mintAppointmentToken(address, uint256, address, address, string, string, uint256, string) → uint256
 *   getTokenByAppointmentId(string) → (bool minted, uint256 tokenId)
 *   getPatientTokens(uint256) → uint256[]
 *   totalMinted() → uint256
 *
 * Events:
 *   Transfer(address, address, uint256)   ← standard ERC-721
 */
contract AppointmentToken {

    // ── ERC-721 minimal implementation ───────────────────────────────────────

    string public name   = "MediChain Appointment";
    string public symbol = "MCAPPT";

    uint256 private _nextTokenId = 1;

    // tokenId → owner
    mapping(uint256 => address) private _owners;
    // owner → balance
    mapping(address => uint256) private _balances;
    // tokenId → approved
    mapping(uint256 => address) private _tokenApprovals;
    // owner → operator → approved
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // ── Appointment-specific storage ──────────────────────────────────────────

    struct AppointmentData {
        uint256  patientId;
        address  patientWallet;
        address  doctorWallet;
        string   doctorName;
        string   specialty;
        uint256  appointmentDate;  // unix timestamp (seconds)
        string   appointmentId;    // MongoDB _id string
        bool     minted;
    }

    // tokenId → appointment data
    mapping(uint256 => AppointmentData) private _tokenData;

    // appointmentId string → tokenId (for dedup lookup)
    mapping(string => uint256) private _appointmentToToken;

    // chainPatientId → list of tokenIds
    mapping(uint256 => uint256[]) private _patientTokens;

    // ── Events ────────────────────────────────────────────────────────────────

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    event AppointmentMinted(
        uint256 indexed tokenId,
        uint256 indexed patientId,
        string  appointmentId,
        address recipient,
        uint256 mintedAt
    );

    // ── Minting ───────────────────────────────────────────────────────────────

    /**
     * @notice Mint an appointment NFT.
     * @param to              recipient wallet (patient or deployer if patient has no wallet)
     * @param patientId       numeric chainPatientId from MongoDB
     * @param patientWallet   patient's wallet (or zero address)
     * @param doctorWallet    doctor's wallet (or zero address)
     * @param doctorName      display name of the doctor
     * @param specialty       doctor's specialty
     * @param appointmentDate unix timestamp of the appointment date
     * @param appointmentId   MongoDB _id of the appointment document
     * @return tokenId        the minted ERC-721 token ID
     */
    function mintAppointmentToken(
        address        to,
        uint256        patientId,
        address        patientWallet,
        address        doctorWallet,
        string calldata doctorName,
        string calldata specialty,
        uint256        appointmentDate,
        string calldata appointmentId
    ) external returns (uint256 tokenId) {
        require(to != address(0),                              "Invalid recipient");
        require(patientId > 0,                                 "Invalid patientId");
        require(bytes(appointmentId).length > 0,               "Empty appointmentId");
        require(_appointmentToToken[appointmentId] == 0,       "Already minted");

        tokenId = _nextTokenId++;

        // Mint
        _owners[tokenId]     = to;
        _balances[to]       += 1;

        // Store metadata
        _tokenData[tokenId] = AppointmentData({
            patientId:       patientId,
            patientWallet:   patientWallet,
            doctorWallet:    doctorWallet,
            doctorName:      doctorName,
            specialty:       specialty,
            appointmentDate: appointmentDate,
            appointmentId:   appointmentId,
            minted:          true
        });

        _appointmentToToken[appointmentId] = tokenId;
        _patientTokens[patientId].push(tokenId);

        emit Transfer(address(0), to, tokenId);
        emit AppointmentMinted(tokenId, patientId, appointmentId, to, block.timestamp);
    }

    // ── View functions (match ABI in blockchain.js) ───────────────────────────

    /**
     * @notice Check if a MongoDB appointment ID already has a minted token.
     */
    function getTokenByAppointmentId(
        string calldata appointmentId
    ) external view returns (bool minted, uint256 tokenId) {
        tokenId = _appointmentToToken[appointmentId];
        minted  = tokenId > 0;
    }

    /**
     * @notice All token IDs minted for a patient.
     */
    function getPatientTokens(uint256 patientId) external view returns (uint256[] memory) {
        return _patientTokens[patientId];
    }

    /**
     * @notice Total tokens ever minted.
     */
    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    /**
     * @notice Get full metadata for a token.
     */
    function getAppointmentData(uint256 tokenId) external view returns (AppointmentData memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenData[tokenId];
    }

    // ── ERC-721 standard functions ────────────────────────────────────────────

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }

    function balanceOf(address owner) public view returns (uint256) {
        require(owner != address(0), "Zero address");
        return _balances[owner];
    }

    function approve(address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        require(msg.sender == owner || isApprovedForAll(owner, msg.sender), "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        require(
            msg.sender == owner ||
            msg.sender == getApproved(tokenId) ||
            isApprovedForAll(owner, msg.sender),
            "Not authorized"
        );
        require(from == owner, "From != owner");
        require(to != address(0), "Zero address");

        delete _tokenApprovals[tokenId];
        _balances[from] -= 1;
        _balances[to]   += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public {
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) public {
        transferFrom(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return
            interfaceId == 0x80ac58cd || // ERC-721
            interfaceId == 0x01ffc9a7;   // ERC-165
    }
}
