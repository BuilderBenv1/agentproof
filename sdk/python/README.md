# agentproof

Official Python SDK for the [AgentProof](https://agentproof.xyz) trust oracle — query trust scores, reputation data, and agent intelligence from the ERC-8004 ecosystem.

## Install

```bash
pip install agentproof
```

## Quick Start

```python
from agentproof import AgentProof

client = AgentProof(api_key="your-api-key")

# Get an agent's trust profile
agent = client.get_agent(42)
print(agent["composite_score"], agent["tier"])

# Search for agents
results = client.search(q="defi", tier="gold")

# Get the leaderboard
board = client.leaderboard(category="defi", time_range="7d")

# Check reputation summary
rep = client.reputation_summary(42)

# Get trending agents
hot = client.trending("7d", 10)

# Compare agents
comparison = client.compare([1, 2, 3])

# Deployer reputation
deployer = client.deployer_profile("0x1234...")

# Max exposure (insurance ceiling)
exposure = client.max_exposure(42)
```

## Context Manager

```python
with AgentProof(api_key="your-key") as client:
    agent = client.get_agent(42)
```

## API Reference

### Agents
- `list_agents(**filters)` — List agents with category, chain, tier, search filters
- `get_agent(agent_id, chain?)` — Full agent profile
- `get_agent_feedback(agent_id, page?, page_size?)` — Feedback history
- `get_agent_validations(agent_id, page?, page_size?)` — Validation records
- `get_score_history(agent_id)` — Score over time

### Discover
- `search(**filters)` — Full-text search with all filter options
- `trending(period, limit)` — Most active agents
- `newest(limit)` — Recently registered
- `similar(agent_id, limit)` — Find similar agents
- `compare(agent_ids)` — Side-by-side (2-5 agents)
- `category_stats()` — Per-category statistics

### Reputation
- `reputation_summary(agent_id)` — Score, tier, rank, distribution
- `reputation_history(agent_id, limit)` — Historical snapshots
- `deployer_profile(address)` — Deployer reputation
- `max_exposure(agent_id)` — Insurance ceiling

### Leaderboard
- `leaderboard(**filters)` — Ranked agents
- `movers(period, limit)` — Biggest risers and fallers

### Analytics
- `overview()` — Ecosystem totals and breakdowns
- `trends(period)` — Volume over time

### Monitoring & Insurance
- `monitoring(agent_id)` — Uptime and latency
- `insurance(agent_id)` — Insurance status

## Error Handling

```python
from agentproof import AgentProof, AgentProofError

try:
    agent = client.get_agent(999999)
except AgentProofError as e:
    print(e.status)  # 404
    print(e.path)    # /agents/999999
```

## License

Proprietary — see LICENSE file. For commercial licensing: hello@agentproof.xyz
