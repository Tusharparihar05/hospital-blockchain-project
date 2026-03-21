// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AppointmentToken {

    uint256 public tokenCounter;

    struct Appointment {
        uint256 tokenId;
        uint256 patientId;
        uint256 doctorId;
        uint256 scheduledTime;   // Unix timestamp
        bool    isValid;
        bool    isCompleted;
    }

    mapping(uint256 => Appointment) public appointments;
    // patientId => list of their tokenIds
    mapping(uint256 => uint256[]) public patientTokens;

    address public owner;

    event TokenIssued(uint256 indexed tokenId, uint256 indexed patientId, uint256 doctorId);
    event TokenInvalidated(uint256 indexed tokenId);
    event AppointmentCompleted(uint256 indexed tokenId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Issue a new appointment token
    function issueToken(
        uint256 patientId,
        uint256 doctorId,
        uint256 scheduledTime
    ) public returns (uint256) {
        uint256 tokenId = tokenCounter;
        tokenCounter++;

        appointments[tokenId] = Appointment({
            tokenId:       tokenId,
            patientId:     patientId,
            doctorId:      doctorId,
            scheduledTime: scheduledTime,
            isValid:       true,
            isCompleted:   false
        });

        patientTokens[patientId].push(tokenId);
        emit TokenIssued(tokenId, patientId, doctorId);
        return tokenId;
    }

    // Mark appointment as completed (doctor calls this)
    function completeAppointment(uint256 tokenId) public {
        require(appointments[tokenId].isValid, "Token not valid");
        appointments[tokenId].isCompleted = true;
        emit AppointmentCompleted(tokenId);
    }

    // Cancel / invalidate a token
    function invalidateToken(uint256 tokenId) public {
        appointments[tokenId].isValid = false;
        emit TokenInvalidated(tokenId);
    }

    // Get all token IDs for a patient
    function getPatientTokens(uint256 patientId) public view returns (uint256[] memory) {
        return patientTokens[patientId];
    }

    // Check if a token is valid
    function isTokenValid(uint256 tokenId) public view returns (bool) {
        return appointments[tokenId].isValid;
    }
}