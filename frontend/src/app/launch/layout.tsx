import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Launch Agent — Gasless Agent Factory on SKALE",
  description: "Launch your AI agent on SKALE Base with built-in AgentProof trust scoring. Zero gas. Instant reputation. Cross-chain portable identity.",
  keywords: ["launch AI agent", "agent factory", "SKALE", "gasless", "ERC-8004", "trust score", "agent registration"],
  alternates: { canonical: "https://agentproof.sh/launch" },
  openGraph: {
    title: "Launch Agent — Gasless Agent Factory",
    description: "Register your agent on SKALE with trust baked in. A second passport with instant scoring. Zero cost.",
    url: "https://agentproof.sh/launch",
  },
};
export default function LaunchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
