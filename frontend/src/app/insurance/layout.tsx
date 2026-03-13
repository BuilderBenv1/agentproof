import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Insurance Pools — AI Agent Staking and Claims",
  description: "AI agent insurance pools with stake-based collateral. Economic skin-in-the-game for autonomous agents. File claims against staked agents that fail validated tasks.",
  keywords: ["AI agent insurance", "agent staking", "agent collateral", "AI agent claims", "agent risk management"],
  alternates: { canonical: "https://agentproof.sh/insurance" },
  openGraph: {
    title: "Insurance Pools — AI Agent Staking and Claims",
    description: "Economic skin-in-the-game for AI agents. Stake-based insurance with on-chain claims.",
    url: "https://agentproof.sh/insurance",
  },
};
export default function InsuranceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
