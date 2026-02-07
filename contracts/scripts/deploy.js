const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Network:", network.name);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "AVAX");

  // 1. Deploy IdentityRegistry
  console.log("\n--- Deploying IdentityRegistry ---");
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityAddr = await identityRegistry.getAddress();
  console.log("IdentityRegistry deployed to:", identityAddr);

  // 2. Deploy ReputationRegistry
  console.log("\n--- Deploying ReputationRegistry ---");
  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy(identityAddr);
  await reputationRegistry.waitForDeployment();
  const reputationAddr = await reputationRegistry.getAddress();
  console.log("ReputationRegistry deployed to:", reputationAddr);

  // 3. Deploy ValidationRegistry
  console.log("\n--- Deploying ValidationRegistry ---");
  const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
  const validationRegistry = await ValidationRegistry.deploy(identityAddr);
  await validationRegistry.waitForDeployment();
  const validationAddr = await validationRegistry.getAddress();
  console.log("ValidationRegistry deployed to:", validationAddr);

  // 4. Deploy AgentProofCore
  console.log("\n--- Deploying AgentProofCore ---");
  const AgentProofCore = await ethers.getContractFactory("AgentProofCore");
  const agentProofCore = await AgentProofCore.deploy(identityAddr, reputationAddr, validationAddr);
  await agentProofCore.waitForDeployment();
  const coreAddr = await agentProofCore.getAddress();
  console.log("AgentProofCore deployed to:", coreAddr);

  // Output deployed addresses
  const addresses = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      IdentityRegistry: identityAddr,
      ReputationRegistry: reputationAddr,
      ValidationRegistry: validationAddr,
      AgentProofCore: coreAddr,
    },
  };

  console.log("\n--- Deployment Summary ---");
  console.log(JSON.stringify(addresses, null, 2));

  // Save to JSON file
  const outputPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
  console.log(`\nAddresses saved to ${outputPath}`);

  // Verify contracts on Snowtrace (skip for hardhat network)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n--- Verifying contracts on Snowtrace ---");

    const verifyContract = async (name, address, args = []) => {
      try {
        await hre.run("verify:verify", { address, constructorArguments: args });
        console.log(`${name} verified successfully`);
      } catch (e) {
        if (e.message.includes("Already Verified")) {
          console.log(`${name} already verified`);
        } else {
          console.log(`${name} verification failed:`, e.message);
        }
      }
    };

    // Wait a bit for block explorers to index
    console.log("Waiting 30s for block explorer indexing...");
    await new Promise((r) => setTimeout(r, 30000));

    await verifyContract("IdentityRegistry", identityAddr, []);
    await verifyContract("ReputationRegistry", reputationAddr, [identityAddr]);
    await verifyContract("ValidationRegistry", validationAddr, [identityAddr]);
    await verifyContract("AgentProofCore", coreAddr, [identityAddr, reputationAddr, validationAddr]);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
