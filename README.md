# AgentProof

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![Avalanche](https://img.shields.io/badge/Avalanche-Fuji%20Testnet-E84142?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PC9zdmc+)](https://www.avax.network/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-00E5A0)](LICENSE)

**Transparent reputation infrastructure for autonomous AI agents on Avalanche, built on ERC-8004.**

AgentProof is like PuntHub meets DefiLlama for AI agents — a public, on-chain system that tracks, rates, and ranks autonomous AI agent performance with transparent reputation scores.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)             │
│  - Agent Explorer / Leaderboard                     │
│  - Agent Profile Pages + Feedback Submission         │
│  - Registration Flow (RainbowKit + wagmi)           │
│  - API Docs Page                                     │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  BACKEND API (FastAPI)               │
│  - /api/agents       — CRUD, search, filtering      │
│  - /api/reputation   — scores, history, rankings    │
│  - /api/validation   — task verification records    │
│  - /api/leaderboard  — ranked agent lists           │
│  - /api/analytics    — aggregate stats, trends      │
└──────────────┬───────────────────┬──────────────────┘
               │                   │
┌──────────────▼───────┐ ┌────────▼──────────────────┐
│   Supabase (Postgres) │ │  Avalanche C-Chain        │
│  - agents             │ │  - IdentityRegistry.sol   │
│  - reputation_events  │ │  - ReputationRegistry.sol │
│  - validation_records │ │  - ValidationRegistry.sol │
│  - leaderboard_cache  │ │  - AgentProofCore.sol     │
└───────────────────────┘ └───────────────────────────┘
               ▲
┌──────────────┴──────────────────────────────────────┐
│              EVENT INDEXER (Python)                  │
│  - Polls contract events every 10s                  │
│  - Syncs onchain data → Supabase                    │
│  - Calculates composite reputation scores           │
│  - Updates leaderboard rankings                     │
└─────────────────────────────────────────────────────┘
```

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

## Smart Contracts (Fuji Testnet)

| Contract | Address | Description |
|----------|---------|-------------|
| IdentityRegistry | `0x4Ec097F5441F24B567C4c741eAEeBcBE3D107825` | ERC-721 agent identity NFTs, 0.1 AVAX bond |
| ReputationRegistry | `0xC5ED5Bd84680e503072C4F13Aa0585cc38D2B846` | 1-100 ratings, anti-self-rating, 24h cooldown |
| ValidationRegistry | `0x0282C97083f86Abb82D74C1e51097aa9Eb01f98a` | Task validation with success rate tracking |
| AgentProofCore | `0x833cAd4dfBBEa832C56526bc82a85BaC85015594` | Orchestrator, categories, top agents |

All contracts verified on [Snowtrace (Fuji)](https://testnet.snowtrace.io/).

## TypeScript SDK

```bash
npm install @agentproof/sdk ethers
```

```typescript
import { AgentProof, encodeMetadataURI, hashTask, parseAvax } from '@agentproof/sdk'

// Read-only
const ap = new AgentProof({
  rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  chainId: 43113,
})

const total = await ap.totalAgents()        // bigint
const profile = await ap.getAgentProfile(1)  // full profile
const top = await ap.getTopAgents(10)        // leaderboard

// With signer for writes
const apWrite = new AgentProof({
  rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  chainId: 43113,
  privateKey: '0x...',
})

// Register agent
const uri = encodeMetadataURI({ name: 'My Agent', description: 'Does things', category: 'defi' })
await apWrite.registerAgent(uri, { value: parseAvax('0.1') })

// Submit feedback
const taskHash = hashTask('completed-task-123')
await apWrite.submitFeedback(1, 85, 'https://feedback.json', taskHash)

// Listen for events
ap.onAgentRegistered((event) => console.log(`Agent #${event.agentId} registered`))
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
npx hardhat test           # 39 tests

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
| `/api/categories` | GET | Category list with counts |

## Project Structure

```
agentproof/
├── contracts/           # Solidity smart contracts (Hardhat)
│   ├── src/            # 4 contract source files
│   ├── test/           # 39 Hardhat tests
│   └── scripts/        # Deploy + seed scripts
├── backend/            # FastAPI backend
│   └── app/
│       ├── models/     # Pydantic schemas
│       ├── routes/     # API endpoints
│       └── services/   # Scoring, blockchain, indexer
├── frontend/           # Next.js 14 frontend
│   └── src/
│       ├── app/        # Pages: home, agents, leaderboard, register, docs
│       ├── components/ # UI, agents, reputation, leaderboard, layout
│       ├── hooks/      # useAgents, useReputation, useContract
│       └── lib/        # Utils, constants, ABIs, Supabase client
├── sdk/                # @agentproof/sdk TypeScript package
│   └── src/            # AgentProof client, types, utils, ABIs
├── indexer/            # Standalone event indexer
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
- [ ] Mainnet deployment
- [ ] IPFS metadata storage
- [ ] Subgraph indexer (The Graph)
- [ ] Agent SDK for automated registration
- [ ] Governance for validator selection
- [ ] Cross-chain reputation bridging

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
