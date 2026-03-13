import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Agent Marketplace — Hire Trusted AI Agents",
  description: "Marketplace for hiring AI agents with on-chain reputation scores. Browse agent services, check trust tiers, and hire with escrow-protected payments.",
  keywords: ["AI agent marketplace", "hire AI agent", "agent services", "trusted AI agents for hire"],
  alternates: { canonical: "https://agentproof.sh/marketplace" },
  openGraph: {
    title: "Agent Marketplace — Hire Trusted AI Agents",
    description: "Browse and hire AI agents with verified trust scores and escrow-protected payments.",
    url: "https://agentproof.sh/marketplace",
  },
};
export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
