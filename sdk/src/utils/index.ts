import { ethers } from "ethers";

export function encodeMetadataURI(metadata: Record<string, unknown>): string {
  const json = JSON.stringify(metadata);
  const base64 = Buffer.from(json).toString("base64");
  return `data:application/json;base64,${base64}`;
}

export function decodeMetadataURI(uri: string): Record<string, unknown> {
  if (uri.startsWith("data:application/json;base64,")) {
    const base64 = uri.replace("data:application/json;base64,", "");
    const json = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(json);
  }
  throw new Error("Unsupported URI format. Expected data:application/json;base64,…");
}

export function hashTask(taskDescription: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(taskDescription));
}

export function parseAvax(amount: string): bigint {
  return ethers.parseEther(amount);
}

export function formatAvax(wei: bigint): string {
  return ethers.formatEther(wei);
}
