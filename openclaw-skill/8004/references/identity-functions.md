# Identity Functions

## Registration (3 overloads)

```solidity
function register(string agentURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId)
function register(string agentURI) external returns (uint256 agentId)
function register() external returns (uint256 agentId)
```

All overloads mint a new ERC-721 token and return the assigned `agentId`.

## URI Management

```solidity
function setAgentURI(uint256 agentId, string calldata newURI) external
```

## On-chain Metadata

```solidity
function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory)
function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external
```

The reserved key `agentWallet` cannot be set via `setMetadata()`.

## Agent Wallet

```solidity
function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external
function getAgentWallet(uint256 agentId) external view returns (address)
function unsetAgentWallet(uint256 agentId) external
```

`setAgentWallet` requires an EIP-712 (EOA) or ERC-1271 (smart contract) signature from `newWallet`.
