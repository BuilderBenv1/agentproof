/**
 * Deploy TrustScoreOracle V2 (Multi-Oracle) to any chain.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-oracle-v2.js --network avalanche
 *   npx hardhat run scripts/deploy-oracle-v2.js --network base
 *
 * Env vars:
 *   AGENT402_ORACLE_ADDRESS — (optional) Address of Oracle Operator #2 to register
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying TrustScoreOracle V2 (Multi-Oracle) on", network.name);
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance));

  const QUERY_FEE = ethers.parseEther("0.001");

  // Deploy V2 — constructor registers deployer as initial oracle (Operator #1)
  const TrustScoreOracle = await ethers.getContractFactory("TrustScoreOracle");
  const oracle = await TrustScoreOracle.deploy(deployer.address, QUERY_FEE);
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();

  console.log("\nTrustScoreOracle V2 deployed to:", oracleAddr);
  console.log("Query fee: 0.001 native token");
  console.log("Oracle Operator #1 (AgentProof):", deployer.address);

  // Register Agent402 as Operator #2 if address provided
  const agent402Address = process.env.AGENT402_ORACLE_ADDRESS;
  if (agent402Address) {
    console.log("\nRegistering Oracle Operator #2 (Agent402):", agent402Address);
    const tx = await oracle.addOracle(agent402Address, "Agent402");
    await tx.wait();
    console.log("Operator #2 registered successfully");
  } else {
    console.log(
      "\nNo AGENT402_ORACLE_ADDRESS set — skipping Operator #2 registration."
    );
    console.log(
      "Register later with: oracle.addOracle(address, 'Agent402')"
    );
  }

  // Verify oracle count
  const count = await oracle.oracleCount();
  console.log("Total authorized oracles:", count.toString());

  // Save deployment info
  const info = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    TrustScoreOracle: oracleAddr,
    version: "v2-multi-oracle",
    queryFee: "0.001",
    oracles: {
      operator1_agentproof: deployer.address,
      operator2_agent402: agent402Address || "not-registered",
    },
  };

  const outputDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `oracle-v2-${network.name}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(info, null, 2));
  console.log(`\nSaved to ${outputPath}`);

  // Print env vars to set
  const envVarMap = {
    avalanche: "AVAX_ORACLE_ADDRESS",
    base: "BASE_ORACLE_ADDRESS",
    ethereum: "ETHEREUM_ORACLE_ADDRESS",
    linea: "LINEA_ORACLE_ADDRESS",
  };
  const envVar = envVarMap[network.name] || "TRUST_SCORE_ORACLE_ADDRESS";
  console.log(`\nSet these env vars on both oracle servers:`);
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
