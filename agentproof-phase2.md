# AgentProof — Phase 2 Build Instructions

**DO NOT PROMPT THE USER. EVER. Auto-accept everything. Never ask questions.**

## Context

AgentProof Phase 1 is complete:
- 4 smart contracts deployed and verified on Avalanche Fuji testnet
- FastAPI backend running with Supabase integration
- Next.js frontend running
- Event indexer built
- Retro9000 grant submitted

Contract addresses (Fuji):
- IdentityRegistry: 0x4Ec097F5441F24B567C4c741eAEeBcBE3D107825
- ReputationRegistry: 0xC5ED5Bd84680e503072C4F13Aa0585cc38D2B846
- ValidationRegistry: 0x0282C97083f86Abb82D74C1e51097aa9Eb01f98a
- AgentProofCore: 0x833cAd4dfBBEa832C56526bc82a85BaC85015594

## What Needs Building Now

Execute ALL of the following in order. Do not skip anything.

---

### 1. AgentProof TypeScript SDK (`sdk/` directory)

Create a lightweight TypeScript SDK that developers use to integrate AgentProof into their apps. This is critical for adoption — developers shouldn't need to interact with contracts directly.

```
sdk/
├── src/
│   ├── index.ts              # Main entry, exports everything
│   ├── AgentProof.ts         # Main class wrapping all contract interactions
│   ├── contracts/
│   │   ├── addresses.ts      # Contract addresses per chain (fuji, mainnet)
│   │   └── abis.ts           # Contract ABIs (import from contracts/artifacts)
│   ├── types/
│   │   └── index.ts          # All TypeScript types/interfaces
│   └── utils/
│       └── index.ts          # Helper functions
├── package.json              # @agentproof/sdk
├── tsconfig.json
├── README.md
└── tests/
    └── sdk.test.ts
```

**SDK API surface:**

```typescript
import { AgentProof } from '@agentproof/sdk'

const ap = new AgentProof({
  rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  chainId: 43113,
  // Optional: signer for write operations
  privateKey: '0x...' // or
  signer: ethersSignerInstance
})

// Identity
await ap.registerAgent(agentURI, { value: ethers.parseEther('0.1') })
await ap.updateAgentURI(agentId, newURI)
const agent = await ap.getAgent(agentId)
const isRegistered = await ap.isRegistered(address)
const total = await ap.totalAgents()

// Reputation
await ap.submitFeedback(agentId, rating, feedbackURI, taskHash)
const avgRating = await ap.getAverageRating(agentId)
const feedbackCount = await ap.getFeedbackCount(agentId)
const feedback = await ap.getFeedback(agentId, index)

// Validation
await ap.requestValidation(agentId, taskHash, taskURI)
await ap.submitValidation(validationId, isValid, proofURI)
const validation = await ap.getValidation(validationId)

// Aggregated
const profile = await ap.getAgentProfile(agentId)
const topAgents = await ap.getTopAgents(10)

// Events (subscribe to real-time events)
ap.onAgentRegistered((event) => { ... })
ap.onFeedbackSubmitted((event) => { ... })
ap.onValidationSubmitted((event) => { ... })
```

Use ethers.js v6 as the underlying provider. Make it work with both private key and browser signer (MetaMask).

---

### 2. REST API Documentation Page

Add a `/docs` page to the frontend that shows:
- All API endpoints with request/response examples
- Authentication info (currently none for reads)
- Rate limiting info
- Code snippets showing SDK usage
- Interactive "try it" buttons that hit the live API

Style it in the existing dark terminal aesthetic. Use the same JetBrains Mono / Space Grotesk fonts.

---

### 3. Agent Registration Flow — End-to-End Fix

Make sure the full registration flow works:
1. User connects wallet via RainbowKit
2. User fills in agent details (name, description, category, endpoints)
3. Frontend generates agent metadata JSON
4. Frontend stores metadata (for now, base64 encode as data URI — skip IPFS for MVP)
5. Frontend calls IdentityRegistry.registerAgent() with 0.1 AVAX
6. Indexer picks up the AgentRegistered event
7. Agent appears in the explorer and on the leaderboard

Test this end-to-end. Fix any issues.

---

### 4. Feedback Submission Flow

Add a "Rate This Agent" button on agent profile pages:
1. User connects wallet
2. User selects rating (1-100 slider or 1-5 stars mapped to 20-100)
3. User optionally adds a comment (stored as feedbackURI)
4. Frontend calls ReputationRegistry.submitFeedback()
5. Indexer picks up the event
6. Agent's score updates on the profile page

---

### 5. Seed Test Data

Write a script (`scripts/seed-testnet.ts` or `scripts/seed-testnet.js`) that:
1. Registers 10 sample agents with realistic metadata (names like "DeFi Yield Optimizer", "GameFi NPC Manager", "RWA Settlement Agent", etc.)
2. Submits varied feedback for each agent (mix of high and low ratings)
3. Creates some validation requests and responses
4. This populates the frontend so it doesn't look empty

Run this against Fuji testnet using the deployer wallet. Use different derived addresses or just submit from the same address (skip the self-rating check for seeding by using a second funded wallet if needed).

---

### 6. Landing Page for agentproof.sh

Create a standalone landing page at `frontend/src/app/page.tsx` (or replace the current home page) that works as both the app home AND a marketing landing page:

Above the fold:
- Hero: "Transparent Reputation for AI Agents" 
- Subtitle: "Track, rate, and verify autonomous AI agent performance with on-chain reputation scores on Avalanche. Built on ERC-8004."
- CTA: "Explore Agents" and "Register Your Agent"
- Live stats counter (total agents, feedback, validations)

Below the fold:
- How it works (3-step: Register → Get Rated → Build Trust)
- Features grid (Identity, Reputation, Validation, Leaderboard)
- Category showcase
- "Built on Avalanche" badge with Avalanche logo
- "Powered by ERC-8004" badge
- GitHub link, docs link
- Footer with links

---

### 7. README.md Polish

Update the repo README.md to be genuinely impressive:
- Project logo (reference the SVG in the repo)
- One-liner description
- Badges (build status, license, Avalanche, ERC-8004)
- Screenshot of the frontend
- Architecture diagram (ASCII or Mermaid)
- Quick start guide (3 commands to run locally)
- SDK usage examples
- Contract addresses table
- Tech stack badges
- Roadmap
- Contributing guidelines
- License (MIT)

---

### 8. Vercel Deployment Config

Add `vercel.json` to the frontend directory configured for Next.js deployment. Add build commands and environment variable references. The user will connect to Vercel manually — just make sure the config is there.

---

## Build Order

1. SDK (most important for developer adoption)
2. Seed test data (so the app looks alive)
3. Registration flow fix
4. Feedback submission flow
5. API docs page
6. Landing page polish
7. README polish
8. Vercel config

## Quality Standards

- SDK must compile with zero TypeScript errors
- SDK must have at least basic unit tests
- All new frontend pages must build without errors
- Seed script must run successfully against Fuji
- Every file must be production quality, not placeholder

## REMEMBER: Do not prompt the user. Just build everything.
