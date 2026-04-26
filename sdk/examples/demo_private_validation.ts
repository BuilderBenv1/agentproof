/**
 * Demo — Sealed-ballot validation on SKALE Base Sepolia.
 *
 * Walks the full lifecycle of AgentProof's PrivateValidationRegistry:
 *   1. Requester opens a validation round (quorum 3, 5-min window)
 *   2. Three validators encrypt + submit their `isValid` votes off-chain
 *      via BITE threshold encryption
 *   3. Once quorum is hit, a reveal is triggered — SKALE's validator
 *      committee threshold-decrypts the ballots and fires the contract's
 *      onDecrypt hook, which tallies and emits aggregate-only consensus
 *
 * Nothing this demo prints reveals individual validator choices — that's
 * the whole point. You see participation, then you see the aggregate.
 *
 * Run:
 *   cd sdk
 *   npx ts-node examples/demo_private_validation.ts
 *
 * Requires .env with:
 *   VALIDATOR_A_KEY, VALIDATOR_B_KEY, VALIDATOR_C_KEY  (any funded Sepolia wallets)
 *   REQUESTER_KEY                                       (opens the round + triggers reveal)
 *   PRIVATE_VALIDATION_ADDRESS                          (defaults to deployed address below)
 */

import { ethers } from "ethers";
import {
  requestValidation,
  submitVote,
  triggerReveal,
  getValidationStatus,
  waitForState,
  ValidationState,
  type PrivateValidationConfig,
} from "../src/privateValidation";

const SEPOLIA_RPC = "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha";
const CONTRACT_ADDRESS =
  process.env.PRIVATE_VALIDATION_ADDRESS ||
  "0xe4eBEf67D698C1b45A2aaacB9ce7c4B0B4E53682"; // live Sepolia deployment

const EXPLORER = "https://base-sepolia.explorer.skalenodes.com";

function stateLabel(s: ValidationState): string {
  return ["Open", "Revealing", "Resolved"][s] ?? `unknown(${s})`;
}

async function main() {
  const requesterKey = process.env.REQUESTER_KEY;
  const keys = [
    process.env.VALIDATOR_A_KEY,
    process.env.VALIDATOR_B_KEY,
    process.env.VALIDATOR_C_KEY,
  ];
  if (!requesterKey || keys.some((k) => !k)) {
    console.error(
      "Set REQUESTER_KEY, VALIDATOR_A_KEY, VALIDATOR_B_KEY, VALIDATOR_C_KEY in .env\n" +
        "(Any four SKALE Base Sepolia wallets with a little CREDITS each.)",
    );
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const requester = new ethers.Wallet(requesterKey, provider);
  const validators = keys.map((k) => new ethers.Wallet(k!, provider));

  const cfg: PrivateValidationConfig = {
    contractAddress: CONTRACT_ADDRESS,
    rpcUrl: SEPOLIA_RPC,
  };

  console.log("════════════════════════════════════════════════════════════════");
  console.log("  AgentProof — Sealed-Ballot Validation on SKALE BITE");
  console.log("════════════════════════════════════════════════════════════════");
  console.log(`  Contract:  ${CONTRACT_ADDRESS}`);
  console.log(`  Explorer:  ${EXPLORER}/address/${CONTRACT_ADDRESS}`);
  console.log(`  Requester: ${requester.address}`);
  validators.forEach((v, i) =>
    console.log(`  Validator ${String.fromCharCode(65 + i)}: ${v.address}`),
  );
  console.log();

  // ── Step 1: Open a private validation round ─────────────────────
  console.log("[1/4] Opening validation round (agent=42, quorum=3, window=300s)...");
  const { tx: reqTx, validationId } = await requestValidation(
    requester,
    {
      agentId: 42,
      taskHash: ethers.id("demo-task-" + Date.now()),
      taskURI: "ipfs://demo-task-description",
      quorum: 3,
      votingPeriodSeconds: 300,
    },
    cfg,
  );
  console.log(`       tx:            ${reqTx.hash}`);
  console.log(`       validationId:  ${validationId}`);

  // ── Step 2: Each validator encrypts + submits their vote ────────
  //
  // Real validator logic would inspect the agent's output and decide.
  // For the demo we hardcode two yes, one no — a 2/3 majority for "valid".
  const votes = [true, true, false];
  console.log(`\n[2/4] Three validators submit encrypted ballots...`);
  for (let i = 0; i < validators.length; i++) {
    const label = String.fromCharCode(65 + i);
    const tx = await submitVote(validators[i], validationId, votes[i], cfg);
    const receipt = await tx.wait();
    console.log(
      `       Validator ${label} → encrypted ballot submitted (tx ${tx.hash.slice(0, 10)}..., block ${receipt?.blockNumber})`,
    );
  }

  let status = await getValidationStatus(provider, validationId, cfg);
  console.log(
    `\n       Round status: state=${stateLabel(status.state)} votesReceived=${status.votesReceived}/${status.quorum}`,
  );
  console.log(
    "       Note: chain storage holds only ciphertexts — no individual vote has been revealed.",
  );

  // ── Step 3: Trigger threshold decryption ────────────────────────
  console.log(`\n[3/4] Triggering reveal (pays 0.06 CREDITS CTX fee)...`);
  const revealTx = await triggerReveal(requester, validationId, cfg);
  await revealTx.wait();
  console.log(`       tx: ${revealTx.hash}`);
  console.log(
    "       BITE committee is threshold-decrypting the ballots and will call onDecrypt...",
  );

  // ── Step 4: Poll for the async decrypt callback ─────────────────
  console.log(`\n[4/4] Waiting for consensus (CTX callback can take ~5-30s)...`);
  status = await waitForState(provider, validationId, cfg, {
    target: ValidationState.Resolved,
    pollMs: 3000,
    timeoutMs: 180_000,
  });

  console.log();
  console.log("────────────────────────────────────────────────────────────────");
  console.log(`  Consensus reached for validationId ${validationId}`);
  console.log("────────────────────────────────────────────────────────────────");
  console.log(`  Result:       ${status.consensusValid ? "VALID" : "INVALID"}`);
  console.log(`  Yes votes:    ${status.yesVotes}`);
  console.log(`  Total votes:  ${status.votesReceived}`);
  console.log(`  State:        ${stateLabel(status.state)}`);
  console.log();
  console.log("  Only the aggregate was emitted — no per-validator choice exists");
  console.log("  anywhere in storage or events. That is the privacy guarantee.");
  console.log();
  console.log(`  Full tx trail: ${EXPLORER}/address/${CONTRACT_ADDRESS}`);
}

main().catch((e) => {
  console.error("\nDemo failed:", e);
  process.exit(1);
});
