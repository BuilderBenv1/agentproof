"use client";

import { useState } from "react";
import {
  Cpu,
  Copy,
  CheckCircle,
  Shield,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Search,
  Activity,
  Globe,
  Zap,
  Eye,
  Target,
  Bot,
  ExternalLink,
} from "lucide-react";

const MCP_URL = "https://mcp.agentproof.sh/sse";

const TOOLS = [
  {
    name: "evaluate_agent",
    category: "Trust",
    icon: Shield,
    description: "Full trust evaluation for an ERC-8004 agent — composite score, tier, recommendation, risk flags, and score breakdown.",
    params: "agent_id: int",
  },
  {
    name: "find_trusted_agents",
    category: "Trust",
    icon: Search,
    description: "Search trusted agents by category, minimum score, tier. Returns ranked list with metadata.",
    params: "category?, min_score?, tier?, limit?",
  },
  {
    name: "risk_check",
    category: "Trust",
    icon: AlertTriangle,
    description: "Risk assessment — concentrated feedback detection, score volatility, uptime checks. Returns risk level and flags.",
    params: "agent_id: int",
  },
  {
    name: "network_stats",
    category: "Trust",
    icon: Globe,
    description: "Network-wide statistics — total agents, average trust score, tier distribution, feedback and validation counts.",
    params: "none",
  },
  {
    name: "get_yield_opportunities",
    category: "Intelligence",
    icon: TrendingUp,
    description: "DeFi yield opportunities on Avalanche with Sharpe ratio, Sortino, VaR, max drawdown, and recommendations.",
    params: "protocol?, min_apy?, max_risk?, sort_by?, limit?",
  },
  {
    name: "get_top_yields",
    category: "Intelligence",
    icon: BarChart3,
    description: "Top 10 risk-adjusted yield opportunities ranked by risk-adjusted APY.",
    params: "none",
  },
  {
    name: "audit_contract",
    category: "Intelligence",
    icon: AlertTriangle,
    description: "Live rug-pull scan — honeypot risk, ownership concentration, liquidity lock, tax manipulation. Returns risk score and red flags.",
    params: "contract_address: str",
  },
  {
    name: "get_contract_scan",
    category: "Intelligence",
    icon: Eye,
    description: "Lookup cached audit results for a contract — risk score, label, detailed sub-scores, and tracked outcome.",
    params: "contract_address: str",
  },
  {
    name: "get_whale_transactions",
    category: "Intelligence",
    icon: Activity,
    description: "Whale movement alerts — large transactions from VCs, market makers, and protocol treasuries on Avalanche.",
    params: "tx_type?, min_usd?, since?, limit?",
  },
  {
    name: "get_liquidation_risks",
    category: "Intelligence",
    icon: Zap,
    description: "At-risk lending positions on Aave/Benqi — health factor, collateral, debt, predicted liquidation price.",
    params: "risk_level?, protocol?",
  },
  {
    name: "get_narrative_trends",
    category: "Intelligence",
    icon: Globe,
    description: "Market narrative trends and sentiment — trending topics, strength, momentum, and related tokens.",
    params: "category?, momentum?, limit?",
  },
  {
    name: "get_convergence_signals",
    category: "Intelligence",
    icon: Target,
    description: "Multi-agent convergence — when whale tracker, auditor, narrative, and other agents independently flag the same token.",
    params: "limit?",
  },
  {
    name: "get_agent_accuracy",
    category: "Intelligence",
    icon: BarChart3,
    description: "Prediction accuracy across all agents — auditor hit rate, liquidation prediction rate, yield Sharpe ratios.",
    params: "none",
  },
  {
    name: "get_sniper_launches",
    category: "Trading",
    icon: Zap,
    description: "Recently detected token launches on Trader Joe — initial liquidity, safety filter results, rejection reasons.",
    params: "limit?",
  },
  {
    name: "get_dca_stats",
    category: "Trading",
    icon: Bot,
    description: "DCA bot performance — total configs, active strategies, total invested, purchases executed, dip buys triggered.",
    params: "none",
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={handleCopy} className="text-gray-500 hover:text-emerald-400 transition-colors">
      {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function MCPPage() {
  const categories = ["Trust", "Intelligence", "Trading"] as const;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-mono text-emerald-400">Model Context Protocol</span>
        </div>
        <h1 className="text-3xl font-bold text-white">
          AgentProof MCP Server
        </h1>
        <p className="text-sm text-gray-400 max-w-xl mx-auto">
          Connect any AI — Claude, ChatGPT, Cursor, or your own agents — to the
          AgentProof intelligence network. 15 tools covering trust scoring,
          DeFi yields, rug audits, whale alerts, and more.
        </p>
      </div>

      {/* Connection Card */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">SSE Endpoint</p>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Remote transport for any MCP-compatible client
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex items-center gap-2 bg-black/40 rounded-lg px-4 py-3 border border-gray-700">
          <code className="text-sm font-mono text-emerald-400 flex-1 break-all">
            {MCP_URL}
          </code>
          <CopyButton text={MCP_URL} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: "Tools", value: "15" },
          { label: "Agents Indexed", value: "25K+" },
          { label: "Yield Pools", value: "64" },
          { label: "Protocols", value: "3" },
          { label: "Transport", value: "SSE" },
        ].map((stat, i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{stat.value}</p>
            <p className="text-[10px] font-mono text-gray-500 uppercase">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Setup Guides */}
      <div className="space-y-4">
        <p className="text-xs font-mono text-gray-500 uppercase">Quick Start</p>

        {/* Claude Desktop */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
            <span className="text-xs font-semibold text-white">Claude Desktop</span>
            <span className="text-[10px] font-mono text-gray-600">claude_desktop_config.json</span>
          </div>
          <div className="relative">
            <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto bg-black/30">{`{
  "mcpServers": {
    "agentproof": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${MCP_URL}"
      ]
    }
  }
}`}</pre>
            <div className="absolute top-2 right-2">
              <CopyButton text={`{\n  "mcpServers": {\n    "agentproof": {\n      "command": "npx",\n      "args": [\n        "mcp-remote",\n        "${MCP_URL}"\n      ]\n    }\n  }\n}`} />
            </div>
          </div>
        </div>

        {/* Python */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
            <span className="text-xs font-semibold text-white">Python MCP Client</span>
            <span className="text-[10px] font-mono text-gray-600">python</span>
          </div>
          <div className="relative">
            <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto bg-black/30">{`from mcp import ClientSession
from mcp.client.sse import sse_client

async with sse_client("${MCP_URL}") as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()

        # List all 15 tools
        tools = await session.list_tools()

        # Evaluate an agent
        result = await session.call_tool("evaluate_agent", {"agent_id": 42})
        print(result.content[0].text)

        # Find top DeFi yields
        yields = await session.call_tool("get_top_yields", {})
        print(yields.content[0].text)`}</pre>
            <div className="absolute top-2 right-2">
              <CopyButton text={`from mcp import ClientSession\nfrom mcp.client.sse import sse_client\n\nasync with sse_client("${MCP_URL}") as (read, write):\n    async with ClientSession(read, write) as session:\n        await session.initialize()\n        tools = await session.list_tools()\n        result = await session.call_tool("evaluate_agent", {"agent_id": 42})\n        print(result.content[0].text)`} />
            </div>
          </div>
        </div>

        {/* Cursor / Continue */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
            <span className="text-xs font-semibold text-white">Cursor / VS Code</span>
            <span className="text-[10px] font-mono text-gray-600">.cursor/mcp.json</span>
          </div>
          <div className="relative">
            <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto bg-black/30">{`{
  "mcpServers": {
    "agentproof": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${MCP_URL}"
      ]
    }
  }
}`}</pre>
            <div className="absolute top-2 right-2">
              <CopyButton text={`{\n  "mcpServers": {\n    "agentproof": {\n      "command": "npx",\n      "args": [\n        "mcp-remote",\n        "${MCP_URL}"\n      ]\n    }\n  }\n}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Tools */}
      <div className="space-y-6">
        <p className="text-xs font-mono text-gray-500 uppercase">Available Tools</p>

        {categories.map((cat) => {
          const catTools = TOOLS.filter((t) => t.category === cat);
          const catColor =
            cat === "Trust"
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : cat === "Intelligence"
              ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
              : "text-amber-400 bg-amber-500/10 border-amber-500/20";

          return (
            <div key={cat} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${catColor}`}>
                  {cat}
                </span>
                <span className="text-xs text-gray-600">{catTools.length} tools</span>
              </div>
              <div className="grid gap-2">
                {catTools.map((tool) => (
                  <div
                    key={tool.name}
                    className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <tool.icon className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-sm font-mono font-bold text-white">
                            {tool.name}
                          </code>
                          <code className="text-[10px] font-mono text-gray-600">
                            ({tool.params})
                          </code>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{tool.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Architecture */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
        <p className="text-xs font-mono text-gray-500 uppercase">Architecture</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/30 border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-xs font-bold text-emerald-400 mb-1">Trust Oracle</p>
            <p className="text-[10px] text-gray-500">oracle.agentproof.sh</p>
            <p className="text-[10px] text-gray-600 mt-1">25K+ ERC-8004 agents</p>
            <p className="text-[10px] text-gray-600">Reputation scoring</p>
          </div>
          <div className="bg-black/30 border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-xs font-bold text-blue-400 mb-1">Intelligence Network</p>
            <p className="text-[10px] text-gray-500">11 autonomous agents</p>
            <p className="text-[10px] text-gray-600 mt-1">Yield, Whale, Auditor</p>
            <p className="text-[10px] text-gray-600">Liquidation, Narrative</p>
          </div>
          <div className="bg-black/30 border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-xs font-bold text-amber-400 mb-1">Trading Bots</p>
            <p className="text-[10px] text-gray-500">DCA, Grid, Sniper, SOS</p>
            <p className="text-[10px] text-gray-600 mt-1">Automated execution</p>
            <p className="text-[10px] text-gray-600">On-chain proofs</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center">
          The MCP server acts as a unified gateway — one SSE endpoint wrapping both backends via httpx.
        </p>
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-3 justify-center pb-8">
        <a
          href="https://github.com/BuilderBenv1/agentproof/tree/main/mcp"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Source Code
        </a>
        <a
          href="/docs"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          API Docs
        </a>
        <a
          href="https://oracle.agentproof.sh"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Trust Oracle
        </a>
        <a
          href="/whitepaper"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Whitepaper
        </a>
      </div>
    </div>
  );
}
