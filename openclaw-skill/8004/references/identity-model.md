# Identity Model

The Identity Registry is built on ERC-721 with URIStorage extension.

## Core Concepts

- Each registered agent is an ERC-721 token with an incrementally assigned `agentId` (tokenId)
- The token owner controls the agent's URI, metadata, and wallet assignment
- Standard ERC-721 ownership semantics apply (transfer, approve, operator)

## MetadataEntry Struct

```solidity
struct MetadataEntry {
    string metadataKey;
    bytes metadataValue;
}
```

Arbitrary key-value metadata stored on-chain per agent.

## Reserved Key: `agentWallet`

- Cannot be set via `setMetadata()` — use `setAgentWallet()` instead
- Initially set to the owner's address at registration
- Changing requires EIP-712 signature (EOA) or ERC-1271 signature (smart contract wallet) from the new wallet
- Cleared automatically on ERC-721 transfer

## Required EIPs

EIP-155, EIP-712, EIP-721, ERC-1271
