"use client";

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, toHex } from "viem";
import { IDENTITY_REGISTRY_ABI, REPUTATION_REGISTRY_ABI } from "@/lib/contracts";
import { CONTRACT_ADDRESSES } from "@/lib/constants";

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

export function useRegisterAgent() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  function register(agentURI: string) {
    if (!CONTRACT_ADDRESSES.identityRegistry) {
      throw new Error("Identity Registry address not configured");
    }

    // Official ERC-8004: register(string agentURI) — no bond required
    writeContract({
      address: CONTRACT_ADDRESSES.identityRegistry as `0x${string}`,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "register",
      args: [agentURI],
    });
  }

  return { register, hash, isPending, isConfirming, isSuccess, error };
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
    // We use value=rating (1-100), valueDecimals=0, empty tags/endpoint
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
