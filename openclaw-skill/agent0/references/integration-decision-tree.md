# Integration Decision Tree

## Language choice

Choose **TypeScript** when:
- Service stack is Node.js
- You need frontend/backend TypeScript alignment
- ESM-only is acceptable (agent0-sdk is ESM only)

Choose **Python** when:
- Service stack is Python
- You need data or evaluation workflows in Python

## Read-only vs write

**Read-only** (no signer or IPFS needed):
- `searchAgents`, `getAgent`, `searchFeedback`, `getReputationSummary`
- Only requires `chainId` and `rpcUrl`

**Write** (requires signer + IPFS or HTTP endpoint):
- `registerIPFS`, `registerHTTP`, `giveFeedback`
- Requires `privateKey` and IPFS provider config (or HTTP URL)

## IPFS provider choice

Choose **Pinata** when:
- Fastest setup; free tier for ERC-8004 agents
- Requires `PINATA_JWT`

Choose **Filecoin Pin** when:
- Prefer Filecoin ecosystem; free tier for ERC-8004 agents
- Requires `FILECOIN_PRIVATE_KEY`

Choose **Self-hosted node** when:
- Need full control of pinning infrastructure
- Requires `IPFS_NODE_URL`

Choose **HTTP registration** when:
- You already host metadata at a stable URL
- No IPFS config needed: `agent.registerHTTP(url)`

## Discovery architecture

Use SDK search methods when:
- Low-latency discovery queries are required
- You cannot rely on direct chain scans for every read
- Subgraph-backed indexing provides eventual consistency
