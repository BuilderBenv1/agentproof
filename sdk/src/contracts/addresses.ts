export interface ContractAddresses {
  identityRegistry: string;
  reputationRegistry: string;
  validationRegistry: string;
  agentProofCore: string;
}

export const CHAIN_ADDRESSES: Record<number, ContractAddresses> = {
  // Avalanche Fuji Testnet
  43113: {
    identityRegistry: "0x4Ec097F5441F24B567C4c741eAEeBcBE3D107825",
    reputationRegistry: "0xC5ED5Bd84680e503072C4F13Aa0585cc38D2B846",
    validationRegistry: "0x0282C97083f86Abb82D74C1e51097aa9Eb01f98a",
    agentProofCore: "0x833cAd4dfBBEa832C56526bc82a85BaC85015594",
  },
  // Avalanche Mainnet — to be populated after mainnet deployment
  43114: {
    identityRegistry: "",
    reputationRegistry: "",
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
