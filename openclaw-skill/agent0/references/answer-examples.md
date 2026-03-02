# Answer Examples

## Example: "How do I register an agent with agent0 in Node?"

1. Install: `npm install agent0-sdk`
2. Initialize SDK:
   ```ts
   import { SDK } from 'agent0-sdk';
   const sdk = new SDK({ chainId: 11155111, rpcUrl: process.env.RPC_URL!, privateKey: process.env.PRIVATE_KEY!, ipfs: 'pinata', pinataJwt: process.env.PINATA_JWT });
   ```
3. Create and configure agent:
   ```ts
   const agent = sdk.createAgent('My Agent', 'Does useful things.', 'https://example.com/img.png');
   await agent.setMCP('https://mcp.example.com/');
   agent.addSkill('data_engineering/data_transformation_pipeline', true);
   agent.setActive(true);
   const reg = await agent.registerIPFS();
   ```
4. Verify: check `reg.agentId`, then `await sdk.getAgent('11155111:' + reg.agentId)` to confirm indexed visibility.

## Example: "Should I use TS or Python?"

- Use TS for Node-centric product integration (ESM only, Node 22+).
- Use Python for backend data/evaluation pipelines (Python 3.8+).
- Both SDKs share the same API surface and package name (`agent0-sdk`).

## Example: "How do I search for agents with specific MCP tools?"

```ts
const results = await sdk.searchAgents({ mcpTools: ['code_generation'], active: true });
```

```python
results = sdk.searchAgents(filters={"mcpTools": ["code_generation"], "active": True})
```

## Example: "Why is search missing my new agent?"

- Subgraph indexing may lag writes by seconds to minutes.
- Verify transaction success via `tx.waitConfirmed()` receipt.
- Retry `searchAgents` or `getAgent` after a short delay.
- Compare with direct on-chain read if urgency is high.

## Example: "How do I give feedback to an agent?"

```ts
const tx = await sdk.giveFeedback('11155111:123', 85, 'data_analyst', 'finance', 'https://api.example.com/feedback');
const { receipt } = await tx.waitConfirmed();
```

```python
tx = sdk.giveFeedback(agentId="11155111:123", value=85, tag1="data_analyst", tag2="finance")
feedback = tx.wait_confirmed(timeout=180).result
```

## Example: "How do I register without IPFS?"

Use HTTP registration with a stable metadata URL:

```ts
await agent.registerHTTP('https://your-server.com/agent-metadata.json');
```

```python
agent.registerHTTP("https://your-server.com/agent-metadata.json")
```
