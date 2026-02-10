# Agent402

**Pay-per-use trust oracle for AI agents.** Trust evaluations via x402 USDC micropayments on Base.

> [agent402.sh](https://agent402.sh)

---

## Architecture

```
┌──────────────────────────┐     ┌──────────────────────────┐
│   Frontend (Next.js)     │     │   Oracle (FastAPI)        │
│   agent402.sh            │────▶│   api.agent402.sh         │
│   Railway Service #1     │     │   Railway Service #2      │
└──────────────────────────┘     └────────────┬─────────────┘
                                              │
                                  ┌───────────▼───────────┐
                                  │   Supabase (Postgres)  │
                                  │   Agent402 database    │
                                  └───────────────────────┘
```

### Two Railway Services

| Service | Directory | Port | Domain |
|---------|-----------|------|--------|
| **Oracle** (Python/FastAPI) | `oracle/` | 8402 | `api.agent402.sh` |
| **Frontend** (Next.js) | `frontend/` | 3000 | `agent402.sh` |

Both deploy from this repo — set the **Root Directory** in Railway settings for each service.

---

## Oracle — `oracle/`

FastAPI trust oracle with x402 payment gating.

### Premium Endpoints (x402 USDC)

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/v1/trust/{agent_id}` | $0.01 | Trust evaluation — score, tier, risk flags, breakdown |
| `GET /api/v1/trust/{agent_id}/risk` | $0.01 | Risk assessment with flags and recommendation |
| `GET /api/v1/agents/trusted` | $0.01 | Search agents by category, score, tier |
| `GET /api/v1/network/stats` | $0.005 | Network-wide statistics |

### Free Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/health` | Health check |
| `GET /api/v1/pricing` | Machine-readable pricing |
| `GET /api/v1/payments/stats` | Payment statistics |
| `GET /api/v1/info` | Oracle metadata |
| `GET /.well-known/agent.json` | A2A agent card |
| `POST /a2a` | A2A JSON-RPC |

### Environment Variables

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
X402_PAY_TO=0xYourWalletAddress
X402_NETWORK=eip155:84532          # Base Sepolia (testnet)
X402_FACILITATOR_URL=https://x402.org/facilitator
PORT=8402
BASE_URL=https://api.agent402.sh
```

---

## Frontend — `frontend/`

Next.js 14 website with landing page, trust lookup, leaderboard, and API docs.

### Environment Variables

```bash
NEXT_PUBLIC_API_URL=https://api.agent402.sh
```

---

## Database Setup

1. Create a new Supabase project
2. Run `oracle/migrations.sql` in the SQL Editor
3. Set `SUPABASE_URL` and `SUPABASE_KEY` in Railway

---

## Railway Deployment

### Service 1: Oracle
- **Root Directory:** `oracle`
- **Builder:** Nixpacks (auto-detects Python)
- **Start Command:** from Procfile (`uvicorn main:app ...`)
- **Custom Domain:** `api.agent402.sh`

### Service 2: Frontend
- **Root Directory:** `frontend`
- **Builder:** Nixpacks (auto-detects Node.js)
- **Build Command:** `npm run build`
- **Start Command:** from Procfile (`npx next start ...`)
- **Custom Domain:** `agent402.sh`

---

## Quick Start (Client)

```bash
pip install "x402[evm]" httpx eth-account
```

```python
from x402.http.client import httpx_client
from eth_account import Account

wallet = Account.from_key("0xYOUR_PRIVATE_KEY")
client = httpx_client(wallet)

resp = client.get("https://api.agent402.sh/api/v1/trust/42")
print(resp.json())
```

---

## Protocol Support

- **REST API + x402** — Standard JSON endpoints with USDC micropayments
- **A2A** — Google Agent-to-Agent protocol for AI-to-AI discovery
- **Base** — USDC payments on Base (Sepolia testnet / mainnet)
