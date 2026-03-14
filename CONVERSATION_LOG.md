# Conversation Log — Human-Agent Collaboration

**Project:** AgentProof
**Track:** Agents That Trust (Synthesis Hackathon)
**Date range:** March 2026
**Human:** Builder (product direction, architecture decisions, deployment ops)
**Agent:** Claude Code (implementation, debugging, contract deployment)

---

## What We Built

AgentProof is an on-chain reputation oracle for AI agents. Any smart contract can query an agent's trust score before interacting with it — gating access, setting collateral requirements, or blocking flagged actors entirely.

**Core deliverables on Base:**
- **TrustScoreOracle V2** — Multi-oracle consensus contract. Scores encoded 0–10,000 with 6 trust tiers. Authorized oracles push scores via `batchUpdateScores()`. Any contract reads for free via `viewScore()`.
- **ReputationGateV2** — Pluggable trust gate. Provides `requireTrust()`, value-based gating, collateral multipliers, batch filtering. Any protocol can drop this in front of sensitive operations.
- Scores are live on-chain, pushed automatically by the oracle service.

---

## Collaboration Timeline

### Session 1 — Contract Design & Deployment

**Human direction:** "We need a ReputationGateV2 that reads from the oracle and lets protocols enforce trust thresholds."

**Agent work:**
- Designed ReputationGateV2 with configurable thresholds (minScore, minTier, maxScoreAge)
- Implemented per-tier value limits and collateral multiplier curves
- Wrote 32 unit tests covering deployment, trust checks, value gating, batch operations, admin functions
- All tests passing

**Human direction:** "Deploy to Base mainnet. Also redeploy the oracle — V1 can't be verified."

**Agent work:**
- Deployed TrustScoreOracle V2 to Base mainnet
- Deployed ReputationGateV2 pointing to new oracle
- Verified both contracts on Basescan via Etherscan V2 API
- Deployed TrustScoreOracle V2 to Avalanche mainnet
- Verified on Snowtrace

**Debugging (joint):**
- Etherscan V1 API was deprecated mid-session — agent migrated hardhat config to V2 endpoint format
- Base RPC key had expired — agent switched to public RPC
- Oracle V1 bytecode didn't match source (deployed pre-V2 refactor) — redeployed fresh

### Session 2 — Score Pusher Debugging

**Human direction:** "Scores aren't appearing on-chain. The oracle service is running but nothing lands."

**Investigation (agent-led, human provided Railway logs and env vars):**

1. **Root cause 1 — Wallet mismatch:** The Railway oracle service uses `ORACLE_PRIVATE_KEY` (wallet `0xF653...`) but the deployed contracts only authorized the deployer wallet (`0x16f0...`). Every `batchUpdateScores()` call silently reverted with `NotAuthorized()`.
   - Fix: Added `0xF653...` as authorized oracle operator on both Base and Avalanche V2 contracts.

2. **Root cause 2 — Gas pricing:** `maxPriorityFeePerGas` was hardcoded to 2 gwei, but on Avalanche the base fee is ~0.03 gwei. Priority fee exceeded max fee — every transaction rejected by the node.
   - Fix: Cap priority fee to base fee, calculate max fee dynamically.

3. **Root cause 3 — Insufficient gas per batch:** Batch size of 50 agents allocated 1.8M gas, but actual cost is ~72k per agent (3.6M needed). Every batch reverted on-chain.
   - Fix: Reduced batch size to 20, increased per-agent gas allocation.

4. **Silent failures:** The pusher returned 0 with no logging at every early-exit path. Added diagnostic logging at every decision point so failures are visible.

**Human provided:** Gas funding for oracle wallet on Base, Railway env var updates, logs for debugging.

**Verification:** Agent pushed 3 test scores from local to both Avalanche and Base oracles — confirmed on-chain via `viewScore()`.

### Session 3 — Multi-Chain Expansion

**Human direction:** "Deploy to Polygon too."

**Agent work:**
- Created combined oracle + gate deploy script for Polygon
- Tried 6+ RPC endpoints — all failed or hung (Polygon RPC ecosystem instability)
- Abandoned Polygon deploy after exhausting options

**Decision (human):** Ship on Base + Avalanche. Polygon can wait.

---

## Architecture (Public)

```
Autonomous Screener (Python, Railway)
  → Evaluates agents using proprietary signal analysis
  → Pushes composite scores on-chain via batchUpdateScores()
        ↓
TrustScoreOracle V2 (Solidity, Base + Avalanche)
  → Multi-oracle consensus (currently 2 operators)
  → viewScore(agentId) → (score, tier, lastUpdated)
        ↓
ReputationGateV2 (Solidity, Base)
  → requireTrust(agentId) — revert if untrusted
  → isTrustedForValue(agentId, value) — value-based gating
  → getCollateralMultiplier(agentId) — risk-adjusted collateral
  → batchCheckTrust(agentIds) — filter arrays
```

---

## Deployed Contracts (Base Mainnet)

| Contract | Address | Verified |
|----------|---------|----------|
| TrustScoreOracle V2 | `0xE74e9C994b8F65db01725DdAE603EAE397aBa432` | Yes |
| ReputationGateV2 | `0x882e22FBB913b53Ab062f3f5f42C3E8838373d23` | Yes |

## Deployed Contracts (Avalanche Mainnet)

| Contract | Address | Verified |
|----------|---------|----------|
| TrustScoreOracle V2 | `0xA9D7a613Ce349d15827CB8C54F08e24549219B4f` | Yes |

---

## Division of Labour

| Area | Human | Agent |
|------|-------|-------|
| Product vision & direction | Lead | — |
| Architecture decisions | Lead | Advisory |
| Smart contract implementation | — | Lead |
| Unit tests (32 tests) | — | Lead |
| Deployment & verification | Joint | Lead |
| Debugging (3 root causes) | Provided logs, env vars, funding | Investigation & fixes |
| Scoring algorithm design | Lead | — |
| Infrastructure ops (Railway) | Lead | — |
| Gas optimization | — | Lead |

---

## Key Decisions Made During Collaboration

1. **Multi-oracle consensus over single-oracle** — Future-proofs for decentralisation. Any number of oracle operators can push scores; contract averages them and flags divergence.

2. **ReputationGateV2 as a separate contract** — Protocols integrate the gate, not the oracle directly. This lets us upgrade oracle logic without breaking integrations.

3. **Value-based gating over binary trust** — Instead of just "trusted/untrusted", the gate enforces per-tier transaction value limits and collateral multipliers. Higher trust = higher limits = lower collateral.

4. **Ship on Base + Avalanche, skip Polygon** — Pragmatic decision after Polygon RPC instability wasted time. Two chains with working infrastructure beats three with one unreliable.

5. **Batch size 20 over 50** — Gas analysis showed 72k per agent update. 20-agent batches fit comfortably under block gas limits with margin for consensus computation.
