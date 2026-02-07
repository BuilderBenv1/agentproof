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

export interface AgentRegisteredEvent {
  agentId: bigint;
  owner: string;
  agentURI: string;
}

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
