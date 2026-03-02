# Trust Boundaries

ERC-8004 improves verifiability but does not eliminate all trust assumptions.

## Boundary Checklist

- **On-chain state**: strong integrity guarantees
- **Off-chain URIs/content**: integrity depends on storage and pinning strategy
- **Indexers/search layers**: may lag chain head (eventually consistent)
- **Scorers/evaluators**: reputation quality depends on evaluator quality
- **Sybil resistance**: `getSummary` requires `clientAddresses` filter — unfiltered aggregation is vulnerable

Always label which layer a claim comes from.

## Endpoint Domain Verification

Optional `.well-known/agent-registration.json` mechanism allows domain owners to prove they control a service endpoint listed in an agent's registration file. This is an off-chain verification — not enforced by the contracts.
