# @agentproof/sdk

Official TypeScript SDK for the [AgentProof](https://agentproof.xyz) trust oracle — query trust scores, reputation data, and agent intelligence from the ERC-8004 ecosystem.

## Install

```bash
npm install @agentproof/sdk
```

## Quick Start

```typescript
import { AgentProof } from "@agentproof/sdk";

const client = new AgentProof({ apiKey: "your-api-key" });

// Get an agent's trust profile
const agent = await client.getAgent(42);
console.log(agent.composite_score, agent.tier);

// Search for agents
const results = await client.search({ q: "defi", tier: "gold" });

// Get the leaderboard
const board = await client.leaderboard({ category: "defi", time_range: "7d" });

// Check reputation summary
const rep = await client.reputationSummary(42);

// Get trending agents
const hot = await client.trending("7d", 10);

// Compare agents side by side
const comparison = await client.compare([1, 2, 3]);

// Deployer reputation
const deployer = await client.deployerProfile("0x1234...");

// Max exposure (insurance ceiling)
const exposure = await client.maxExposure(42);
```

## API Reference

### Constructor

```typescript
new AgentProof({ apiKey: string, baseUrl?: string, timeout?: number })
```

### Agents
- `listAgents(params?)` — List agents with category, chain, tier, search filters
- `getAgent(agentId, chain?)` — Full agent profile with score trajectory, cross-chain data
- `getAgentFeedback(agentId, page?, pageSize?)` — Paginated feedback history
- `getAgentValidations(agentId, page?, pageSize?)` — Paginated validation records
- `getScoreHistory(agentId)` — Score snapshots over time

### Discover
- `search(params?)` — Full-text search with category, tier, chain, open_source, autonomy filters
- `trending(period?, limit?)` — Agents with most activity in 7d/30d
- `newest(limit?)` — Recently registered agents
- `similar(agentId, limit?)` — Find similar agents
- `compare(agentIds[])` — Side-by-side comparison (2-5 agents)
- `categoryStats()` — Per-category statistics

### Reputation
- `reputationSummary(agentId)` — Score, tier, rank, rating distribution
- `reputationHistory(agentId, limit?)` — Historical score snapshots
- `deployerProfile(address)` — Deployer reputation and agent portfolio
- `maxExposure(agentId)` — Insurance exposure ceiling

### Leaderboard
- `leaderboard(params?)` — Ranked agents with filters and time ranges
- `movers(period?, limit?)` — Biggest risers and fallers

### Analytics
- `overview()` — Ecosystem totals, category/tier/chain breakdowns
- `trends(period?)` — Registration and feedback volume over time

### Monitoring & Insurance
- `monitoring(agentId)` — Uptime, latency, check count
- `insurance(agentId)` — Insurance status and claims

## Error Handling

```typescript
import { AgentProof, AgentProofError } from "@agentproof/sdk";

try {
  const agent = await client.getAgent(999999);
} catch (err) {
  if (err instanceof AgentProofError) {
    console.log(err.status); // 404
    console.log(err.path);   // /agents/999999
  }
}
```

## License

Proprietary — see LICENSE file. For commercial licensing: hello@agentproof.xyz
