/**
 * Deploy TrustScoreOracle to any chain.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-oracle.js --network avalanche
 *   npx hardhat run scripts/deploy-oracle.js --network base
 *   npx hardhat run scripts/deploy-oracle.js --network ethereum
 *   npx hardhat run scripts/deploy-oracle.js --network linea
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying TrustScoreOracle on", network.name);
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance));

  const QUERY_FEE = ethers.parseEther("0.001");
  const TrustScoreOracle = await ethers.getContractFactory("TrustScoreOracle");
  const oracle = await TrustScoreOracle.deploy(deployer.address, QUERY_FEE);
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();

  console.log("\nTrustScoreOracle deployed to:", oracleAddr);
  console.log("Query fee: 0.001 native token");
  console.log("Oracle updater:", deployer.address);

  // Save deployment info
  const info = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    TrustScoreOracle: oracleAddr,
    queryFee: "0.001",
  };

  const outputDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `oracle-${network.name}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(info, null, 2));
  console.log(`\nSaved to ${outputPath}`);

  // Print env var to set
  const envVarMap = {
    avalanche: "AVAX_ORACLE_ADDRESS",
    base: "BASE_ORACLE_ADDRESS",
    ethereum: "ETHEREUM_ORACLE_ADDRESS",
    linea: "LINEA_ORACLE_ADDRESS",
  };
  const envVar = envVarMap[network.name] || "TRUST_SCORE_ORACLE_ADDRESS";
  console.log(`\nSet this env var on Railway:`);
  console.log(`  ${envVar}=${oracleAddr}`);

  // Verify on block explorer
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting 30s for block explorer indexing...");
    await new Promise((r) => setTimeout(r, 30000));
    try {
      await hre.run("verify:verify", {
        address: oracleAddr,
        constructorArguments: [deployer.address, QUERY_FEE],
      });
      console.log("Contract verified!");
    } catch (e) {
      if (e.message.includes("Already Verified")) {
        console.log("Already verified");
      } else {
        console.log("Verification failed:", e.message);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
