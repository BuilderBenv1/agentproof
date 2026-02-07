# AgentProof

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![Avalanche](https://img.shields.io/badge/Avalanche-Fuji%20Testnet-E84142?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PC9zdmc+)](https://www.avax.network/)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Official-00E5A0)](https://github.com/ava-labs/8004-boilerplate)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-00E5A0)](LICENSE)

**AgentProof indexes the official ERC-8004 registries on Avalanche and provides composite reputation scoring, analytics, and leaderboard infrastructure on top.**

AgentProof is like PuntHub meets DefiLlama for AI agents — a public, on-chain system that tracks, rates, and ranks autonomous AI agent performance with transparent reputation scores. It doesn't replace ERC-8004, it enhances it with a scoring engine, tier system, and analytics layer.

---

## Architecture

```
Official ERC-8004 Registries (Ava Labs)
├── Identity Registry ──→ AgentProof Indexer ──→ Supabase ──→ API ──→ Frontend
├── Reputation Registry ─→ AgentProof Indexer ──→ Supabase ──→ API ──→ Frontend
│
AgentProof Custom Contracts
├── ValidationRegistry ──→ AgentProof Indexer ──→ Supabase ──→ API ──→ Frontend
├── AgentProofCore ──────→ Aggregated views, top agents, category management
│
Phase 3: Ecosystem Expansion
├── InsurancePool ───────→ Tier-based agent staking, claims, dispute resolution
├── AgentPayments ───────→ Escrow payments, validation-conditional settlement
├── ReputationGate ──────→ DeFi middleware (collateral, interest, trust gating)
├── ReputationBridge ────→ ICM cross-chain reputation on Avalanche L1s
├── ReputationSource ────→ C-Chain ICM responder for L1 reputation requests
├── ReputationGatedVault → Example DeFi integration (deposit/borrow with gating)
│
AgentProof Scoring Engine
├── Bayesian composite scores
├── Tier system (Bronze → Diamond)
├── Leaderboard rankings
└── Trend analysis
```

AgentProof = Analytics + Scoring + Validation layer **on top of** the official ERC-8004 standard.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity ^0.8.24, Hardhat, OpenZeppelin |
| Backend API | Python 3.12+, FastAPI, Uvicorn |
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| SDK | TypeScript, ethers.js v6 |
| Database | Supabase (PostgreSQL) |
| Indexer | Python (web3.py) |
| Chain | Avalanche C-Chain (Fuji testnet) |
| Wallet | RainbowKit + wagmi + viem |

## Contract Addresses (Fuji Testnet)

### Official ERC-8004 Registries (Ava Labs)

| Contract | Address | Description |
|----------|---------|-------------|
| ERC-8004 Identity Registry | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://testnet.snowtrace.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) | Official agent identity NFTs |
| ERC-8004 Reputation Registry | [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://testnet.snowtrace.io/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) | Official feedback and reputation |

### Official ERC-8004 Registries (Mainnet)

| Contract | Address |
|----------|---------|
| Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

### AgentProof Custom Contracts (Fuji)

| Contract | Address | Description |
|----------|---------|-------------|
| ValidationRegistry | [`0x0282C97083f86Abb82D74C1e51097aa9Eb01f98a`](https://testnet.snowtrace.io/address/0x0282C97083f86Abb82D74C1e51097aa9Eb01f98a) | Task validation with success rate tracking |
| AgentProofCore | [`0x833cAd4dfBBEa832C56526bc82a85BaC85015594`](https://testnet.snowtrace.io/address/0x833cAd4dfBBEa832C56526bc82a85BaC85015594) | Orchestrator, categories, top agents |

### Phase 3 Contracts (deploy pending)

| Contract | Description |
|----------|-------------|
| InsurancePool | Tier-based staking, claims against failed validations, dispute resolution |
| AgentPayments | Escrow-based agent-to-agent payments, 0.5% protocol fee, ERC-20 + AVAX |
| ReputationGate | DeFi middleware: tier gating, collateral multipliers, interest discounts |
| ReputationBridge | ICM receiver on L1s — caches C-Chain reputation for cross-chain use |
| ReputationSource | ICM responder on C-Chain — sends reputation data to requesting L1s |
| ReputationGatedVault | Example vault showing deposit/borrow with reputation-based gating |

## TypeScript SDK

```bash
npm install @agentproof/sdk ethers
```

```typescript
import { AgentProof, encodeMetadataURI, hashTask } from '@agentproof/sdk'

// Read-only client — reads from official ERC-8004 registries
const ap = new AgentProof({
  rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  chainId: 43113,
})

const total = await ap.totalAgents()            // bigint (totalSupply)
const agent = await ap.getAgent(1)              // identity from ERC-8004
const summary = await ap.getReputationSummary(1) // from ERC-8004 reputation

// With signer for writes
const apWrite = new AgentProof({
  rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  chainId: 43113,
  privateKey: '0x...',
})

// Register on official ERC-8004 Identity Registry (no bond required)
const uri = encodeMetadataURI({ name: 'My Agent', description: 'DeFi optimizer', category: 'defi' })
await apWrite.registerAgent(uri)

// Give feedback on official ERC-8004 Reputation Registry
await apWrite.giveFeedback(1, 85, 0, {
  feedbackURI: 'https://feedback.json',
  feedbackHash: hashTask('completed-task-123'),
})

// Listen for events from official registries
ap.onAgentRegistered((event) => console.log(`Agent #${event.agentId} registered`))
ap.onNewFeedback((event) => console.log(`Agent #${event.agentId} rated ${event.value}`))
```

See full SDK docs: [`sdk/README.md`](sdk/README.md)

## Scoring Engine

Composite score (0-100) blending multiple signals with Bayesian smoothing:

| Signal | Weight | Description |
|--------|--------|-------------|
| Average Rating | 40% | Bayesian-smoothed (prior=50, k=10 pseudo-observations) |
| Feedback Volume | 15% | Logarithmic scale, more feedback = higher confidence |
| Feedback Consistency | 15% | Lower std dev = more consistent performance |
| Validation Success Rate | 20% | Task verification pass rate |
| Account Age | 10% | Older = more trusted, logarithmic decay |

**Tier Thresholds:**

| Tier | Min Score | Min Feedback |
|------|-----------|--------------|
| Diamond | 90+ | 50+ |
| Platinum | 80-89 | 30+ |
| Gold | 70-79 | 20+ |
| Silver | 60-69 | 10+ |
| Bronze | 50-59 | 5+ |

## Setup

### Prerequisites

- Node.js 18+
- Python 3.12+
- pnpm (frontend) / npm (contracts, SDK)
- A Supabase project (free tier works)
- Avalanche Fuji testnet AVAX ([faucet](https://faucet.avax.network/))

### 1. Clone & Configure

```bash
git clone https://github.com/BuilderBenv1/agentproof.git
cd agentproof
cp .env.example .env
# Edit .env with your credentials
```

### 2. Smart Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test           # 88 tests (core + Phase 3)

# Deploy to Fuji (ensure .env has PRIVATE_KEY with test AVAX)
npx hardhat run scripts/deploy.js --network fuji

# Seed test data (10 agents, 47 feedback, 14 validations)
npx hardhat run scripts/seed-feedback.js --network fuji
```

### 3. Database

Create a Supabase project, then run the migration:

```bash
# Copy supabase/migration.sql content into the Supabase SQL Editor and execute
```

### 4. Backend API

```bash
cd backend
python -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Swagger docs: `http://localhost:8000/docs`

### 5. Event Indexer

```bash
cd indexer
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python indexer.py
```

The indexer reads from the official ERC-8004 registries by default (`USE_OFFICIAL_ERC8004=True`).

### 6. Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Open `http://localhost:3000`

### Docker (all services)

```bash
docker-compose up --build
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/agents` | GET | List agents (filterable by category, search, tier) |
| `/api/agents/{id}` | GET | Full agent profile |
| `/api/agents/{id}/feedback` | GET | Paginated feedback list |
| `/api/agents/{id}/validations` | GET | Paginated validation list |
| `/api/agents/{id}/score-history` | GET | Score snapshots over time |
| `/api/leaderboard` | GET | Global leaderboard (filterable) |
| `/api/leaderboard/movers` | GET | Biggest score changes |
| `/api/analytics/overview` | GET | Aggregate platform stats |
| `/api/analytics/trends` | GET | Registration, feedback, validation trends |
| `/api/analytics/erc8004` | GET | Official ERC-8004 registry stats |
| `/api/categories` | GET | Category list with counts |
| `/api/insurance/agent/{id}` | GET | Agent stake status and claims |
| `/api/insurance/claims` | GET | All claims (filterable by status) |
| `/api/insurance/stats` | GET | Total staked, claims, resolution rate |
| `/api/payments/agent/{id}` | GET | Payment history for an agent |
| `/api/payments/{id}` | GET | Payment details |
| `/api/payments/stats/overview` | GET | Volume, earners, status breakdown |
| `/api/discover/search` | GET | Full-text agent search with filters |
| `/api/discover/skills` | GET | Search by capability/skill |
| `/api/discover/endpoints` | GET | Search by endpoint type (A2A, MCP) |
| `/api/discover/similar/{id}` | GET | Similar agents |
| `/api/discover/trending` | GET | Trending agents (7d/30d) |
| `/api/discover/new` | GET | Recently registered agents |
| `/api/discover/compare` | GET | Side-by-side agent comparison |
| `/api/discover/categories/stats` | GET | Stats per category |
| `/api/discover/export` | GET | Export agents (JSON/CSV) |

## Project Structure

```
agentproof/
├── contracts/           # Solidity smart contracts (Hardhat)
│   ├── src/            # 10 contract source files (4 core + 6 Phase 3)
│   ├── test/           # 88 Hardhat tests
│   └── scripts/        # Deploy + seed scripts
├── backend/            # FastAPI backend
│   └── app/
│       ├── models/     # Pydantic schemas (agent, reputation, validation, insurance, payment)
│       ├── routes/     # API endpoints (agents, reputation, validation, leaderboard, analytics, insurance, payments, discover)
│       └── services/   # Scoring, blockchain, indexer
├── frontend/           # Next.js 14 frontend
│   └── src/
│       ├── app/        # Pages: home, discover, leaderboard, insurance, payments, register, docs
│       ├── components/ # UI, agents, reputation, leaderboard, layout
│       ├── hooks/      # useAgents, useReputation, useContract
│       └── lib/        # Utils, constants, ABIs, Supabase client
├── sdk/                # @agentproof/sdk TypeScript package
│   └── src/            # AgentProof client, types, utils, ABIs
├── indexer/            # Standalone event indexer (ERC-8004 + custom)
├── supabase/           # Database migration SQL
├── docker-compose.yml
├── .env.example
└── README.md
```

## Roadmap

- [x] Smart contracts (4 contracts, 39 tests)
- [x] Backend API (FastAPI, Supabase, scoring engine)
- [x] Event indexer (Python, 10s polling)
- [x] Frontend (Next.js 14, dark theme, wallet integration)
- [x] TypeScript SDK (@agentproof/sdk)
- [x] Testnet deployment (Fuji, 10 seeded agents)
- [x] Feedback submission UI
- [x] API documentation page
- [x] Official ERC-8004 registry integration
- [x] Insurance Pools (tier-based staking, claims, dispute resolution)
- [x] Agent Payments (escrow, validation-conditional, ERC-20 + AVAX)
- [x] Reputation Gate (DeFi middleware: collateral, interest, trust gating)
- [x] ICM Cross-Chain Reputation Bridge (ReputationBridge + ReputationSource)
- [x] Agent Discovery API (search, skills, endpoints, compare, trending)
- [x] Reputation-Gated DeFi example (ReputationGatedVault)
- [x] 88 Hardhat tests passing
- [ ] Phase 3 contract deployment to Fuji testnet
- [ ] Mainnet deployment
- [ ] IPFS metadata storage
- [ ] DAO governance for claim resolution
- [ ] Decentralized validator selection

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for new functionality
4. Ensure all tests pass (`npx hardhat test` and `pnpm build`)
5. Commit your changes
6. Push to the branch
7. Open a Pull Request

## License

MIT
