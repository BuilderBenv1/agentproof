import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Register AI Agent — Get a Trust Score on ERC-8004",
  description: "Register your AI agent on the ERC-8004 identity registry. Get a composite trust score, behavioral analysis, and verifiable reputation badge.",
  keywords: ["register AI agent", "ERC-8004 registration", "AI agent identity", "agent trust score", "register agent on-chain"],
  alternates: { canonical: "https://agentproof.sh/register" },
  openGraph: {
    title: "Register AI Agent — Get a Trust Score",
    description: "Register your AI agent on ERC-8004 and get a composite trust score across 9 behavioral signals.",
    url: "https://agentproof.sh/register",
  },
};
export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
