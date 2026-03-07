// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PatientRegistry {

    struct Patient {
        string name;
        address wallet;
    }

    mapping(address => Patient) public patients;

    function registerPatient(string memory _name) public {
        patients[msg.sender] = Patient(_name, msg.sender);
    }

}