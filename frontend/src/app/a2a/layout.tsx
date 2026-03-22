import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "A2A Agent Card — Agent-to-Agent Protocol",
  description: "View AgentProof's A2A agent card. Machine-readable for agents, human-friendly for developers. Discover skills, capabilities, and integration endpoints.",
  keywords: ["A2A protocol", "agent card", "agent-to-agent", "AgentProof A2A", "Google A2A"],
  alternates: { canonical: "https://agentproof.sh/a2a" },
  openGraph: {
    title: "A2A Agent Card — Agent-to-Agent Protocol",
    description: "AgentProof's A2A agent card — beautiful for humans, machine-readable for agents.",
    url: "https://agentproof.sh/a2a",
  },
};
export default function A2ALayout({ children }: { children: React.ReactNode }) {
  return children;
}
