import type { Metadata } from "next";
import EvidenceWall from "@/components/sections/EvidenceWall";

export const metadata: Metadata = {
  title: "Evidence — Why AI Agents Need Reputation Infrastructure",
  description: "Research papers, real incidents, threat intelligence, and industry validation proving AI agents need trust infrastructure. Stanford, Harvard, MIT research, NIST advisories, CrowdStrike reports.",
  keywords: ["AI agent security", "AI agent incidents", "autonomous agent risk", "ERC-8004 evidence", "AI agent trust research", "agent reputation"],
  alternates: { canonical: "https://agentproof.sh/evidence" },
  openGraph: {
    title: "Evidence — Why AI Agents Need Reputation Infrastructure",
    description: "Research papers, real incidents, and threat intelligence proving AI agents need trust scoring.",
    url: "https://agentproof.sh/evidence",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Evidence — Why AI Agents Need Reputation Infrastructure",
  description: "Curated research, real incidents, and industry validation proving autonomous AI agents need trust scoring and reputation infrastructure.",
  url: "https://agentproof.sh/evidence",
  isPartOf: { "@type": "WebSite", name: "AgentProof", url: "https://agentproof.sh" },
  about: [
    { "@type": "Thing", name: "AI Agent Security" },
    { "@type": "Thing", name: "ERC-8004" },
    { "@type": "Thing", name: "Autonomous Agent Risk" },
  ],
};

export default function EvidencePage() {
  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EvidenceWall />
    </div>
  );
}
