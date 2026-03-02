# Python Client Init

```python
from agent0_sdk import SDK
import os

sdk = SDK(
    chainId=11155111,
    rpcUrl=os.getenv("RPC_URL"),
    signer=os.getenv("PRIVATE_KEY"),       # Optional: for write operations
    ipfs="pinata",                          # Options: 'pinata', 'filecoinPin', 'node'
    pinataJwt=os.getenv("PINATA_JWT"),
)
```

- `signer` is optional — omit for read-only usage (search, getAgent).
- IPFS config is only needed for `registerIPFS()`. Use `registerHTTP(url)` to skip IPFS.
- For `'filecoinPin'`, pass `filecoinPrivateKey` instead of `pinataJwt`.
- For `'node'`, pass `ipfsNodeUrl`.

> Version-sensitive: `SDK` constructor and kwargs reflect v1.5.3.
