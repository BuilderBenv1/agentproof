# AgentProof × Ampersend — Reputation-Gated Payments

**ReputationGatedTreasurer** — an X402 Treasurer that gates agent-to-agent payments on AgentProof trust scores. Before signing a payment to a counterparty, it queries the AgentProof oracle. Below threshold → blocked. Above threshold → payment proceeds.

## The Loop: Discover → Verify → Transact

```
┌─────────────────────────────────────────────────────────────┐
│                      BUYER AGENT                            │
│                                                             │
│  1. DISCOVER   Remote seller agent via A2A agent card       │
│       ↓                                                     │
│  2. VERIFY     Seller returns 402 Payment Required          │
│       ↓        ReputationGatedTreasurer intercepts          │
│       ↓        → resolve payTo address via AgentProof       │
│       ↓        → check score >= min_score                   │
│       ↓        → check tier >= min_tier                     │
│       ↓        → PASS: sign payment     FAIL: block         │
│       ↓                                                     │
│  3. TRANSACT   Signed x402 payment attached to retry        │
│                Seller verifies + executes                   │
└─────────────────────────────────────────────────────────────┘
```

## Where This Fits

| Layer | Protocol | Who |
|-------|----------|-----|
| Micropayments | x402 | Coinbase |
| Commerce / Escrow | ERC-8183 (ACP) | Virtuals / community |
| Payment Management | Ampersend SDK | Edge & Node |
| **Trust Oracle** | **ERC-8004** | **AgentProof** |

AgentProof sits at the trust layer. The `ReputationGatedTreasurer` is the bridge between the trust layer and the payment layer — it ensures your agent only pays counterparties with verified reputation.

## Quick Start

```bash
# Install
uv add ampersend-sdk x402-a2a httpx eth-account

# For LangChain agent mode
uv add langchain-ampersend langchain langchain-openai
```

### Standalone reputation check (no wallet needed)

```bash
export AGENTPROOF_API_KEY="ap_live_..."
export CHECK_ADDRESS="0x1234..."

python example_agent.py check
```

### Full LangChain buyer agent

```bash
export AGENTPROOF_API_KEY="ap_live_..."
export SESSION_KEY_PRIVATE_KEY="0x..."
export SELLER_AGENT_URL="https://subgraph-a2a.x402.staging.thegraph.com"
export OPENAI_API_KEY="sk-..."
export MIN_SCORE="30"
export MIN_TIER="bronze"

python example_agent.py agent
```

## Usage in Your Own Agent

```python
from reputation_gated_treasurer import ReputationGatedTreasurer
from ampersend_sdk.x402.wallets.account import AccountWallet
from eth_account import Account

wallet = AccountWallet(Account.from_key(PRIVATE_KEY))

treasurer = ReputationGatedTreasurer(
    wallet=wallet,
    agentproof_api_key="ap_live_...",
    min_score=50.0,       # minimum composite score (0-100)
    min_tier="silver",    # minimum tier (unranked/bronze/silver/gold/platinum/diamond)
    chain="base",         # chain context for score resolution
)

# Use with LangChain A2A toolkit
from langchain_ampersend import A2AToolkit

toolkit = A2AToolkit(
    remote_agent_url="https://seller-agent.example.com",
    treasurer=treasurer,  # ← AgentProof gate applied here
)
await toolkit.initialize()
tools = toolkit.get_tools()
# ... use tools in your LangChain agent
```

### Direct trust resolution

```python
# Check any address without making a payment
result = await treasurer.resolve_trust("0x1234...")
print(f"Score: {result.score}, Tier: {result.tier}, Agent ID: {result.agent_id}")
```

## Configuration

| Param | Default | Description |
|-------|---------|-------------|
| `min_score` | `30.0` | Minimum AgentProof composite score (0-100) |
| `min_tier` | `"bronze"` | Minimum tier: unranked, bronze, silver, gold, platinum, diamond |
| `oracle_url` | `https://oracle.agentproof.sh` | AgentProof oracle endpoint |
| `chain` | `"base"` | Chain context (base, avalanche, ethereum, linea) |
| `cache_size` | `256` | In-memory score cache (0 = disabled) |
| `timeout` | `10.0` | Oracle HTTP timeout in seconds |

## Tier Thresholds (AgentProof Defaults)

| Tier | Score Range | Feedback Required |
|------|-------------|-------------------|
| Diamond | 90+ | 50+ |
| Platinum | 80-89 | 30+ |
| Gold | 70-79 | 20+ |
| Silver | 60-69 | 10+ |
| Bronze | 50-59 | 5+ |
| Unranked | < 50 | — |

## Error Handling

```python
from reputation_gated_treasurer import (
    ReputationGatedException,
    AgentNotRegistered,
)

try:
    result = await executor.ainvoke({"input": "query the seller"})
except ReputationGatedException as e:
    print(f"Blocked: score={e.score}, tier={e.tier}")
    print(f"Address: {e.address}")
except AgentNotRegistered as e:
    print(f"No AgentProof identity for {e.address}")
```

## How It Works Under the Hood

1. Seller responds with HTTP 402 + `PaymentRequirements` (amount, token, chain, `payTo` address)
2. `ReputationGatedTreasurer.onPaymentRequired()` intercepts before signing
3. Calls `GET /api/v1/hook/resolve/{payTo}` on the AgentProof oracle
4. Oracle resolves address → ERC-8004 agent ID → composite score + tier
5. If `score >= min_score` AND `tier >= min_tier`: signs the x402 payment
6. Otherwise: raises `ReputationGatedException` — payment never signed

The oracle endpoint mirrors the on-chain `AddressResolver` contract, providing the same trust data without requiring an on-chain read per payment.

## License

MIT — part of the [AgentProof](https://agentproof.xyz) project.
