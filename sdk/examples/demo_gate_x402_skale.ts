/**
 * Thursday demo — reputation-gated x402 on SKALE.
 *
 * Narrative (2 min):
 *   1. Agent about to pay counterparty — calls AgentProof.gateX402()
 *   2. SDK reads TrustScoreOracle on SKALE (gasless, direct RPC)
 *   3. Platinum counterparty → allowed → payment proceeds
 *   4. Unranked counterparty → blocked → payment refused
 *   5. Show SKALE explorer: same contract, recent batch writes, tx history
 *
 * Run:
 *   cd sdk
 *   npx ts-node examples/demo_gate_x402_skale.ts
 */

import { AgentProof } from "../src/AgentProof";

const SKALE_RPC = "https://skale-base.skalenodes.com/v1/base";
const SKALE_CHAIN_ID = 1187947933;
const TRUST_SCORE_ORACLE = "0xe4eBEf67D698C1b45A2aaacB9ce7c4B0B4E53682";
const EXPLORER = "https://skale-base-explorer.skalenodes.com/address";

async function check(
  sdk: AgentProof,
  agentId: number,
  minTier: string,
  label: string,
): Promise<void> {
  console.log(`\n── ${label} (agent #${agentId}, requires ${minTier}) ──`);
  const t0 = Date.now();
  const r = await sdk.gateX402(agentId, minTier);
  const dt = Date.now() - t0;

  const emoji = r.allowed ? "✓ ALLOWED" : "✗ BLOCKED";
  const age =
    r.ageSeconds >= 0
      ? r.ageSeconds < 60
        ? `${r.ageSeconds}s ago`
        : `${Math.round(r.ageSeconds / 60)}m ago`
      : "never";

  console.log(`  ${emoji}  tier=${r.tier}  score=${r.score.toFixed(2)}  updated=${age}  [${dt}ms RPC call]`);
  if (!r.allowed) {
    console.log(`  reason: ${r.reason}`);
  }
}

async function main() {
  const sdk = new AgentProof({
    rpcUrl: SKALE_RPC,
    chainId: SKALE_CHAIN_ID,
  });

  console.log("════════════════════════════════════════════════════════════════");
  console.log("  AgentProof — gateX402 reputation gate, live on SKALE Base");
  console.log("════════════════════════════════════════════════════════════════");
  console.log(`  TrustScoreOracle:  ${TRUST_SCORE_ORACLE}`);
  console.log(`  SKALE explorer:    ${EXPLORER}/${TRUST_SCORE_ORACLE}`);
  console.log(`  Gas model:         gasless — every read + write is free`);

  // Real agents pushed on-chain in the one-shot backfill — all platinum.
  // Pick ones that demo well:
  //   2340  🦞 Clawnch 🦞           score 75.92
  //   1374  Gekko Executor          score 75.46
  //   1199  Gekko Allocator         score 74.64
  await check(sdk, 2340, "platinum", "🦞 Clawnch — top-scored agent");
  await check(sdk, 1374, "gold",     "Gekko Executor — requires only gold");
  await check(sdk, 2340, "diamond",  "🦞 Clawnch — requires diamond (1 tier above)");

  // Unscored agent — demonstrates the block path
  await check(sdk, 999999, "bronze", "unknown/unscored agent");

  console.log();
  console.log("────────────────────────────────────────────────────────────────");
  console.log("  Every one of those was a direct on-chain read on SKALE.");
  console.log("  Zero gas, sub-second latency, fully verifiable on the explorer.");
  console.log("────────────────────────────────────────────────────────────────");
}

main().catch((e) => {
  console.error("Demo failed:", e);
  process.exit(1);
});
