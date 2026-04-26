/**
 * PrivateValidation — client helpers for AgentProof's sealed-ballot validation
 *                     contract on SKALE Base (BITE-enabled chains).
 *
 * Validators encrypt their `isValid` vote off-chain with `@skalenetwork/bite`,
 * submit the ciphertext on-chain, and only the aggregate consensus is ever
 * revealed (via a CTX callback into the contract's onDecrypt hook).
 *
 * See contracts/src/PrivateValidationRegistry.sol for the contract side.
 */

import { ethers, Contract, type Signer, type Provider, type ContractTransactionResponse } from "ethers";
import { BITE } from "@skalenetwork/bite";
import { PRIVATE_VALIDATION_REGISTRY_ABI } from "./contracts/abis";

// CTX gas payment enforced by the contract (PrivateValidationRegistry.CTX_GAS_PAYMENT).
export const CTX_REVEAL_FEE = ethers.parseEther("0.06");

export enum ValidationState {
  Open = 0,
  Revealing = 1,
  Resolved = 2,
}

export interface ValidationStatus {
  validationId: bigint;
  agentId: bigint;
  taskHash: string;
  taskURI: string;
  requester: string;
  createdAt: number;
  deadline: number;
  quorum: number;
  votesReceived: number;
  state: ValidationState;
  consensusValid: boolean;
  yesVotes: number;
}

export interface PrivateValidationConfig {
  /** Deployed PrivateValidationRegistry address. */
  contractAddress: string;
  /** BITE-enabled RPC (SKALE Base or SKALE Base Sepolia). */
  rpcUrl: string;
}

/**
 * Encrypt an `isValid` vote with the SKALE network's BLS threshold key,
 * binding the ciphertext to a specific contract via AAD so it cannot be
 * replayed against any other CTX-submitting contract.
 *
 * Returns a 0x-prefixed hex string — the ABI-encoded `bytes` payload ready
 * to pass to submitEncryptedVote.
 */
export async function encryptVote(
  isValid: boolean,
  cfg: PrivateValidationConfig,
): Promise<string> {
  const bite = new BITE(cfg.rpcUrl);
  const plaintextHex = ethers.AbiCoder.defaultAbiCoder().encode(["bool"], [isValid]);
  // AAD = the contract address — only this contract can submit to CTX.
  return bite.encryptMessageForCTX(plaintextHex, cfg.contractAddress);
}

/**
 * Submit an encrypted `isValid` ballot to the registry.
 *
 * Encrypts off-chain via `encryptVote` then calls submitEncryptedVote on-chain.
 * Returns the tx response — await `.wait()` for confirmation.
 */
export async function submitVote(
  signer: Signer,
  validationId: bigint | number,
  isValid: boolean,
  cfg: PrivateValidationConfig,
): Promise<ContractTransactionResponse> {
  const ciphertext = await encryptVote(isValid, cfg);
  const contract = new Contract(cfg.contractAddress, PRIVATE_VALIDATION_REGISTRY_ABI, signer);
  return contract.submitEncryptedVote(validationId, ciphertext);
}

/**
 * Open a new private validation round.
 *
 * Returns the tx response + the new validationId (decoded from the
 * ValidationRequested event emitted by the tx).
 */
export async function requestValidation(
  signer: Signer,
  params: {
    agentId: bigint | number;
    taskHash: string; // 32-byte hex
    taskURI: string;
    quorum: number;
    votingPeriodSeconds: number;
  },
  cfg: PrivateValidationConfig,
): Promise<{ tx: ContractTransactionResponse; validationId: bigint }> {
  const contract = new Contract(cfg.contractAddress, PRIVATE_VALIDATION_REGISTRY_ABI, signer);
  const tx = await contract.requestValidation(
    params.agentId,
    params.taskHash,
    params.taskURI,
    params.quorum,
    params.votingPeriodSeconds,
  );
  const receipt = await tx.wait();
  if (!receipt) throw new Error("requestValidation: no receipt");

  const iface = new ethers.Interface(PRIVATE_VALIDATION_REGISTRY_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "ValidationRequested") {
        return { tx, validationId: parsed.args[0] as bigint };
      }
    } catch {
      // non-matching log
    }
  }
  throw new Error("requestValidation: ValidationRequested event not found in receipt");
}

/**
 * Trigger threshold decryption + tally. Pays the CTX fee (0.06 sFUEL/CREDITS).
 * Can be called by anyone once quorum is reached or the deadline has passed.
 */
export async function triggerReveal(
  signer: Signer,
  validationId: bigint | number,
  cfg: PrivateValidationConfig,
): Promise<ContractTransactionResponse> {
  const contract = new Contract(cfg.contractAddress, PRIVATE_VALIDATION_REGISTRY_ABI, signer);
  return contract.triggerReveal(validationId, { value: CTX_REVEAL_FEE });
}

/** Fetch current status of a validation round. */
export async function getValidationStatus(
  provider: Provider,
  validationId: bigint | number,
  cfg: PrivateValidationConfig,
): Promise<ValidationStatus> {
  const contract = new Contract(cfg.contractAddress, PRIVATE_VALIDATION_REGISTRY_ABI, provider);
  const r = await contract.getValidation(validationId);
  return {
    validationId: BigInt(validationId),
    agentId: r[0] as bigint,
    taskHash: r[1] as string,
    taskURI: r[2] as string,
    requester: r[3] as string,
    createdAt: Number(r[4]),
    deadline: Number(r[5]),
    quorum: Number(r[6]),
    votesReceived: Number(r[7]),
    state: Number(r[8]) as ValidationState,
    consensusValid: r[9] as boolean,
    yesVotes: Number(r[10]),
  };
}

/**
 * Poll until a validation reaches a target state (default: Resolved).
 * Useful for waiting on the async BITE decryption callback after triggerReveal.
 */
export async function waitForState(
  provider: Provider,
  validationId: bigint | number,
  cfg: PrivateValidationConfig,
  opts: { target?: ValidationState; pollMs?: number; timeoutMs?: number } = {},
): Promise<ValidationStatus> {
  const target = opts.target ?? ValidationState.Resolved;
  const pollMs = opts.pollMs ?? 2000;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const status = await getValidationStatus(provider, validationId, cfg);
    if (status.state >= target) return status;
    await new Promise((res) => setTimeout(res, pollMs));
  }
  throw new Error(
    `waitForState: timed out after ${timeoutMs}ms waiting for state >= ${ValidationState[target]}`,
  );
}
