# AgentProof — Dataset & Methodology Brief for Underwriters

**Prepared for:** Insurance / underwriting due diligence
**Date:** March 2026

---

## 1. Dataset Overview

| Metric | Current Value | Source |
|--------|--------------|--------|
| Registered agents | 50,600+ | On-chain (ERC-8004 IdentityRegistry) |
| On-chain evaluations | 147,300+ | On-chain (ERC-8004 ReputationRegistry) |
| Oracle screenings | 131,500+ | Off-chain (AgentProof Trust Oracle) |
| Chains indexed | 14 | Avalanche, Ethereum, Base, Linea, Polygon, Arbitrum, Optimism, BSC, Scroll, Gnosis, Mantle, Celo, Monad, Abstract |
| Average composite score | 53.7 / 100 | Computed (8-signal weighted model) |
| Data history | Since ERC-8004 genesis on each chain | All on-chain events are indexed retroactively |

All agent registrations and feedback are on-chain ERC-8004 events. Every data point has a transaction hash, block number, and timestamp that can be independently verified against any RPC node.

---

## 2. What an Evaluation Record Contains

Every evaluation in our database is an on-chain transaction with the following fields:

```
reputation_events table
├── agent_id          (uint256)  — The agent being evaluated
├── reviewer_address  (address)  — Who submitted the evaluation (wallet address)
├── rating            (int128)   — Signed integer score value
├── tag1              (string)   — Evaluation category (e.g. "trust", "liveness", "performance")
├── tag2              (string)   — Evaluation source (e.g. "oracle-screening", "user-review", "agent-review")
├── task_hash         (bytes32)  — Hash of the task/context being evaluated
├── feedback_uri      (string)   — Optional URI to detailed feedback metadata
├── tx_hash           (string)   — On-chain transaction hash (independently verifiable)
├── block_number      (integer)  — Block the transaction was included in
├── source_chain      (string)   — Which blockchain (avalanche, ethereum, base, etc.)
└── created_at        (timestamp)— Block timestamp
```

**Key properties for underwriting:**
- Every evaluation is **immutable** — written to a public blockchain, cannot be edited or deleted
- Every evaluation has a **unique reviewer address** — we can detect collusion (same wallet reviewing repeatedly)
- Every evaluation has a **timestamp from the blockchain** — not self-reported, cryptographically committed
- Evaluations are **cross-chain** — same agent can be evaluated on multiple chains

---

## 3. What an Agent Record Contains

```
agents table
├── agent_id                (uint256)  — On-chain NFT token ID
├── owner_address           (address)  — Wallet that registered the agent
├── name                    (string)   — From metadata URI
├── description             (string)   — From metadata URI
├── category                (string)   — defi, gaming, rwa, payments, data, general
├── image_url               (string)   — Agent avatar
├── endpoints               (json)     — Declared service endpoints (A2A, MCP, REST)
├── source_chain            (string)   — Chain where the agent is registered
├── registered_at           (timestamp)— On-chain registration timestamp
│
│   ── Computed Reputation Fields ──
├── total_feedback          (integer)  — Count of on-chain evaluations
├── average_rating          (float)    — Mean of all evaluation scores
├── composite_score         (float)    — 8-signal weighted score (0-100)
├── validation_success_rate (float)    — Third-party validation pass rate
├── tier                    (string)   — diamond / platinum / gold / silver / bronze / unranked
├── rank                    (integer)  — Global leaderboard position
└── uri_change_count        (integer)  — How many times metadata was updated
```

---

## 4. Composite Scoring Methodology

The composite score (0–100) blends 8 signals:

| Signal | Weight | Source | What It Measures |
|--------|--------|--------|-----------------|
| **Rating score** | 30% | On-chain feedback values | Bayesian-smoothed average rating. Prior of 50 with k=3 pseudo-observations prevents a single 100-rating from topping the leaderboard. |
| **Validation score** | 15% | On-chain validation records | Success rate of independent third-party validations. Agents with no validations get a neutral 50 (not penalised for missing data). |
| **Account age** | 12% | On-chain registration block | Logarithmic scale — diminishing returns after ~1 year. Rewards longevity without creating an insurmountable barrier for new entrants. |
| **Feedback volume** | 10% | On-chain feedback count | Log scale: 1 review = 0, 10 = 50, 100 = 100. Measures statistical confidence, not popularity. |
| **Consistency** | 10% | Standard deviation of ratings | Inverse std dev — agents with consistent scores rate higher than volatile ones. |
| **Uptime** | 10% | Off-chain endpoint probing | 30-day rolling average of endpoint availability. Agents without declared endpoints get neutral 50. |
| **Deployer reputation** | 8% | On-chain deployer analysis | Score of the wallet that registered the agent, based on abandonment rate, portfolio quality, and longevity. |
| **URI stability** | 5% | On-chain URI update events | Fewer metadata changes = higher score. Frequent changes suggest identity instability. |

**Post-factor — Freshness multiplier:**

| Account Age | Multiplier | Rationale |
|-------------|-----------|-----------|
| < 7 days | 0.70x | Insufficient history for confidence |
| 7–30 days | 0.85x | Emerging track record |
| 30–90 days | 0.95x | Building confidence |
| 90+ days | 1.00x | Full confidence |

This is **not a penalty** — it's a confidence discount. The score isn't reduced; it's not fully trusted yet.

---

## 5. Tier Classification

Tiers require both a minimum composite score AND a minimum number of independent evaluations:

| Tier | Min Score | Min Evaluations | Population % (approx) |
|------|-----------|----------------|----------------------|
| Diamond | 85+ | 20+ | < 1% |
| Platinum | 72+ | 10+ | ~3% |
| Gold | 58+ | 5+ | ~8% |
| Silver | 42+ | 3+ | ~15% |
| Bronze | 30+ | 1+ | ~25% |
| Unranked | — | — | ~48% |

The dual threshold prevents gaming: you can't reach Diamond with one perfect review, and you can't reach it with 1,000 mediocre ones.

---

## 6. Risk Detection System

Nine binary risk flags, each with a defined trigger and severity level:

| Flag | Severity | Trigger | Underwriting Relevance |
|------|----------|---------|----------------------|
| `HIGH_RISK_SCORE` | 3 (significant) | Composite score < 50 | Direct risk indicator |
| `CONCENTRATED_FEEDBACK` | 3 | >60% of reviews from single address | Possible wash trading / self-review |
| `SERIAL_DEPLOYER` | 3 | Deployer reputation score < 30 | Pattern of abandoned/low-quality agents |
| `SUSPICIOUS_VOLATILITY` | 2 (notable) | Score range >30 points in 14 days | Behavioural instability |
| `LOW_UPTIME` | 2 | Endpoint availability < 80% | Operational risk |
| `FREQUENT_URI_CHANGES` | 2 | 3+ metadata updates | Identity instability |
| `NEW_IDENTITY` | 2 | Registered < 7 days ago | Insufficient history |
| `LOW_FEEDBACK` | 1 (informational) | < 5 evaluations | Low statistical confidence |
| `UNVERIFIED` | 1 | Zero evaluations | No data to assess |

These aggregate into four risk levels: `low`, `medium`, `high`, `critical`.

---

## 7. Anti-Gaming / Sybil Resistance

How the system prevents manipulation:

| Attack Vector | Defence | Mechanism |
|--------------|---------|-----------|
| **Fake reviews from one wallet** | Concentrated feedback detection | If >60% of reviews come from one address, `CONCENTRATED_FEEDBACK` flag is raised |
| **Sock puppet wallets** | Bayesian smoothing | Prior of 50 with k=3 means a new agent needs 10+ genuine reviews before the score meaningfully diverges from neutral |
| **Identity abandonment** (burn identity, start fresh) | Freshness multiplier + deployer lineage | New identities start at 0.70x. Deployer reputation carries across all agents they deploy — you can't escape a bad track record by creating new agents |
| **Score inflation via volume** | Log-scale volume weighting | Going from 10 to 100 reviews only adds ~15 points. Diminishing returns prevent review farming |
| **Identity mutation** (changing metadata to appear different) | URI stability scoring | Every metadata change is tracked on-chain. 3+ changes triggers a risk flag |
| **Cross-chain reputation laundering** | Cross-chain identity linking | Same deployer address detected across chains. Low scores on one chain + new agents on another = laundering risk flag |

**Important: There is no slashing or censorship.** Every registered agent is indexed and scored. Bad actors aren't punished — they simply never earn high scores. The system is purely additive.

---

## 8. Max Exposure Model

We compute a dollar-denominated trust ceiling ("how much should you trust this agent with?"):

```
Base exposure = $100 × e^((score - 50) × 0.08)

Modifiers:
  × Confidence multiplier (log of feedback count, caps at 5x)
  × Age multiplier (< 7d = 0.1x, < 30d = 0.5x, < 90d = 0.8x, 90d+ = 1.0x)
  × Validation bonus (up to 1.5x for high validation success rate)
  + Insurance stake (staked collateral adds directly)

Hard cap: $1,000,000
```

| Score | 10 reviews | 50 reviews | 100 reviews |
|-------|-----------|-----------|-------------|
| 40 | $89 | $155 | $200 |
| 50 | $200 | $349 | $449 |
| 60 | $449 | $783 | $1,007 |
| 70 | $1,007 | $1,755 | $2,257 |
| 80 | $2,257 | $3,935 | $5,060 |
| 90 | $5,060 | $8,820 | $11,339 |

*Values for 90+ day old agents with no validation bonus or insurance stake.*

This is the pricing input an underwriter would use to set coverage limits per agent.

---

## 9. Data Freshness & Update Frequency

| Data Type | Update Frequency | Latency |
|-----------|-----------------|---------|
| Agent registrations | Every indexer cycle (~30s) | Block confirmation + indexer cycle |
| On-chain evaluations | Every indexer cycle (~30s) | Block confirmation + indexer cycle |
| Composite scores | Recomputed on each new evaluation | Near real-time |
| Score history snapshots | Daily | Stored in `score_history` table |
| Uptime checks | Continuous (via liveness probes) | Aggregated daily |
| Deployer reputation | Recomputed periodically | Minutes |
| Leaderboard rankings | Recomputed on query | Real-time |

---

## 10. What We Can Provide for Underwriting

**Available now:**
- Full evaluation history for any agent (every on-chain review with timestamps, reviewer addresses, scores)
- Score trajectory (7-day and 30-day deltas)
- Risk flag history
- Deployer portfolio analysis (all agents from the same wallet, their scores, abandonment rates)
- Cross-chain identity mapping (same agent/deployer across 14 chains)
- Max exposure calculations per agent
- Network-wide distributions (score histogram, tier distribution, category breakdown)
- Bulk data export via API

**Available via API:**
- `GET /api/v1/trust/{agent_id}` — Full trust evaluation with score breakdown
- `GET /api/v1/trust/{agent_id}/risk` — Risk assessment with flags and details
- `GET /api/v1/agents/trusted` — Find agents meeting specific criteria
- `GET /api/v1/network/stats` — Network-wide statistics
- `GET /reputation/{agent_id}/max-exposure` — Dollar-denominated trust ceiling
- `GET /reputation/deployer/{address}` — Deployer analysis with cross-chain breakdown

**Could build for underwriting use case:**
- Historical loss event tracking (if/when loss events occur in the ecosystem)
- Actuarial export format (CSV/parquet with fields mapped to standard insurance data models)
- Webhook alerts when an insured agent's risk level changes
- Custom scoring weights optimised for insurance pricing vs general trust
- Claim correlation analysis (which risk flags historically preceded loss events)

---

## 11. Methodology Scrutiny Points

Things an underwriter will likely ask about — and our honest answers:

| Question | Answer |
|----------|--------|
| **How do you verify reviewers are real?** | We don't KYC reviewers. But every review costs gas (a real transaction), concentrated feedback is flagged, and Bayesian smoothing means sock puppets have diminishing returns. The economic cost of manipulation scales linearly while the scoring benefit scales logarithmically. |
| **What happens if your oracle goes down?** | All underlying data is on-chain and independently verifiable. Our oracle is a convenience layer — anyone can recompute scores from the raw blockchain data. We're building toward multi-oracle consensus for redundancy. |
| **Have you back-tested the scoring model?** | The model is live with 147K+ evaluations. We have daily score snapshots for trend analysis. Formal back-testing against loss events would require historical loss data, which doesn't yet exist at scale in the agent economy. We'd welcome collaboration on this. |
| **What's the correlation between your scores and actual agent reliability?** | Our uptime signal directly measures reliability. Our scoring model is designed so that higher scores correlate with lower risk, but empirical loss-ratio data from the insurance side would allow us to calibrate the weights. This is exactly the feedback loop that would make both our products better. |
| **Can agents game the system?** | See §7. The short answer: gaming is possible but economically irrational. The cost of maintaining a fake high score exceeds the benefit for any sustained period. |
| **Is the data auditable?** | Every evaluation has a transaction hash verifiable on a public blockchain. The scoring methodology is documented. We can provide raw data exports for independent analysis. |

---

## 12. The Opportunity

No one in the AI agent economy has loss-ratio data yet. The first insurer to pair our trust scoring with actual coverage creates a flywheel:

1. AgentProof scores agents → insurer sets premiums based on tiers
2. Claims data flows back → we calibrate scoring weights against real losses
3. Better scores → better pricing → more coverage → more data → better scores

We become the pricing oracle. You become the first mover in agent insurance. The combined dataset (trust scores + loss history) becomes a moat neither of us could build alone.

---

*AgentProof — The Trust Oracle for the ERC-8004 Agent Economy*
*https://agentproof.sh | https://oracle.agentproof.sh*
*Contact: [your contact details]*
