import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "MCP Server — Model Context Protocol Integration",
  description: "AgentProof MCP server for Claude, Cursor, and other AI assistants. Query AI agent trust scores directly from your development environment via Model Context Protocol.",
  keywords: ["MCP server", "Model Context Protocol", "AgentProof MCP", "Claude MCP", "AI agent MCP", "trust score MCP"],
  alternates: { canonical: "https://agentproof.sh/mcp" },
  openGraph: {
    title: "MCP Server — Model Context Protocol Integration",
    description: "Query AI agent trust scores from Claude, Cursor, and other AI assistants via MCP.",
    url: "https://agentproof.sh/mcp",
  },
};
export default function McpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
