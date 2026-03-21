// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PatientRecords {

    struct Record {
        bytes32 dataHash;    // keccak256 of the actual data stored in your backend
        uint256 timestamp;
        address addedBy;
    }

    // patientId (number) => list of records
    mapping(uint256 => Record[]) private patientRecords;

    // who is allowed to add records (doctors/staff wallet addresses)
    mapping(address => bool) public authorizedDoctors;
    address public owner;

    event RecordAdded(uint256 indexed patientId, bytes32 dataHash, address addedBy);
    event DoctorAuthorized(address doctor);
    event DoctorRevoked(address doctor);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedDoctors[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedDoctors[msg.sender] = true; // owner is authorized by default
    }

    // Owner adds a doctor wallet as authorized
    function authorizeDoctor(address doctor) public onlyOwner {
        authorizedDoctors[doctor] = true;
        emit DoctorAuthorized(doctor);
    }

    // Owner removes a doctor
    function revokeDoctor(address doctor) public onlyOwner {
        authorizedDoctors[doctor] = false;
        emit DoctorRevoked(doctor);
    }

    // Add a record hash for a patient — only authorized doctors can call this
    function addRecord(uint256 patientId, bytes32 dataHash) public onlyAuthorized {
        patientRecords[patientId].push(Record(dataHash, block.timestamp, msg.sender));
        emit RecordAdded(patientId, dataHash, msg.sender);
    }

    // Get all records for a patient
    function getRecords(uint256 patientId) public view returns (Record[] memory) {
        return patientRecords[patientId];
    }

    // Get count of records for a patient
    function getRecordCount(uint256 patientId) public view returns (uint256) {
        return patientRecords[patientId].length;
    }
}