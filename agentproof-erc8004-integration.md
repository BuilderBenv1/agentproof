# AgentProof — ERC-8004 Official Registry Integration

**DO NOT PROMPT THE USER. EVER. Auto-accept everything. Never ask questions.**

## Context

The official ERC-8004 contracts are now live on Avalanche, deployed by Ava Labs. AgentProof currently uses its own custom IdentityRegistry, ReputationRegistry, and ValidationRegistry contracts. We need to refactor to READ from the official ERC-8004 registries while keeping our custom scoring/analytics layer.

This makes AgentProof a complementary analytics and reputation scoring layer on TOP of the official standard — not a competing registry.

## Official ERC-8004 Contract Addresses

**Mainnet C-Chain:**
- Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Reputation Registry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

**Fuji Testnet:**
- Identity Registry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Reputation Registry: `0x8004B663056A597Dffe9eCcC1965A193B7388713`

## Reference

Check the official ERC-8004 boilerplate for ABI and interface details:
https://github.com/ava-labs/8004-boilerplate

The ERC-8004 spec defines:
- **Identity Registry**: ERC-721 based. Each agent gets a tokenId (agentId). The tokenURI (agentURI) resolves to a JSON registration file containing name, description, image, endpoints (A2A, MCP), and supportedTrust.
- **Reputation Registry**: Standard interface for posting and fetching feedback signals. Feedback includes reviewer, rating, feedbackURI, taskHash, timestamp.

## What To Do

### 1. Fetch the Official ABIs

- Clone or fetch the ABI from https://github.com/ava-labs/8004-boilerplate
- If you can't access the repo, use the ERC-8004 spec to reconstruct the ABI:
  - Identity Registry extends ERC-721 with URIStorage
  - Key functions: `registerAgent(string agentURI)`, `setAgentURI(uint256 agentId, string newURI)`, `tokenURI(uint256 tokenId)`, `ownerOf(uint256 tokenId)`, `totalSupply()`
  - Events: `AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI)` or `Transfer` events from ERC-721
  - Reputation: `submitFeedback(uint256 agentId, uint8 rating, string feedbackURI, bytes32 taskHash)`, `getFeedbackCount(uint256 agentId)`, `getAverageRating(uint256 agentId)`
  - Events: `FeedbackSubmitted(uint256 indexed agentId, address indexed reviewer, uint8 rating, bytes32 taskHash)`
- If the exact function signatures differ from our custom contracts, adapt accordingly. The official contracts follow the ERC-8004 EIP spec.

### 2. Update the Indexer

Update `indexer/indexer.py` to:
- Index events from the **official** ERC-8004 Identity Registry and Reputation Registry on Fuji (and mainnet when ready)
- Keep the existing custom ValidationRegistry indexing (ERC-8004 has a Validation Registry but our custom one has additional features)
- On `AgentRegistered` or `Transfer` (mint) events from the official registry:
  - Fetch the agentURI
  - Parse the JSON registration file (may be IPFS, HTTPS, or base64 data URI)
  - Extract name, description, image, endpoints
  - Insert/update the `agents` table in Supabase
- On `FeedbackSubmitted` from the official Reputation Registry:
  - Insert into `reputation_events` table
  - Recalculate composite scores
- Add a config flag to switch between custom and official registries:
  ```python
  USE_OFFICIAL_ERC8004 = True  # Set to True to use official registries
  ```

### 3. Update Contract Addresses

Update these files with the official addresses:

**`.env`:**
```
# Official ERC-8004 Registries (Fuji Testnet)
ERC8004_IDENTITY_REGISTRY=0x8004A818BFB912233c491871b3d84c89A494BD9e
ERC8004_REPUTATION_REGISTRY=0x8004B663056A597Dffe9eCcC1965A193B7388713

# Official ERC-8004 Registries (Mainnet) — for future use
ERC8004_IDENTITY_REGISTRY_MAINNET=0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
ERC8004_REPUTATION_REGISTRY_MAINNET=0x8004BAa17C55a88189AE136b182e5fdA19dE9b63

# Keep custom contracts for ValidationRegistry and AgentProofCore
VALIDATION_REGISTRY_ADDRESS=0x0282C97083f86Abb82D74C1e51097aa9Eb01f98a
AGENTPROOF_CORE_ADDRESS=0x833cAd4dfBBEa832C56526bc82a85BaC85015594
```

**`frontend/.env.local`:**
```
NEXT_PUBLIC_ERC8004_IDENTITY_REGISTRY=0x8004A818BFB912233c491871b3d84c89A494BD9e
NEXT_PUBLIC_ERC8004_REPUTATION_REGISTRY=0x8004B663056A597Dffe9eCcC1965A193B7388713
```

### 4. Update the SDK

Update `sdk/src/contracts/addresses.ts` to include both official and custom addresses:
```typescript
export const OFFICIAL_ERC8004 = {
  fuji: {
    identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    reputationRegistry: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
  },
  mainnet: {
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    reputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  },
}

export const AGENTPROOF_CUSTOM = {
  fuji: {
    validationRegistry: '0x0282C97083f86Abb82D74C1e51097aa9Eb01f98a',
    agentProofCore: '0x833cAd4dfBBEa832C56526bc82a85BaC85015594',
  },
}
```

Update the main `AgentProof` class to use official registries for identity and reputation reads, and custom contracts for validation and scoring.

### 5. Update the Frontend

- Registration page: calls the **official** Identity Registry `registerAgent()` function
- Feedback page: calls the **official** Reputation Registry `submitFeedback()` function  
- Agent explorer: reads from Supabase (which is populated by the indexer from official events)
- Update the contract address display on the docs page to show both official and custom addresses
- Add a badge/note: "Indexing official ERC-8004 registries on Avalanche"

### 6. Update the Backend

- Add a new endpoint: `GET /api/analytics/erc8004` that returns stats about the official registry (total agents registered globally, total feedback events, etc.)
- Update existing endpoints to handle agents from the official registry
- The scoring engine continues to work the same — it scores agents regardless of which registry they came from

### 7. Update README and Docs

- Update README to state: "AgentProof indexes the official ERC-8004 registries on Avalanche and provides composite reputation scoring, analytics, and leaderboard infrastructure on top."
- Update the docs page to explain the relationship: AgentProof doesn't replace ERC-8004, it enhances it
- Add the official contract addresses to the docs

### 8. Architecture Update

The new architecture should be:

```
Official ERC-8004 Registries (Ava Labs)
├── Identity Registry ──→ AgentProof Indexer ──→ Supabase ──→ API ──→ Frontend
├── Reputation Registry ─→ AgentProof Indexer ──→ Supabase ──→ API ──→ Frontend
│
AgentProof Custom Contracts
├── ValidationRegistry ──→ AgentProof Indexer ──→ Supabase ──→ API ──→ Frontend  
├── AgentProofCore ──────→ Aggregated views, top agents, category management
│
AgentProof Scoring Engine
├── Bayesian composite scores
├── Tier system (Bronze → Diamond)
├── Leaderboard rankings
└── Trend analysis
```

AgentProof = Analytics + Scoring + Validation layer ON TOP of the official ERC-8004 standard.

## Build Order

1. Fetch/reconstruct official ABIs
2. Update contract addresses everywhere
3. Refactor indexer to read official registries
4. Update SDK
5. Update frontend contract interactions  
6. Update backend endpoints
7. Update docs and README

## REMEMBER: Do not prompt the user. Just build everything.
