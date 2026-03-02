# Agent Identifier

Normative format from the ERC-8004 spec:

- `agentRegistry`: `{namespace}:{chainId}:{identityRegistry}` — e.g., `eip155:1:0x742...`
- `agentId`: The ERC-721 `tokenId` assigned incrementally by the Identity Registry

Together these form a globally unique agent reference. The `agentRegistry` string follows the EIP-155 chain identifier convention.

Rules:
- Always include `agentRegistry` (not just `chainId`) when referencing agents cross-chain
- `agentId` alone is only unique within a single Identity Registry deployment
- The `registrations` array in the agent's registration file lists all `{agentRegistry, agentId}` pairs
