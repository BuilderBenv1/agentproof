# ERC-8004 Standardised Tag Taxonomy — Proposal

**From:** AgentProof (Trust Oracle for the ERC-8004 Agent Economy)
**Date:** March 2026
**Status:** Draft for discussion with the ERC-8004 working group

---

## 1. Context

ERC-8004 currently provides two `bytes32` tag fields (`tag1`, `tag2`) on every feedback entry, plus a freeform metadata URI on agent identity. These are deliberately flexible — but as the ecosystem grows beyond 50K registered agents across 14 chains, consumers (oracles, marketplaces, DeFi protocols, enterprise platforms, insurers, wallets, other agents) need a shared vocabulary to query and interpret reputation data consistently.

This proposal defines a **standardised tag taxonomy** that any ERC-8004 participant can use. It is additive — existing freeform usage remains valid. These are recommended conventions, not breaking changes.

---

## 2. Design Principles

1. **Consumer-agnostic.** Tags describe raw facts about agents. Interpretation is left to consumers. An insurer reads `financial_access: write` and prices risk. A marketplace reads the same tag and decides ranking. A wallet reads it and shows a warning.

2. **Earned reputation, not punishment.** The taxonomy supports upward progression through demonstrated behaviour. There is no slashing, no score reduction, no censorship. Bad actors simply never earn high scores.

3. **Oracle-independent.** Multiple oracles (AgentProof, ARC, future providers) should be able to read and write tags using the same vocabulary, enabling meta-scoring and cross-oracle consensus.

4. **On-chain verifiable where possible.** Tags derived from on-chain data (age, feedback count, deployer history) can be independently verified. Tags from off-chain data (uptime, audit status) are oracle-attested.

---

## 3. Proposed Tag Categories

### 3.1 Agent Identity Tags

Stored in the agent's metadata URI (set via `register()` / `setAgentURI()`).

| Tag | Type | Description | Example |
|-----|------|-------------|---------|
| `name` | string | Human-readable agent name | `"DeFi Yield Optimizer"` |
| `description` | string | What the agent does | `"Automated yield farming across Aave, Compound"` |
| `category` | enum | Primary function category (see §4) | `"defi"` |
| `image` | string | Avatar/logo URI | `"https://..."` or `"ipfs://..."` |
| `endpoints` | array | Service endpoints (A2A, MCP, REST) | `[{"protocol":"a2a","url":"https://..."}]` |
| `autonomy_level` | enum | `supervised` \| `semi_autonomous` \| `autonomous` | `"autonomous"` |
| `financial_access` | enum | `none` \| `read` \| `write` \| `unlimited` | `"write"` |
| `data_access_level` | enum | `none` \| `public` \| `private` \| `sensitive` | `"public"` |
| `can_delegate` | bool | Can this agent invoke other agents? | `true` |
| `can_be_delegated` | bool | Can other agents invoke this one? | `true` |
| `supported_protocols` | array | Communication protocols | `["a2a", "mcp", "rest"]` |
| `open_source` | bool | Is source code publicly available? | `true` |
| `source_url` | string | Link to source code repository | `"https://github.com/..."` |
| `audited_by` | array | Auditor names or addresses | `["Trail of Bits", "0x..."]` |
| `owner_type` | enum | `eoa` \| `multisig` \| `dao` \| `protocol` | `"multisig"` |
| `upgrade_pattern` | enum | `immutable` \| `proxy` \| `uri_mutable` | `"uri_mutable"` |
| `human_in_loop` | bool | Is there a kill switch or human override? | `true` |
| `jurisdiction` | string | Regulatory jurisdiction (ISO 3166-1) | `"US"` or `"GB"` |
| `compliance_tags` | array | Declared compliance certifications | `["soc2", "gdpr"]` |

### 3.2 Feedback Tags (tag1 / tag2)

Used in the `giveFeedback()` function's `tag1` and `tag2` parameters.

**`tag1` — Feedback Category** (what dimension is being evaluated):

| Value | Description | Used By |
|-------|-------------|---------|
| `trust` | General trust/quality assessment | Oracles, users |
| `liveness` | Endpoint availability check | Oracles (automated) |
| `performance` | Speed/efficiency of task execution | Users, agents |
| `accuracy` | Correctness of output/results | Users, agents |
| `reliability` | Consistency across repeated tasks | Agents |
| `security` | Security posture assessment | Security scanners |
| `compliance` | Regulatory compliance check | Enterprise platforms |
| `cost` | Value for money / cost efficiency | Marketplaces |
| `communication` | Quality of A2A/MCP interactions | Other agents |
| `safety` | Adherence to safety constraints | Safety auditors |

**`tag2` — Feedback Source** (who/what generated this feedback):

| Value | Description | Used By |
|-------|-------------|---------|
| `oracle-screening` | Automated oracle evaluation | Trust oracles |
| `liveness-check` | Automated uptime probe | Trust oracles |
| `user-review` | Human user feedback | End users |
| `agent-review` | Peer agent feedback | Other ERC-8004 agents |
| `protocol-review` | DeFi protocol integration review | DeFi protocols |
| `audit-report` | Formal audit finding | Auditors |
| `incident-report` | Post-incident assessment | Security teams |
| `marketplace-review` | Marketplace transaction review | Marketplace platforms |
| `validator` | Third-party validation result | Validators |
| `self-report` | Agent's own operational metrics | The agent itself |

### 3.3 Reputation Tags (Oracle-Computed)

Computed by oracles and exposed via API. Not stored on-chain in the feedback itself, but derived from on-chain data.

#### 3.3.1 Tiers

Graduated trust levels based on composite score and evidence volume:

| Tier | Min Score | Min Feedback | Meaning |
|------|-----------|--------------|---------|
| `diamond` | 85 | 20 | Highest trust — extensively validated |
| `platinum` | 72 | 10 | High trust — well-established track record |
| `gold` | 58 | 5 | Good trust — proven performance |
| `silver` | 42 | 3 | Moderate trust — emerging track record |
| `bronze` | 30 | 1 | Minimal trust — limited evidence |
| `unranked` | — | — | Insufficient data to assess |

#### 3.3.2 Risk Flags

Binary flags indicating specific risk patterns detected. Severity indicates signal strength (1=informational, 2=notable, 3=significant):

| Flag | Severity | Trigger |
|------|----------|---------|
| `HIGH_RISK_SCORE` | 3 | Composite score below safe threshold |
| `CONCENTRATED_FEEDBACK` | 3 | Reviews from too few unique addresses |
| `SERIAL_DEPLOYER` | 3 | Owner has deployed 100+ agents |
| `SUSPICIOUS_VOLATILITY` | 2 | Score swinging abnormally between periods |
| `LOW_UPTIME` | 2 | Agent endpoint unreachable or degraded |
| `FREQUENT_URI_CHANGES` | 2 | Metadata URI changed many times (identity instability) |
| `NEW_IDENTITY` | 2 | Agent registered less than 7 days ago |
| `LOW_FEEDBACK` | 1 | Insufficient review volume for confidence |
| `UNVERIFIED` | 1 | No validations or third-party attestations |

#### 3.3.3 Risk Levels

Aggregated from individual risk flags:

| Level | Meaning |
|-------|---------|
| `low` | No significant risk flags |
| `medium` | Minor concerns — proceed with caution |
| `high` | Multiple or severe risk signals — elevated caution |
| `critical` | Strong evidence of risk — not recommended |

#### 3.3.4 Recommendations

Actionable guidance for consumers:

| Recommendation | Meaning |
|----------------|---------|
| `TRUSTED` | Safe for standard interactions at the agent's tier level |
| `CAUTION` | Usable but with monitoring — some risk signals present |
| `HIGH_RISK` | Significant risk — limit exposure, require manual review |
| `UNVERIFIED` | Insufficient data — treat as unknown, not necessarily unsafe |

#### 3.3.5 Trajectory

Score movement over time:

| Trend | Definition |
|-------|-----------|
| `rising` | Score increased >1 point in 7 days |
| `falling` | Score decreased >1 point in 7 days |
| `stable` | Score within ±1 point over 7 days |
| `new` | Insufficient history to determine trend |

---

## 4. Agent Categories

Standardised primary function categories. An agent SHOULD declare exactly one.

| Slug | Name | Description |
|------|------|-------------|
| `defi` | DeFi Agents | Trading, yield farming, lending, financial automation |
| `gaming` | Gaming Agents | In-game economy, NPCs, gaming infrastructure |
| `rwa` | RWA Agents | Real-world asset tokenization and management |
| `payments` | Payment Agents | Settlement, remittance, payment processing |
| `data` | Data Agents | Analytics, indexing, data pipelines, oracles |
| `security` | Security Agents | Scanning, monitoring, threat detection |
| `infrastructure` | Infrastructure Agents | DevOps, deployment, orchestration |
| `social` | Social Agents | Communication, content, community management |
| `governance` | Governance Agents | DAO operations, voting, proposal management |
| `general` | General Agents | Multi-purpose or uncategorised |

---

## 5. Scoring Signals

Standardised signals that any oracle SHOULD compute. Individual oracles MAY weight these differently — that's the point of multi-oracle diversity.

| Signal | Weight (AgentProof default) | Source | Description |
|--------|---------------------------|--------|-------------|
| `rating_score` | 30% | On-chain feedback values | Bayesian-smoothed average of all feedback |
| `validation_score` | 15% | On-chain validation records | Success rate of third-party validations |
| `age_score` | 12% | On-chain registration timestamp | Account longevity (log scale) |
| `volume_score` | 10% | On-chain feedback count | Evidence volume (log scale) |
| `consistency_score` | 10% | On-chain feedback variance | Inverse standard deviation of ratings |
| `uptime_score` | 10% | Off-chain endpoint probing | Endpoint availability percentage |
| `deployer_score` | 8% | On-chain deployer analysis | Deployer's track record across all their agents |
| `uri_stability_score` | 5% | On-chain URI update events | Fewer metadata changes = higher stability |

**Post-factors applied after composite calculation:**

| Factor | Effect | Trigger |
|--------|--------|---------|
| `freshness_multiplier` | 0.70x–1.0x | Account age <7d = 0.70x, <30d = 0.85x, <90d = 0.95x |

---

## 6. Operational Metrics (Future Standard Fields)

Recommended additional fields for agent metadata URIs. These support advanced consumers (insurance, enterprise, threat feeds):

| Field | Type | Description |
|-------|------|-------------|
| `total_tasks_completed` | uint | Lifetime task execution count |
| `total_value_handled_usd` | uint | Lifetime value throughput (USD equivalent) |
| `max_transaction_value_usd` | uint | Largest single transaction |
| `avg_response_time_ms` | uint | Average response latency |
| `error_rate_30d` | float | Error percentage over 30 days |
| `last_active` | timestamp | Most recent on-chain or off-chain action |
| `active_chains` | array | Chains the agent currently operates on |
| `protocol_integrations` | array | DeFi protocols / services the agent interacts with |

---

## 7. Insurance & Risk Pricing Fields

For consumers building insurance or risk products on top of ERC-8004:

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `max_exposure_usd` | float | Oracle-computed | Dollar-denominated trust ceiling |
| `coverage_tier` | enum | Oracle-computed | `$1K` \| `$10K` \| `$100K` \| `$1M` |
| `claim_history` | uint | Off-chain | Number of claims filed against this agent |
| `incident_count` | uint | Off-chain | Times flagged by threat intelligence |
| `loss_event` | bool | Off-chain | Has this agent ever caused a verified financial loss? |
| `insurable` | bool | Oracle-computed | Meets minimum thresholds for coverage |
| `insurance_stake_usd` | float | On-chain | Staked collateral backing this agent |

---

## 8. Cross-Oracle Consensus Fields

For multi-oracle environments where multiple reputation providers score the same agent:

| Field | Type | Description |
|-------|------|-------------|
| `oracle_id` | uint256 | ERC-8004 agent ID of the scoring oracle |
| `oracle_name` | string | Human-readable oracle name |
| `methodology_version` | string | Scoring methodology version |
| `confidence` | float | Oracle's confidence in its own score (0-1) |
| `consensus_score` | float | Weighted average across all oracles |
| `oracle_agreement` | float | Percentage of oracles within ±5 points |
| `divergence_flag` | bool | True if oracles disagree by >15 points |

---

## 9. Threat Intelligence Fields

For real-time threat feed consumers:

| Field | Type | Description |
|-------|------|-------------|
| `threat_level` | enum | `none` \| `watch` \| `warning` \| `critical` |
| `first_flagged` | timestamp | When the agent was first flagged |
| `flag_source` | array | Which oracles/scanners flagged it |
| `flag_reason` | string | Human-readable explanation |
| `behavioural_cluster` | string | Agent archetype classification |
| `regime_change_detected` | bool | Has the agent's behaviour pattern shifted? |

---

## 10. What AgentProof Currently Uses

For transparency, here is exactly what AgentProof indexes and computes today:

**Currently stored on-chain via ERC-8004:**
- `tag1` values we write: `"trust"`, `"liveness"`
- `tag2` values we write: `"oracle-screening"`, `"liveness-check"`

**Currently in agent metadata URIs:**
- `name`, `description`, `category`, `image`, `endpoints`

**Currently computed off-chain by our oracle:**
- All 8 scoring signals (§5)
- All 9 risk flags (§3.3.2)
- 4 risk levels (§3.3.3)
- 4 recommendations (§3.3.4)
- 6 tiers (§3.3.1)
- Score trajectory (§3.3.5)
- Max exposure USD (§7)
- Cross-chain identity linking (same deployer detection)
- Reputation laundering detection (low scores on one chain + new agents on another)
- Deployer reputation scoring

**Not yet implemented but proposed:**
- Agent capability tags (§3.1: `autonomy_level`, `financial_access`, etc.)
- Operational metrics (§6)
- Full insurance fields (§7)
- Cross-oracle consensus (§8)
- Threat intelligence feed (§9)

---

## 11. Backwards Compatibility

This proposal is fully backwards compatible:

- All new metadata fields are optional additions to the existing URI schema
- `tag1` / `tag2` remain freeform `bytes32` — the recommended values are conventions, not enforced on-chain
- Existing agents with no new tags continue to work — they simply have less metadata available for advanced consumers
- Oracles that don't implement all signals can report partial data with a `confidence` score indicating coverage

---

## 12. Summary

The ERC-8004 standard provides the on-chain primitives (identity, feedback, tags). This taxonomy provides the **shared vocabulary** so that the growing ecosystem of oracles, marketplaces, protocols, wallets, insurers, and enterprises can speak the same language when evaluating agent trustworthiness.

The standard defines the tags. Oracles fill them with data. Consumers interpret them for their own use case. No single entity controls the interpretation — that's decentralisation applied to reputation.

---

*AgentProof — The Trust Oracle for the ERC-8004 Agent Economy*
*https://agentproof.sh | https://oracle.agentproof.sh*
