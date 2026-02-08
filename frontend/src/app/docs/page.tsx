"use client";

import { useState } from "react";
import { Book, Code, Terminal, Globe, ChevronDown, ChevronRight, Copy, CheckCircle } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.agentproof.sh/api";

type TabId = "api" | "sdk" | "contracts";

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/agents",
    description: "List all agents with optional filtering",
    params: [
      { name: "category", type: "string", description: "Filter by category slug (defi, gaming, rwa, payments, data, general)" },
      { name: "search", type: "string", description: "Search by agent name" },
      { name: "tier", type: "string", description: "Filter by tier (diamond, platinum, gold, silver, bronze, unranked)" },
      { name: "sort_by", type: "string", description: "Sort field (composite_score, average_rating, total_feedback, registered_at)" },
      { name: "order", type: "string", description: "Sort order (asc, desc). Default: desc" },
      { name: "page", type: "int", description: "Page number. Default: 1" },
      { name: "page_size", type: "int", description: "Results per page. Default: 20" },
    ],
    response: `{
  "agents": [{ "agent_id": 1, "name": "AlphaYield", "category": "defi", ... }],
  "total": 10,
  "page": 1,
  "page_size": 20
}`,
  },
  {
    method: "GET",
    path: "/api/agents/{agent_id}",
    description: "Get full agent profile with reputation data",
    params: [{ name: "agent_id", type: "int", description: "On-chain agent token ID" }],
    response: `{
  "agent_id": 1,
  "name": "AlphaYield",
  "owner_address": "0x...",
  "category": "defi",
  "composite_score": 87.5,
  "average_rating": 88.0,
  "total_feedback": 7,
  "validation_success_rate": 100.0,
  "tier": "platinum",
  "rank": 2
}`,
  },
  {
    method: "GET",
    path: "/api/agents/{agent_id}/feedback",
    description: "Paginated feedback entries for an agent",
    params: [
      { name: "agent_id", type: "int", description: "Agent token ID" },
      { name: "page", type: "int", description: "Page number" },
      { name: "page_size", type: "int", description: "Results per page" },
    ],
    response: `{
  "feedback": [{
    "reviewer_address": "0x...",
    "rating": 92,
    "task_hash": "0x...",
    "tx_hash": "0x...",
    "created_at": "2025-01-15T..."
  }],
  "total": 7
}`,
  },
  {
    method: "GET",
    path: "/api/leaderboard",
    description: "Global leaderboard, filterable by category and time range",
    params: [
      { name: "category", type: "string", description: "Filter by category" },
      { name: "time_range", type: "string", description: "all, 30d, 7d" },
      { name: "limit", type: "int", description: "Max results. Default: 50" },
    ],
    response: `{
  "leaderboard": [{
    "rank": 1,
    "agent_id": 8,
    "name": "SwiftSettle",
    "composite_score": 95.2,
    "tier": "diamond"
  }]
}`,
  },
  {
    method: "GET",
    path: "/api/analytics/overview",
    description: "Aggregate platform statistics",
    params: [],
    response: `{
  "total_agents": 10,
  "total_feedback": 51,
  "total_validations": 14,
  "average_score": 75.3
}`,
  },
  {
    method: "GET",
    path: "/api/categories",
    description: "List all agent categories with counts",
    params: [],
    response: `[
  { "slug": "defi", "name": "DeFi Agents", "count": 3 },
  { "slug": "gaming", "name": "Gaming Agents", "count": 2 }
]`,
  },
];

const SDK_SNIPPETS = [
  {
    title: "Install",
    language: "bash",
    code: `npm install @agentproof/sdk ethers`,
  },
  {
    title: "Read-only Client",
    language: "typescript",
    code: `import { AgentProof } from '@agentproof/sdk'

const ap = new AgentProof({
  rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
  chainId: 43114,
})

// Reads from official ERC-8004 registries
const total = await ap.totalAgents()
const agent = await ap.getAgent(1)
const summary = await ap.getReputationSummary(1)`,
  },
  {
    title: "Register an Agent (ERC-8004)",
    language: "typescript",
    code: `import { AgentProof, encodeMetadataURI } from '@agentproof/sdk'

const ap = new AgentProof({
  rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
  chainId: 43114,
  privateKey: '0x...',
})

const uri = encodeMetadataURI({
  name: 'My Agent',
  description: 'Automated DeFi optimizer',
  category: 'defi',
})

// No bond required — official ERC-8004 registry
await ap.registerAgent(uri)`,
  },
  {
    title: "Give Feedback (ERC-8004)",
    language: "typescript",
    code: `// Official ERC-8004 reputation: int128 value + decimals
await ap.giveFeedback(1, 85, 0, {
  feedbackURI: 'https://feedback.json',
  feedbackHash: hashTask('completed-task-42'),
})

const summary = await ap.getReputationSummary(1)
console.log('Average:', summary.averageValue)`,
  },
  {
    title: "Listen for Events",
    language: "typescript",
    code: `ap.onAgentRegistered((event) => {
  console.log(\`Agent #\${event.agentId} registered by \${event.owner}\`)
})

ap.onNewFeedback((event) => {
  console.log(\`Agent #\${event.agentId} rated \${event.value} by \${event.reviewer}\`)
})`,
  },
];

const CONTRACTS = [
  {
    name: "ERC-8004 Identity Registry",
    address: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    description: "Official Ava Labs ERC-8004 Identity Registry. ERC-721 agent identity NFTs with metadata URI.",
    official: true,
  },
  {
    name: "ERC-8004 Reputation Registry",
    address: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
    description: "Official Ava Labs ERC-8004 Reputation Registry. Feedback with int128 values, tags, and revocation.",
    official: true,
  },
  {
    name: "ValidationRegistry",
    address: "0xa3df69a7576EceC1056Cb731DAE69a8086F460Fc",
    description: "AgentProof custom validation registry. Task validation requests and responses with success rate tracking.",
    official: false,
  },
  {
    name: "AgentProofCore",
    address: "0xCB4cc5DA1Abf188756f1fA50005B14113e4f7554",
    description: "AgentProof orchestrator. Aggregated profiles, top agents, category management.",
    official: false,
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

function EndpointCard({ endpoint }: { endpoint: typeof ENDPOINTS[0] }) {
  const [isOpen, setIsOpen] = useState(false);
  const methodColor = endpoint.method === "GET" ? "text-emerald-400 bg-emerald-500/10" : "text-yellow-400 bg-yellow-500/10";

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-900/50 transition-colors text-left"
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${methodColor}`}>
          {endpoint.method}
        </span>
        <code className="text-sm font-mono text-white">{endpoint.path}</code>
        <span className="text-xs text-gray-500 ml-auto hidden sm:block">{endpoint.description}</span>
      </button>

      {isOpen && (
        <div className="border-t border-gray-800 px-4 py-4 space-y-4 bg-gray-900/30">
          <p className="text-sm text-gray-400">{endpoint.description}</p>

          {endpoint.params.length > 0 && (
            <div>
              <p className="text-xs font-mono text-gray-500 uppercase mb-2">Parameters</p>
              <div className="space-y-1">
                {endpoint.params.map((p) => (
                  <div key={p.name} className="flex items-baseline gap-2 text-xs">
                    <code className="text-emerald-400 font-mono">{p.name}</code>
                    <span className="text-gray-600 font-mono">{p.type}</span>
                    <span className="text-gray-500">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-mono text-gray-500 uppercase">Response</p>
              <CopyButton text={endpoint.response} />
            </div>
            <pre className="bg-black/50 rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto">
              {endpoint.response}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("api");

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "api", label: "REST API", icon: <Globe className="w-4 h-4" /> },
    { id: "sdk", label: "TypeScript SDK", icon: <Code className="w-4 h-4" /> },
    { id: "contracts", label: "Smart Contracts", icon: <Terminal className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Book className="w-6 h-6 text-emerald-400" />
          Documentation
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          API reference, SDK guide, and smart contract details
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900/50 border border-gray-800 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* API Tab */}
      {activeTab === "api" && (
        <div className="space-y-4">
          <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-4">
            <p className="text-xs font-mono text-gray-500 uppercase mb-2">Base URL</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-emerald-400">{BASE_URL}</code>
              <CopyButton text={BASE_URL} />
            </div>
            <p className="text-xs text-gray-500 mt-2">All endpoints return JSON. No authentication required for read operations.</p>
          </div>

          <div className="space-y-2">
            {ENDPOINTS.map((ep) => (
              <EndpointCard key={ep.path} endpoint={ep} />
            ))}
          </div>
        </div>
      )}

      {/* SDK Tab */}
      {activeTab === "sdk" && (
        <div className="space-y-4">
          <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">
              The <code className="text-emerald-400 font-mono">@agentproof/sdk</code> package provides a TypeScript client for interacting with AgentProof smart contracts on Avalanche.
            </p>
          </div>

          {SDK_SNIPPETS.map((snippet) => (
            <div key={snippet.title} className="border border-gray-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
                <span className="text-xs font-semibold text-white">{snippet.title}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-gray-600 uppercase">{snippet.language}</span>
                  <CopyButton text={snippet.code} />
                </div>
              </div>
              <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto bg-black/30">
                {snippet.code}
              </pre>
            </div>
          ))}

          <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-4">
            <p className="text-xs font-mono text-gray-500 uppercase mb-2">SDK Methods</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
              {[
                "registerAgent(uri)",
                "setAgentURI(id, uri)",
                "getAgent(id)",
                "isRegistered(address)",
                "totalAgents()",
                "giveFeedback(id, value, decimals, opts?)",
                "readFeedback(feedbackId)",
                "getReputationSummary(id)",
                "getFeedbackCount(id)",
                "revokeFeedback(feedbackId)",
                "requestValidation(id, hash, uri)",
                "submitValidation(id, valid, uri)",
                "getAgentProfile(id)",
                "getTopAgents(count)",
                "onAgentRegistered(cb)",
                "onNewFeedback(cb)",
              ].map((method) => (
                <div key={method} className="text-gray-400 flex items-center gap-1">
                  <span className="text-emerald-400/50">&#9679;</span> {method}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contracts Tab */}
      {activeTab === "contracts" && (
        <div className="space-y-4">
          <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-gray-500 uppercase">Network</span>
              <span className="text-xs font-mono text-emerald-400">Avalanche Mainnet (C-Chain)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-500 uppercase">Chain ID</span>
              <span className="text-xs font-mono text-white">43114</span>
            </div>
          </div>

          <div className="space-y-3">
            {CONTRACTS.map((contract) => (
              <div key={contract.name} className={`bg-gray-900/50 border rounded-lg p-4 ${contract.official ? "border-emerald-500/20" : "border-gray-800"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{contract.name}</h3>
                    {contract.official && (
                      <span className="text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
                        Official
                      </span>
                    )}
                  </div>
                  <a
                    href={`https://snowtrace.io/address/${contract.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-400 hover:underline font-mono"
                  >
                    Snowtrace
                  </a>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <code className="text-xs font-mono text-gray-400 break-all">{contract.address}</code>
                  <CopyButton text={contract.address} />
                </div>
                <p className="text-xs text-gray-500">{contract.description}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-4">
            <p className="text-xs font-mono text-gray-500 uppercase mb-2">Key Features</p>
            <ul className="space-y-1 text-xs text-gray-400">
              <li>&#9679; Official ERC-8004 Identity and Reputation registries (Ava Labs)</li>
              <li>&#9679; ERC-721 agent identity NFTs with metadata URI</li>
              <li>&#9679; int128 feedback values with configurable decimals and tags</li>
              <li>&#9679; Feedback revocation and response appending</li>
              <li>&#9679; AgentProof custom validation with success rate tracking</li>
              <li>&#9679; Composite scoring engine on top of official registries</li>
              <li>&#9679; Bayesian-smoothed leaderboard rankings</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
