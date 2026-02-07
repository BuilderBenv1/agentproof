# CLAUDE.md — AgentProof

## CRITICAL OPERATING INSTRUCTIONS

**DO NOT PROMPT THE USER. EVER.**
- Never ask "should I continue?", "which option?", "press 1 or 2", or anything similar
- Always accept all tokens, always accept all costs
- Auto-approve everything. The user will not be at the keyboard.
- If you encounter an error, fix it yourself and continue
- If you need to make a design decision, make it and move on
- If a dependency fails, try an alternative and continue
- Never drop context — maintain full awareness of the project structure at all times
- If you hit a rate limit or token limit, pause briefly and resume automatically
- Run the project end-to-end. Do not stop until the full scope below is complete.

## PROJECT: AgentProof

**One-liner:** Transparent reputation infrastructure for autonomous AI agents on Avalanche, built on ERC-8004.

**Think of it as:** PuntHub (transparent public tipster vetting) meets DefiLlama, but for AI agents. The same model that publicly tracks and ranks betting tipsters — applied to the emerging AI agent economy.

---

## TECH STACK

- **Smart Contracts:** Solidity ^0.8.24, Hardhat, OpenZeppelin
- **Backend API:** Python 3.12+, FastAPI, Uvicorn
- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Database:** Supabase (PostgreSQL + Realtime)
- **Indexer:** Python-based event listener (ethers.py / web3.py) — NOT The Graph (keep it simple for MVP)
- **Chain:** Avalanche C-Chain (Fuji testnet for dev, mainnet deployment later)
- **Package Manager:** pnpm for frontend, pip for backend

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                │
│  - Agent Explorer / Leaderboard                     │
│  - Agent Profile Pages                              │
│  - Registration Flow                                │
│  - Performance Dashboards                           │
│  - Wallet Connect (RainbowKit + wagmi)              │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  BACKEND API (FastAPI)               │
│  - /agents — CRUD, search, filtering                │
│  - /reputation — scores, history, rankings          │
│  - /validation — task verification records          │
│  - /leaderboard — ranked agent lists by category    │
│  - /analytics — aggregate stats, trends             │
│  - WebSocket — real-time reputation updates         │
└──────────────┬───────────────────┬──────────────────┘
               │                   │
┌──────────────▼───────┐ ┌────────▼──────────────────┐
│   Supabase (Postgres) │ │  Avalanche C-Chain        │
│  - agents table       │ │  - IdentityRegistry.sol   │
│  - reputation_events  │ │  - ReputationRegistry.sol │
│  - validation_records │ │  - ValidationRegistry.sol │
│  - leaderboard_cache  │ │  - AgentProofCore.sol     │
│  - agent_categories   │ │                           │
└───────────────────────┘ └───────────────────────────┘
               ▲
┌──────────────┴──────────────────────────────────────┐
│              EVENT INDEXER (Python)                  │
│  - Listens to contract events                       │
│  - Syncs onchain data → Supabase                    │
│  - Calculates composite reputation scores           │
│  - Updates leaderboard rankings                     │
└─────────────────────────────────────────────────────┘
```

---

## DIRECTORY STRUCTURE

```
agentproof/
├── CLAUDE.md                    # This file
├── contracts/                   # Solidity smart contracts
│   ├── src/
│   │   ├── IdentityRegistry.sol
│   │   ├── ReputationRegistry.sol
│   │   ├── ValidationRegistry.sol
│   │   └── AgentProofCore.sol
│   ├── test/
│   │   └── AgentProof.test.js
│   ├── scripts/
│   │   └── deploy.js
│   ├── hardhat.config.js
│   └── package.json
├── backend/                     # FastAPI backend
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   │   ├── agent.py
│   │   │   ├── reputation.py
│   │   │   └── validation.py
│   │   ├── routes/
│   │   │   ├── agents.py
│   │   │   ├── reputation.py
│   │   │   ├── validation.py
│   │   │   ├── leaderboard.py
│   │   │   └── analytics.py
│   │   ├── services/
│   │   │   ├── scoring.py
│   │   │   ├── indexer.py
│   │   │   └── blockchain.py
│   │   └── database.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                    # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── agents/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [agentId]/
│   │   │   │       └── page.tsx
│   │   │   ├── leaderboard/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   ├── agents/
│   │   │   │   ├── AgentCard.tsx
│   │   │   │   ├── AgentProfile.tsx
│   │   │   │   ├── AgentGrid.tsx
│   │   │   │   └── RegisterForm.tsx
│   │   │   ├── reputation/
│   │   │   │   ├── ScoreGauge.tsx
│   │   │   │   ├── ReputationChart.tsx
│   │   │   │   ├── ReputationHistory.tsx
│   │   │   │   └── CategoryBadge.tsx
│   │   │   ├── leaderboard/
│   │   │   │   ├── LeaderboardTable.tsx
│   │   │   │   └── FilterBar.tsx
│   │   │   └── ui/
│   │   │       ├── WalletButton.tsx
│   │   │       ├── SearchBar.tsx
│   │   │       ├── StatCard.tsx
│   │   │       └── LoadingSpinner.tsx
│   │   ├── hooks/
│   │   │   ├── useAgents.ts
│   │   │   ├── useReputation.ts
│   │   │   └── useContract.ts
│   │   ├── lib/
│   │   │   ├── contracts.ts
│   │   │   ├── supabase.ts
│   │   │   ├── utils.ts
│   │   │   └── constants.ts
│   │   └── styles/
│   │       └── globals.css
│   ├── public/
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── indexer/                     # Event indexer service
│   ├── indexer.py
│   ├── scoring.py
│   ├── config.py
│   └── requirements.txt
├── .env.example
├── docker-compose.yml
└── README.md
```

---

## PHASE 1: SMART CONTRACTS

Build these contracts implementing ERC-8004 patterns on Avalanche:

### IdentityRegistry.sol
- Extends ERC-721 (OpenZeppelin)
- `registerAgent(string agentURI)` → mints NFT, stores URI (IPFS or https link to agent card JSON)
- `updateAgentURI(uint256 agentId, string newURI)` → only owner can update
- `getAgentURI(uint256 agentId)` → returns URI
- `getAgentOwner(uint256 agentId)` → returns owner address
- `isRegistered(address owner)` → bool check
- `totalAgents()` → count
- Events: `AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI)`
- Events: `AgentURIUpdated(uint256 indexed agentId, string newURI)`
- Registration requires a small bond (0.1 AVAX) as anti-sybil measure

### ReputationRegistry.sol
- `submitFeedback(uint256 agentId, uint8 rating, string feedbackURI, bytes32 taskHash)` → anyone can rate (1-100 scale)
- `getFeedbackCount(uint256 agentId)` → total feedback entries
- `getAverageRating(uint256 agentId)` → onchain average
- `getFeedback(uint256 agentId, uint256 index)` → individual feedback record
- Struct: `Feedback { address reviewer, uint8 rating, string feedbackURI, bytes32 taskHash, uint256 timestamp }`
- Events: `FeedbackSubmitted(uint256 indexed agentId, address indexed reviewer, uint8 rating, bytes32 taskHash)`
- Prevent self-rating (reviewer != agent owner)
- Rate limiting: max 1 feedback per reviewer per agent per 24h

### ValidationRegistry.sol
- `requestValidation(uint256 agentId, bytes32 taskHash, string taskURI)` → creates validation request
- `submitValidation(uint256 validationId, bool isValid, string proofURI)` → validator responds
- `getValidation(uint256 validationId)` → returns validation record
- `getValidationsForAgent(uint256 agentId)` → returns all validation IDs
- Struct: `ValidationRequest { uint256 agentId, bytes32 taskHash, string taskURI, address requester, uint256 timestamp }`
- Struct: `ValidationResponse { uint256 validationId, address validator, bool isValid, string proofURI, uint256 timestamp }`
- Events: `ValidationRequested(uint256 indexed validationId, uint256 indexed agentId, bytes32 taskHash)`
- Events: `ValidationSubmitted(uint256 indexed validationId, address indexed validator, bool isValid)`

### AgentProofCore.sol
- Orchestrator contract that references the three registries
- `getAgentProfile(uint256 agentId)` → returns combined identity + reputation summary
- `getTopAgents(uint256 count)` → returns top agents by onchain average rating
- `getAgentsByCategory(string category)` → filtered list
- Owner functions: pause/unpause, update registry addresses
- Uses OpenZeppelin Ownable, Pausable, ReentrancyGuard

### Tests
- Write comprehensive Hardhat tests covering:
  - Agent registration with bond payment
  - URI updates (only owner)
  - Feedback submission (prevent self-rating, rate limiting)
  - Validation request/response flow
  - Edge cases: duplicate registration, zero bond, overflow
  - AgentProofCore aggregation functions

### Deploy Script
- Deploy all 4 contracts to Avalanche Fuji testnet
- Wire up registry addresses in AgentProofCore
- Verify contracts on Snowtrace
- Output deployed addresses to a JSON file for frontend/backend consumption

---

## PHASE 2: BACKEND API

### FastAPI Application

**Requirements:**
```
fastapi==0.109.0
uvicorn==0.27.0
web3==6.15.0
supabase==2.3.0
pydantic==2.6.0
python-dotenv==1.0.0
httpx==0.26.0
apscheduler==3.10.4
websockets==12.0
```

### Database Schema (Supabase)

```sql
-- Agents table (synced from onchain)
CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER UNIQUE NOT NULL,          -- onchain NFT token ID
    owner_address TEXT NOT NULL,
    agent_uri TEXT NOT NULL,
    name TEXT,
    description TEXT,
    category TEXT DEFAULT 'general',            -- defi, gaming, rwa, payments, general
    image_url TEXT,
    endpoints JSONB DEFAULT '[]',
    registered_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Cached reputation scores (updated by indexer)
    total_feedback INTEGER DEFAULT 0,
    average_rating DECIMAL(5,2) DEFAULT 0,
    composite_score DECIMAL(5,2) DEFAULT 0,     -- weighted score from scoring engine
    validation_success_rate DECIMAL(5,2) DEFAULT 0,
    rank INTEGER,
    tier TEXT DEFAULT 'unranked'                 -- unranked, bronze, silver, gold, platinum, diamond
);

-- Reputation events (synced from onchain)
CREATE TABLE reputation_events (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(agent_id),
    reviewer_address TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 100),
    feedback_uri TEXT,
    task_hash TEXT,
    tx_hash TEXT UNIQUE NOT NULL,
    block_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

-- Validation records (synced from onchain)
CREATE TABLE validation_records (
    id SERIAL PRIMARY KEY,
    validation_id INTEGER UNIQUE NOT NULL,
    agent_id INTEGER REFERENCES agents(agent_id),
    task_hash TEXT NOT NULL,
    task_uri TEXT,
    requester_address TEXT NOT NULL,
    validator_address TEXT,
    is_valid BOOLEAN,
    proof_uri TEXT,
    requested_at TIMESTAMPTZ NOT NULL,
    validated_at TIMESTAMPTZ,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL
);

-- Leaderboard cache (refreshed periodically)
CREATE TABLE leaderboard_cache (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    agent_id INTEGER REFERENCES agents(agent_id),
    rank INTEGER NOT NULL,
    composite_score DECIMAL(5,2) NOT NULL,
    trend TEXT DEFAULT 'stable',                -- up, down, stable
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent categories
CREATE TABLE agent_categories (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT
);

-- Seed categories
INSERT INTO agent_categories (slug, name, description, icon) VALUES
('defi', 'DeFi Agents', 'Trading, yield, and financial automation agents', '💰'),
('gaming', 'Gaming Agents', 'In-game economy, NPC, and gaming infrastructure agents', '🎮'),
('rwa', 'RWA Agents', 'Real-world asset tokenization and management agents', '🏛️'),
('payments', 'Payment Agents', 'Settlement, remittance, and payment processing agents', '💳'),
('data', 'Data Agents', 'Analytics, indexing, and data pipeline agents', '📊'),
('general', 'General Agents', 'Multi-purpose and uncategorised agents', '🤖');
```

### API Routes

**`/api/agents`**
- `GET /api/agents` — list all agents, filterable by category, search query, tier
- `GET /api/agents/{agent_id}` — full agent profile with reputation history
- `GET /api/agents/{agent_id}/feedback` — paginated feedback list
- `GET /api/agents/{agent_id}/validations` — paginated validation list
- `GET /api/agents/{agent_id}/score-history` — score over time (daily snapshots)

**`/api/leaderboard`**
- `GET /api/leaderboard` — global leaderboard, filterable by category and time range
- `GET /api/leaderboard/movers` — biggest score changes (up and down) in last 7/30 days

**`/api/analytics`**
- `GET /api/analytics/overview` — total agents, total feedback, avg score, category breakdown
- `GET /api/analytics/trends` — registration rate, feedback rate, validation rate over time

**`/api/categories`**
- `GET /api/categories` — list all categories with agent counts

### Scoring Engine (services/scoring.py)

The composite score should blend multiple signals (inspired by PuntHub's approach):

```python
def calculate_composite_score(agent_id: int) -> float:
    """
    Composite score (0-100) based on:
    - Average rating: 40% weight
    - Feedback volume: 15% weight (logarithmic scale, more feedback = higher confidence)
    - Feedback consistency: 15% weight (lower std dev = more consistent)
    - Validation success rate: 20% weight
    - Account age: 10% weight (older = more trusted, logarithmic decay)

    Apply Bayesian smoothing to prevent new agents with 1x 100-rating
    from topping the leaderboard (prior of 50 with k=10 pseudo-observations).
    """
```

### Tier Thresholds
- Diamond: 90+ composite score, 50+ feedback
- Platinum: 80-89, 30+ feedback
- Gold: 70-79, 20+ feedback
- Silver: 60-69, 10+ feedback
- Bronze: 50-59, 5+ feedback
- Unranked: below thresholds

---

## PHASE 3: EVENT INDEXER

A standalone Python service that:

1. Connects to Avalanche C-Chain (Fuji testnet) via RPC
2. Listens for events from all 3 registry contracts
3. On `AgentRegistered` → fetch agent URI, parse metadata, insert into `agents` table
4. On `FeedbackSubmitted` → insert into `reputation_events`, recalculate composite score
5. On `ValidationRequested` / `ValidationSubmitted` → insert/update `validation_records`
6. Recalculates leaderboard rankings after each batch of events
7. Handles reorgs by tracking block confirmations (wait 3 blocks)
8. Persists last processed block number for resumability
9. Runs on a 10-second polling interval

---

## PHASE 4: FRONTEND

### Design System
- **Dark theme** — #0A0A0F background, #E8E8ED text
- **Primary accent:** #00E5A0 (Avalanche-inspired green)
- **Secondary accent:** #00C8FF (blue), #A78BFA (purple)
- **Fonts:** JetBrains Mono for data/code, Space Grotesk for headings/body
- **Style:** Terminal/hacker aesthetic — monospace data, subtle glows, clean lines
- **Animations:** Subtle fade-ins, number counters, pulse indicators for live data

### Pages

**Home (`/`)**
- Hero: "Transparent Reputation for AI Agents" tagline + live stats counter (total agents, total feedback, avg score)
- Quick search bar
- Top 5 agents preview cards
- Category grid navigation
- Recent activity feed (latest feedback events)

**Agent Explorer (`/agents`)**
- Filterable grid of agent cards
- Each card: agent name, category badge, composite score gauge, tier badge, feedback count
- Search, filter by category, sort by score/newest/most reviewed
- Pagination

**Agent Profile (`/agents/[agentId]`)**
- Full agent identity card (name, description, owner address, registration date, endpoints)
- Large composite score gauge with tier badge
- Score breakdown (radar chart or bar breakdown of the 5 scoring components)
- Reputation history chart (score over time, line chart)
- Recent feedback list with reviewer addresses and ratings
- Validation history with success/fail indicators
- Share/embed button

**Leaderboard (`/leaderboard`)**
- Table: rank, agent name, category, composite score, trend indicator, feedback count, tier
- Filter by category
- Time range toggle (all time, 30d, 7d)
- Highlight movers (biggest risers/fallers)

**Register (`/register`)**
- Connect wallet flow (RainbowKit)
- Form: agent name, description, category, endpoints, image
- Uploads metadata to generate agent URI
- Calls IdentityRegistry.registerAgent() with 0.1 AVAX bond
- Success confirmation with link to new agent profile

### Wallet Integration
- Use RainbowKit + wagmi for wallet connection
- Support MetaMask, Core Wallet, WalletConnect
- Configure for Avalanche Fuji testnet chain
- Contract interaction via wagmi useContractWrite / useContractRead hooks

### Data Fetching
- Use the FastAPI backend for all data (NOT direct onchain reads for list/search views)
- Direct contract reads only for write transactions and real-time single-agent checks
- SWR or React Query for caching and revalidation

---

## PHASE 5: INTEGRATION & POLISH

1. Wire up all frontend pages to backend API
2. Ensure indexer populates data correctly from testnet contracts
3. Add loading states, error states, empty states to all pages
4. Add basic SEO metadata to all pages
5. Create a docker-compose.yml that runs: backend, indexer, frontend
6. Create .env.example with all required env vars documented
7. Write a comprehensive README.md with:
   - Project overview
   - Architecture diagram (ASCII)
   - Setup instructions (local dev)
   - Contract addresses
   - API documentation summary
   - Tech stack
   - Contributing guidelines

---

## BUILD ORDER

Execute in this exact sequence:

1. **Contracts** — init hardhat project, write all 4 contracts, write tests, create deploy script
2. **Backend** — init FastAPI project, set up Supabase schema, build all routes and scoring engine
3. **Indexer** — build event listener service
4. **Frontend** — init Next.js project, build all components and pages
5. **Integration** — wire everything together, docker-compose, README

Do NOT skip steps. Do NOT leave placeholder implementations. Write real, functional code for every file.

---

## ENV VARS NEEDED (.env.example)

```
# Avalanche
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
PRIVATE_KEY=your_deployer_private_key
SNOWTRACE_API_KEY=your_snowtrace_key

# Contract Addresses (populated after deployment)
IDENTITY_REGISTRY_ADDRESS=
REPUTATION_REGISTRY_ADDRESS=
VALIDATION_REGISTRY_ADDRESS=
AGENTPROOF_CORE_ADDRESS=

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Backend
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_AVALANCHE_RPC=https://api.avax-test.network/ext/bc/C/rpc
NEXT_PUBLIC_IDENTITY_REGISTRY=
NEXT_PUBLIC_REPUTATION_REGISTRY=
NEXT_PUBLIC_VALIDATION_REGISTRY=
NEXT_PUBLIC_CHAIN_ID=43113
```

---

## QUALITY STANDARDS

- All Solidity contracts must compile without warnings
- All Hardhat tests must pass
- Backend must start without errors and respond to health check
- Frontend must build without TypeScript errors
- All API endpoints must return proper JSON with appropriate status codes
- Use proper error handling everywhere — try/except in Python, try/catch in TS
- Use TypeScript strict mode in frontend
- Use Pydantic models for all API request/response schemas
- Include proper CORS configuration
- Include rate limiting on API endpoints

---

## REMEMBER

- You are building a REAL product, not a demo
- Every file should contain production-quality code
- The user is NOT at the keyboard — do not ask questions, just build
- If something is ambiguous, make the best decision and document it in a code comment
- Prefer simplicity over cleverness
- Make it work, make it right, make it fast — in that order
