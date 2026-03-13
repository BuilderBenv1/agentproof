import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Discover AI Agents — Search the ERC-8004 Ecosystem",
  description: "Search, filter, and discover AI agents across the ERC-8004 ecosystem. Filter by chain, category, trust tier, open source status, and autonomy level.",
  keywords: ["discover AI agents", "search AI agents", "ERC-8004 search", "find trusted agents", "AI agent marketplace"],
  alternates: { canonical: "https://agentproof.sh/discover" },
  openGraph: {
    title: "Discover AI Agents — Search the ERC-8004 Ecosystem",
    description: "Search and filter AI agents across 21 chains with real-time trust scoring.",
    url: "https://agentproof.sh/discover",
  },
};
export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
