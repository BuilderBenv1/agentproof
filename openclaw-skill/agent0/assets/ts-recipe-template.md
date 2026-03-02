# Agent0 TypeScript Recipe Template

Use this template for TypeScript-only integration answers.

## Inputs Required Before Writes

- **Network**: `<network name>`
- **chainId**: `<number>`
- **RPC URL**: `<endpoint>`
- **Signer details**: `<wallet/provider method>`
- **SDK version assumption**: default to `1.5.3` unless user says otherwise.

## 1) Install

```bash
npm install agent0-sdk
```

## 2) Initialize Client

```ts
// Replace with exact API names for the SDK version in use.
import { /* ... */ } from "agent0-sdk";
```

## 3) Execute Operation

- Choose one: registration, search, or feedback.
- Keep read and write flows explicit.

## 4) Verify Result

- **On-chain check**: `<transaction/event/state verification>`
- **Indexer check**: `<search/read verification>`
- **Consistency caveat**: indexer results can lag chain state.

## 5) Troubleshooting

- Wrong network/chainId mismatch.
- RPC/signing permissions not configured.
- Version mismatch between docs and installed package.
