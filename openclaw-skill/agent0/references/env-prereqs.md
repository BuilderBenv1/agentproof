# Environment Prerequisites

## Runtime
- **TypeScript**: Node.js 22+, npm/yarn/pnpm/bun
- **Python**: Python 3.8+, pip

## Required for writes
- Target `chainId` (e.g., `11155111` for Sepolia)
- RPC URL (`RPC_URL`)
- Signer private key (`PRIVATE_KEY` or `AGENT_PRIVATE_KEY`)

## IPFS provider (for registration metadata)

Choose one:

| Provider | Env var | Notes |
|---|---|---|
| `'pinata'` | `PINATA_JWT` | Free tier available for ERC-8004 agents |
| `'filecoinPin'` | `FILECOIN_PRIVATE_KEY` | Free tier available for ERC-8004 agents |
| `'node'` | `IPFS_NODE_URL` | Self-hosted IPFS node |
| HTTP (no IPFS) | — | Use `agent.registerHTTP(url)` instead of `agent.registerIPFS()` |

## Best practices
- Separate read-only runtime config from write-capable secret material
- Never commit private keys or JWTs to source control
- For read-only usage (search, getAgent), no signer or IPFS config is needed
