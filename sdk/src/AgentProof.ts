import { ethers } from "ethers";
import { IDENTITY_REGISTRY_ABI, REPUTATION_REGISTRY_ABI, VALIDATION_REGISTRY_ABI, AGENTPROOF_CORE_ABI } from "./contracts/abis";
import { getAddresses, ContractAddresses } from "./contracts/addresses";
import type {
  AgentProofConfig,
  AgentIdentity,
  AgentProfile,
  Feedback,
  ValidationRequest,
  ValidationResponse,
  TopAgentsResult,
  AgentRegisteredEvent,
  FeedbackSubmittedEvent,
  ValidationSubmittedEvent,
} from "./types";

export class AgentProof {
  public readonly provider: ethers.JsonRpcProvider;
  public readonly signer: ethers.Signer | null;
  public readonly addresses: ContractAddresses;

  public readonly identityRegistry: ethers.Contract;
  public readonly reputationRegistry: ethers.Contract;
  public readonly validationRegistry: ethers.Contract;
  public readonly agentProofCore: ethers.Contract;

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

    this.identityRegistry = new ethers.Contract(this.addresses.identityRegistry, IDENTITY_REGISTRY_ABI, signerOrProvider);
    this.reputationRegistry = new ethers.Contract(this.addresses.reputationRegistry, REPUTATION_REGISTRY_ABI, signerOrProvider);
    this.validationRegistry = new ethers.Contract(this.addresses.validationRegistry, VALIDATION_REGISTRY_ABI, signerOrProvider);
    this.agentProofCore = new ethers.Contract(this.addresses.agentProofCore, AGENTPROOF_CORE_ABI, signerOrProvider);
  }

  private requireSigner(): ethers.Signer {
    if (!this.signer) {
      throw new Error("Signer required for write operations. Provide privateKey or signer in config.");
    }
    return this.signer;
  }

  // ─── Identity ──────────────────────────────────────────────

  async registerAgent(agentURI: string, overrides?: { value?: bigint }): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const bond = overrides?.value ?? ethers.parseEther("0.1");
    const tx = await this.identityRegistry.registerAgent(agentURI, { value: bond });
    return tx.wait();
  }

  async updateAgentURI(agentId: number | bigint, newURI: string): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.identityRegistry.updateAgentURI(agentId, newURI);
    return tx.wait();
  }

  async getAgent(agentId: number | bigint): Promise<AgentIdentity> {
    const owner = await this.identityRegistry.getAgentOwner(agentId);
    const agentURI = await this.identityRegistry.getAgentURI(agentId);
    return { agentId: BigInt(agentId), owner, agentURI };
  }

  async isRegistered(address: string): Promise<boolean> {
    return this.identityRegistry.isRegistered(address);
  }

  async totalAgents(): Promise<bigint> {
    return this.identityRegistry.totalAgents();
  }

  async getRegistrationBond(): Promise<bigint> {
    return this.identityRegistry.registrationBond();
  }

  // ─── Reputation ────────────────────────────────────────────

  async submitFeedback(
    agentId: number | bigint,
    rating: number,
    feedbackURI: string,
    taskHash: string
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    const tx = await this.reputationRegistry.submitFeedback(agentId, rating, feedbackURI, taskHash);
    return tx.wait();
  }

  async getAverageRating(agentId: number | bigint): Promise<bigint> {
    return this.reputationRegistry.getAverageRating(agentId);
  }

  async getFeedbackCount(agentId: number | bigint): Promise<bigint> {
    return this.reputationRegistry.getFeedbackCount(agentId);
  }

  async getFeedback(agentId: number | bigint, index: number | bigint): Promise<Feedback> {
    const result = await this.reputationRegistry.getFeedback(agentId, index);
    return {
      reviewer: result[0],
      rating: Number(result[1]),
      feedbackURI: result[2],
      taskHash: result[3],
      timestamp: result[4],
    };
  }

  // ─── Validation ────────────────────────────────────────────

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

  // ─── Aggregated (Core) ────────────────────────────────────

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

  // ─── Events ────────────────────────────────────────────────

  onAgentRegistered(callback: (event: AgentRegisteredEvent) => void): void {
    this.identityRegistry.on("AgentRegistered", (agentId: bigint, owner: string, agentURI: string) => {
      callback({ agentId, owner, agentURI });
    });
  }

  onFeedbackSubmitted(callback: (event: FeedbackSubmittedEvent) => void): void {
    this.reputationRegistry.on("FeedbackSubmitted", (agentId: bigint, reviewer: string, rating: number, taskHash: string) => {
      callback({ agentId, reviewer, rating, taskHash });
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
