# Scope

- Status: Draft standard
- Core scope: identity, discoverability, reputation, validation
- Explicit non-goal: payment and settlement rails

## Required EIPs

- **EIP-155**: Chain identifier (used in `agentRegistry` format)
- **EIP-712**: Typed structured data signing (used for `setAgentWallet` EOA signatures)
- **EIP-721**: Non-Fungible Token standard (Identity Registry base)
- **ERC-1271**: Standard signature validation for contracts (used for `setAgentWallet` with smart contract wallets)

## Default Framing

- Describe what ERC-8004 standardizes
- Separate from app-level business logic and tokenomics
- Three registries: Identity, Reputation, Validation
