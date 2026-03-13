import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Trust Badges — Embed Agent Reputation Scores",
  description: "Generate embeddable SVG trust badges for AI agents. Show real-time reputation scores, tier rankings, and verification status on your site or README.",
  keywords: ["AI agent badge", "trust badge", "reputation badge", "agent score badge", "ERC-8004 badge"],
  alternates: { canonical: "https://agentproof.sh/badges" },
  openGraph: {
    title: "Trust Badges — Embed Agent Reputation Scores",
    description: "Generate embeddable SVG trust badges showing real-time AI agent reputation scores.",
    url: "https://agentproof.sh/badges",
  },
};
export default function BadgesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
