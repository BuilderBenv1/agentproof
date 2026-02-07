import { ethers } from "ethers";
import {
  IDENTITY_REGISTRY_ABI,
  REPUTATION_REGISTRY_ABI,
  VALIDATION_REGISTRY_ABI,
  AGENTPROOF_CORE_ABI,
  INSURANCE_POOL_ABI,
  AGENT_PAYMENTS_ABI,
  REPUTATION_GATE_ABI,
} from "./contracts/abis";
import { getAddresses, ContractAddresses } from "./contracts/addresses";
import type {
  AgentProofConfig,
  AgentIdentity,
  AgentProfile,
  ERC8004Feedback,
  ERC8004ReputationSummary,
  Feedback,
  ValidationRequest,
  ValidationResponse,
  TopAgentsResult,
  AgentRegisteredEvent,
  NewFeedbackEvent,
  FeedbackSubmittedEvent,
  ValidationSubmittedEvent,
  InsuranceStake,
  InsuranceClaim,
  Payment,
  AgentEarnings,
  ReputationGateInfo,
} from "./types";

export class AgentProof {
  public readonly provider: ethers.JsonRpcProvider;
  public readonly signer: ethers.Signer | null;
  public readonly addresses: ContractAddresses;

  // Official ERC-8004 registries
  public readonly identityRegistry: ethers.Contract;
  public readonly reputationRegistry: ethers.Contract;

  // AgentProof custom contracts
  public readonly validationRegistry: ethers.Contract;
  public readonly agentProofCore: ethers.Contract;

  // Phase 3 contracts (optional — available after deployment)
  public readonly insurancePool: ethers.Contract | null;
  public readonly agentPayments: ethers.Contract | null;
  public readonly reputationGate: ethers.Contract | null;

  constructor(config: AgentProofConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    if (config.signer) {
      this.signer = config.signer;
    } else if (config.privateKey) {
      this.signer = new ethers.Wallet(config.privateKey, this.provider);
    } else {
      this.signer = null;
    }

    const chainId = config.chainId || 43113;
    const customAddresses = config.contracts;
    const defaults = getAddresses(chainId);

    this.addresses = {
      identityRegistry: customAddresses?.identityRegistry || defaults.identityRegistry,
      reputationRegistry: customAddresses?.reputationRegistry || defaults.reputationRegistry,
      validationRegistry: customAddresses?.validationRegistry || defaults.validationRegistry,
      agentProofCore: customAddresses?.agentProofCore || defaults.agentProofCore,
    };

    const signerOrProvider = this.signer || this.provider;

    // Official ERC-8004 contracts
    this.identityRegistry = new ethers.Contract(this.addresses.identityRegistry, IDENTITY_REGISTRY_ABI, signerOrProvider);
    this.reputationRegistry = new ethers.Contract(this.addresses.reputationRegistry, REPUTATION_REGISTRY_ABI, signerOrProvider);

    // AgentProof custom contracts
    this.validationRegistry = new ethers.Contract(this.addresses.validationRegistry, VALIDATION_REGISTRY_ABI, signerOrProvider);
    this.agentProofCore = new ethers.Contract(this.addresses.agentProofCore, AGENTPROOF_CORE_ABI, signerOrProvider);

    // Phase 3 contracts (only initialized if addresses are provided)
    this.insurancePool = this.addresses.insurancePool
      ? new ethers.Contract(this.addresses.insurancePool, INSURANCE_POOL_ABI, signerOrProvider)
      : null;
    this.agentPayments = this.addresses.agentPayments
      ? new ethers.Contract(this.addresses.agentPayments, AGENT_PAYMENTS_ABI, signerOrProvider)
      : null;
    this.reputationGate = this.addresses.reputationGate
      ? new ethers.Contract(this.addresses.reputationGate, REPUTATION_GATE_ABI, signerOrProvider)
      : null;
  }

  private requireSigner(): ethers.Signer {
    if (!this.signer) {
      throw new Error("Signer required for write operations. Provide privateKey or signer in config.");
    }
    return this.signer;
  }

  // ─── Identity (Official ERC-8004) ────────────────────────────

  /** Register an agent on the official ERC-8004 Identity Registry. No bond required. */
  async registerAgent(agentURI: string): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.identityRegistry.register(agentURI);
    return tx.wait();
  }

  /** Update agent URI on the official ERC-8004 Identity Registry. */
  async setAgentURI(agentId: number | bigint, agentURI: string): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.identityRegistry.setAgentURI(agentId, agentURI);
    return tx.wait();
  }

  /** Get agent identity from the official ERC-8004 registry. */
  async getAgent(agentId: number | bigint): Promise<AgentIdentity> {
    const owner = await this.identityRegistry.ownerOf(agentId);
    const agentURI = await this.identityRegistry.tokenURI(agentId);
    return { agentId: BigInt(agentId), owner, agentURI };
  }

  /** Check if an address owns any agent NFT. */
  async isRegistered(address: string): Promise<boolean> {
    const balance = await this.identityRegistry.balanceOf(address);
    return balance > 0n;
  }

  /** Get total registered agents from the official registry. */
  async totalAgents(): Promise<bigint> {
    return this.identityRegistry.totalSupply();
  }

  // ─── Reputation (Official ERC-8004) ──────────────────────────

  /**
   * Submit feedback on the official ERC-8004 Reputation Registry.
   * @param agentId - The agent's token ID
   * @param value - Rating value (int128). For a 1-100 scale, use value=rating, valueDecimals=0
   * @param valueDecimals - Decimal places for the value
   * @param options - Optional tags, endpoint, feedbackURI, feedbackHash
   */
  async giveFeedback(
    agentId: number | bigint,
    value: number | bigint,
    valueDecimals: number = 0,
    options: {
      tag1?: string;
      tag2?: string;
      endpoint?: string;
      feedbackURI?: string;
      feedbackHash?: string;
    } = {}
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tag1 = options.tag1 || ethers.ZeroHash;
    const tag2 = options.tag2 || ethers.ZeroHash;
    const endpoint = options.endpoint || "";
    const feedbackURI = options.feedbackURI || "";
    const feedbackHash = options.feedbackHash || ethers.ZeroHash;
    const tx = await this.reputationRegistry.giveFeedback(
      agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash
    );
    return tx.wait();
  }

  /** Revoke a previously submitted feedback. */
  async revokeFeedback(feedbackId: number | bigint): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.reputationRegistry.revokeFeedback(feedbackId);
    return tx.wait();
  }

  /** Append a response to feedback (e.g., agent owner responding). */
  async appendResponse(feedbackId: number | bigint, responseURI: string): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.reputationRegistry.appendResponse(feedbackId, responseURI);
    return tx.wait();
  }

  /** Get feedback count for an agent from the official registry. */
  async getFeedbackCount(agentId: number | bigint): Promise<bigint> {
    return this.reputationRegistry.getFeedbackCount(agentId);
  }

  /** Read a specific feedback entry by ID from the official registry. */
  async readFeedback(feedbackId: number | bigint): Promise<ERC8004Feedback> {
    const r = await this.reputationRegistry.readFeedback(feedbackId);
    return {
      agentId: r[0],
      reviewer: r[1],
      value: r[2],
      valueDecimals: Number(r[3]),
      tag1: r[4],
      tag2: r[5],
      endpoint: r[6],
      feedbackURI: r[7],
      feedbackHash: r[8],
      timestamp: r[9],
      revoked: r[10],
      responseURI: r[11],
    };
  }

  /** Get reputation summary for an agent from the official registry. */
  async getReputationSummary(agentId: number | bigint): Promise<ERC8004ReputationSummary> {
    const r = await this.reputationRegistry.getSummary(agentId);
    return {
      totalFeedback: r[0],
      averageValue: r[1],
      averageValueDecimals: Number(r[2]),
    };
  }

  // ─── Validation (AgentProof Custom) ──────────────────────────

  async requestValidation(
    agentId: number | bigint,
    taskHash: string,
    taskURI: string
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.validationRegistry.requestValidation(agentId, taskHash, taskURI);
    return tx.wait();
  }

  async submitValidation(
    validationId: number | bigint,
    isValid: boolean,
    proofURI: string
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.validationRegistry.submitValidation(validationId, isValid, proofURI);
    return tx.wait();
  }

  async getValidation(validationId: number | bigint): Promise<ValidationRequest> {
    const r = await this.validationRegistry.getValidation(validationId);
    return {
      agentId: r[0],
      taskHash: r[1],
      taskURI: r[2],
      requester: r[3],
      timestamp: r[4],
      isCompleted: r[5],
    };
  }

  async getValidationResponse(validationId: number | bigint): Promise<ValidationResponse> {
    const r = await this.validationRegistry.getValidationResponse(validationId);
    return {
      validationId: r[0],
      validator: r[1],
      isValid: r[2],
      proofURI: r[3],
      timestamp: r[4],
    };
  }

  async getValidationsForAgent(agentId: number | bigint): Promise<bigint[]> {
    return this.validationRegistry.getValidationsForAgent(agentId);
  }

  async getValidationSuccessRate(agentId: number | bigint): Promise<bigint> {
    return this.validationRegistry.getSuccessRate(agentId);
  }

  // ─── Aggregated (AgentProof Core) ───────────────────────────

  async getAgentProfile(agentId: number | bigint): Promise<AgentProfile> {
    const p = await this.agentProofCore.getAgentProfile(agentId);
    return {
      agentId: p[0],
      owner: p[1],
      agentURI: p[2],
      feedbackCount: p[3],
      averageRating: p[4],
      validationSuccessRate: p[5],
      totalValidations: p[6],
      completedValidations: p[7],
      successfulValidations: p[8],
    };
  }

  async getTopAgents(count: number): Promise<TopAgentsResult> {
    const [agentIds, ratings] = await this.agentProofCore.getTopAgents(count);
    return { agentIds, ratings };
  }

  async setAgentCategory(agentId: number | bigint, category: string): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.agentProofCore.setAgentCategory(agentId, category);
    return tx.wait();
  }

  async getAgentsByCategory(category: string): Promise<bigint[]> {
    return this.agentProofCore.getAgentsByCategory(category);
  }

  // ─── Insurance Pool (Phase 3) ──────────────────────────────

  private requireInsurancePool(): ethers.Contract {
    if (!this.insurancePool) throw new Error("InsurancePool address not configured");
    return this.insurancePool;
  }

  /** Stake AVAX for an agent in the insurance pool. */
  async stakeForAgent(agentId: number | bigint, tier: string, amount: bigint): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const pool = this.requireInsurancePool();
    const tx = await pool.stakeForAgent(agentId, tier, { value: amount });
    return tx.wait();
  }

  /** Request unstake (starts 7-day cooldown). */
  async requestUnstake(agentId: number | bigint): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.requireInsurancePool().requestUnstake(agentId);
    return tx.wait();
  }

  /** Unstake after cooldown. */
  async unstake(agentId: number | bigint): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.requireInsurancePool().unstake(agentId);
    return tx.wait();
  }

  /** Get stake info for an agent. */
  async getAgentStake(agentId: number | bigint): Promise<InsuranceStake> {
    const [stakedAmount, tier, isStaked] = await this.requireInsurancePool().getAgentStake(agentId);
    return { stakedAmount, tier, isStaked };
  }

  /** Check if agent is insured. */
  async isInsured(agentId: number | bigint): Promise<boolean> {
    return this.requireInsurancePool().isInsured(agentId);
  }

  /** Get minimum stake for a tier. */
  async getMinimumStake(tier: string): Promise<bigint> {
    return this.requireInsurancePool().getMinimumStake(tier);
  }

  /** File a claim against a staked agent. */
  async fileClaim(
    agentId: number | bigint,
    validationId: number | bigint,
    amount: bigint,
    evidenceURI: string
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.requireInsurancePool().fileClaim(agentId, validationId, amount, evidenceURI);
    return tx.wait();
  }

  /** Get claim details. */
  async getClaim(claimId: number | bigint): Promise<InsuranceClaim> {
    const c = await this.requireInsurancePool().getClaim(claimId);
    return {
      claimId: c[0], agentId: c[1], claimant: c[2], amount: c[3],
      validationId: c[4], evidenceURI: c[5], disputeURI: c[6],
      status: Number(c[7]), filedAt: c[8], resolvedAt: c[9],
    };
  }

  // ─── Agent Payments (Phase 3) ─────────────────────────────

  private requireAgentPayments(): ethers.Contract {
    if (!this.agentPayments) throw new Error("AgentPayments address not configured");
    return this.agentPayments;
  }

  /** Create an escrow payment between agents. */
  async createPayment(
    fromAgentId: number | bigint,
    toAgentId: number | bigint,
    amount: bigint,
    token: string,
    taskHash: string,
    requiresValidation: boolean = false
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const isNative = token === ethers.ZeroAddress;
    const tx = await this.requireAgentPayments().createPayment(
      fromAgentId, toAgentId, amount, token, taskHash, requiresValidation,
      isNative ? { value: amount } : {}
    );
    return tx.wait();
  }

  /** Release a payment to the recipient. */
  async releasePayment(paymentId: number | bigint): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.requireAgentPayments().releasePayment(paymentId);
    return tx.wait();
  }

  /** Refund a payment after timeout or failed validation. */
  async refundPayment(paymentId: number | bigint): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.requireAgentPayments().refundPayment(paymentId);
    return tx.wait();
  }

  /** Get payment details. */
  async getPayment(paymentId: number | bigint): Promise<Payment> {
    const p = await this.requireAgentPayments().getPayment(paymentId);
    return {
      paymentId: p[0], fromAgentId: p[1], toAgentId: p[2], amount: p[3],
      token: p[4], taskHash: p[5], requiresValidation: p[6],
      status: Number(p[7]), createdAt: p[8], resolvedAt: p[9],
      fromCancelRequested: p[10], toCancelRequested: p[11],
    };
  }

  /** Get agent earnings and spending. */
  async getAgentEarnings(agentId: number | bigint): Promise<AgentEarnings> {
    const [totalEarned, totalPaid] = await this.requireAgentPayments().getAgentEarnings(agentId);
    return { totalEarned, totalPaid };
  }

  // ─── Reputation Gate (Phase 3) ────────────────────────────

  private requireReputationGate(): ethers.Contract {
    if (!this.reputationGate) throw new Error("ReputationGate address not configured");
    return this.reputationGate;
  }

  /** Check if an agent meets a minimum tier requirement. Reverts if not. */
  async requireMinimumTier(agentId: number | bigint, requiredTier: string): Promise<void> {
    await this.requireReputationGate().requireMinimumTier(agentId, requiredTier);
  }

  /** Get all reputation gate info for an agent. */
  async getReputationGateInfo(agentId: number | bigint): Promise<ReputationGateInfo> {
    const gate = this.requireReputationGate();
    const [collateralMultiplier, interestRateDiscount, priorityScore, maxTrustedValue] = await Promise.all([
      gate.getCollateralMultiplier(agentId),
      gate.getInterestRateDiscount(agentId),
      gate.getPriorityScore(agentId),
      gate.getMaxTrustedValue(agentId),
    ]);
    return { collateralMultiplier, interestRateDiscount, priorityScore, maxTrustedValue };
  }

  /** Check if an agent is trusted for a given value at risk. */
  async isTrustedForValue(agentId: number | bigint, valueAtRisk: bigint): Promise<boolean> {
    return this.requireReputationGate().isTrustedForValue(agentId, valueAtRisk);
  }

  /** Batch check tier for multiple agents. */
  async batchCheckTier(agentIds: (number | bigint)[], requiredTier: string): Promise<boolean[]> {
    return this.requireReputationGate().batchCheckTier(agentIds, requiredTier);
  }

  // ─── Events ─────────────────────────────────────────────────

  /** Listen for agent registrations on the official ERC-8004 registry. */
  onAgentRegistered(callback: (event: AgentRegisteredEvent) => void): void {
    this.identityRegistry.on("Registered", (agentId: bigint, owner: string, agentURI: string) => {
      callback({ agentId, owner, agentURI });
    });
  }

  /** Listen for new feedback on the official ERC-8004 reputation registry. */
  onNewFeedback(callback: (event: NewFeedbackEvent) => void): void {
    this.reputationRegistry.on("NewFeedback", (feedbackId: bigint, agentId: bigint, reviewer: string, value: bigint, valueDecimals: number, tag1: string, tag2: string) => {
      callback({ feedbackId, agentId, reviewer, value, valueDecimals, tag1, tag2 });
    });
  }

  onValidationSubmitted(callback: (event: ValidationSubmittedEvent) => void): void {
    this.validationRegistry.on("ValidationSubmitted", (validationId: bigint, validator: string, isValid: boolean) => {
      callback({ validationId, validator, isValid });
    });
  }

  removeAllListeners(): void {
    this.identityRegistry.removeAllListeners();
    this.reputationRegistry.removeAllListeners();
    this.validationRegistry.removeAllListeners();
  }
}
