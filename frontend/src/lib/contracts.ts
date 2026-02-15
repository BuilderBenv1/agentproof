// ─── Official ERC-8004 Identity Registry ABI ───────────────────────
// Deployed by Ava Labs on Avalanche C-Chain
export const IDENTITY_REGISTRY_ABI = [
  {
    inputs: [{ name: "agentURI", type: "string" }],
    name: "register",
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "agentURI", type: "string" },
    ],
    name: "setAgentURI",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
] as const;

// ─── Official ERC-8004 Reputation Registry ABI ─────────────────────
export const REPUTATION_REGISTRY_ABI = [
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "bytes32" },
      { name: "tag2", type: "bytes32" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    name: "giveFeedback",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getFeedbackCount",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getSummary",
    outputs: [
      {
        components: [
          { name: "totalFeedback", type: "uint256" },
          { name: "averageValue", type: "int128" },
          { name: "averageValueDecimals", type: "uint8" },
        ],
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─── AgentProof Payments ABI (escrow-based agent hiring) ────────────
export const AGENT_PAYMENTS_ABI = [
  {
    inputs: [
      { name: "fromAgentId", type: "uint256" },
      { name: "toAgentId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "token", type: "address" },
      { name: "taskHash", type: "bytes32" },
      { name: "requiresValidation", type: "bool" },
    ],
    name: "createPayment",
    outputs: [{ type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "paymentId", type: "uint256" }],
    name: "releasePayment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "paymentId", type: "uint256" }],
    name: "refundPayment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "paymentId", type: "uint256" }],
    name: "getPayment",
    outputs: [
      {
        components: [
          { name: "paymentId", type: "uint256" },
          { name: "fromAgentId", type: "uint256" },
          { name: "toAgentId", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "token", type: "address" },
          { name: "taskHash", type: "bytes32" },
          { name: "requiresValidation", type: "bool" },
          { name: "status", type: "uint8" },
          { name: "cancelRequestedByFrom", type: "bool" },
          { name: "cancelRequestedByTo", type: "bool" },
          { name: "createdAt", type: "uint256" },
          { name: "resolvedAt", type: "uint256" },
        ],
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getAgentPayments",
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getAgentEarnings",
    outputs: [
      { name: "totalEarned", type: "uint256" },
      { name: "totalPaid", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "paymentId", type: "uint256" },
      { indexed: true, name: "fromAgentId", type: "uint256" },
      { indexed: true, name: "toAgentId", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "token", type: "address" },
    ],
    name: "PaymentCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "paymentId", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
    name: "PaymentReleased",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "paymentId", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
    name: "PaymentRefunded",
    type: "event",
  },
] as const;

// ─── AgentProof Validation Registry ABI (custom) ───────────────────
export const VALIDATION_REGISTRY_ABI = [
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "taskHash", type: "bytes32" },
      { name: "taskURI", type: "string" },
    ],
    name: "requestValidation",
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "validationId", type: "uint256" },
      { name: "isValid", type: "bool" },
      { name: "proofURI", type: "string" },
    ],
    name: "submitValidation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
