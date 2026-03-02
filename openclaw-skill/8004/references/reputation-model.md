# Reputation Model

Collects feedback linked to registered agents in the Identity Registry. Initialized with `initialize(address identityRegistry_)`.

## Feedback Fields

| Field | Type | Storage |
|---|---|---|
| `value` | `int128` | on-chain |
| `valueDecimals` | `uint8` (0–18) | on-chain |
| `tag1` | `string` | on-chain |
| `tag2` | `string` | on-chain |
| `isRevoked` | `bool` | on-chain |
| `endpoint` | `string` | emitted only |
| `feedbackURI` | `string` | emitted only |
| `feedbackHash` | `bytes32` | emitted only |

## Rules

- `agentId` must be registered in the linked Identity Registry
- Submitter MUST NOT be the agent owner or approved operator (no self-feedback)
- `valueDecimals` MUST be 0–18
- `tag1`, `tag2`, `endpoint`, `feedbackURI`, `feedbackHash` are all OPTIONAL
- `feedbackHash` is the keccak256 of `feedbackURI` content (optional for IPFS, which is self-verifying)
- Read identity registry address with `getIdentityRegistry()`
