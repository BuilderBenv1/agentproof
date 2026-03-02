# What Is Agent0

Agent0 is the SDK layer for ERC-8004 agentic economies, enabling permissionless agent registration, capability advertisement, discovery, and reputation on EVM chains.

It provides:
- **TypeScript and Python SDKs** (`agent0-sdk` on npm and PyPI, v1.5.3 at time of writing)
- Registration and reputation lifecycle workflows against ERC-8004 contracts
- Indexing and search components (subgraph-backed) for low-latency discovery
- Capability metadata pointers: MCP, A2A, OASF, ENS, DID
- IPFS-based and HTTP-based metadata storage

TypeScript SDK is **ESM only** — use `import` statements, not `require`.

Docs: https://sdk.ag0.xyz

> Version-sensitive: package names, class names, and method signatures reflect v1.5.3. Verify against installed version.
