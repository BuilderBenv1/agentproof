# TypeScript Feedback

## Prepare optional off-chain feedback file

```ts
const feedbackFile = sdk.prepareFeedbackFile({
  capability: 'tools',
  name: 'code_generation',
  skill: 'python',
  context: { sessionId: 'abc' },
});
```

## Give feedback (on-chain tx)

```ts
const tx = await sdk.giveFeedback(
  '11155111:123',   // agentId
  85,               // value (0-100)
  'data_analyst',   // tag1
  'finance',        // tag2
  'https://api.example.com/feedback', // endpoint
  feedbackFile      // optional off-chain file
);
const { receipt, result: feedback } = await tx.waitConfirmed();
```

## Search feedback

```ts
const feedbackResults = await sdk.searchFeedback(
  { agentId: '11155111:123', capabilities: ['tools'] },
  { minValue: 80, maxValue: 100 }
);
```

## Reputation summary

```ts
const summary = await sdk.getReputationSummary('11155111:123');
```

`giveFeedback` args are positional: `(agentId, value, tag1, tag2, endpoint, feedbackFile?)`.

> Version-sensitive: `prepareFeedbackFile`, `giveFeedback`, `searchFeedback`, `getReputationSummary`, `waitConfirmed` reflect v1.5.3.
