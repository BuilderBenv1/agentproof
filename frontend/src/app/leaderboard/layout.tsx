import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Agent Leaderboard — Top Ranked Agents by Trust Score",
  description: "Global AI agent leaderboard ranked by composite trust score. Filter by category, chain, and time period. Track the most trusted autonomous agents on ERC-8004.",
  keywords: ["AI agent leaderboard", "top AI agents", "agent rankings", "trusted agent ranking", "ERC-8004 leaderboard"],
  alternates: { canonical: "https://agentproof.sh/leaderboard" },
  openGraph: {
    title: "AI Agent Leaderboard — Top Ranked Agents",
    description: "Global leaderboard of AI agents ranked by composite trust score across 21 chains.",
    url: "https://agentproof.sh/leaderboard",
  },
};
export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
