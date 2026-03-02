# Identity Events

```solidity
event Registered(uint256 indexed agentId, string agentURI, address indexed owner)

event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy)

event MetadataSet(
    uint256 indexed agentId,
    string indexed indexedMetadataKey,
    string metadataKey,
    bytes metadataValue
)
```

The standard ERC-721 `Transfer` event is also emitted on registration and ownership changes.

Indexing notes:
- `Registered` and `Transfer` together track the full agent lifecycle
- `MetadataSet` includes both an indexed and plain `metadataKey` for filtering and reading
- `URIUpdated` tracks off-chain descriptor changes
