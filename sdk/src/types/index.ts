import { ethers } from "ethers";

export interface AgentProofConfig {
  rpcUrl: string;
  chainId?: number;
  privateKey?: string;
  signer?: ethers.Signer;
  contracts?: {
    identityRegistry?: string;
    reputationRegistry?: string;
    validationRegistry?: string;
    agentProofCore?: string;
    insurancePool?: string;
    agentPayments?: string;
    reputationGate?: string;
    agentMonitor?: string;
    agentSplits?: string;
  };
}

export interface AgentIdentity {
  agentId: bigint;
  owner: string;
  agentURI: string;
}

export interface AgentProfile {
  agentId: bigint;
  owner: string;
  agentURI: string;
  feedbackCount: bigint;
  averageRating: bigint;
  validationSuccessRate: bigint;
  totalValidations: bigint;
  completedValidations: bigint;
  successfulValidations: bigint;
}

// ERC-8004 feedback structure (official)
export interface ERC8004Feedback {
  agentId: bigint;
  reviewer: string;
  value: bigint;           // int128
  valueDecimals: number;   // uint8
  tag1: string;            // bytes32
  tag2: string;            // bytes32
  endpoint: string;
  feedbackURI: string;
  feedbackHash: string;    // bytes32
  timestamp: bigint;
  revoked: boolean;
  responseURI: string;
}

// ERC-8004 agent summary from reputation registry
export interface ERC8004ReputationSummary {
  totalFeedback: bigint;
  averageValue: bigint;       // int128
  averageValueDecimals: number; // uint8
}

// Legacy feedback structure (custom contracts)
export interface Feedback {
  reviewer: string;
  rating: number;
  feedbackURI: string;
  taskHash: string;
  timestamp: bigint;
}

export interface ValidationRequest {
  agentId: bigint;
  taskHash: string;
  taskURI: string;
  requester: string;
  timestamp: bigint;
  isCompleted: boolean;
}

export interface ValidationResponse {
  validationId: bigint;
  validator: string;
  isValid: boolean;
  proofURI: string;
  timestamp: bigint;
}

// ERC-8004 event types
export interface AgentRegisteredEvent {
  agentId: bigint;
  owner: string;
  agentURI: string;
}

export interface NewFeedbackEvent {
  feedbackId: bigint;
  agentId: bigint;
  reviewer: string;
  value: bigint;
  valueDecimals: number;
  tag1: string;
  tag2: string;
}

// Legacy event types
export interface FeedbackSubmittedEvent {
  agentId: bigint;
  reviewer: string;
  rating: number;
  taskHash: string;
}

export interface ValidationSubmittedEvent {
  validationId: bigint;
  validator: string;
  isValid: boolean;
}

export interface TopAgentsResult {
  agentIds: bigint[];
  ratings: bigint[];
}

// ─── Phase 3 Types ──────────────────────────────────────────────────

export interface InsuranceStake {
  stakedAmount: bigint;
  tier: string;
  isStaked: boolean;
}

export interface InsuranceClaim {
  claimId: bigint;
  agentId: bigint;
  claimant: string;
  amount: bigint;
  validationId: bigint;
  evidenceURI: string;
  disputeURI: string;
  status: number; // 0=Pending, 1=Disputed, 2=Approved, 3=Rejected
  filedAt: bigint;
  resolvedAt: bigint;
}

export interface Payment {
  paymentId: bigint;
  fromAgentId: bigint;
  toAgentId: bigint;
  amount: bigint;
  token: string;
  taskHash: string;
  requiresValidation: boolean;
  status: number; // 0=Escrowed, 1=Released, 2=Refunded, 3=Cancelled
  createdAt: bigint;
  resolvedAt: bigint;
  fromCancelRequested: boolean;
  toCancelRequested: boolean;
}

export interface AgentEarnings {
  totalEarned: bigint;
  totalPaid: bigint;
}

export interface ReputationGateInfo {
  collateralMultiplier: bigint;
  interestRateDiscount: bigint;
  priorityScore: bigint;
  maxTrustedValue: bigint;
}

// ─── Phase 4 Types ──────────────────────────────────────────────────

export interface MonitorEndpoint {
  agentId: bigint;
  endpointIndex: bigint;
  url: string;
  endpointType: string;
  isActive: boolean;
  registeredAt: bigint;
}

export interface UptimeCheck {
  agentId: bigint;
  endpointIndex: bigint;
  isUp: boolean;
  latencyMs: bigint;
  timestamp: bigint;
}

export interface UptimeCounts {
  total: bigint;
  successful: bigint;
}

export interface RevenueSplit {
  splitId: bigint;
  creatorAgentId: bigint;
  agentIds: bigint[];
  sharesBps: bigint[];
  isActive: boolean;
  createdAt: bigint;
}

export interface SplitPayment {
  splitPaymentId: bigint;
  splitId: bigint;
  amount: bigint;
  token: string;
  taskHash: string;
  payer: string;
  distributed: boolean;
  createdAt: bigint;
  distributedAt: bigint;
}

export interface SplitParticipants {
  agentIds: bigint[];
  sharesBps: bigint[];
}

// Phase 4 event types

export interface EndpointRegisteredEvent {
  agentId: bigint;
  endpointIndex: bigint;
  url: string;
  endpointType: string;
}

export interface UptimeCheckLoggedEvent {
  agentId: bigint;
  endpointIndex: bigint;
  isUp: boolean;
  latencyMs: bigint;
}

export interface SplitCreatedEvent {
  splitId: bigint;
  creatorAgentId: bigint;
  agentIds: bigint[];
  sharesBps: bigint[];
}

export interface SplitDistributedEvent {
  splitPaymentId: bigint;
  splitId: bigint;
  amounts: bigint[];
}
