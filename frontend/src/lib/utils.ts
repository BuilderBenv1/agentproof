import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function truncateAddress(address: string, start = 6, end = 4): string {
  if (!address) return "";
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(date);
}

export function explorerTxUrl(txHash: string): string {
  return `https://snowscan.xyz/tx/${txHash}`;
}

export function explorerAddressUrl(address: string): string {
  return `https://snowscan.xyz/address/${address}`;
}

/**
 * Decode a base64 data URI to its JSON content.
 * Returns the parsed object if valid, or null otherwise.
 */
export function decodeDataUri(uri: string): Record<string, unknown> | null {
  if (!uri || !uri.startsWith("data:")) return null;
  try {
    // data:application/json;base64,<payload>
    const base64 = uri.split(",")[1];
    if (!base64) return null;
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Returns true if the URI is a navigable URL (http/https/ipfs).
 */
export function isNavigableUri(uri: string): boolean {
  if (!uri) return false;
  return /^https?:\/\//i.test(uri) || /^ipfs:\/\//i.test(uri);
}

export function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    diamond: "#B9F2FF",
    platinum: "#E5E4E2",
    gold: "#FFD700",
    silver: "#C0C0C0",
    bronze: "#CD7F32",
    unranked: "#666666",
  };
  return colors[tier] || colors.unranked;
}
