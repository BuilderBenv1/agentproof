# TypeScript Registration

Full flow: create agent → configure capabilities → register to IPFS (or HTTP).

```ts
import { SDK } from 'agent0-sdk';

const sdk = new SDK({
  chainId: 11155111,
  rpcUrl: process.env.RPC_URL!,
  privateKey: process.env.PRIVATE_KEY!,
  ipfs: 'pinata',
  pinataJwt: process.env.PINATA_JWT,
});

// 1. Create agent with basic metadata
const agent = sdk.createAgent(
  'My AI Agent',
  'An intelligent assistant for various tasks.',
  'https://example.com/agent-image.png'
);

// 2. Configure capabilities
await agent.setMCP('https://mcp.example.com/');
await agent.setA2A('https://a2a.example.com/agent-card.json');
agent.setENS('myagent.eth');

// 3. Add OASF skills and domains (second arg validates against taxonomy)
agent.addSkill('data_engineering/data_transformation_pipeline', true);
agent.addDomain('finance_and_business/investment_services', true);

// 4. Set trust mechanisms
agent.setTrust(true, true, false); // reputation, cryptoEconomic, teeAttestation

// 5. Set active status
agent.setActive(true);

// 6. Register (pins metadata to IPFS + on-chain tx)
const registrationFile = await agent.registerIPFS();
console.log(`Agent registered: ${registrationFile.agentId}`);
```

Alternative: `await agent.registerHTTP('https://your-metadata-url.com/')` to skip IPFS.

For updates, mutate agent fields and call `registerIPFS()` / `registerHTTP()` again.

> Version-sensitive: `createAgent`, `setMCP`, `setA2A`, `setENS`, `addSkill`, `addDomain`, `setTrust`, `setActive`, `registerIPFS` reflect v1.5.3.
