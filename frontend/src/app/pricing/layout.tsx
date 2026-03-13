import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "API Pricing — AgentProof Trust Oracle",
  description: "AgentProof API pricing tiers. Pay-per-call at $0.05 or subscribe from $250/month. Free tier available. Query AI agent trust scores at scale.",
  keywords: ["AgentProof pricing", "AI agent API pricing", "trust score API cost", "agent reputation pricing"],
  alternates: { canonical: "https://agentproof.sh/pricing" },
  openGraph: {
    title: "API Pricing — AgentProof Trust Oracle",
    description: "Flexible API pricing from pay-per-call to enterprise. Query AI agent trust scores at scale.",
    url: "https://agentproof.sh/pricing",
  },
};
export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
