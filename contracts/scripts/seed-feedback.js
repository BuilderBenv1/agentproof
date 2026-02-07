/**
 * seed-feedback.js — Submits feedback and validations using deployer + fresh reviewer wallets.
 * Uses staticCall pre-checks and sequential execution to avoid nonce issues.
 *
 * Run: npx hardhat run scripts/seed-feedback.js --network fuji
 */
const { ethers } = require("hardhat");

function encodeURI(metadata) {
  const json = JSON.stringify(metadata);
  return `data:application/json;base64,${Buffer.from(json).toString("base64")}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeSendFeedback(reputation, signer, agentId, rating, feedbackURI, taskHash, label) {
  const repSigned = reputation.connect(signer);
  try {
    // Pre-check with staticCall
    await repSigned.submitFeedback.staticCall(agentId, rating, feedbackURI, taskHash);
  } catch (e) {
    console.log(`  SKIP ${label}: staticCall failed — ${e.reason || e.shortMessage || "unknown"}`);
    return false;
  }

  try {
    const tx = await repSigned.submitFeedback(agentId, rating, feedbackURI, taskHash);
    await tx.wait();
    console.log(`  OK ${label}: rating=${rating}`);
    return true;
  } catch (e) {
    console.log(`  FAIL ${label}: tx failed — ${e.reason || e.shortMessage || "unknown"}`);
    return false;
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "AVAX\n");

  const reputation = await ethers.getContractAt("ReputationRegistry", process.env.REPUTATION_REGISTRY_ADDRESS);
  const validation = await ethers.getContractAt("ValidationRegistry", process.env.VALIDATION_REGISTRY_ADDRESS);
  const identity = await ethers.getContractAt("IdentityRegistry", process.env.IDENTITY_REGISTRY_ADDRESS);

  const totalAgents = Number(await identity.totalAgents());
  console.log("Total agents:", totalAgents);

  const AGENTS = [
    "AlphaYield", "SentinelBot", "NovaPay", "DataForge", "QuestMaster",
    "VaultGuard", "RealEstateAI", "SwiftSettle", "ChainScout", "PixelForge"
  ];

  // Create 5 independent reviewer wallets and fund them
  console.log("\n=== Creating reviewer wallets ===\n");
  const reviewers = [];
  for (let i = 0; i < 6; i++) {
    const w = ethers.Wallet.createRandom().connect(ethers.provider);
    reviewers.push(w);
    const tx = await deployer.sendTransaction({ to: w.address, value: ethers.parseEther("0.15") });
    await tx.wait();
    console.log(`Reviewer ${i}: ${w.address}`);
    await sleep(500);
  }

  // ──────────────────────────────────────────────────────
  // FEEDBACK — each reviewer rates agents sequentially
  // ──────────────────────────────────────────────────────
  console.log("\n=== Submitting feedback (deployer first, then reviewers) ===\n");

  // Rating plan: agentId → [{reviewerIdx, rating, task}]
  const ratingPlan = {
    1: [ // AlphaYield — high performer
      { r: 0, rating: 92, task: "yield-001" },
      { r: 1, rating: 88, task: "yield-002" },
      { r: 2, rating: 95, task: "yield-003" },
      { r: 3, rating: 78, task: "yield-004" },
      { r: 4, rating: 85, task: "yield-005" },
      { r: 5, rating: 90, task: "yield-006" },
    ],
    2: [ // SentinelBot — top tier
      { r: 0, rating: 96, task: "sentinel-001" },
      { r: 1, rating: 91, task: "sentinel-002" },
      { r: 2, rating: 94, task: "sentinel-003" },
      { r: 3, rating: 89, task: "sentinel-004" },
      { r: 4, rating: 93, task: "sentinel-005" },
    ],
    3: [ // NovaPay — mid
      { r: 0, rating: 72, task: "novapay-001" },
      { r: 1, rating: 68, task: "novapay-002" },
      { r: 2, rating: 75, task: "novapay-003" },
      { r: 3, rating: 70, task: "novapay-004" },
    ],
    4: [ // DataForge — solid
      { r: 0, rating: 83, task: "forge-001" },
      { r: 1, rating: 80, task: "forge-002" },
      { r: 2, rating: 86, task: "forge-003" },
      { r: 3, rating: 79, task: "forge-004" },
      { r: 4, rating: 82, task: "forge-005" },
      { r: 5, rating: 81, task: "forge-006" },
    ],
    5: [ // QuestMaster — good
      { r: 0, rating: 90, task: "quest-001" },
      { r: 1, rating: 88, task: "quest-002" },
      { r: 2, rating: 85, task: "quest-003" },
    ],
    6: [ // VaultGuard — below avg
      { r: 0, rating: 62, task: "vault-001" },
      { r: 1, rating: 58, task: "vault-002" },
      { r: 2, rating: 65, task: "vault-003" },
      { r: 3, rating: 60, task: "vault-004" },
      { r: 4, rating: 55, task: "vault-005" },
    ],
    7: [ // RealEstateAI — poor
      { r: 0, rating: 45, task: "rwa-001" },
      { r: 1, rating: 50, task: "rwa-002" },
      { r: 2, rating: 42, task: "rwa-003" },
    ],
    8: [ // SwiftSettle — top performer
      { r: 0, rating: 97, task: "swift-001" },
      { r: 1, rating: 95, task: "swift-002" },
      { r: 2, rating: 93, task: "swift-003" },
      { r: 3, rating: 96, task: "swift-004" },
      { r: 4, rating: 94, task: "swift-005" },
      { r: 5, rating: 98, task: "swift-006" },
    ],
    9: [ // ChainScout — ok
      { r: 0, rating: 77, task: "scout-001" },
      { r: 1, rating: 74, task: "scout-002" },
      { r: 2, rating: 80, task: "scout-003" },
      { r: 3, rating: 76, task: "scout-004" },
    ],
    10: [ // PixelForge — good
      { r: 0, rating: 84, task: "pixel-001" },
      { r: 1, rating: 82, task: "pixel-002" },
      { r: 2, rating: 87, task: "pixel-003" },
      { r: 3, rating: 80, task: "pixel-004" },
      { r: 4, rating: 83, task: "pixel-005" },
    ],
  };

  let feedbackCount = 0;
  for (const [agentIdStr, ratings] of Object.entries(ratingPlan)) {
    const agentId = parseInt(agentIdStr);
    console.log(`\nAgent #${agentId} (${AGENTS[agentId - 1]}):`);

    for (const { r, rating, task } of ratings) {
      const reviewer = reviewers[r];
      const taskHash = ethers.keccak256(ethers.toUtf8Bytes(task));
      const feedbackURI = `https://agentproof.io/feedback/${task}`;
      const label = `R${r}→A${agentId}`;

      const ok = await safeSendFeedback(reputation, reviewer, agentId, rating, feedbackURI, taskHash, label);
      if (ok) feedbackCount++;

      await sleep(2000); // Give the RPC node time between txs
    }
  }

  console.log(`\n\nTotal feedback submitted: ${feedbackCount}`);

  // ──────────────────────────────────────────────────────
  // VALIDATIONS
  // ──────────────────────────────────────────────────────
  console.log("\n=== Submitting validations ===\n");

  const VALIDATION_PLAN = [
    [0, 1, "yield-val-1", 1, true],
    [1, 1, "yield-val-2", 2, true],
    [0, 2, "sentinel-val-1", 1, true],
    [1, 2, "sentinel-val-2", 2, true],
    [0, 3, "novapay-val-1", 1, false],
    [0, 4, "forge-val-1", 1, true],
    [1, 5, "quest-val-1", 0, true],
    [0, 6, "vault-val-1", 2, false],
    [1, 7, "rwa-val-1", 0, false],
    [0, 8, "swift-val-1", 1, true],
    [2, 8, "swift-val-2", 3, true],
    [0, 9, "scout-val-1", 1, true],
    [1, 10, "pixel-val-1", 0, true],
    [2, 10, "pixel-val-2", 3, true],
  ];

  let valCount = 0;
  for (const [reqIdx, agentId, taskDesc, valIdx, isValid] of VALIDATION_PLAN) {
    const requester = reviewers[reqIdx];
    const validator = reviewers[valIdx];
    const taskHash = ethers.keccak256(ethers.toUtf8Bytes(taskDesc));
    const taskURI = `https://agentproof.io/tasks/${taskDesc}`;

    try {
      const valReq = validation.connect(requester);
      // staticCall check
      await valReq.requestValidation.staticCall(agentId, taskHash, taskURI);
      const reqTx = await valReq.requestValidation(agentId, taskHash, taskURI);
      const receipt = await reqTx.wait();

      const ev = receipt.logs.find((l) => {
        try { return validation.interface.parseLog(l)?.name === "ValidationRequested"; }
        catch { return false; }
      });
      const vid = validation.interface.parseLog(ev).args[0];

      await sleep(2000);

      // Submit response
      const valResp = validation.connect(validator);
      await valResp.submitValidation.staticCall(vid, isValid, `https://agentproof.io/proof/${taskDesc}`);
      const resTx = await valResp.submitValidation(vid, isValid, `https://agentproof.io/proof/${taskDesc}`);
      await resTx.wait();

      valCount++;
      console.log(`Val #${vid}: Agent #${agentId} (${AGENTS[agentId - 1]}) → ${isValid ? "VALID" : "INVALID"}`);
    } catch (e) {
      console.log(`Val FAIL [A${agentId}]: ${e.reason || e.shortMessage || e.message?.slice(0, 100)}`);
    }

    await sleep(2000);
  }

  console.log(`\nTotal validations: ${valCount}`);

  // ──────────────────────────────────────────────────────
  // Final stats
  // ──────────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("         SEED RESULTS");
  console.log("========================================");
  for (let i = 1; i <= totalAgents; i++) {
    const avg = await reputation.getAverageRating(i);
    const count = await reputation.getFeedbackCount(i);
    console.log(`Agent #${i} (${AGENTS[i - 1]}): avg=${avg}, feedback=${count}`);
  }
  console.log(`\nFeedback: ${feedbackCount}, Validations: ${valCount}`);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "AVAX");
}

main().then(() => process.exit(0)).catch(console.error);
