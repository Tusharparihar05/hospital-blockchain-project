// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AppointmentToken
 * @notice ERC-721 NFT minted for every confirmed appointment.
 */
contract AppointmentToken {

    string public name   = "MediChain Appointment";
    string public symbol = "MCAPPT";

    uint256 private _nextTokenId = 1;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    struct AppointmentData {
        uint256 patientId;
        address patientWallet;
        address doctorWallet;
        string  doctorName;
        string  specialty;
        uint256 appointmentDate;
        string  appointmentId;
        bool    minted;
    }

    mapping(uint256 => AppointmentData) private _tokenData;
    mapping(string  => uint256)         private _appointmentToToken;
    mapping(uint256 => uint256[])       private _patientTokens;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event AppointmentMinted(uint256 indexed tokenId, uint256 indexed patientId, string appointmentId, address recipient);

    function mintAppointmentToken(
        address to,
        uint256 patientId,
        address patientWallet,
        address doctorWallet,
        string calldata doctorName,
        string calldata specialty,
        uint256 appointmentDate,
        string calldata appointmentId
    ) external returns (uint256 tokenId) {
        require(to != address(0),                        "Invalid recipient");
        require(patientId > 0,                           "Invalid patientId");
        require(bytes(appointmentId).length > 0,         "Empty appointmentId");
        require(_appointmentToToken[appointmentId] == 0, "Already minted");

        tokenId = _nextTokenId++;

        _owners[tokenId]  = to;
        _balances[to]    += 1;

        // Store in struct — avoids stack-too-deep
        AppointmentData storage d = _tokenData[tokenId];
        d.patientId       = patientId;
        d.patientWallet   = patientWallet;
        d.doctorWallet    = doctorWallet;
        d.doctorName      = doctorName;
        d.specialty       = specialty;
        d.appointmentDate = appointmentDate;
        d.appointmentId   = appointmentId;
        d.minted          = true;

        _appointmentToToken[appointmentId] = tokenId;
        _patientTokens[patientId].push(tokenId);

        emit Transfer(address(0), to, tokenId);
        emit AppointmentMinted(tokenId, patientId, appointmentId, to);
    }

    function getTokenByAppointmentId(string calldata appointmentId)
        external view returns (bool minted, uint256 tokenId)
    {
        tokenId = _appointmentToToken[appointmentId];
        minted  = tokenId > 0;
    }

    function getPatientTokens(uint256 patientId) external view returns (uint256[] memory) {
        return _patientTokens[patientId];
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function getAppointmentData(uint256 tokenId) external view returns (AppointmentData memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenData[tokenId];
    }

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
        return interfaceId == 0x80ac58cd || interfaceId == 0x01ffc9a7;
    }
}
