# @agentproof/sdk

TypeScript SDK for **AgentProof** — transparent reputation infrastructure for AI agents on Avalanche.

## Install

```bash
npm install @agentproof/sdk ethers
```

## Quick Start

```typescript
import { AgentProof, encodeMetadataURI, hashTask } from '@agentproof/sdk'
import { parseEther } from 'ethers'

// Read-only (no signer)
const ap = new AgentProof({
  rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  chainId: 43113,
})

// With signer for write operations
const apWrite = new AgentProof({
  rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  chainId: 43113,
  privateKey: '0x...',
})

// Register an agent
const uri = encodeMetadataURI({ name: 'My Agent', description: 'Does things', category: 'defi' })
await apWrite.registerAgent(uri, { value: parseEther('0.1') })

// Read agent data
const total = await ap.totalAgents()
const agent = await ap.getAgent(1)
const profile = await ap.getAgentProfile(1)

// Submit feedback
const taskHash = hashTask('completed-task-123')
await apWrite.submitFeedback(1, 85, 'https://feedback.json', taskHash)

// Listen for events
ap.onAgentRegistered((event) => {
  console.log(`Agent #${event.agentId} registered by ${event.owner}`)
})
```

## API

### Identity
- `registerAgent(uri, opts?)` — Register agent NFT (0.1 AVAX bond)
- `updateAgentURI(agentId, uri)` — Update metadata
- `getAgent(agentId)` — Get agent identity
- `isRegistered(address)` — Check registration
- `totalAgents()` — Total count

### Reputation
- `submitFeedback(agentId, rating, feedbackURI, taskHash)` — Submit 1-100 rating
- `getAverageRating(agentId)` — On-chain average
- `getFeedbackCount(agentId)` — Total feedback
- `getFeedback(agentId, index)` — Individual entry

### Validation
- `requestValidation(agentId, taskHash, taskURI)` — Request task validation
- `submitValidation(validationId, isValid, proofURI)` — Submit result
- `getValidation(validationId)` — Get request details

### Aggregated
- `getAgentProfile(agentId)` — Full profile with all metrics
- `getTopAgents(count)` — Top agents by rating

### Events
- `onAgentRegistered(callback)`
- `onFeedbackSubmitted(callback)`
- `onValidationSubmitted(callback)`
- `removeAllListeners()`

## License

MIT
