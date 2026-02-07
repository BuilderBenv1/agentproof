# AgentProof — Phase 3: ERC-8004 Ecosystem Expansion

**DO NOT PROMPT THE USER. EVER. Auto-accept everything. Never ask questions.**

## Context

AgentProof Phase 1 (core contracts, backend, frontend) and Phase 2 (SDK, seed data, docs, landing page) are complete. The official ERC-8004 integration is being wired up. Now we're expanding AgentProof into a full ERC-8004 ecosystem platform on Avalanche.

This phase builds 5 new modules. Each one fills a gap nobody else has built yet in the ERC-8004 ecosystem. Execute ALL of them in order.

Contract addresses (Fuji):
- IdentityRegistry (custom): 0x4Ec097F5441F24B567C4c741eAEeBcBE3D107825
- ReputationRegistry (custom): 0xC5ED5Bd84680e503072C4F13Aa0585cc38D2B846
- ValidationRegistry (custom): 0x0282C97083f86Abb82D74C1e51097aa9Eb01f98a
- AgentProofCore: 0x833cAd4dfBBEa832C56526bc82a85BaC85015594
- ERC-8004 Official Identity (Fuji): 0x8004A818BFB912233c491871b3d84c89A494BD9e
- ERC-8004 Official Reputation (Fuji): 0x8004B663056A597Dffe9eCcC1965A193B7388713

---

## MODULE 1: Agent Insurance Pools

### Concept
Agents stake collateral proportional to their reputation tier. When an agent fails a validated task, the counterparty claims compensation from the pool. Higher reputation = lower required stake. This creates economic skin-in-the-game for agents.

### Smart Contract: `InsurancePool.sol`

Location: `contracts/src/InsurancePool.sol`

```solidity
// Key functionality:

// Agent staking
function stakeForAgent(uint256 agentId) external payable
// - Agent owner stakes AVAX as collateral
// - Minimum stake varies by tier:
//   Unranked: 1 AVAX, Bronze: 0.5 AVAX, Silver: 0.3 AVAX,
//   Gold: 0.2 AVAX, Platinum: 0.1 AVAX, Diamond: 0.05 AVAX
// - Stake is locked while agent is active
// - Emits AgentStaked(agentId, amount, tier)

function unstake(uint256 agentId) external
// - Only agent owner
// - 7 day cooldown period after requesting unstake
// - Cannot unstake if there are pending claims
// - Emits AgentUnstaked(agentId, amount)

// Claims
function fileClaim(uint256 agentId, uint256 validationId, uint256 amount, string calldata evidenceURI) external
// - Anyone can file a claim against a staked agent
// - Must reference a failed validation (isValid == false in ValidationRegistry)
// - Claim amount cannot exceed agent's total stake
// - Creates a pending claim with 48h dispute window
// - Emits ClaimFiled(claimId, agentId, claimant, amount)

function disputeClaim(uint256 claimId, string calldata disputeURI) external
// - Only agent owner can dispute within 48h window
// - Extends resolution to require arbitration
// - Emits ClaimDisputed(claimId)

function resolveClaim(uint256 claimId, bool inFavorOfClaimant) external onlyOwner
// - For MVP, contract owner resolves disputes
// - Future: DAO governance or decentralised arbitration
// - If in favor: transfers claim amount from agent's stake to claimant
// - If not: claim is dismissed, stake remains
// - Emits ClaimResolved(claimId, inFavorOfClaimant, amount)

// Views
function getAgentStake(uint256 agentId) external view returns (uint256 stakedAmount, uint256 tier, bool isStaked)
function getMinimumStake(string calldata tier) external pure returns (uint256)
function getClaim(uint256 claimId) external view returns (Claim memory)
function getAgentClaims(uint256 agentId) external view returns (uint256[] memory claimIds)
function isInsured(uint256 agentId) external view returns (bool)

// Structs
struct Claim {
    uint256 claimId;
    uint256 agentId;
    address claimant;
    uint256 amount;
    uint256 validationId;
    string evidenceURI;
    string disputeURI;
    ClaimStatus status; // Pending, Disputed, Approved, Rejected
    uint256 filedAt;
    uint256 resolvedAt;
}
```

### Tests
Write comprehensive tests for InsurancePool.sol:
- Staking with correct tier minimums
- Staking below minimum reverts
- Unstake with cooldown period
- Filing claims against failed validations
- Dispute flow
- Claim resolution (both outcomes)
- Cannot unstake with pending claims
- Edge cases

### Backend Integration
- Add `insurance` routes to FastAPI:
  - `GET /api/insurance/agent/{agent_id}` — stake status, claims history
  - `GET /api/insurance/claims` — all claims, filterable by status
  - `GET /api/insurance/stats` — total staked, total claims, resolution rate
- Add `insurance_stakes` and `insurance_claims` tables to Supabase
- Update indexer to track InsurancePool events

### Frontend
- Add insurance badge to agent cards ("Insured ✓" with stake amount)
- Add insurance tab on agent profile page showing stake details and claims
- Add insurance overview page at `/insurance`

---

## MODULE 2: x402 Payment Integration

### Concept
Enable agent-to-agent payments using the x402 protocol. Agents can hire other agents, pay for services, and settle based on validation results. Payments are conditional — "pay only if the task passes validation."

### Smart Contract: `AgentPayments.sol`

Location: `contracts/src/AgentPayments.sol`

```solidity
// Key functionality:

// Create a payment intent (escrow)
function createPayment(
    uint256 fromAgentId,
    uint256 toAgentId,
    uint256 amount,
    address token,        // USDC, USDT, or AVAX (address(0))
    bytes32 taskHash,
    bool requiresValidation
) external payable returns (uint256 paymentId)
// - Locks funds in escrow
// - If requiresValidation is true, payment only releases after successful validation
// - If false, releases after toAgent confirms task completion
// - Emits PaymentCreated(paymentId, fromAgentId, toAgentId, amount, token)

// Release payment (after validation or confirmation)
function releasePayment(uint256 paymentId) external
// - If requiresValidation: checks ValidationRegistry for matching taskHash with isValid == true
// - If not: only fromAgent or toAgent can trigger after confirmation
// - Transfers funds from escrow to toAgent's owner address
// - Emits PaymentReleased(paymentId, amount)

// Refund (if validation fails or timeout)
function refundPayment(uint256 paymentId) external
// - If validation shows isValid == false, fromAgent can claim refund
// - Also auto-refunds after 7 day timeout if no validation submitted
// - Emits PaymentRefunded(paymentId, amount)

// Cancel (mutual agreement)
function cancelPayment(uint256 paymentId) external
// - Both parties must agree (2-step: request + confirm)
// - Returns funds to fromAgent
// - Emits PaymentCancelled(paymentId)

// Views
function getPayment(uint256 paymentId) external view returns (Payment memory)
function getAgentPayments(uint256 agentId) external view returns (uint256[] memory)
function getAgentEarnings(uint256 agentId) external view returns (uint256 totalEarned, uint256 totalPaid)

// Structs
struct Payment {
    uint256 paymentId;
    uint256 fromAgentId;
    uint256 toAgentId;
    uint256 amount;
    address token;
    bytes32 taskHash;
    bool requiresValidation;
    PaymentStatus status; // Escrowed, Released, Refunded, Cancelled
    uint256 createdAt;
    uint256 resolvedAt;
}

// Protocol fee: 0.5% on releases (sent to contract owner/treasury)
```

### ERC-20 Support
- Support USDC and USDT (standard ERC-20 tokens on Avalanche)
- Support native AVAX payments (msg.value with address(0) as token)
- Use SafeERC20 from OpenZeppelin for token transfers

### Tests
- Create payment with AVAX
- Create payment with ERC20 (mock USDC)
- Release after successful validation
- Refund after failed validation
- Timeout refund after 7 days
- Cancel flow (mutual agreement)
- Protocol fee collection
- Edge cases: double release, unauthorized refund, etc.

### Backend Integration
- Add `payments` routes:
  - `GET /api/payments/agent/{agent_id}` — payment history
  - `GET /api/payments/{payment_id}` — payment details
  - `GET /api/payments/stats` — total volume, avg payment, top earners
- Add `payments` table to Supabase
- Update indexer for payment events
- Update scoring engine: agents with more successful paid tasks get a scoring bonus

### Frontend
- Add "Hire Agent" button on agent profiles (creates payment + task)
- Add payments tab on agent profile showing earnings and payment history
- Add payments dashboard at `/payments`
- Show agent earnings on leaderboard

---

## MODULE 3: Agent Discovery API & Explorer

### Concept
A powerful search and discovery engine for AI agents. Index all ERC-8004 agents on Avalanche, parse their registration files, and provide rich search capabilities. Think "Google for AI agents."

### Backend — Enhanced Discovery Endpoints

Add to FastAPI:

```python
# Full-text search across agent names, descriptions, capabilities, endpoints
GET /api/discover/search?q=defi+yield&category=defi&tier=gold&min_score=70&has_insurance=true&sort=score

# Search by capability/skill
GET /api/discover/skills?skill=data_analysis&chain=avalanche

# Search by endpoint type (A2A, MCP)
GET /api/discover/endpoints?type=mcp&version=2025-06-18

# Similar agents (based on category, skills, score range)
GET /api/discover/similar/{agent_id}

# Trending agents (biggest score increases in last 7/30 days)
GET /api/discover/trending?period=7d

# New agents (recently registered)
GET /api/discover/new?limit=20

# Agent comparison (side-by-side)
GET /api/discover/compare?agents=1,5,12

# Agent statistics by category
GET /api/discover/categories/stats

# Export agent data (JSON, CSV)
GET /api/discover/export?format=json&category=defi
```

### Supabase Schema Additions

```sql
-- Full-text search index
ALTER TABLE agents ADD COLUMN search_vector tsvector;
CREATE INDEX idx_agents_search ON agents USING gin(search_vector);

-- Agent capabilities (extracted from registration file)
CREATE TABLE agent_capabilities (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(agent_id),
    capability TEXT NOT NULL,
    UNIQUE(agent_id, capability)
);
CREATE INDEX idx_capabilities_capability ON agent_capabilities(capability);

-- Agent endpoints (extracted from registration file)
CREATE TABLE agent_endpoints (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(agent_id),
    endpoint_type TEXT NOT NULL,  -- 'a2a', 'mcp', 'rest', etc.
    endpoint_url TEXT NOT NULL,
    version TEXT,
    UNIQUE(agent_id, endpoint_type)
);
CREATE INDEX idx_endpoints_type ON agent_endpoints(endpoint_type);
```

### Indexer Enhancement
Update the indexer to:
1. When an agent registers, fetch and parse the agentURI JSON
2. Extract capabilities/skills from the registration file
3. Extract endpoint information (A2A, MCP endpoints)
4. Populate `agent_capabilities` and `agent_endpoints` tables
5. Build the full-text search vector from name + description + capabilities
6. Handle various URI schemes: IPFS (ipfs://), HTTPS, base64 data URIs

### Frontend — Discovery Page

Create `/discover` page with:
- Large search bar with autocomplete
- Filter sidebar: category, tier, insured status, endpoint type, min score
- Results grid with agent cards
- Sort options: relevance, score, newest, most reviewed, most earned
- Agent comparison tool (select 2-3 agents, see side-by-side stats)
- Trending section showing rising agents
- Category stats overview

---

## MODULE 4: Cross-Chain Reputation via ICM

### Concept
Make agent reputation portable across Avalanche L1s using Interchain Messaging (ICM). An agent with a Gold reputation on C-Chain should be recognised as Gold on The Grotto, Henesys, or any other Avalanche L1.

### Smart Contract: `ReputationBridge.sol`

Location: `contracts/src/ReputationBridge.sol`

```solidity
// This contract sits on each Avalanche L1 that wants to consume AgentProof reputation

// Import Teleporter/ICM interfaces
import "@teleporter/ITeleporterMessenger.sol";
import "@teleporter/ITeleporterReceiver.sol";

contract ReputationBridge is ITeleporterReceiver {

    ITeleporterMessenger public teleporterMessenger;
    bytes32 public cChainBlockchainID;
    address public cChainReputationSource;

    // Cached reputation data from C-Chain
    mapping(uint256 => CachedReputation) public reputationCache;

    struct CachedReputation {
        uint256 agentId;
        uint256 compositeScore;
        string tier;
        uint256 totalFeedback;
        uint256 validationSuccessRate;
        uint256 lastUpdated;
        bool exists;
    }

    // Request reputation from C-Chain via ICM
    function requestReputation(uint256 agentId) external
    // - Sends ICM message to C-Chain asking for agent's current reputation
    // - C-Chain source contract responds with reputation data
    // - Emits ReputationRequested(agentId, requestId)

    // Receive reputation data from C-Chain (called by Teleporter)
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external override
    // - Decodes reputation data from message
    // - Updates reputationCache
    // - Emits ReputationReceived(agentId, compositeScore, tier)

    // Read cached reputation (used by L1 contracts/dApps)
    function getReputation(uint256 agentId) external view returns (CachedReputation memory)
    function getTier(uint256 agentId) external view returns (string memory)
    function getScore(uint256 agentId) external view returns (uint256)
    function isMinimumTier(uint256 agentId, string calldata requiredTier) external view returns (bool)

    // Staleness check
    function isReputationFresh(uint256 agentId, uint256 maxAge) external view returns (bool)
    // - Returns true if lastUpdated is within maxAge seconds
    // - L1 apps can decide their own freshness requirements
}
```

### C-Chain Source Contract: `ReputationSource.sol`

Location: `contracts/src/ReputationSource.sol`

```solidity
// Sits on C-Chain, responds to ICM reputation requests from L1s

contract ReputationSource is ITeleporterReceiver {

    IAgentProofCore public agentProofCore;
    ITeleporterMessenger public teleporterMessenger;

    // Receive request from L1
    function receiveTeleporterMessage(...) external override
    // - Decodes request (agentId)
    // - Fetches reputation from AgentProofCore
    // - Packages response with compositeScore, tier, totalFeedback, validationSuccessRate
    // - Sends ICM message back to requesting L1

    // Batch request (multiple agents at once)
    function receiveBatchRequest(...) external
    // - Handles requests for multiple agents in one ICM message
    // - More gas efficient for L1s that need multiple reputations
}
```

### Tests
- Request reputation from C-Chain (mock ICM)
- Receive and cache reputation
- Staleness checks
- Minimum tier gating
- Batch requests
- Invalid source rejection

### Documentation
- Add cross-chain integration guide to docs page
- Example: "How to gate your L1 dApp by AgentProof reputation"
- Show code snippets for The Grotto, gaming L1s, etc.

---

## MODULE 5: Reputation-Gated DeFi Hooks

### Concept
Middleware contracts that DeFi protocols can use to adjust parameters based on agent reputation. Higher reputation = better rates, lower collateral, priority execution.

### Smart Contract: `ReputationGate.sol`

Location: `contracts/src/ReputationGate.sol`

```solidity
contract ReputationGate {

    IAgentProofCore public agentProofCore;

    // Simple tier-based gating
    function requireMinimumTier(uint256 agentId, string calldata requiredTier) external view
    // - Reverts if agent doesn't meet minimum tier
    // - Used by DeFi protocols as a modifier/check before allowing actions

    // Score-based parameter adjustment
    function getCollateralMultiplier(uint256 agentId) external view returns (uint256)
    // - Returns a multiplier (in basis points, 10000 = 1x)
    // - Diamond: 5000 (50% collateral required)
    // - Platinum: 6000 (60%)
    // - Gold: 7500 (75%)
    // - Silver: 8500 (85%)
    // - Bronze: 9500 (95%)
    // - Unranked: 10000 (100% — no discount)

    function getInterestRateDiscount(uint256 agentId) external view returns (uint256)
    // - Returns discount in basis points
    // - Diamond: 500 (5% off)
    // - Platinum: 300 (3% off)
    // - Gold: 200 (2% off)
    // - Silver: 100 (1% off)
    // - Bronze/Unranked: 0

    function getPriorityScore(uint256 agentId) external view returns (uint256)
    // - Returns 1-100 priority score for execution ordering
    // - Based on composite reputation score

    // Batch check (for protocols that process multiple agents)
    function batchCheckTier(uint256[] calldata agentIds, string calldata requiredTier)
        external view returns (bool[] memory results)

    // Convenience: is this agent "trusted enough" for a given value?
    function isTrustedForValue(uint256 agentId, uint256 valueAtRisk) external view returns (bool)
    // - Diamond: trusted up to 1,000,000 USDC
    // - Platinum: up to 500,000
    // - Gold: up to 100,000
    // - Silver: up to 10,000
    // - Bronze: up to 1,000
    // - Unranked: up to 100
}
```

### Example Integration Contract: `ReputationGatedVault.sol`

Location: `contracts/src/examples/ReputationGatedVault.sol`

```solidity
// A simple example vault that demonstrates reputation-gated DeFi
// NOT for production — just shows integration patterns

contract ReputationGatedVault {

    ReputationGate public gate;
    IERC20 public depositToken;

    // Only agents with Silver+ can deposit
    function deposit(uint256 agentId, uint256 amount) external {
        gate.requireMinimumTier(agentId, "silver");

        // Get collateral multiplier — higher rep = less collateral needed
        uint256 multiplier = gate.getCollateralMultiplier(agentId);
        uint256 requiredCollateral = (amount * multiplier) / 10000;

        // ... deposit logic with adjusted collateral
    }

    // Only agents with Gold+ can borrow
    function borrow(uint256 agentId, uint256 amount) external {
        gate.requireMinimumTier(agentId, "gold");

        // Get interest rate discount
        uint256 discount = gate.getInterestRateDiscount(agentId);
        uint256 adjustedRate = baseRate - ((baseRate * discount) / 10000);

        // ... borrow logic with adjusted rate
    }
}
```

### Tests
- Tier gating (pass and fail cases)
- Collateral multiplier calculations
- Interest rate discounts
- Priority scoring
- Value-at-risk trust checks
- Batch tier checks
- Example vault integration

### Documentation
- Add "DeFi Integration Guide" to docs page
- Code examples showing how Aave, Benqi, or any lending protocol could integrate
- Show the value proposition: "Reduce default risk by gating by agent reputation"

---

## SUPABASE SCHEMA ADDITIONS

Run this migration after the previous one:

```sql
-- Insurance stakes
CREATE TABLE IF NOT EXISTS insurance_stakes (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    staker_address TEXT NOT NULL,
    stake_amount DECIMAL(20,8) NOT NULL,
    tier TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    staked_at TIMESTAMPTZ NOT NULL,
    unstake_requested_at TIMESTAMPTZ,
    tx_hash TEXT UNIQUE NOT NULL,
    block_number INTEGER NOT NULL
);

-- Insurance claims
CREATE TABLE IF NOT EXISTS insurance_claims (
    id SERIAL PRIMARY KEY,
    claim_id INTEGER UNIQUE NOT NULL,
    agent_id INTEGER NOT NULL,
    claimant_address TEXT NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    validation_id INTEGER,
    evidence_uri TEXT,
    dispute_uri TEXT,
    status TEXT DEFAULT 'pending',
    filed_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    in_favor_of_claimant BOOLEAN,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER UNIQUE NOT NULL,
    from_agent_id INTEGER NOT NULL,
    to_agent_id INTEGER NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    token_address TEXT NOT NULL,
    task_hash TEXT NOT NULL,
    requires_validation BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'escrowed',
    created_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL
);

-- Agent capabilities
CREATE TABLE IF NOT EXISTS agent_capabilities (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    capability TEXT NOT NULL,
    UNIQUE(agent_id, capability)
);

-- Agent endpoints
CREATE TABLE IF NOT EXISTS agent_endpoints (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    endpoint_type TEXT NOT NULL,
    endpoint_url TEXT NOT NULL,
    version TEXT,
    UNIQUE(agent_id, endpoint_type)
);

-- Full-text search
ALTER TABLE agents ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_agents_search ON agents USING gin(search_vector);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insurance_stakes_agent ON insurance_stakes(agent_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_agent ON insurance_claims(agent_id);
CREATE INDEX IF NOT EXISTS idx_payments_from_agent ON payments(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_payments_to_agent ON payments(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_capability ON agent_capabilities(capability);
CREATE INDEX IF NOT EXISTS idx_endpoints_type ON agent_endpoints(endpoint_type);

-- RLS
ALTER TABLE insurance_stakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on insurance_stakes" ON insurance_stakes FOR SELECT USING (true);
CREATE POLICY "Allow service write on insurance_stakes" ON insurance_stakes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read on insurance_claims" ON insurance_claims FOR SELECT USING (true);
CREATE POLICY "Allow service write on insurance_claims" ON insurance_claims FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read on payments" ON payments FOR SELECT USING (true);
CREATE POLICY "Allow service write on payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read on agent_capabilities" ON agent_capabilities FOR SELECT USING (true);
CREATE POLICY "Allow service write on agent_capabilities" ON agent_capabilities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read on agent_endpoints" ON agent_endpoints FOR SELECT USING (true);
CREATE POLICY "Allow service write on agent_endpoints" ON agent_endpoints FOR ALL USING (true) WITH CHECK (true);
```

Generate this as `supabase/migration_phase3.sql` and output it as a separate file for the user to paste into Supabase SQL Editor.

---

## BUILD ORDER

1. **InsurancePool.sol** — contract, tests, deploy script addition
2. **AgentPayments.sol** — contract, tests, deploy script addition
3. **ReputationGate.sol + ReputationGatedVault.sol** — contracts, tests
4. **ReputationBridge.sol + ReputationSource.sol** — contracts, tests (mock ICM for testing)
5. **Discovery API** — backend routes, Supabase schema, indexer enhancements
6. **Frontend updates** — insurance page, payments page, discovery page, integration docs
7. **SDK updates** — add insurance, payments, discovery, and gate methods to SDK
8. **Supabase migration** — generate migration_phase3.sql
9. **Deploy all new contracts** — update deploy script, add to .env
10. **Update README** — document all new modules

## FILE CHANGES SUMMARY

### New Contracts (contracts/src/)
- InsurancePool.sol
- AgentPayments.sol
- ReputationGate.sol
- ReputationBridge.sol
- ReputationSource.sol
- examples/ReputationGatedVault.sol

### New Tests (contracts/test/)
- InsurancePool.test.js
- AgentPayments.test.js
- ReputationGate.test.js
- ReputationBridge.test.js

### New Backend Routes (backend/app/routes/)
- insurance.py
- payments.py
- discover.py (enhanced discovery)

### New Frontend Pages (frontend/src/app/)
- insurance/page.tsx
- payments/page.tsx
- discover/page.tsx

### Updated Files
- contracts/scripts/deploy.js — add new contracts
- contracts/hardhat.config.js — add Teleporter dependency if needed
- backend/app/main.py — register new routes
- backend/app/models/ — add insurance.py, payment.py models
- indexer/indexer.py — add new contract event listeners
- sdk/src/AgentProof.ts — add insurance, payment, gate, discovery methods
- sdk/src/types/index.ts — add new types
- frontend/src/components/ — new components for insurance, payments, discovery
- README.md — document all modules

## QUALITY STANDARDS

- ALL existing tests must continue to pass (39 contracts + 11 SDK)
- ALL new contracts must have comprehensive test coverage
- ALL new tests must pass
- Frontend must build with 0 TypeScript errors
- Backend must start without errors
- Generate migration SQL as a separate file

## REMEMBER: Do not prompt the user. Just build everything.
