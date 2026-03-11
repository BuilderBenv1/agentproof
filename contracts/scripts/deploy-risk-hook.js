/**
 * Deploy RiskAssessedHook (ERC-ACP Risk-Assessed Jobs) to any chain.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-risk-hook.js --network avalanche
 *   npx hardhat run scripts/deploy-risk-hook.js --network base
 *
 * Env vars:
 *   TRUST_SCORE_ORACLE_ADDRESS — Address of deployed TrustScoreOracle
 *   IDENTITY_REGISTRY_ADDRESS — Address of deployed ERC-8004 IdentityRegistry
 *   ACP_ADDRESS               — Address of deployed ERC-ACP AgenticCommerce contract
 *   MAX_SCORE_AGE             — Max score age in seconds (0 = no expiry, default 3600 = 1 hour)
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying RiskAssessedHook on", network.name);
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance));

  // Read required addresses from env
  const oracleAddress = process.env.TRUST_SCORE_ORACLE_ADDRESS;
  const registryAddress = process.env.IDENTITY_REGISTRY_ADDRESS;
  const acpAddress = process.env.ACP_ADDRESS;

  if (!oracleAddress || !registryAddress || !acpAddress) {
    console.error("\nError: Set required env vars:");
    console.error("  TRUST_SCORE_ORACLE_ADDRESS — deployed TrustScoreOracle contract");
    console.error("  IDENTITY_REGISTRY_ADDRESS — deployed ERC-8004 IdentityRegistry");
    console.error("  ACP_ADDRESS               — deployed ERC-ACP AgenticCommerce contract");
    process.exit(1);
  }

  const maxScoreAge = parseInt(process.env.MAX_SCORE_AGE || "3600", 10);

  console.log("\nConfiguration:");
  console.log("  Oracle:", oracleAddress);
  console.log("  IdentityRegistry:", registryAddress);
  console.log("  ACP:", acpAddress);
  console.log("  Max Score Age:", maxScoreAge, maxScoreAge === 0 ? "(no expiry)" : `(${maxScoreAge}s)`);

  // Deploy RiskAssessedHook
  const Hook = await ethers.getContractFactory("RiskAssessedHook");
  const hook = await Hook.deploy(oracleAddress, registryAddress, acpAddress, maxScoreAge);
  await hook.waitForDeployment();
  const hookAddr = await hook.getAddress();

  console.log("\nRiskAssessedHook deployed to:", hookAddr);

  // Log default collateral tiers
  console.log("\nDefault collateral tiers:");
  const tiers = ["Unranked", "Bronze", "Silver", "Gold", "Platinum", "Diamond"];
  for (let i = 0; i <= 5; i++) {
    const bps = await hook.collateralBps(i);
    const maxExp = await hook.maxExposure(i);
    console.log(`  ${tiers[i]} (${i}): ${Number(bps) / 100}% collateral, ${ethers.formatEther(maxExp)} ETH max exposure`);
  }

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentInfo = {
    contract: "RiskAssessedHook",
    address: hookAddr,
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    oracle: oracleAddress,
    identityRegistry: registryAddress,
    acp: acpAddress,
    maxScoreAge,
    slashRecipient: deployer.address,
    deployedAt: new Date().toISOString(),
    txHash: hook.deploymentTransaction()?.hash,
  };

  const filename = `risk-hook-${network.name}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\nDeployment info saved to deployments/${filename}`);

  // Verification command
  console.log("\nVerify with:");
  console.log(`  npx hardhat verify --network ${network.name} ${hookAddr} ${oracleAddress} ${registryAddress} ${acpAddress} ${maxScoreAge}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
