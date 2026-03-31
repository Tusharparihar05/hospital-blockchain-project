// blockchain/scripts/deploy.js
// Run with: npx hardhat run scripts/deploy.js --network localhost

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n🚀 Deploying contracts with account:", deployer.address);
  console.log("   Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ── 1. PatientRecords ─────────────────────────────────────────────────────
  console.log("📄 Deploying PatientRecords...");
  const PatientRecords = await hre.ethers.getContractFactory("PatientRecords");
  const patientRecords = await PatientRecords.deploy();
  await patientRecords.waitForDeployment();
  const prAddress = await patientRecords.getAddress();
  console.log("   ✅ PatientRecords deployed to:", prAddress);

  // ── 2. AppointmentToken ───────────────────────────────────────────────────
  console.log("🎟️  Deploying AppointmentToken...");
  const AppointmentToken = await hre.ethers.getContractFactory("AppointmentToken");
  const appointmentToken = await AppointmentToken.deploy();
  await appointmentToken.waitForDeployment();
  const atAddress = await appointmentToken.getAddress();
  console.log("   ✅ AppointmentToken deployed to:", atAddress);

  // ── 3. DoctorRegistry ─────────────────────────────────────────────────────
  console.log("🩺 Deploying DoctorRegistry...");
  const DoctorRegistry = await hre.ethers.getContractFactory("DoctorRegistry");
  const doctorRegistry = await DoctorRegistry.deploy();
  await doctorRegistry.waitForDeployment();
  const drAddress = await doctorRegistry.getAddress();
  console.log("   ✅ DoctorRegistry deployed to:", drAddress);

  // ── 4. PatientRegistry ────────────────────────────────────────────────────
  console.log("👤 Deploying PatientRegistry...");
  const PatientRegistry = await hre.ethers.getContractFactory("PatientRegistry");
  const patientRegistry = await PatientRegistry.deploy();
  await patientRegistry.waitForDeployment();
  const prgAddress = await patientRegistry.getAddress();
  console.log("   ✅ PatientRegistry deployed to:", prgAddress);

  // ── Print all addresses ───────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  COPY THESE INTO YOUR .env FILES:");
  console.log("════════════════════════════════════════════════════════════\n");

  console.log("── backend/.env ─────────────────────────────────────────────");
  console.log(`PATIENT_RECORDS_ADDRESS=${prAddress}`);
  console.log(`APPOINTMENT_TOKEN_ADDRESS=${atAddress}`);
  console.log(`DOCTOR_REGISTRY_ADDRESS=${drAddress}`);
  console.log(`PATIENT_REGISTRY_ADDRESS=${prgAddress}`);
  console.log(`BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545`);
  console.log(`DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`);

  console.log("\n── frontend/.env ────────────────────────────────────────────");
  console.log(`REACT_APP_PATIENT_RECORDS_ADDRESS=${prAddress}`);
  console.log(`REACT_APP_APPOINTMENT_ADDRESS=${atAddress}`);

  console.log("\n════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("❌ Deploy failed:", err);
  process.exitCode = 1;
});