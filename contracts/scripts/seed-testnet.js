/**
 * seed-testnet.js — Registers 10 agents on Fuji, submits varied feedback
 * and creates validation requests/responses so the app looks alive.
 *
 * Run: npx hardhat run scripts/seed-testnet.js --network fuji
 */
const { ethers } = require("hardhat");

// ──────────────────────────────────────────────────────
// Agent metadata templates
// ──────────────────────────────────────────────────────
const AGENTS = [
  { name: "AlphaYield", description: "Automated DeFi yield optimiser across Avalanche DEXs. Rebalances every 15 min.", category: "defi" },
  { name: "SentinelBot", description: "Real-time smart-contract exploit monitor. Alerts within 2 blocks of suspicious activity.", category: "defi" },
  { name: "NovaPay", description: "Cross-chain payment settlement agent supporting AVAX, USDC, and BTC.b.", category: "payments" },
  { name: "DataForge", description: "On-chain analytics indexer that aggregates Avalanche C-Chain metrics into dashboards.", category: "data" },
  { name: "QuestMaster", description: "In-game quest orchestrator for Web3 RPGs. Manages loot drops and NPC interactions.", category: "gaming" },
  { name: "VaultGuard", description: "Multi-sig treasury manager with automated payroll and budget tracking.", category: "defi" },
  { name: "RealEstateAI", description: "Tokenised real-world asset valuation agent. Performs appraisals on-chain.", category: "rwa" },
  { name: "SwiftSettle", description: "Instant AVAX-to-fiat off-ramp agent for merchants. Sub-second settlement.", category: "payments" },
  { name: "ChainScout", description: "Multi-chain data aggregator. Pulls TVL, volume, and whale movements across 12 networks.", category: "data" },
  { name: "PixelForge", description: "Procedural NFT generation agent for gaming studios. Produces 10k collections in hours.", category: "gaming" },
];

// Feedback templates (reviewer → agent)
// We'll have wallets cross-rate each other's agents
const FEEDBACK_SETS = [
  // [reviewerIdx, agentIdx, rating, taskDesc]
  [1, 0, 92, "yield-rebalance-task-001"],
  [2, 0, 88, "yield-rebalance-task-002"],
  [3, 0, 95, "yield-rebalance-task-003"],
  [4, 0, 78, "yield-rebalance-task-004"],
  [5, 0, 85, "yield-rebalance-task-005"],
  [6, 0, 90, "yield-rebalance-task-006"],
  [7, 0, 87, "yield-rebalance-task-007"],

  [0, 1, 96, "exploit-monitor-task-001"],
  [2, 1, 91, "exploit-monitor-task-002"],
  [3, 1, 94, "exploit-monitor-task-003"],
  [4, 1, 89, "exploit-monitor-task-004"],
  [5, 1, 93, "exploit-monitor-task-005"],

  [0, 2, 72, "payment-settle-task-001"],
  [1, 2, 68, "payment-settle-task-002"],
  [3, 2, 75, "payment-settle-task-003"],
  [4, 2, 70, "payment-settle-task-004"],

  [0, 3, 83, "data-index-task-001"],
  [1, 3, 80, "data-index-task-002"],
  [2, 3, 86, "data-index-task-003"],
  [5, 3, 79, "data-index-task-004"],
  [6, 3, 82, "data-index-task-005"],
  [7, 3, 81, "data-index-task-006"],

  [0, 4, 90, "quest-run-task-001"],
  [1, 4, 88, "quest-run-task-002"],
  [2, 4, 85, "quest-run-task-003"],

  [0, 5, 62, "vault-manage-task-001"],
  [1, 5, 58, "vault-manage-task-002"],
  [3, 5, 65, "vault-manage-task-003"],
  [4, 5, 60, "vault-manage-task-004"],
  [7, 5, 55, "vault-manage-task-005"],

  [0, 6, 45, "rwa-appraisal-task-001"],
  [1, 6, 50, "rwa-appraisal-task-002"],
  [2, 6, 42, "rwa-appraisal-task-003"],

  [0, 7, 97, "swift-settle-task-001"],
  [1, 7, 95, "swift-settle-task-002"],
  [2, 7, 93, "swift-settle-task-003"],
  [3, 7, 96, "swift-settle-task-004"],
  [4, 7, 94, "swift-settle-task-005"],
  [5, 7, 98, "swift-settle-task-006"],
  [6, 7, 91, "swift-settle-task-007"],
  [8, 7, 92, "swift-settle-task-008"],

  [0, 8, 77, "chain-scout-task-001"],
  [1, 8, 74, "chain-scout-task-002"],
  [2, 8, 80, "chain-scout-task-003"],
  [3, 8, 76, "chain-scout-task-004"],

  [0, 9, 84, "pixel-forge-task-001"],
  [1, 9, 82, "pixel-forge-task-002"],
  [3, 9, 87, "pixel-forge-task-003"],
  [4, 9, 80, "pixel-forge-task-004"],
  [5, 9, 83, "pixel-forge-task-005"],
];

// Validation requests (requesterIdx, agentIdx, taskDesc, validatorIdx, isValid)
const VALIDATIONS = [
  [1, 0, "yield-rebalance-validate-001", 2, true],
  [2, 0, "yield-rebalance-validate-002", 3, true],
  [0, 1, "exploit-detect-validate-001", 3, true],
  [0, 1, "exploit-detect-validate-002", 4, true],
  [1, 2, "payment-validate-001", 0, false],
  [0, 3, "data-index-validate-001", 1, true],
  [1, 4, "quest-validate-001", 0, true],
  [0, 5, "vault-validate-001", 2, false],
  [1, 6, "rwa-validate-001", 0, false],
  [0, 7, "swift-validate-001", 1, true],
  [2, 7, "swift-validate-002", 3, true],
  [0, 8, "scout-validate-001", 1, true],
  [1, 9, "pixel-validate-001", 0, true],
  [2, 9, "pixel-validate-002", 3, true],
];

function encodeURI(metadata) {
  const json = JSON.stringify(metadata);
  const base64 = Buffer.from(json).toString("base64");
  return `data:application/json;base64,${base64}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "AVAX\n");

  // Load contract addresses from env
  const IDENTITY = process.env.IDENTITY_REGISTRY_ADDRESS;
  const REPUTATION = process.env.REPUTATION_REGISTRY_ADDRESS;
  const VALIDATION = process.env.VALIDATION_REGISTRY_ADDRESS;
  const CORE = process.env.AGENTPROOF_CORE_ADDRESS;

  console.log("Identity:", IDENTITY);
  console.log("Reputation:", REPUTATION);
  console.log("Validation:", VALIDATION);
  console.log("Core:", CORE, "\n");

  // Get contract instances
  const identity = await ethers.getContractAt("IdentityRegistry", IDENTITY);
  const reputation = await ethers.getContractAt("ReputationRegistry", REPUTATION);
  const validation = await ethers.getContractAt("ValidationRegistry", VALIDATION);

  // Check how many agents already exist
  const existingCount = await identity.totalAgents();
  console.log("Existing agents:", existingCount.toString());

  if (existingCount >= 10n) {
    console.log("Already have 10+ agents, skipping registration. Proceeding to feedback/validation.");
  }

  // ──────────────────────────────────────────────────────
  // Step 1: Generate 10 wallets and fund them
  // ──────────────────────────────────────────────────────
  console.log("\n=== STEP 1: Generate & fund wallets ===\n");

  const wallets = [];
  for (let i = 0; i < 10; i++) {
    const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
    wallets.push(wallet);
    console.log(`Wallet ${i}: ${wallet.address}`);
  }

  // Fund each wallet: 0.15 AVAX (0.1 bond + gas)
  const fundAmount = ethers.parseEther("0.2");
  for (let i = 0; i < wallets.length; i++) {
    const tx = await deployer.sendTransaction({
      to: wallets[i].address,
      value: fundAmount,
    });
    await tx.wait();
    console.log(`Funded wallet ${i} with 0.2 AVAX (tx: ${tx.hash.slice(0, 10)}...)`);
  }

  console.log("\n=== STEP 2: Register agents ===\n");

  // ──────────────────────────────────────────────────────
  // Step 2: Register agents (skip if already registered)
  // ──────────────────────────────────────────────────────
  const agentIds = [];

  for (let i = 0; i < AGENTS.length; i++) {
    const wallet = wallets[i];
    const alreadyRegistered = await identity.isRegistered(wallet.address);

    if (alreadyRegistered) {
      const agentId = await identity.getAgentIdByOwner(wallet.address);
      agentIds.push(agentId);
      console.log(`Agent ${i} (${AGENTS[i].name}) already registered as #${agentId}`);
      continue;
    }

    const meta = AGENTS[i];
    const uri = encodeURI({
      name: meta.name,
      description: meta.description,
      category: meta.category,
      version: "1.0.0",
      endpoints: [`https://api.agentproof.io/agents/${meta.name.toLowerCase()}`],
    });

    const identityWithSigner = identity.connect(wallet);
    const bond = await identity.registrationBond();

    try {
      const tx = await identityWithSigner.registerAgent(uri, { value: bond, gasLimit: 500000 });
      const receipt = await tx.wait();
      // Parse the AgentRegistered event to get the agentId
      const event = receipt.logs.find((log) => {
        try {
          return identity.interface.parseLog(log)?.name === "AgentRegistered";
        } catch {
          return false;
        }
      });
      const parsedEvent = identity.interface.parseLog(event);
      const agentId = parsedEvent.args[0];
      agentIds.push(agentId);
      console.log(`Registered agent ${i}: ${meta.name} => ID #${agentId} (tx: ${tx.hash.slice(0, 10)}...)`);
    } catch (e) {
      console.error(`Failed to register agent ${i} (${meta.name}):`, e.message?.slice(0, 80));
      agentIds.push(null);
    }

    // Small delay to avoid nonce issues
    await sleep(2000);
  }

  console.log("\nAgent IDs:", agentIds.map((id) => (id ? id.toString() : "FAILED")));

  // ──────────────────────────────────────────────────────
  // Step 3: Submit feedback
  // ──────────────────────────────────────────────────────
  console.log("\n=== STEP 3: Submit feedback ===\n");

  let feedbackCount = 0;
  for (const [reviewerIdx, agentIdx, rating, taskDesc] of FEEDBACK_SETS) {
    const reviewerWallet = wallets[reviewerIdx];
    const agentId = agentIds[agentIdx];

    if (!agentId) {
      console.log(`Skipping feedback: agent ${agentIdx} not registered`);
      continue;
    }

    const reputationWithSigner = reputation.connect(reviewerWallet);
    const taskHash = ethers.keccak256(ethers.toUtf8Bytes(taskDesc));
    const feedbackURI = encodeURI({
      task: taskDesc,
      rating,
      comment: `Verified performance for ${AGENTS[agentIdx].name}. Rating: ${rating}/100.`,
      timestamp: new Date().toISOString(),
    });

    try {
      const tx = await reputationWithSigner.submitFeedback(agentId, rating, feedbackURI, taskHash, { gasLimit: 300000 });
      await tx.wait();
      feedbackCount++;
      console.log(`Feedback #${feedbackCount}: wallet[${reviewerIdx}] → agent #${agentId} (${AGENTS[agentIdx].name}): ${rating}/100`);
    } catch (e) {
      console.error(`Feedback failed [${reviewerIdx}→${agentIdx}]:`, e.message?.slice(0, 80));
    }

    await sleep(1500);
  }

  console.log(`\nSubmitted ${feedbackCount} feedback entries.`);

  // ──────────────────────────────────────────────────────
  // Step 4: Create validation requests & responses
  // ──────────────────────────────────────────────────────
  console.log("\n=== STEP 4: Create validations ===\n");

  let validationCount = 0;
  for (const [requesterIdx, agentIdx, taskDesc, validatorIdx, isValid] of VALIDATIONS) {
    const requesterWallet = wallets[requesterIdx];
    const validatorWallet = wallets[validatorIdx];
    const agentId = agentIds[agentIdx];

    if (!agentId) {
      console.log(`Skipping validation: agent ${agentIdx} not registered`);
      continue;
    }

    const taskHash = ethers.keccak256(ethers.toUtf8Bytes(taskDesc));
    const taskURI = encodeURI({
      task: taskDesc,
      agent: AGENTS[agentIdx].name,
      description: `Validation of ${taskDesc}`,
    });

    // Request
    try {
      const validationWithRequester = validation.connect(requesterWallet);
      const reqTx = await validationWithRequester.requestValidation(agentId, taskHash, taskURI, { gasLimit: 300000 });
      const reqReceipt = await reqTx.wait();

      // Parse validationId from event
      const event = reqReceipt.logs.find((log) => {
        try {
          return validation.interface.parseLog(log)?.name === "ValidationRequested";
        } catch {
          return false;
        }
      });
      const parsedEvent = validation.interface.parseLog(event);
      const validationId = parsedEvent.args[0];

      console.log(`Validation #${validationId}: requested by wallet[${requesterIdx}] for agent #${agentId}`);

      await sleep(1500);

      // Submit response
      const validationWithValidator = validation.connect(validatorWallet);
      const proofURI = encodeURI({
        validationId: validationId.toString(),
        isValid,
        proof: `Validator verified task ${taskDesc}. Result: ${isValid ? "VALID" : "INVALID"}`,
      });

      const resTx = await validationWithValidator.submitValidation(validationId, isValid, proofURI, { gasLimit: 300000 });
      await resTx.wait();
      validationCount++;
      console.log(`  → Validated by wallet[${validatorIdx}]: ${isValid ? "VALID" : "INVALID"}`);
    } catch (e) {
      console.error(`Validation failed [req:${requesterIdx} agent:${agentIdx}]:`, e.message?.slice(0, 100));
    }

    await sleep(1500);
  }

  console.log(`\nCompleted ${validationCount} validations.`);

  // ──────────────────────────────────────────────────────
  // Step 5: Set categories on AgentProofCore
  // ──────────────────────────────────────────────────────
  console.log("\n=== STEP 5: Set agent categories ===\n");

  const core = await ethers.getContractAt("AgentProofCore", CORE);

  for (let i = 0; i < AGENTS.length; i++) {
    const agentId = agentIds[i];
    if (!agentId) continue;

    const wallet = wallets[i];
    const coreWithSigner = core.connect(wallet);

    try {
      const tx = await coreWithSigner.setAgentCategory(agentId, AGENTS[i].category, { gasLimit: 200000 });
      await tx.wait();
      console.log(`Set category for agent #${agentId} (${AGENTS[i].name}): ${AGENTS[i].category}`);
    } catch (e) {
      console.error(`Category set failed for agent #${agentId}:`, e.message?.slice(0, 80));
    }

    await sleep(1000);
  }

  // ──────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("          SEED COMPLETE");
  console.log("========================================");
  console.log(`Agents registered: ${agentIds.filter(Boolean).length}`);
  console.log(`Feedback submitted: ${feedbackCount}`);
  console.log(`Validations completed: ${validationCount}`);

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`\nDeployer balance: ${ethers.formatEther(finalBalance)} AVAX`);
  console.log(`Gas spent: ${ethers.formatEther(balance - finalBalance)} AVAX`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
