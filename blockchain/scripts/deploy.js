// blockchain/scripts/deploy.js
// ─────────────────────────────────────────────────────────────────────────────
//  Deploys all 4 MediChain contracts in order and prints the .env values
//  to paste into your backend/.env file.
//
//  Usage:
//    Local:   npx hardhat run scripts/deploy.js --network localhost
//    Sepolia: npx hardhat run scripts/deploy.js --network sepolia
// ─────────────────────────────────────────────────────────────────────────────
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("\n🚀 MediChain Contract Deployment");
  console.log("═══════════════════════════════════════════");
  console.log(`Network:   ${hre.network.name}`);
  console.log(`Deployer:  ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance:   ${hre.ethers.formatEther(balance)} ETH`);
  console.log("═══════════════════════════════════════════\n");

  // ── 1. PatientRecords ──────────────────────────────────────────────────────
  process.stdout.write("Deploying PatientRecords...  ");
  const PatientRecords = await hre.ethers.getContractFactory("PatientRecords");
  const patientRecords = await PatientRecords.deploy();
  await patientRecords.waitForDeployment();
  const prAddr = await patientRecords.getAddress();
  console.log(`✅  ${prAddr}`);

  // ── 2. AppointmentToken ────────────────────────────────────────────────────
  process.stdout.write("Deploying AppointmentToken... ");
  const AppointmentToken = await hre.ethers.getContractFactory("AppointmentToken");
  const appointmentToken = await AppointmentToken.deploy();
  await appointmentToken.waitForDeployment();
  const atAddr = await appointmentToken.getAddress();
  console.log(`✅  ${atAddr}`);

  // ── 3. DoctorRegistry ─────────────────────────────────────────────────────
  process.stdout.write("Deploying DoctorRegistry...  ");
  const DoctorRegistry = await hre.ethers.getContractFactory("DoctorRegistry");
  const doctorRegistry = await DoctorRegistry.deploy();
  await doctorRegistry.waitForDeployment();
  const drAddr = await doctorRegistry.getAddress();
  console.log(`✅  ${drAddr}`);

  // ── 4. PatientRegistry ────────────────────────────────────────────────────
  process.stdout.write("Deploying PatientRegistry... ");
  const PatientRegistry = await hre.ethers.getContractFactory("PatientRegistry");
  const patientRegistry = await PatientRegistry.deploy();
  await patientRegistry.waitForDeployment();
  const prgAddr = await patientRegistry.getAddress();
  console.log(`✅  ${prgAddr}`);

  // ── Print .env block ───────────────────────────────────────────────────────
  const rpc = hre.network.name === "localhost"
    ? "http://127.0.0.1:8545"
    : `(your ${hre.network.name} RPC URL)`;

  console.log("\n═══════════════════════════════════════════");
  console.log("📋  Copy these into your backend/.env file:");
  console.log("═══════════════════════════════════════════");
  console.log(`BLOCKCHAIN_RPC_URL=${rpc}`);
  console.log(`DEPLOYER_PRIVATE_KEY=${process.env.DEPLOYER_PRIVATE_KEY || "(add your key)"}`);
  console.log(`PATIENT_RECORDS_ADDRESS=${prAddr}`);
  console.log(`APPOINTMENT_TOKEN_ADDRESS=${atAddr}`);
  console.log(`DOCTOR_REGISTRY_ADDRESS=${drAddr}`);
  console.log(`PATIENT_REGISTRY_ADDRESS=${prgAddr}`);
  console.log("═══════════════════════════════════════════\n");

  // ── Quick smoke test ───────────────────────────────────────────────────────
  console.log("🔍  Quick smoke test...");

  // PatientRecords: anchor a dummy hash
  const dummyHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("smoke-test"));
  await patientRecords.anchorRecord(100001, dummyHash, "Test", "smoke.pdf");
  const anchored = await patientRecords.isAnchored(dummyHash);
  console.log(`    PatientRecords.isAnchored:    ${anchored ? "✅ pass" : "❌ fail"}`);

  // AppointmentToken: mint a token
  const tx = await appointmentToken.mintAppointmentToken(
    deployer.address,
    100001,
    deployer.address,
    deployer.address,
    "Dr. Test",
    "General",
    Math.floor(Date.now() / 1000),
    "SMOKE_TEST_APT_001"
  );
  const receipt = await tx.wait();
  const total   = await appointmentToken.totalMinted();
  console.log(`    AppointmentToken.totalMinted: ${total > 0n ? "✅ pass" : "❌ fail"} (${total} token(s))`);

  // DoctorRegistry: register + verify
  await doctorRegistry.registerDoctor(deployer.address, "Dr. Test", "General", "MCI999999", "smoke_mongo_id");
  await doctorRegistry.verifyDoctor(deployer.address);
  const verified = await doctorRegistry.isVerified(deployer.address);
  console.log(`    DoctorRegistry.isVerified:    ${verified ? "✅ pass" : "❌ fail"}`);

  // PatientRegistry: register a patient
  await patientRegistry.registerPatient(100001, deployer.address, "smoke_patient_mongo", "HLT-0xSMOKE");
  const registered = await patientRegistry.isRegistered(100001);
  console.log(`    PatientRegistry.isRegistered: ${registered ? "✅ pass" : "❌ fail"}`);

  console.log("\n🎉  All contracts deployed and smoke tested successfully!\n");
}

main().catch(err => {
  console.error("\n❌  Deployment failed:", err);
  process.exitCode = 1;
});