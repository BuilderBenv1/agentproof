/**
 * Deploy AgentProofHook (ERC-8183 Reputation-Gated Jobs) to any chain.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-hook.js --network avalanche
 *   npx hardhat run scripts/deploy-hook.js --network base
 *
 * Env vars:
 *   TRUST_SCORE_ORACLE_ADDRESS — Address of deployed TrustScoreOracle
 *   IDENTITY_REGISTRY_ADDRESS — Address of deployed ERC-8004 IdentityRegistry
 *   MIN_SCORE     — Minimum trust score (0-10000, default 3000 = 30.00)
 *   MIN_TIER      — Minimum tier (0-5, default 1 = bronze)
 *   MAX_SCORE_AGE — Max score age in seconds (0 = no expiry, default 3600 = 1 hour)
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AgentProofHook on", network.name);
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance));

  // Read required addresses from env
  const oracleAddress = process.env.TRUST_SCORE_ORACLE_ADDRESS;
  const registryAddress = process.env.IDENTITY_REGISTRY_ADDRESS;

  if (!oracleAddress || !registryAddress) {
    console.error("\nError: Set TRUST_SCORE_ORACLE_ADDRESS and IDENTITY_REGISTRY_ADDRESS env vars");
    console.error("  TRUST_SCORE_ORACLE_ADDRESS — deployed TrustScoreOracle contract");
    console.error("  IDENTITY_REGISTRY_ADDRESS — deployed ERC-8004 IdentityRegistry");
    process.exit(1);
  }

  const minScore = parseInt(process.env.MIN_SCORE || "3000", 10);
  const minTier = parseInt(process.env.MIN_TIER || "1", 10);
  const maxScoreAge = parseInt(process.env.MAX_SCORE_AGE || "3600", 10);

  console.log("\nConfiguration:");
  console.log("  Oracle:", oracleAddress);
  console.log("  IdentityRegistry:", registryAddress);
  console.log("  Min Score:", minScore, `(${(minScore / 100).toFixed(2)})`);
  console.log("  Min Tier:", minTier, ["unranked", "bronze", "silver", "gold", "platinum", "diamond"][minTier]);
  console.log("  Max Score Age:", maxScoreAge, maxScoreAge === 0 ? "(no expiry)" : `(${maxScoreAge}s)`);

  // Deploy AgentProofHook
  const Hook = await ethers.getContractFactory("AgentProofHook");
  const hook = await Hook.deploy(oracleAddress, registryAddress, minScore, minTier, maxScoreAge);
  await hook.waitForDeployment();
  const hookAddr = await hook.getAddress();

  console.log("\nAgentProofHook deployed to:", hookAddr);

  // Deploy AddressResolver (address → agentId bridge)
  const Resolver = await ethers.getContractFactory("AddressResolver");
  const resolver = await Resolver.deploy(oracleAddress, registryAddress);
  await resolver.waitForDeployment();
  const resolverAddr = await resolver.getAddress();

  console.log("AddressResolver deployed to:", resolverAddr);

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentInfo = {
    contract: "AgentProofHook",
    address: hookAddr,
    addressResolver: resolverAddr,
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    oracle: oracleAddress,
    identityRegistry: registryAddress,
    minScore,
    minTier,
    maxScoreAge,
    deployedAt: new Date().toISOString(),
    txHash: hook.deploymentTransaction()?.hash,
  };

  const filename = `hook-${network.name}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment info saved to deployments/${filename}`);

  // Verification commands
  console.log("\nVerify with:");
  console.log(`  npx hardhat verify --network ${network.name} ${hookAddr} ${oracleAddress} ${registryAddress} ${minScore} ${minTier} ${maxScoreAge}`);
  console.log(`  npx hardhat verify --network ${network.name} ${resolverAddr} ${oracleAddress} ${registryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
