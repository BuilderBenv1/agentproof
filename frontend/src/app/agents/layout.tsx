import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Agent Explorer — Browse 68,000+ Scored Agents",
  description: "Browse, search, and filter 68,000+ AI agents scored across 21 chains. Real-time trust scores, tier rankings, and behavioral analysis on ERC-8004.",
  keywords: ["AI agent directory", "ERC-8004 agents", "AI agent scores", "agent explorer", "trusted AI agents", "agent rankings"],
  alternates: { canonical: "https://agentproof.sh/agents" },
  openGraph: {
    title: "AI Agent Explorer — Browse 68,000+ Scored Agents",
    description: "Browse and search AI agents with real-time trust scores across 21 chains.",
    url: "https://agentproof.sh/agents",
  },
};
export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
