require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.25",
    settings: {
      evmVersion: "cancun"
    }
  },
  networks: {
    hardhat: {},
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: [] // Private key to be added by user
    },
    sepolia: {
      url: "https://rpc.sepolia.org",
      accounts: []
    }
  }
};
