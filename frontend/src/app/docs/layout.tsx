import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "API Documentation — AgentProof Trust Oracle",
  description: "AgentProof API documentation. REST API, MCP server, Google A2A protocol, webhooks, and SDK integration guides for querying AI agent trust scores.",
  keywords: ["AgentProof API", "AI agent API", "trust score API", "ERC-8004 API", "agent reputation API", "MCP server", "A2A protocol"],
  alternates: { canonical: "https://agentproof.sh/docs" },
  openGraph: {
    title: "API Documentation — AgentProof Trust Oracle",
    description: "REST API, MCP, A2A, webhooks, and SDK docs for querying AI agent trust scores.",
    url: "https://agentproof.sh/docs",
  },
};
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
