require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    // ── Local Hardhat node (default for dev) ─────────────────────────────────
    // Start with: npx hardhat node
    localhost: {
      url: "http://127.0.0.1:8545",
    },

    // ── Sepolia testnet ───────────────────────────────────────────────────────
    // Get free Sepolia ETH from: https://sepoliafaucet.com/
    // Get RPC URL from: https://alchemy.com (free tier)
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },

  // Etherscan verification (optional — add ETHERSCAN_API_KEY to .env)
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};