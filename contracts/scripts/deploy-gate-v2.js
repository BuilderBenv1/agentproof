/**
 * Deploy ReputationGateV2 to Base (or any configured chain).
 *
 * Usage:
 *   npx hardhat run scripts/deploy-gate-v2.js --network base
 *   npx hardhat run scripts/deploy-gate-v2.js --network avalanche
 *
 * Env vars:
 *   TRUST_SCORE_ORACLE — Address of the TrustScoreOracle on the target chain
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Known oracle deployments per chain
const ORACLE_ADDRESSES = {
  base: process.env.BASE_ORACLE_ADDRESS || process.env.TRUST_SCORE_ORACLE,
  avalanche: process.env.AVAX_ORACLE_ADDRESS || process.env.TRUST_SCORE_ORACLE,
  fuji: process.env.FUJI_ORACLE_ADDRESS || process.env.TRUST_SCORE_ORACLE,
  polygon: process.env.POLYGON_ORACLE_ADDRESS || process.env.TRUST_SCORE_ORACLE,
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ReputationGateV2 on", network.name);
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance));

  const oracleAddr = ORACLE_ADDRESSES[network.name];
  if (!oracleAddr) {
    console.error("No oracle address for network:", network.name);
    console.error("Set TRUST_SCORE_ORACLE or chain-specific env var");
    process.exit(1);
  }

  console.log("Oracle address:", oracleAddr);

  // Gate config: minScore=3000 (30.00), minTier=1 (bronze), maxScoreAge=0 (no expiry)
  const MIN_SCORE = 3000;
  const MIN_TIER = 1;
  const MAX_SCORE_AGE = 0;

  const ReputationGateV2 = await ethers.getContractFactory("ReputationGateV2");
  const gate = await ReputationGateV2.deploy(oracleAddr, MIN_SCORE, MIN_TIER, MAX_SCORE_AGE);
  await gate.waitForDeployment();
  const gateAddr = await gate.getAddress();

  console.log("\nReputationGateV2 deployed to:", gateAddr);
  console.log("Min score:", MIN_SCORE, "(30.00)");
  console.log("Min tier:", MIN_TIER, "(bronze)");
  console.log("Max score age:", MAX_SCORE_AGE, "(no expiry)");

  // Save deployment info
  const info = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    ReputationGateV2: gateAddr,
    TrustScoreOracle: oracleAddr,
    config: {
      minScore: MIN_SCORE,
      minTier: MIN_TIER,
      maxScoreAge: MAX_SCORE_AGE,
    },
  };

  const outputDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `gate-v2-${network.name}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(info, null, 2));
  console.log(`\nSaved to ${outputPath}`);

  // Verify on block explorer
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting 30s for block explorer indexing...");
    await new Promise((r) => setTimeout(r, 30000));
    try {
      await hre.run("verify:verify", {
        address: gateAddr,
        constructorArguments: [oracleAddr, MIN_SCORE, MIN_TIER, MAX_SCORE_AGE],
      });
      console.log("Contract verified on block explorer!");
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
