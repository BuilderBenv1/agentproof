require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const AVALANCHE_RPC_URL = process.env.AVALANCHE_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || process.env.ETH_RPC_URL || "https://eth.llamarpc.com";
const LINEA_RPC_URL = process.env.LINEA_RPC_URL || "https://rpc.linea.build";
const SNOWTRACE_API_KEY = process.env.SNOWTRACE_API_KEY || "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const LINEASCAN_API_KEY = process.env.LINEASCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    fuji: {
      url: AVALANCHE_RPC_URL,
      chainId: 43113,
      accounts: [PRIVATE_KEY],
    },
    avalanche: {
      url: "https://api.avax.network/ext/bc/C/rpc",
      chainId: 43114,
      accounts: [PRIVATE_KEY],
    },
    base: {
      url: BASE_RPC_URL,
      chainId: 8453,
      accounts: [PRIVATE_KEY],
    },
    ethereum: {
      url: ETHEREUM_RPC_URL,
      chainId: 1,
      accounts: [PRIVATE_KEY],
    },
    linea: {
      url: LINEA_RPC_URL,
      chainId: 59144,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      avalancheFujiTestnet: SNOWTRACE_API_KEY,
      avalanche: SNOWTRACE_API_KEY,
      base: BASESCAN_API_KEY,
      mainnet: ETHERSCAN_API_KEY,
      linea: LINEASCAN_API_KEY,
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "linea",
        chainId: 59144,
        urls: {
          apiURL: "https://api.lineascan.build/api",
          browserURL: "https://lineascan.build",
        },
      },
    ],
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
