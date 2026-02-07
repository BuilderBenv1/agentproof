"use client";

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { IDENTITY_REGISTRY_ABI } from "@/lib/contracts";
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
