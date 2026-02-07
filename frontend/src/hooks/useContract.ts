"use client";

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, keccak256, toHex } from "viem";
import { IDENTITY_REGISTRY_ABI, REPUTATION_REGISTRY_ABI } from "@/lib/contracts";
import { CONTRACT_ADDRESSES, REGISTRATION_BOND } from "@/lib/constants";

export function useRegisterAgent() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  function register(agentURI: string) {
    if (!CONTRACT_ADDRESSES.identityRegistry) {
      throw new Error("Identity Registry address not configured");
    }

    writeContract({
      address: CONTRACT_ADDRESSES.identityRegistry as `0x${string}`,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "registerAgent",
      args: [agentURI],
      value: parseEther(REGISTRATION_BOND),
    });
  }

  return { register, hash, isPending, isConfirming, isSuccess, error };
}

export function useIsRegistered(address: string | undefined) {
  const { data, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.identityRegistry as `0x${string}`,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "isRegistered",
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address && !!CONTRACT_ADDRESSES.identityRegistry,
    },
  });

  return { isRegistered: data as boolean | undefined, isLoading };
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

    const taskHash = keccak256(toHex(taskDescription));

    const feedbackURI = `data:application/json;base64,${btoa(JSON.stringify({
      rating,
      task: taskDescription,
      timestamp: new Date().toISOString(),
    }))}`;

    writeContract({
      address: CONTRACT_ADDRESSES.reputationRegistry as `0x${string}`,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "submitFeedback",
      args: [BigInt(agentId), rating, feedbackURI, taskHash],
    });
  }

  return { submitFeedback, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useTotalAgents() {
  const { data, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.identityRegistry as `0x${string}`,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "totalAgents",
    query: {
      enabled: !!CONTRACT_ADDRESSES.identityRegistry,
    },
  });

  return { totalAgents: data ? Number(data) : 0, isLoading };
}
