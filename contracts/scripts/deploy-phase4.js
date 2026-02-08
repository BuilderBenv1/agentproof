const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Phase 4 contracts with account:", deployer.address);
  console.log("Network:", network.name);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "AVAX");

  // Existing IdentityRegistry address (required by both new contracts)
  const identityAddr = process.env.IDENTITY_REGISTRY_ADDRESS;
  if (!identityAddr) {
    throw new Error("IDENTITY_REGISTRY_ADDRESS not set in .env");
  }
  console.log("Using IdentityRegistry:", identityAddr);

  // 1. Deploy AgentMonitor
  console.log("\n--- Deploying AgentMonitor ---");
  const AgentMonitor = await ethers.getContractFactory("AgentMonitor");
  const agentMonitor = await AgentMonitor.deploy(identityAddr);
  await agentMonitor.waitForDeployment();
  const monitorAddr = await agentMonitor.getAddress();
  console.log("AgentMonitor deployed to:", monitorAddr);

  // 2. Deploy AgentSplits
  console.log("\n--- Deploying AgentSplits ---");
  const AgentSplits = await ethers.getContractFactory("AgentSplits");
  const agentSplits = await AgentSplits.deploy(identityAddr);
  await agentSplits.waitForDeployment();
  const splitsAddr = await agentSplits.getAddress();
  console.log("AgentSplits deployed to:", splitsAddr);

  // Output
  const addresses = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    identityRegistry: identityAddr,
    contracts: {
      AgentMonitor: monitorAddr,
      AgentSplits: splitsAddr,
    },
  };

  console.log("\n--- Phase 4 Deployment Summary ---");
  console.log(JSON.stringify(addresses, null, 2));

  // Save to JSON
  const outputPath = path.join(__dirname, "..", "deployments", `phase4-${network.name}.json`);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
  console.log(`\nAddresses saved to ${outputPath}`);

  // Verify on Snowtrace
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n--- Verifying contracts on Snowtrace ---");
    console.log("Waiting 30s for block explorer indexing...");
    await new Promise((r) => setTimeout(r, 30000));

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

    await verifyContract("AgentMonitor", monitorAddr, [identityAddr]);
    await verifyContract("AgentSplits", splitsAddr, [identityAddr]);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
