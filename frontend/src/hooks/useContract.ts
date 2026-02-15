"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useSendTransaction,
} from "wagmi";
import { keccak256, toHex, decodeEventLog } from "viem";
import { IDENTITY_REGISTRY_ABI, REPUTATION_REGISTRY_ABI, AGENT_PAYMENTS_ABI } from "@/lib/contracts";
import { CONTRACT_ADDRESSES, PROTOCOL_FEE, TREASURY_ADDRESS } from "@/lib/constants";

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

type RegistrationStep = "idle" | "fee" | "fee_confirming" | "register" | "register_confirming" | "done";

export function useRegisterAgent() {
  const [step, setStep] = useState<RegistrationStep>("idle");
  const [agentId, setAgentId] = useState<number | null>(null);
  const [pendingURI, setPendingURI] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Send protocol fee
  const {
    sendTransaction,
    data: feeHash,
    isPending: feePending,
    error: feeError,
    reset: resetFee,
  } = useSendTransaction();

  const {
    isLoading: feeConfirming,
    isSuccess: feeSuccess,
  } = useWaitForTransactionReceipt({ hash: feeHash });

  // Step 2: Register on ERC-8004
  const {
    writeContract,
    data: registerHash,
    isPending: registerPending,
    error: registerError,
    reset: resetRegister,
  } = useWriteContract();

  const {
    data: registerReceipt,
    isLoading: registerConfirming,
    isSuccess: registerSuccess,
  } = useWaitForTransactionReceipt({ hash: registerHash });

  // Start the registration flow
  const register = useCallback((agentURI: string) => {
    if (!CONTRACT_ADDRESSES.identityRegistry) {
      setErrorMsg("Identity Registry address not configured");
      return;
    }

    setErrorMsg(null);
    setPendingURI(agentURI);
    setStep("fee");

    // Send 0.05 AVAX protocol fee to treasury
    sendTransaction({
      to: TREASURY_ADDRESS,
      value: PROTOCOL_FEE,
    });
  }, [sendTransaction]);

  // When fee is confirmed, proceed to register
  useEffect(() => {
    if (feeSuccess && pendingURI && step === "fee") {
      setStep("register");
      writeContract({
        address: CONTRACT_ADDRESSES.identityRegistry as `0x${string}`,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "register",
        args: [pendingURI],
      });
    }
  }, [feeSuccess, pendingURI, step, writeContract]);

  // When register is confirmed, extract agent ID from receipt
  useEffect(() => {
    if (registerSuccess && registerReceipt && step === "register") {
      setStep("done");

      // Decode the ERC-721 Transfer event to get the minted tokenId
      for (const log of registerReceipt.logs) {
        try {
          const event = decodeEventLog({
            abi: IDENTITY_REGISTRY_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (event.eventName === "Transfer") {
            const tokenId = Number((event.args as { tokenId: bigint }).tokenId);
            setAgentId(tokenId);
            break;
          }
        } catch {
          // Not a Transfer event from this ABI, skip
        }
      }
    }
  }, [registerSuccess, registerReceipt, step]);

  // Track errors
  useEffect(() => {
    if (feeError) {
      setErrorMsg(feeError.message?.includes("User rejected")
        ? "Transaction rejected in wallet"
        : feeError.message || "Fee payment failed");
      setStep("idle");
    }
  }, [feeError]);

  useEffect(() => {
    if (registerError) {
      setErrorMsg(registerError.message?.includes("User rejected")
        ? "Transaction rejected in wallet"
        : registerError.message || "Registration failed");
      setStep("idle");
    }
  }, [registerError]);

  const isPending = step === "fee" && feePending;
  const isConfirming =
    (step === "fee" && feeConfirming) ||
    (step === "register" && (registerPending || registerConfirming));
  const isSuccess = step === "done" && registerSuccess;

  const statusText = (() => {
    if (step === "fee" && feePending) return "Confirm fee payment in wallet...";
    if (step === "fee" && feeConfirming) return "Processing protocol fee...";
    if (step === "register" && registerPending) return "Confirm registration in wallet...";
    if (step === "register" && registerConfirming) return "Minting agent identity...";
    return null;
  })();

  function reset() {
    setStep("idle");
    setAgentId(null);
    setPendingURI(null);
    setErrorMsg(null);
    resetFee();
    resetRegister();
  }

  return {
    register,
    registerHash,
    feeHash,
    isPending,
    isConfirming,
    isSuccess,
    agentId,
    statusText,
    error: errorMsg ? { message: errorMsg } : null,
    reset,
  };
}

export function useIsRegistered(address: string | undefined) {
  // ERC-8004 uses balanceOf > 0 to check registration
  const { data, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.identityRegistry as `0x${string}`,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address && !!CONTRACT_ADDRESSES.identityRegistry,
    },
  });

  const balance = data as bigint | undefined;
  const isRegistered = balance !== undefined ? balance > BigInt(0) : undefined;

  return { isRegistered, isLoading };
}

export function useSubmitFeedback() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  function submitFeedback(agentId: number, rating: number, taskDescription: string) {
    if (!CONTRACT_ADDRESSES.reputationRegistry) {
      throw new Error("Reputation Registry address not configured");
    }

    const feedbackURI = `data:application/json;base64,${btoa(JSON.stringify({
      rating,
      task: taskDescription,
      timestamp: new Date().toISOString(),
    }))}`;

    const feedbackHash = keccak256(toHex(taskDescription));

    // Official ERC-8004: giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)
    writeContract({
      address: CONTRACT_ADDRESSES.reputationRegistry as `0x${string}`,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "giveFeedback",
      args: [
        BigInt(agentId),
        BigInt(rating),     // int128 value
        0,                  // uint8 valueDecimals
        ZERO_BYTES32,       // tag1
        ZERO_BYTES32,       // tag2
        "",                 // endpoint
        feedbackURI,
        feedbackHash,
      ],
    });
  }

  return { submitFeedback, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useTotalAgents() {
  const { data, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.identityRegistry as `0x${string}`,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "totalSupply",
    query: {
      enabled: !!CONTRACT_ADDRESSES.identityRegistry,
    },
  });

  return { totalAgents: data ? Number(data) : 0, isLoading };
}

// ─── Hire Agent via AgentPayments escrow ──────────────────────────────

type HireStep = "idle" | "sending" | "confirming" | "done";

export function useHireAgent() {
  const [step, setStep] = useState<HireStep>("idle");
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    writeContract,
    data: txHash,
    isPending: isSending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({ hash: txHash });

  // Hire an agent: escrow AVAX into AgentPayments
  const hire = useCallback(
    (toAgentId: number, amountAvax: number, taskDescription: string) => {
      if (!CONTRACT_ADDRESSES.agentPayments) {
        setErrorMsg("AgentPayments contract not configured");
        return;
      }

      setErrorMsg(null);
      setStep("sending");

      const amountWei = BigInt(Math.floor(amountAvax * 1e18));
      const taskHash = keccak256(toHex(taskDescription));

      // fromAgentId = 0 means "user hire" (no agent identity needed)
      writeContract({
        address: CONTRACT_ADDRESSES.agentPayments as `0x${string}`,
        abi: AGENT_PAYMENTS_ABI,
        functionName: "createPayment",
        args: [
          BigInt(0),          // fromAgentId (0 = user)
          BigInt(toAgentId),  // toAgentId
          amountWei,          // amount
          "0x0000000000000000000000000000000000000000" as `0x${string}`, // token (address(0) = AVAX)
          taskHash,           // taskHash
          false,              // requiresValidation
        ],
        value: amountWei,     // Send AVAX with the transaction
      });
    },
    [writeContract]
  );

  // Extract paymentId from receipt
  useEffect(() => {
    if (isSuccess && receipt && step === "sending") {
      setStep("done");
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({
            abi: AGENT_PAYMENTS_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (event.eventName === "PaymentCreated") {
            const id = Number((event.args as { paymentId: bigint }).paymentId);
            setPaymentId(id);
            break;
          }
        } catch {
          // Not a PaymentCreated event, skip
        }
      }
    }
  }, [isSuccess, receipt, step]);

  // Track errors
  useEffect(() => {
    if (writeError) {
      setErrorMsg(
        writeError.message?.includes("User rejected")
          ? "Transaction rejected in wallet"
          : writeError.message || "Payment failed"
      );
      setStep("idle");
    }
  }, [writeError]);

  const statusText = (() => {
    if (step === "sending" && isSending) return "Confirm payment in wallet...";
    if (step === "sending" && isConfirming) return "Escrowing funds on-chain...";
    if (step === "done") return "Payment escrowed successfully!";
    return null;
  })();

  function reset() {
    setStep("idle");
    setPaymentId(null);
    setErrorMsg(null);
    resetWrite();
  }

  return {
    hire,
    txHash,
    paymentId,
    isPending: step === "sending" && isSending,
    isConfirming: step === "sending" && isConfirming,
    isSuccess: step === "done",
    statusText,
    error: errorMsg ? { message: errorMsg } : null,
    reset,
  };
}
