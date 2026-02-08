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
}

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
  // Avalanche Mainnet
  43114: {
    identityRegistry: OFFICIAL_ERC8004.mainnet.identityRegistry,
    reputationRegistry: OFFICIAL_ERC8004.mainnet.reputationRegistry,
    validationRegistry: "0xa3df69a7576EceC1056Cb731DAE69a8086F460Fc",
    agentProofCore: "0xCB4cc5DA1Abf188756f1fA50005B14113e4f7554",
    insurancePool: "0x154DFef33222D090808f3A0F50cbef864990939A",
    agentPayments: "0x4E3092E46233c32F3A0E4b782230cA67E359f35f",
    reputationGate: "0xD66C677Cf394D68fD847d760151304697D3A1a0B",
    agentMonitor: "0xaF28359675d2365EF3a5235CEda02aAbd0e670DC",
    agentSplits: "0xE243046e2C378F49AF0f94Ea7d72c95E4F88AcFc",
  },
};

export function getAddresses(chainId: number): ContractAddresses {
  const addresses = CHAIN_ADDRESSES[chainId];
  if (!addresses) {
    throw new Error(`No contract addresses configured for chain ID ${chainId}`);
  }
  return addresses;
}
