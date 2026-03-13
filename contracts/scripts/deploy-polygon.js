/**
 * Deploy TrustScoreOracle V2 + ReputationGateV2 to Polygon.
 * Manually sets gas to handle Polygon's high base fee.
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying to Polygon");
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "POL");

  // Get current gas price from network
  const feeData = await ethers.provider.getFeeData();
  console.log("Network gasPrice:", feeData.gasPrice?.toString());
  console.log("Network maxFeePerGas:", feeData.maxFeePerGas?.toString());

  // Use legacy tx with explicit gasPrice to avoid EIP-1559 estimation issues
  const gasPrice = feeData.gasPrice
    ? (feeData.gasPrice * 12n) / 10n  // 1.2x current gas price
    : ethers.parseUnits("150", "gwei");

  console.log("Using gasPrice:", gasPrice.toString());

  const QUERY_FEE = ethers.parseEther("0.001");

  // Override: set gasLimit explicitly to skip estimateGas (Polygon EIP-1559 issue)
  const oracleOverrides = { gasPrice, gasLimit: 2_500_000 };
  const gateOverrides = { gasPrice, gasLimit: 1_500_000 };

  // 1. Deploy TrustScoreOracle
  console.log("\n--- Deploying TrustScoreOracle V2 ---");
  const TrustScoreOracle = await ethers.getContractFactory("TrustScoreOracle");
  const oracle = await TrustScoreOracle.deploy(deployer.address, QUERY_FEE, oracleOverrides);
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("TrustScoreOracle deployed to:", oracleAddr);

  // 2. Deploy ReputationGateV2
  console.log("\n--- Deploying ReputationGateV2 ---");
  const MIN_SCORE = 3000;
  const MIN_TIER = 1;
  const MAX_SCORE_AGE = 0;
  const ReputationGateV2 = await ethers.getContractFactory("ReputationGateV2");
  const gate = await ReputationGateV2.deploy(oracleAddr, MIN_SCORE, MIN_TIER, MAX_SCORE_AGE, gateOverrides);
  await gate.waitForDeployment();
  const gateAddr = await gate.getAddress();
  console.log("ReputationGateV2 deployed to:", gateAddr);

  // Save deployment info
  const info = {
    network: "polygon",
    chainId: 137,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    TrustScoreOracle: oracleAddr,
    ReputationGateV2: gateAddr,
    version: "v2-multi-oracle",
    queryFee: "0.001",
    gateConfig: { minScore: MIN_SCORE, minTier: MIN_TIER, maxScoreAge: MAX_SCORE_AGE },
  };

  const outputDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "polygon.json");
  fs.writeFileSync(outputPath, JSON.stringify(info, null, 2));
  console.log(`\nSaved to ${outputPath}`);

  const remaining = await ethers.provider.getBalance(deployer.address);
  console.log("Remaining balance:", ethers.formatEther(remaining), "POL");

  console.log("\nSet on Railway:");
  console.log(`  POLYGON_ORACLE_ADDRESS=${oracleAddr}`);

  // Verify
  console.log("\nWaiting 30s for block explorer indexing...");
  await new Promise((r) => setTimeout(r, 30000));

  for (const [name, addr, args] of [
    ["TrustScoreOracle", oracleAddr, [deployer.address, QUERY_FEE]],
    ["ReputationGateV2", gateAddr, [oracleAddr, MIN_SCORE, MIN_TIER, MAX_SCORE_AGE]],
  ]) {
    try {
      await hre.run("verify:verify", { address: addr, constructorArguments: args });
      console.log(`${name} verified!`);
    } catch (e) {
      if (e.message.includes("Already Verified")) console.log(`${name} already verified`);
      else console.log(`${name} verification failed:`, e.message.slice(0, 100));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
