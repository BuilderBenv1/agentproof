export interface ContractAddresses {
  identityRegistry: string;
  reputationRegistry: string;
  validationRegistry: string;
  agentProofCore: string;
  // Phase 3 contracts (optional — populated after deployment)
  insurancePool?: string;
  agentPayments?: string;
  reputationGate?: string;
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
    validationRegistry: "",
    agentProofCore: "",
  },
};

export function getAddresses(chainId: number): ContractAddresses {
  const addresses = CHAIN_ADDRESSES[chainId];
  if (!addresses) {
    throw new Error(`No contract addresses configured for chain ID ${chainId}`);
  }
  return addresses;
}
