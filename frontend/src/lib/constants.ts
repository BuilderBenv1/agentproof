export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const AVALANCHE_FUJI_CHAIN_ID = 43113;

export const CONTRACT_ADDRESSES = {
  identityRegistry: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY || "",
  reputationRegistry: process.env.NEXT_PUBLIC_REPUTATION_REGISTRY || "",
  validationRegistry: process.env.NEXT_PUBLIC_VALIDATION_REGISTRY || "",
};

export const TIERS = {
  diamond: { label: "Diamond", color: "#B9F2FF", minScore: 90, minFeedback: 50 },
  platinum: { label: "Platinum", color: "#E5E4E2", minScore: 80, minFeedback: 30 },
  gold: { label: "Gold", color: "#FFD700", minScore: 70, minFeedback: 20 },
  silver: { label: "Silver", color: "#C0C0C0", minScore: 60, minFeedback: 10 },
  bronze: { label: "Bronze", color: "#CD7F32", minScore: 50, minFeedback: 5 },
  unranked: { label: "Unranked", color: "#666666", minScore: 0, minFeedback: 0 },
} as const;

export const CATEGORIES = [
  { slug: "defi", name: "DeFi Agents", icon: "dollar-sign" },
  { slug: "gaming", name: "Gaming Agents", icon: "gamepad-2" },
  { slug: "rwa", name: "RWA Agents", icon: "landmark" },
  { slug: "payments", name: "Payment Agents", icon: "credit-card" },
  { slug: "data", name: "Data Agents", icon: "bar-chart-3" },
  { slug: "general", name: "General Agents", icon: "bot" },
] as const;

export const REGISTRATION_BOND = "0.1"; // AVAX
