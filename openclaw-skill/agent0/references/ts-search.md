# TypeScript Search

## Filtered search

```ts
const results = await sdk.searchAgents(
  {
    name: 'AI',
    mcpTools: ['code_generation'],
    a2aSkills: ['python'],
    active: true,
    feedback: { minValue: 80, tag: 'enterprise', includeRevoked: false },
  },
  { sort: ['updatedAt:desc'] }
);
```

## Multi-chain search

```ts
const multiChainResults = await sdk.searchAgents({
  active: true,
  chains: [1, 11155111, 137],
});
```

## Single agent lookup

```ts
const agentSummary = await sdk.getAgent('11155111:123');
```

Agent ID format: `chainId:agentId` (e.g., `'11155111:123'`).

## Key SearchFilter fields

`chains`, `agentIds`, `name`, `description`, `owners`, `operators`, `hasRegistrationFile`, `hasWeb`, `hasMCP`, `hasA2A`, `hasOASF`, `walletAddress`, `supportedTrust`, `a2aSkills`, `mcpTools`, `mcpPrompts`, `mcpResources`, `oasfSkills`, `oasfDomains`, `active`, `x402support`, `feedback` (nested: `minValue`, `maxValue`, `minCount`, `maxCount`, `tag1`, `tag2`, `fromReviewers`, `includeRevoked`)

## Key AgentSummary fields (returned)

`chainId`, `agentId`, `name`, `image`, `description`, `owners`, `operators`, `mcp`, `a2a`, `web`, `email`, `ens`, `did`, `walletAddress`, `supportedTrusts`, `a2aSkills`, `mcpTools`, `mcpPrompts`, `mcpResources`, `oasfSkills`, `oasfDomains`, `active`, `x402support`, `createdAt`, `updatedAt`, `feedbackCount`, `averageValue`

Search results are eventually consistent — subgraph indexing may lag recent on-chain writes.

> Version-sensitive: `searchAgents`, `getAgent`, filter/result field names reflect v1.5.3.
