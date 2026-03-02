# Troubleshooting

## Write failures
- Confirm RPC endpoint health and rate limits
- Confirm signer key format (hex with `0x` prefix) and balance for gas
- Confirm `chainId` and registry address alignment
- Check `tx.waitConfirmed()` / `tx.wait_confirmed()` receipt for revert reasons

## Stale reads
- Subgraph indexing may lag on-chain writes by seconds to minutes
- Compare with direct on-chain read to verify
- Retry search queries after short delay for post-write verification

## IPFS issues
- **Pinata**: verify `PINATA_JWT` is valid and not expired
- **Filecoin Pin**: verify `FILECOIN_PRIVATE_KEY` is correct
- **Self-hosted node**: verify `IPFS_NODE_URL` is reachable and has disk space
- If IPFS pinning fails, try `registerHTTP(url)` as fallback
- Verify pinned content is accessible via public gateway before relying on it

## ESM issues (TypeScript)
- `agent0-sdk` is ESM only — `require()` will fail
- Ensure `"type": "module"` in `package.json` or use `.mjs` extension
- If using CommonJS project, use dynamic `import()` or migrate to ESM
- Node.js 22+ required

## Subgraph / search issues
- If `searchAgents` returns empty results for known agents, indexer may be syncing
- Multi-chain queries (`chains: [1, 137]`) require subgraph support per chain
- Filter by `active: true` to exclude deactivated agents

## SDK version mismatch
- Confirm installed version matches examples: `npm list agent0-sdk` or `pip show agent0-sdk`
- Method names and constructor options may differ between versions
- Current examples reflect v1.5.3
