require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.19",
  networks: {
    // Local chain for development
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Sepolia testnet (for going public) — fill in later
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  paths: {
    artifacts: "./artifacts",  // compiled contract ABIs go here
  },
};