# Python Search

## Filtered search

```python
results = sdk.searchAgents(
    filters={
        "name": "AI",
        "mcpTools": ["code_generation"],
        "a2aSkills": ["python"],
        "active": True,
        "feedback": {"minValue": 80, "tag": "enterprise", "includeRevoked": False},
    },
    options={"sort": ["updatedAt:desc"]},
)
```

## Single agent lookup

```python
agent_summary = sdk.getAgent("11155111:123")
```

Agent ID format: `chainId:agentId` (e.g., `"11155111:123"`).

## Key SearchFilter fields

`chains`, `agentIds`, `name`, `description`, `owners`, `operators`, `hasRegistrationFile`, `hasWeb`, `hasMCP`, `hasA2A`, `hasOASF`, `walletAddress`, `supportedTrust`, `a2aSkills`, `mcpTools`, `mcpPrompts`, `mcpResources`, `oasfSkills`, `oasfDomains`, `active`, `x402support`, `feedback` (nested: `minValue`, `maxValue`, `minCount`, `maxCount`, `tag1`, `tag2`, `fromReviewers`, `includeRevoked`)

## Key AgentSummary fields (returned)

`chainId`, `agentId`, `name`, `image`, `description`, `owners`, `operators`, `mcp`, `a2a`, `web`, `email`, `ens`, `did`, `walletAddress`, `supportedTrusts`, `a2aSkills`, `mcpTools`, `mcpPrompts`, `mcpResources`, `oasfSkills`, `oasfDomains`, `active`, `x402support`, `createdAt`, `updatedAt`, `feedbackCount`, `averageValue`

Search results are eventually consistent — subgraph indexing may lag recent on-chain writes.

> Version-sensitive: `searchAgents`, `getAgent`, filter/result field names reflect v1.5.3.
