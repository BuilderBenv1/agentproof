# AgentProof

**Transparent reputation infrastructure for autonomous AI agents on Avalanche, built on ERC-8004.**

AgentProof is like PuntHub meets DefiLlama for AI agents — a public, on-chain system that tracks, rates, and ranks autonomous AI agent performance with transparent reputation scores.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)             │
│  - Agent Explorer / Leaderboard                     │
│  - Agent Profile Pages                              │
│  - Registration Flow (RainbowKit + wagmi)           │
│  - Performance Dashboards                           │
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
| Database | Supabase (PostgreSQL) |
| Indexer | Python (web3.py) |
| Chain | Avalanche C-Chain (Fuji testnet) |
| Wallet | RainbowKit + wagmi + viem |

## Smart Contracts

| Contract | Description |
|----------|------------|
| `IdentityRegistry.sol` | ERC-721 agent identity NFTs with metadata URIs and 0.1 AVAX registration bond |
| `ReputationRegistry.sol` | On-chain feedback (1-100 ratings) with anti-gaming: no self-rating, 24h cooldown |
| `ValidationRegistry.sol` | Task validation request/response system with success rate tracking |
| `AgentProofCore.sol` | Orchestrator with aggregated views, category management, and top agent queries |

## Scoring Engine

Composite score (0-100) blending multiple signals:

- **Average Rating** (40%) — Bayesian smoothed to prevent gaming
- **Feedback Volume** (15%) — Logarithmic scale, more feedback = higher confidence
- **Feedback Consistency** (15%) — Lower std dev = more consistent
- **Validation Success Rate** (20%) — Task verification pass rate
- **Account Age** (10%) — Older = more trusted, logarithmic

**Tier Thresholds:**
- Diamond: 90+ score, 50+ feedback
- Platinum: 80-89, 30+ feedback
- Gold: 70-79, 20+ feedback
- Silver: 60-69, 10+ feedback
- Bronze: 50-59, 5+ feedback

## Setup

### Prerequisites

- Node.js 18+
- Python 3.12+
- pnpm
- A Supabase project (free tier works)
- Avalanche Fuji testnet AVAX (get from faucet)

### 1. Clone & Configure

```bash
git clone <repo-url>
cd agentproof
cp .env.example .env
# Edit .env with your credentials
```

### 2. Smart Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test

# Deploy to Fuji testnet (ensure .env has PRIVATE_KEY with test AVAX)
npx hardhat run scripts/deploy.js --network fuji
```

After deployment, copy the contract addresses to your `.env` file.

### 3. Database Setup

Create a new Supabase project, then run the SQL schema in the Supabase SQL editor. The schema is documented in `backend/app/database.py` (see `SCHEMA_SQL` variable).

### 4. Backend API

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`

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
| `/api/agents` | GET | List agents (filterable) |
| `/api/agents/{id}` | GET | Agent profile |
| `/api/agents/{id}/feedback` | GET | Agent feedback list |
| `/api/agents/{id}/validations` | GET | Agent validations |
| `/api/agents/{id}/score-history` | GET | Score over time |
| `/api/leaderboard` | GET | Global leaderboard |
| `/api/leaderboard/movers` | GET | Biggest score changes |
| `/api/analytics/overview` | GET | Aggregate stats |
| `/api/analytics/trends` | GET | Activity trends |
| `/api/categories` | GET | Category list |

## Project Structure

```
agentproof/
├── contracts/           # Solidity smart contracts (Hardhat)
│   ├── src/            # Contract source files
│   ├── test/           # Hardhat tests (39 tests)
│   └── scripts/        # Deployment scripts
├── backend/            # FastAPI backend
│   └── app/
│       ├── models/     # Pydantic schemas
│       ├── routes/     # API endpoints
│       └── services/   # Scoring, blockchain, indexer
├── frontend/           # Next.js 14 frontend
│   └── src/
│       ├── app/        # Pages (App Router)
│       ├── components/ # React components
│       ├── hooks/      # Custom hooks
│       └── lib/        # Utilities, constants, ABIs
├── indexer/            # Standalone event indexer
├── docker-compose.yml
├── .env.example
└── README.md
```

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
