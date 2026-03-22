"use client";

import { useState, useEffect } from "react";
import {
  Globe,
  Copy,
  CheckCircle,
  Zap,
  Shield,
  Search,
  AlertTriangle,
  BarChart3,
  Lock,
  Fingerprint,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { API_URL } from "@/lib/constants";

interface A2ASkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
}

interface A2ACard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: { streaming: boolean; pushNotifications: boolean };
  skills: A2ASkill[];
  provider: { organization: string; url: string };
}

const SKILL_ICONS: Record<string, React.ElementType> = {
  evaluate_agent: Shield,
  find_trusted_agents: Search,
  risk_check: AlertTriangle,
  network_stats: BarChart3,
  hook_gate_check: Lock,
  resolve_address: Fingerprint,
  resolve_ens: Globe,
};

export default function A2APage() {
  const [card, setCard] = useState<A2ACard | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    async function fetchCard() {
      try {
        const res = await fetch(`${API_URL}/.well-known/agent.json`, {
          headers: { Accept: "application/json" },
        });
        setCard(await res.json());
      } catch (err) {
        console.error("[a2a] Failed to fetch agent card:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCard();
  }, []);

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 font-mono text-sm animate-pulse">Loading agent card...</div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-400 font-mono text-sm">Failed to load agent card</div>
      </div>
    );
  }

  const jsonEndpoint = `${card.url}/.well-known/agent.json`;
  const a2aEndpoint = `${card.url}/a2a`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Globe className="w-6 h-6 text-emerald-400" />
          A2A Agent Card
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Google Agent-to-Agent protocol card — human-friendly view, machine-readable at the endpoint
        </p>
      </div>

      {/* Business Card */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl shadow-emerald-500/[0.02]">
        {/* Card Header */}
        <div className="p-6 pb-4 bg-gradient-to-br from-emerald-500/[0.06] to-transparent border-b border-gray-800">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold tracking-wider uppercase text-emerald-400 bg-emerald-900/40 px-2.5 py-1 rounded-md mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                A2A Agent
              </div>
              <h2 className="text-xl font-bold text-white">{card.name}</h2>
              <span className="text-xs font-mono text-gray-500">v{card.version}</span>
            </div>
            <a
              href={card.provider.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-gray-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              {card.provider.organization}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-sm text-gray-400 mt-3 leading-relaxed">{card.description}</p>
        </div>

        {/* Meta Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-gray-800">
          <div className="p-4 border-r border-gray-800">
            <div className="text-[10px] font-mono font-semibold tracking-wider uppercase text-gray-500 mb-1">
              Endpoint
            </div>
            <button
              onClick={() => copyToClipboard(a2aEndpoint, "endpoint")}
              className="text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 group"
            >
              POST /a2a
              {copied === "endpoint" ? (
                <CheckCircle className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </div>
          <div className="p-4 border-r border-gray-800">
            <div className="text-[10px] font-mono font-semibold tracking-wider uppercase text-gray-500 mb-1">
              Protocol
            </div>
            <div className="text-xs font-mono text-gray-300">JSON-RPC 2.0</div>
          </div>
          <div className="p-4 border-r border-gray-800">
            <div className="text-[10px] font-mono font-semibold tracking-wider uppercase text-gray-500 mb-1">
              Streaming
            </div>
            <div className="text-xs font-mono text-gray-300">
              {card.capabilities.streaming ? "Yes" : "No"}
            </div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-mono font-semibold tracking-wider uppercase text-gray-500 mb-1">
              Skills
            </div>
            <div className="text-xs font-mono text-white font-bold">{card.skills.length}</div>
          </div>
        </div>

        {/* Skills */}
        <div className="p-6">
          <h3 className="text-[11px] font-mono font-semibold tracking-wider uppercase text-gray-500 mb-4">
            Available Skills
          </h3>
          <div className="space-y-3">
            {card.skills.map((skill) => {
              const Icon = SKILL_ICONS[skill.id] || Zap;
              const isExpanded = expandedSkill === skill.id;
              return (
                <div
                  key={skill.id}
                  className="bg-black/30 border border-gray-800 rounded-xl overflow-hidden hover:border-emerald-500/20 transition-colors"
                >
                  <button
                    onClick={() => setExpandedSkill(isExpanded ? null : skill.id)}
                    className="w-full p-4 flex items-start gap-3 text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-900/30 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{skill.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-mono text-gray-600 bg-gray-800 px-2 py-0.5 rounded">
                            {skill.id}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{skill.description}</p>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 ml-11 space-y-3">
                      {skill.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {skill.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-mono text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {skill.examples.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">
                            Example prompts
                          </div>
                          {skill.examples.map((ex, i) => (
                            <div key={i} className="text-xs text-gray-500 italic">
                              &ldquo;{ex}&rdquo;
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Connect */}
        <div className="p-6 pt-0 space-y-3">
          <h3 className="text-[11px] font-mono font-semibold tracking-wider uppercase text-gray-500 mb-3">
            Connect
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-black/30 border border-gray-800 rounded-xl p-4">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">
                Agent Card URL
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-emerald-400 truncate flex-1">
                  {jsonEndpoint}
                </code>
                <button
                  onClick={() => copyToClipboard(jsonEndpoint, "card-url")}
                  className="shrink-0 text-gray-500 hover:text-white transition-colors"
                >
                  {copied === "card-url" ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="bg-black/30 border border-gray-800 rounded-xl p-4">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">
                Task Endpoint
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-emerald-400 truncate flex-1">
                  {a2aEndpoint}
                </code>
                <button
                  onClick={() => copyToClipboard(a2aEndpoint, "task-url")}
                  className="shrink-0 text-gray-500 hover:text-white transition-colors"
                >
                  {copied === "task-url" ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Raw JSON Toggle */}
        <div className="border-t border-gray-800 p-4">
          <button
            onClick={() => setShowJson(!showJson)}
            className="text-xs font-mono text-gray-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
          >
            {showJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showJson ? "Hide" : "View"} raw JSON
          </button>
          {showJson && (
            <div className="mt-3 relative">
              <pre className="bg-black/50 border border-gray-800 rounded-xl p-4 overflow-x-auto text-xs font-mono text-gray-400 leading-relaxed max-h-96 overflow-y-auto">
                {JSON.stringify(card, null, 2)}
              </pre>
              <button
                onClick={() => copyToClipboard(JSON.stringify(card, null, 2), "json")}
                className="absolute top-2 right-2 p-2 text-gray-600 hover:text-white transition-colors"
              >
                {copied === "json" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 px-6 py-3 flex items-center justify-between">
          <a
            href={card.provider.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-gray-400 hover:text-emerald-400 transition-colors"
          >
            {card.provider.organization}
          </a>
          <span className="text-[10px] font-mono text-gray-600 tracking-wider">
            Google A2A Protocol
          </span>
        </div>
      </div>

      {/* Usage Hint */}
      <div className="text-center text-xs font-mono text-gray-600">
        Agents: fetch <code className="text-gray-500">{jsonEndpoint}</code> with{" "}
        <code className="text-gray-500">Accept: application/json</code>
      </div>
    </div>
  );
}
