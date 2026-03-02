# TypeScript Client Init

```ts
import { SDK } from 'agent0-sdk';

const sdk = new SDK({
  chainId: 11155111,
  rpcUrl: process.env.RPC_URL!,
  privateKey: process.env.PRIVATE_KEY ?? process.env.AGENT_PRIVATE_KEY, // Optional: for write operations
  ipfs: 'pinata', // Options: 'pinata', 'filecoinPin', 'node'
  pinataJwt: process.env.PINATA_JWT,
});
```

- `privateKey` is optional — omit for read-only usage (search, getAgent).
- IPFS config is only needed for `registerIPFS()`. Use `registerHTTP(url)` to skip IPFS.
- For `'filecoinPin'`, pass `filecoinPrivateKey` instead of `pinataJwt`.
- For `'node'`, pass `ipfsNodeUrl`.

> Version-sensitive: constructor `SDK` and its options reflect v1.5.3.
