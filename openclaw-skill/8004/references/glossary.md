# Glossary

## Identifiers

- **agentRegistry**: `{namespace}:{chainId}:{identityRegistry}` — globally unique registry reference (e.g., `eip155:1:0x742...`)
- **agentId**: `uint256` ERC-721 tokenId assigned incrementally within an Identity Registry
- **agentURI**: Off-chain URI pointing to the agent's registration file JSON
- **MetadataEntry**: `struct { string metadataKey; bytes metadataValue; }` — on-chain key-value pair
- **agentWallet**: Reserved metadata key for the agent's payment/signing address

## Registries

- **Identity Registry**: ERC-721-based registry for agent registration, URI, metadata, and wallet management
- **Reputation Registry**: Collects and aggregates feedback for registered agents
- **Validation Registry**: Challenge-response evaluation registry (still evolving with TEE community)

## Reputation Terms

- **feedbackIndex**: `uint64` per-client sequential index for feedback entries
- **clientAddress**: `address` of the feedback submitter
- **tag1 / tag2**: Optional string tags for categorizing feedback

## Ecosystem Protocols

- **x402**: HTTP 402-based payment protocol (support declared via `x402Support` field, out of ERC-8004 scope)
- **MCP**: Model Context Protocol — AI model tool-use interface
- **A2A**: Agent-to-Agent protocol — inter-agent communication
- **OASF**: Open Agentic Schema Framework — standardized agent skill and domain taxonomies
- **DID**: Decentralized Identifier — W3C standard for self-sovereign identity
- **ENS**: Ethereum Name Service — human-readable Ethereum addresses
