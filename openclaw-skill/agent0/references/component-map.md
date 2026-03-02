# Component Map

- **`agent0-ts`**: TypeScript SDK (`agent0-sdk` on npm). ESM only. v1.5.3 at time of writing.
- **`agent0-py`**: Python SDK (`agent0-sdk` on PyPI). v1.5.3 at time of writing.
- **Subgraph indexer**: Provides query-friendly on-chain data. Powers `searchAgents`, `searchFeedback`, and `getAgent` calls. Data is eventually consistent with on-chain state.
- **Search service**: Discovery-focused API layer over indexed data. Supports filtering by capabilities, trust, feedback, and OASF taxonomies.
- **OASF taxonomy files**: Bundled with SDKs. v0.8.0 includes 136 skills and 204 domains. Used with `addSkill()` and `addDomain()` methods. Pass `validate_oasf=True` (Python) or `true` as second arg (TypeScript) to validate against taxonomy.
- **IPFS providers**: Pinata, Filecoin Pin, self-hosted IPFS node. Used for metadata storage during registration.

Use SDK + subgraph indexing together for best developer ergonomics.

Docs: https://sdk.ag0.xyz

> Version-sensitive: OASF taxonomy counts and SDK method names reflect v1.5.3 / OASF v0.8.0.
