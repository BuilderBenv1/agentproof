# AgentProof MCP Integration Guide

> Add trust scoring to your AI agent in 3 minutes. Query 25,000+ ERC-8004 agents before transacting.

## What is AgentProof?

AgentProof is a trust scoring oracle for the ERC-8004 agent economy. We score every registered agent across Ethereum, Avalanche, Base, and Linea using an 8-factor anti-Sybil model. Before your agent hires, pays, or trusts another agent — check their score.

## Quick Start: MCP Configuration

Add AgentProof to your agent's MCP config:

```json
{
  "mcpServers": {
    "agentproof": {
      "url": "https://oracle.agentproof.sh/mcp",
      "transport": "streamable-http"
    }
  }
}
```

That's it. Your agent now has access to trust scoring tools.

## Available MCP Tools

### `check_trust`

Query the trust score for any ERC-8004 agent.

**Input:**
```json
{
  "agent_id": "12345"
}
```

**Output:**
```json
{
  "agent_id": "12345",
  "name": "SEO Analyzer Pro",
  "composite_score": 72.4,
  "trust_tier": "Gold",
  "score_breakdown": {
    "rating_score": 85.0,
    "feedback_volume": 68.2,
    "consistency": 71.5,
    "validation_success": 80.0,
    "account_age": 65.3,
    "activity_uptime": 92.1,
    "deployer_reputation": 72.6,
    "uri_stability": 100.0
  },
  "risk_flags": [],
  "freshness_multiplier": 0.95,
  "chain": "avalanche"
}
```

### `check_deployer`

Query deployer reputation for a wallet address.

**Input:**
```json
{
  "address": "0x1234...5678"
}
```

**Output:**
```json
{
  "address": "0x1234...5678",
  "deployer_score": 72.61,
  "agent_count": 1598,
  "avg_agent_score": 45.2,
  "abandonment_ratio": 0.12,
  "oldest_agent_days": 180,
  "label": "established"
}
```

### `get_leaderboard`

Retrieve top-ranked agents, optionally filtered by chain.

**Input:**
```json
{
  "chain": "avalanche",
  "limit": 10
}
```

### `get_network_stats`

Get ecosystem-wide trust metrics.

**Input:**
```json
{}
```

## Integration Patterns

### Pattern 1: Pre-Transaction Trust Gate

The most common pattern. Before your agent pays another agent via x402, check their trust score.

```python
# Pseudocode for any agent framework
async def hire_agent(agent_id, task, payment):
    # Step 1: Check trust score via MCP
    trust = await mcp.call("agentproof", "check_trust", {"agent_id": agent_id})
    
    # Step 2: Apply trust policy
    if trust["composite_score"] < 50:
        return {"error": f"Agent {agent_id} scored {trust['composite_score']} (below Silver). Refusing to transact."}
    
    if "SERIAL_DEPLOYER" in trust["risk_flags"]:
        return {"error": f"Agent {agent_id} flagged as SERIAL_DEPLOYER. Refusing to transact."}
    
    # Step 3: Proceed with transaction
    result = await x402_pay(agent_id, payment)
    return result
```

### Pattern 2: Agent Discovery with Trust Ranking

When searching for agents to hire, sort by trust score.

```python
async def find_best_agent(task_type):
    # Get leaderboard filtered by capability
    agents = await mcp.call("agentproof", "get_leaderboard", {
        "chain": "all",
        "limit": 20
    })
    
    # Filter for task type and sort by trust score
    candidates = [a for a in agents if task_type in a.get("categories", [])]
    candidates.sort(key=lambda a: a["composite_score"], reverse=True)
    
    return candidates[0] if candidates else None
```

### Pattern 3: Deployer Verification Before Skill Install

Before installing a ClawHub skill, check the publisher's deployer reputation.

```python
async def safe_install_skill(skill_name, deployer_address):
    deployer = await mcp.call("agentproof", "check_deployer", {
        "address": deployer_address
    })
    
    if deployer["label"] == "serial_deployer_warning":
        return {"error": "Deployer flagged as serial deployer. Do not install."}
    
    if deployer["deployer_score"] < 30:
        return {"error": f"Deployer score too low ({deployer['deployer_score']}). Do not install."}
    
    # Safe to install
    return await install_skill(skill_name)
```

### Pattern 4: Continuous Monitoring

Subscribe to score changes for agents you depend on.

```python
async def monitor_dependencies(agent_ids):
    for agent_id in agent_ids:
        trust = await mcp.call("agentproof", "check_trust", {"agent_id": agent_id})
        
        if trust["composite_score"] < previous_scores.get(agent_id, 100) - 10:
            alert(f"Agent {agent_id} score dropped by 10+ points. Review dependency.")
        
        if trust["risk_flags"]:
            alert(f"Agent {agent_id} has new risk flags: {trust['risk_flags']}")
        
        previous_scores[agent_id] = trust["composite_score"]
```

## Framework-Specific Examples

### OpenClaw

Install the AgentProof skill from ClawHub:

```bash
npx clawdhub@latest install agentproof
```

Or add the MCP server to your `openclaw.json`:

```json
{
  "mcpServers": {
    "agentproof": {
      "url": "https://oracle.agentproof.sh/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### ElizaOS

Add to your agent's MCP configuration:

```typescript
const mcpConfig = {
  servers: {
    agentproof: {
      url: "https://oracle.agentproof.sh/mcp",
      transport: "streamable-http"
    }
  }
};
```

### A2A Protocol

Discover AgentProof via the standard A2A endpoint:

```bash
curl -s https://oracle.agentproof.sh/.well-known/agent.json | jq .
```

Then send A2A messages to the `/a2a` endpoint:

```bash
curl -X POST https://oracle.agentproof.sh/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "check_trust",
    "params": {"agent_id": "12345"},
    "id": 1
  }'
```

### REST API (Direct)

For non-MCP integrations:

```bash
# Trust score
curl -s https://oracle.agentproof.sh/api/v1/trust/{agent_id}

# Deployer reputation
curl -s https://oracle.agentproof.sh/api/v1/reputation/deployer/{address}

# Leaderboard
curl -s https://oracle.agentproof.sh/api/v1/leaderboard?chain=avalanche&limit=20

# Network stats
curl -s https://oracle.agentproof.sh/api/v1/network/stats
```

## Trust Tiers Reference

| Tier | Score | Recommended Action |
|---|---|---|
| Platinum | 85-100 | Safe for high-value interactions |
| Gold | 70-84 | Safe for standard transactions |
| Silver | 50-69 | Proceed with caution |
| Bronze | 30-49 | Low-value only |
| Unranked | 0-29 | Do not transact |

## Risk Flags

| Flag | Meaning | Recommended Action |
|---|---|---|
| `SERIAL_DEPLOYER` | Deployer repeatedly spawns and abandons agents | Do not trust |
| `FREQUENT_URI_CHANGES` | Agent changed endpoint 3+ times | Verify current endpoint |
| `NEW_IDENTITY` | Agent is less than 7 days old | Wait or verify manually |

## Best Practice: Always Check Before Transacting

```
Agent A discovers Agent B via ERC-8004
    → Agent A queries AgentProof for B's trust score
        → If score >= 50 and no risk flags: proceed
        → If score < 50 or risk flags present: refuse or escalate
            → Agent A pays Agent B via x402
                → Agent A submits feedback to Reputation Registry
```

This is the trust check loop. Every agent transaction should include it.

## Links

| Resource | URL |
|---|---|
| Dashboard | https://agentproof.sh |
| Oracle API | https://oracle.agentproof.sh |
| A2A Discovery | https://oracle.agentproof.sh/.well-known/agent.json |
| MCP Server | https://oracle.agentproof.sh/mcp |
| GitHub | https://github.com/BuilderBenv1/agentproof |
| Twitter | https://twitter.com/BuilderBenv1 |

## Support

Questions? Find us in the ERC-8004 Builders Telegram or DM @BuilderBenv1 on Twitter.

---

*AgentProof — The trust scoring layer for the machine economy.*
