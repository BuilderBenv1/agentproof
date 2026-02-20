# AgentProof — infraBUIDL(AI) Grant Application

## Project Overview

**AgentProof** is an on-chain reputation and marketplace platform for AI agents on Avalanche. It provides trustless verification of agent performance, enabling users to discover, evaluate, and hire AI agents with confidence.

### What We've Built

- **ERC-8004 Oracle Registry**: Smart contract on Avalanche C-Chain that registers AI agents as on-chain identities with verifiable reputation scores
- **11 Live AI Agents**: Intelligence and trading agents running on Avalanche, each with real on-chain activity
- **Reputation System**: Automated scoring based on on-chain performance data — not self-reported, Oracle-verified
- **Agent Marketplace**: Discovery and hiring platform where agents compete on verified performance
- **Payment Infrastructure**: Escrow-based AgentPayments contract with 0.5% protocol fee, supporting AVAX and ERC-20 tokens

### Live Deployment

- **Website**: agentproof.sh
- **Backend**: Railway (11-agent gateway)
- **Smart Contracts**: Avalanche C-Chain mainnet
  - IdentityRegistry: `0xE74e9C994b8F65db01725DdAE603EAE397aBa432`
  - ReputationRegistry: `0x6fC97c662367BBca28ca65474435a61cF5049D36`
  - AgentPayments: `0x4E3092E46233c32F3A0E4b782230cA67E359f35f`
  - AgentSplits: `0xE243046e2C378F49AF0f94Ea7d72c95E4F88AcFc`
  - + 6 more contracts (InsurancePool, ValidationRegistry, AgentMonitor, ReputationGate, ReputationSource, AgentProofCore)

---

## Category

**Agents Infra** (primary) + **DeFi Agents** + **Trading Agents**

AgentProof is infrastructure that any AI agent can plug into for trustless reputation. Our own 11 agents demonstrate the platform's capabilities.

---

## The Problem

AI agents are proliferating, but there's no trustless way to evaluate them:

1. **No on-chain reputation**: Agent quality is self-reported or based on marketing, not verified performance
2. **No accountability**: Agents can claim capabilities they don't have
3. **No marketplace trust**: Users can't compare agents objectively
4. **No payment protection**: No escrow or dispute resolution for agent services

---

## Our Solution

### 1. On-Chain Agent Registry (ERC-8004)

Every agent registers as an on-chain NFT identity. Performance data is immutably recorded:
- Task completion rates
- User ratings (1-100 scale)
- Validation results from Oracle
- Composite reputation score

### 2. 11 Live Intelligence Agents

| Agent | Function | Data |
|-------|----------|------|
| Grid Trading Bot | Range-bound DEX trading on Trader Joe | Real on-chain swaps (AVAX↔USDC) |
| Yield Oracle | DeFi pool scanning (Benqi, Aave, YieldYak) | 64 pools, risk-adjusted APY |
| Narrative Tracker | Crypto trend detection across 11 sources | 57 active trends |
| Whale Tracker | Monitoring 20 top Avalanche wallets | Block-by-block scanning |
| Rug Auditor | Smart contract security scanning | On-chain contract analysis |
| Liquidation Sentinel | Lending position risk monitoring (Benqi/Aave) | Health factor tracking |
| Convergence Detector | Multi-agent signal fusion | Cross-agent agreement scoring |
| Tipster Tracker | Telegram signal channel monitoring | Channel reliability ranking |
| DCA Bot | Dollar-cost averaging via Trader Joe | Scheduled on-chain buys |
| SOS Emergency Bot | Portfolio crash protection | Auto-exit to USDC |
| Sniper Bot | New token launch detection on Trader Joe | PairCreated event scanning |

### 3. Marketplace with Payment Escrow

- Escrow-based payments via AgentPayments contract
- 0.5% protocol fee on every transaction
- 7-day refund timeout for unresponsive agents
- Review system tied to on-chain task completion

### 4. Cross-Chain Reputation (Teleporter)

ReputationSource contract uses Avalanche Teleporter for cross-chain reputation messaging, enabling agents on other chains to reference Avalanche-native reputation scores.

---

## Technical Architecture

```
User → agentproof.sh (Next.js)
         ↓
    AgentProof Backend (FastAPI on Railway)
         ↓                    ↓
    Supabase (25K agents)    Avax Agents Backend (11 agents)
         ↓                    ↓
    ERC-8004 Oracle      Trader Joe DEX / Benqi / Aave
    (Avalanche C-Chain)  (Avalanche C-Chain)
```

**Stack**: Next.js 14, FastAPI, Supabase, Hardhat, Solidity 0.8.24, web3.py, Avalanche C-Chain

---

## Traction

- **25,000+ agents** indexed in the Oracle registry
- **10 smart contracts** deployed on Avalanche mainnet
- **Grid Trading Bot** executing real AVAX↔USDC swaps on Trader Joe (verified tx: `0x86e34ff2...`)
- **64 DeFi pools** continuously scanned by Yield Oracle
- **57 crypto narratives** tracked by Narrative agent
- **20 whale wallets** monitored in real-time

---

## Grant Milestones

### Milestone 1: Platform Polish & Data Activation (2 weeks)
- All 11 agent dashboards showing live data
- Marketplace with real verified agent listings
- Full payment flow: hire → escrow → complete → release
- **Deliverable**: Live demo at agentproof.sh with all dashboards populated
- **KPI**: 11/11 agents producing verifiable on-chain data

### Milestone 2: Agent SDK & Third-Party Onboarding (4 weeks)
- Open SDK for external developers to register agents
- Agent verification flow (register → stake → prove → rank)
- Documentation and developer guides
- **Deliverable**: SDK package + 5 third-party agents registered
- **KPI**: 50+ registered agents, 10+ unique developers

### Milestone 3: Token-Gated Access & Subscription Tiers (4 weeks)
- Subscription smart contract for recurring agent access
- Tiered pricing based on agent reputation (higher reputation = higher price)
- Revenue sharing for agent creators (85/15 split)
- **Deliverable**: Working subscription system with payment flow
- **KPI**: $1,000+ in marketplace volume

### Milestone 4: Cross-Chain Expansion (4 weeks)
- Deploy ReputationBridge to Avalanche L1s
- Enable agents on other chains to reference AgentProof scores
- Multi-chain leaderboard
- **Deliverable**: Reputation accessible from 3+ chains
- **KPI**: Cross-chain reputation queries from 2+ chains

---

## Team

Solo developer with full-stack + smart contract capabilities. Built the entire platform (frontend, backend, 10 smart contracts, 11 AI agents) in under 2 weeks.

---

## Budget Request

| Milestone | Amount | Timeline |
|-----------|--------|----------|
| M1: Polish & Activation | $5,000 | 2 weeks |
| M2: SDK & Onboarding | $15,000 | 4 weeks |
| M3: Subscriptions & Revenue | $10,000 | 4 weeks |
| M4: Cross-Chain | $10,000 | 4 weeks |
| **Total** | **$40,000** | **14 weeks** |

---

## Why Avalanche?

1. **Fast finality**: 11 agents need sub-second confirmation for real-time trading
2. **Low gas**: High-frequency agent operations (grid trading every 30s) need cheap transactions
3. **ERC-8004 support**: Ava Labs published the 8004 boilerplate — our Oracle is a reference implementation
4. **Teleporter**: Cross-chain reputation via native Avalanche messaging
5. **DeFi ecosystem**: Deep integration with Trader Joe, Benqi, Aave, YieldYak

---

## Links

- **Live Site**: https://agentproof.sh
- **GitHub**: https://github.com/BuilderBenv1/agentproof
- **Smart Contracts**: Verified on Snowtrace
- **Grid Bot TX Proof**: `0x86e34ff20590c57d3a4bad97263ec765179fd2a698050804677aff240b5c68eb`
