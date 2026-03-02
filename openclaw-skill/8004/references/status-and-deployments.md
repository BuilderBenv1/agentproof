# Status and Deployments

Standard status: Draft

## Deterministic Addresses (CREATE2 — same on all chains)

**Mainnets:**
- IdentityRegistry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- ReputationRegistry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

**Testnets:**
- IdentityRegistry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- ReputationRegistry: `0x8004B663056A597Dffe9eCcC1965A193B7388713`

## Deployed Networks (as of Feb 2026)

Mainnets and testnets: Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, Celo, Gnosis, Linea, Scroll, Taiko, Abstract, MegaETH, Mantle (WIP), Monad, BSC.

ValidationRegistry is not yet widely deployed.

## Caveats

- Addresses are deterministic but verify on-chain before integrating
- Always ask user which chain they target if unspecified
- Include current date in deployment status responses
