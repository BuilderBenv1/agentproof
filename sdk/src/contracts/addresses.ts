export interface ContractAddresses {
  identityRegistry: string;
  reputationRegistry: string;
  validationRegistry: string;
  agentProofCore: string;
  // Phase 3 contracts (optional — populated after deployment)
  insurancePool?: string;
  agentPayments?: string;
  reputationGate?: string;
  // Phase 4 contracts (optional — populated after deployment)
  agentMonitor?: string;
  agentSplits?: string;
  // ERC-8183 hook contracts (optional — populated after deployment)
  agentProofHook?: string;
  addressResolver?: string;
  // On-chain trust score store — populated by the score pusher every ~5min.
  // This is what AgentProof.gateX402() reads from.
  trustScoreOracle?: string;
}

// Zero address placeholder for optional/not-yet-deployed registries.
// Used on chains where only the ERC-8183 hook stack is live.
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Official ERC-8004 registries deployed by Ava Labs
export const OFFICIAL_ERC8004 = {
  fuji: {
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
  mainnet: {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  },
} as const;

// AgentProof custom contracts (validation, scoring, aggregation)
export const AGENTPROOF_CUSTOM = {
  fuji: {
    validationRegistry: "0x0282C97083f86Abb82D74C1e51097aa9Eb01f98a",
    agentProofCore: "0x833cAd4dfBBEa832C56526bc82a85BaC85015594",
    // Legacy custom registries (kept for reference)
    legacyIdentityRegistry: "0x4Ec097F5441F24B567C4c741eAEeBcBE3D107825",
    legacyReputationRegistry: "0xC5ED5Bd84680e503072C4F13Aa0585cc38D2B846",
  },
} as const;

// Default addresses use official ERC-8004 for identity/reputation, custom for validation/core
export const CHAIN_ADDRESSES: Record<number, ContractAddresses> = {
  // Avalanche Fuji Testnet
  43113: {
    identityRegistry: OFFICIAL_ERC8004.fuji.identityRegistry,
    reputationRegistry: OFFICIAL_ERC8004.fuji.reputationRegistry,
    validationRegistry: AGENTPROOF_CUSTOM.fuji.validationRegistry,
    agentProofCore: AGENTPROOF_CUSTOM.fuji.agentProofCore,
  },
  // Avalanche Mainnet — v2 hook + gate deployed 2026-04-21
  43114: {
    identityRegistry: OFFICIAL_ERC8004.mainnet.identityRegistry,
    reputationRegistry: OFFICIAL_ERC8004.mainnet.reputationRegistry,
    validationRegistry: "0xa3df69a7576EceC1056Cb731DAE69a8086F460Fc",
    agentProofCore: "0xCB4cc5DA1Abf188756f1fA50005B14113e4f7554",
    insurancePool: "0x154DFef33222D090808f3A0F50cbef864990939A",
    agentPayments: "0x4E3092E46233c32F3A0E4b782230cA67E359f35f",
    // reputationGate was 0xD66C677Cf394D68fD847d760151304697D3A1a0B (v1, legacy).
    // v2 (job-anchored attestation gate) deployed 2026-04-21 — use this going forward.
    reputationGate: "0x2a1F64fd4A402eD7A8b570C008A941A05F1EdAF8",
    agentProofHook: "0x9c872066A1E484Fda0fCb4cCc301E8488Ba23Cfc",
    agentMonitor: "0xaF28359675d2365EF3a5235CEda02aAbd0e670DC",
    agentSplits: "0xE243046e2C378F49AF0f94Ea7d72c95E4F88AcFc",
  },
  // SKALE Base Mainnet — ERC-8183 hook + gate deployed 2026-04-21
  1187947933: {
    identityRegistry: OFFICIAL_ERC8004.mainnet.identityRegistry,
    reputationRegistry: OFFICIAL_ERC8004.mainnet.reputationRegistry,
    validationRegistry: ZERO_ADDRESS,
    agentProofCore: ZERO_ADDRESS,
    agentProofHook: "0x47542257F7d839C8986837C9Adb9c931B0C00AA0",
    reputationGate: "0x61A2a41F987bf55Ef7eAB478bF575Cd05Abd3650",
    trustScoreOracle: "0xe4eBEf67D698C1b45A2aaacB9ce7c4B0B4E53682",
  },
  // Optimism Mainnet — deployed 2026-04-21
  10: {
    identityRegistry: OFFICIAL_ERC8004.mainnet.identityRegistry,
    reputationRegistry: OFFICIAL_ERC8004.mainnet.reputationRegistry,
    validationRegistry: ZERO_ADDRESS,
    agentProofCore: ZERO_ADDRESS,
    agentProofHook: "0xbe9eC346429F9B57Ce4e8d001E25C6d1204F4E91",
    reputationGate: "0x42e85B5488791751CC7465C3c368d5bD6c43A591",
    trustScoreOracle: "0xe4eBEf67D698C1b45A2aaacB9ce7c4B0B4E53682",
  },
  // Polygon Mainnet — deployed 2026-04-21
  137: {
    identityRegistry: OFFICIAL_ERC8004.mainnet.identityRegistry,
    reputationRegistry: OFFICIAL_ERC8004.mainnet.reputationRegistry,
    validationRegistry: ZERO_ADDRESS,
    agentProofCore: ZERO_ADDRESS,
    agentProofHook: "0x4314B80c773234dDcadFd078dDD3068F48f8E130",
    reputationGate: "0x5Cce2740CB96c8478424787feD1350aAf0B4c942",
    trustScoreOracle: "0xe4eBEf67D698C1b45A2aaacB9ce7c4B0B4E53682",
  },
  // Linea Mainnet — deployed 2026-04-21
  59144: {
    identityRegistry: OFFICIAL_ERC8004.mainnet.identityRegistry,
    reputationRegistry: OFFICIAL_ERC8004.mainnet.reputationRegistry,
    validationRegistry: ZERO_ADDRESS,
    agentProofCore: ZERO_ADDRESS,
    agentProofHook: "0xe32c2fF8cbc2A0090233142b2428d734A5c07271",
    reputationGate: "0x6D407a900aEE83922C4A7267522D6FF0066C017a",
    trustScoreOracle: "0xe4eBEf67D698C1b45A2aaacB9ce7c4B0B4E53682",
  },
  // Celo Mainnet — deployed 2026-04-21
  42220: {
    identityRegistry: OFFICIAL_ERC8004.mainnet.identityRegistry,
    reputationRegistry: OFFICIAL_ERC8004.mainnet.reputationRegistry,
    validationRegistry: ZERO_ADDRESS,
    agentProofCore: ZERO_ADDRESS,
    agentProofHook: "0x758Eb3BFC07e809e425a64b807Ed3890Fe3311a8",
    reputationGate: "0xd3985aCf56EFC308e35D82c0f9EFd6BE76907524",
    trustScoreOracle: "0x5Cce2740CB96c8478424787feD1350aAf0B4c942",
  },
};

export function getAddresses(chainId: number): ContractAddresses {
  const addresses = CHAIN_ADDRESSES[chainId];
  if (!addresses) {
    throw new Error(`No contract addresses configured for chain ID ${chainId}`);
  }
  return addresses;
}
