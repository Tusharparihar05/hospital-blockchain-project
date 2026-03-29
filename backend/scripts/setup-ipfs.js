// backend/scripts/setup-ipfs.js
// ─────────────────────────────────────────────────────────────────────────────
//  One-time IPFS setup for web3.storage (w3up client).
//  Run this ONCE before starting the backend for the first time.
//
//  Steps:
//    1. npm install @web3-storage/w3up-client   (in backend folder)
//    2. node scripts/setup-ipfs.js              (follow the prompts)
//    3. The script prints your Space DID — save it, you might need it later.
//
//  After this, the backend/routes/records.js will auto-upload to IPFS.
// ─────────────────────────────────────────────────────────────────────────────
const readline = require("readline");

async function main() {
  let create;
  try {
    ({ create } = require("@web3-storage/w3up-client"));
  } catch {
    console.error("❌  @web3-storage/w3up-client not installed.");
    console.error("    Run: npm install @web3-storage/w3up-client");
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(res => rl.question(q, res));

  console.log("\n🌐  MediChain IPFS Setup (web3.storage w3up)");
  console.log("═════════════════════════════════════════════\n");

  const email = await ask("Enter your web3.storage account email: ");
  rl.close();

  console.log("\nCreating client...");
  const client = await create();

  console.log(`Sending verification email to ${email}...`);
  await client.login(email);

  console.log("\n✅  Check your email and click the verification link.");
  console.log("    Once verified, press ENTER to continue.");
  await new Promise(res => process.stdin.once("data", res));

  // Create a storage space
  console.log("\nCreating storage space 'medichain'...");
  const space = await client.createSpace("medichain");
  await client.setCurrentSpace(space.did());

  console.log("\n═════════════════════════════════════════════");
  console.log("✅  IPFS setup complete!");
  console.log(`    Space DID: ${space.did()}`);
  console.log("\n    web3.storage gives you 5 GB free.");
  console.log("    Your uploaded files will be viewable at:");
  console.log("    https://w3s.link/ipfs/<CID>");
  console.log("\n    No extra .env variable needed —");
  console.log("    the client stores credentials locally.");
  console.log("═════════════════════════════════════════════\n");

  // Test upload
  console.log("Testing upload with a small file...");
  const testFile = new File(["MediChain IPFS test"], "test.txt", { type: "text/plain" });
  const cid = await client.uploadFile(testFile);
  console.log(`✅  Test upload successful!`);
  console.log(`    CID: ${cid}`);
  console.log(`    URL: https://w3s.link/ipfs/${cid}\n`);
}

main().catch(err => {
  console.error("❌  Setup failed:", err.message);
  process.exit(1);
});