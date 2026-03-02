# Reputation Functions

## Give Feedback

```solidity
function giveFeedback(
    uint256 agentId, int128 value, uint8 valueDecimals,
    string calldata tag1, string calldata tag2,
    string calldata endpoint, string calldata feedbackURI, bytes32 feedbackHash
) external
```

## Revoke Feedback

```solidity
function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external
```

## Append Response

```solidity
function appendResponse(
    uint256 agentId, address clientAddress, uint64 feedbackIndex,
    string calldata responseURI, bytes32 responseHash
) external
```

Anyone can call (e.g., agent showing refund proof, data aggregator tagging spam).

## Read Functions

```solidity
function getSummary(uint256 agentId, address[] calldata clientAddresses, string tag1, string tag2)
    external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)
```

⚠ `clientAddresses` MUST be non-empty — results without client filtering are subject to Sybil/spam attacks.

```solidity
function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex)
    external view returns (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked)

function readAllFeedback(uint256 agentId, address[] calldata clientAddresses, string tag1, string tag2, bool includeRevoked)
    external view returns (
        address[] memory clients, uint64[] memory feedbackIndexes,
        int128[] memory values, uint8[] memory valueDecimals,
        string[] memory tag1s, string[] memory tag2s, bool[] memory revokedStatuses
    )

function getResponseCount(uint256 agentId, address clientAddress, uint64 feedbackIndex, address[] responders)
    external view returns (uint64 count)

function getClients(uint256 agentId) external view returns (address[] memory)
function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64)
```

## Reputation Events

```solidity
event NewFeedback(
    uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex,
    int128 value, uint8 valueDecimals,
    string indexed indexedTag1, string tag1, string tag2,
    string endpoint, string feedbackURI, bytes32 feedbackHash
)
event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex)
event ResponseAppended(
    uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex,
    address indexed responder, string responseURI, bytes32 responseHash
)
```
