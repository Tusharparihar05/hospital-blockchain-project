const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // ── Deploy PatientRecords ─────────────────────────────────────────────────
  console.log("\nDeploying PatientRecords...");
  const PatientRecords = await ethers.getContractFactory("PatientRecords");
  const patientRecords = await PatientRecords.deploy();
  await patientRecords.waitForDeployment();
  const patientRecordsAddress = await patientRecords.getAddress();
  console.log("✅ PatientRecords deployed to:", patientRecordsAddress);

  // ── Deploy AppointmentToken ───────────────────────────────────────────────
  console.log("\nDeploying AppointmentToken...");
  const AppointmentToken = await ethers.getContractFactory("AppointmentToken");
  const appointmentToken = await AppointmentToken.deploy();
  await appointmentToken.waitForDeployment();
  const appointmentTokenAddress = await appointmentToken.getAddress();
  console.log("✅ AppointmentToken deployed to:", appointmentTokenAddress);

  // ── Save addresses + ABIs to frontend ────────────────────────────────────
  // This auto-updates your frontend's .env and copies ABIs
  const addresses = {
    PatientRecords:  patientRecordsAddress,
    AppointmentToken: appointmentTokenAddress,
    network:         hre.network.name,
    deployedAt:      new Date().toISOString(),
  };

  // Save addresses to a JSON file
  fs.writeFileSync(
    path.join(__dirname, "../deployed-addresses.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n📄 Addresses saved to deployed-addresses.json");

  // Copy ABI files to frontend/src/abis/
  const frontendAbisDir = path.join(__dirname, "../../frontend/src/abis");
  if (!fs.existsSync(frontendAbisDir)) fs.mkdirSync(frontendAbisDir, { recursive: true });

  // Copy PatientRecords ABI
  const prArtifact = require(`../artifacts/contracts/PatientRecords.sol/PatientRecords.json`);
  fs.writeFileSync(
    path.join(frontendAbisDir, "PatientRecords.json"),
    JSON.stringify(prArtifact.abi, null, 2)
  );

  // Copy AppointmentToken ABI
  const atArtifact = require(`../artifacts/contracts/AppointmentToken.sol/AppointmentToken.json`);
  fs.writeFileSync(
    path.join(frontendAbisDir, "AppointmentToken.json"),
    JSON.stringify(atArtifact.abi, null, 2)
  );

  console.log("📁 ABIs copied to frontend/src/abis/");

  // Print .env values to paste
  console.log("\n─────────────────────────────────────────────");
  console.log("📋 COPY THESE INTO frontend/.env :");
  console.log(`REACT_APP_PATIENT_RECORDS_ADDRESS=${patientRecordsAddress}`);
  console.log(`REACT_APP_APPOINTMENT_ADDRESS=${appointmentTokenAddress}`);
  console.log("─────────────────────────────────────────────");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});