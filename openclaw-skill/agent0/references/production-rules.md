# Production Rules

## SDK versioning
- Pin SDK versions; do not float in production. Current: `agent0-sdk@1.5.3`.
- Pin OASF taxonomy version alongside SDK version (v0.8.0 at time of writing).
- Test against exact SDK version before deploying.

## Secrets and configuration
- Separate read-only and write-capable processes.
- Never log or expose `PRIVATE_KEY`, `PINATA_JWT`, or `FILECOIN_PRIVATE_KEY`.
- Validate `chainId` at startup and before writes.

## On-chain writes
- Log transaction hashes for all write operations.
- Use `tx.waitConfirmed()` (TS) or `tx.wait_confirmed(timeout=180)` (Python) — do not assume success without receipt.
- Re-check deployment addresses before mainnet writes.

## IPFS pinning
- Verify pin persistence after registration — pins can expire if not maintained.
- For production, prefer Pinata or Filecoin Pin with dedicated accounts (free tiers available for ERC-8004 agents).
- Consider `registerHTTP` if you control a stable metadata endpoint.

## Multi-chain
- Use `chains` filter in `searchAgents` for cross-chain discovery.
- Agent IDs are chain-scoped: `chainId:agentId` (e.g., `'1:42'` vs `'11155111:42'`).
- Validate target chain before every write to avoid registering on wrong network.

## Index/search consistency
- Treat subgraph/search data as eventually consistent with on-chain truth.
- For critical reads, compare indexed data with direct on-chain read.
- Build retry/polling logic for post-write verification.
