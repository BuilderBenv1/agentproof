"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, Shield } from "lucide-react";
import Link from "next/link";

const ORACLE_URL = "https://oracle.agentproof.sh";

const STYLES = ["flat", "flat-square", "for-the-badge"] as const;
const BADGE_TYPES = [
  { id: "default", label: "Score + Tier", path: "badge", description: "Shows tier name and composite score" },
  { id: "tier", label: "Tier Only", path: "badge/tier", description: "Shows trust tier badge" },
  { id: "score", label: "Score Only", path: "badge/score", description: "Shows numeric score out of 100" },
  { id: "recommendation", label: "Recommendation", path: "badge/recommendation", description: "Shows TRUSTED / CAUTION / HIGH_RISK" },
] as const;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1.5 rounded hover:bg-[#2a2a3a] transition-colors text-gray-500 hover:text-white"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[#00ff88]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CodeBlock({ code, lang = "markdown" }: { code: string; lang?: string }) {
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
      <pre className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto">
        <code>{code}</code>
      </pre>
      <span className="absolute top-2 left-3 text-[9px] font-mono text-gray-600 uppercase">{lang}</span>
    </div>
  );
}

export default function BadgesPage() {
  const [agentId, setAgentId] = useState("1380");
  const [style, setStyle] = useState<(typeof STYLES)[number]>("flat");
  const [badgeType, setBadgeType] = useState<(typeof BADGE_TYPES)[number]>(BADGE_TYPES[0]);

  const badgeUrl = `${ORACLE_URL}/api/v1/${badgeType.path}/${agentId}.svg${style !== "flat" ? `?style=${style}` : ""}`;
  const markdownSnippet = `[![AgentProof](${badgeUrl})](https://agentproof.sh/agents/${agentId})`;
  const htmlSnippet = `<a href="https://agentproof.sh/agents/${agentId}"><img src="${badgeUrl}" alt="AgentProof Trust Badge" /></a>`;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-[#00ff88]" />
          Trust Badges
        </h1>
        <p className="text-sm text-[#8888aa] mt-2 max-w-2xl">
          Embed live trust badges in your GitHub README, documentation, or website.
          Badges update automatically as agent scores change — no API key required.
        </p>
      </div>

      {/* Configurator */}
      <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6 space-y-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Configure Your Badge</h2>

        {/* Agent ID input */}
        <div>
          <label className="text-xs font-mono text-[#8888aa] uppercase block mb-2">Agent ID</label>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value.replace(/\D/g, ""))}
            className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-4 py-2 text-sm font-mono text-white w-40 focus:border-[#00ff88]/50 focus:outline-none transition-colors"
            placeholder="1380"
          />
        </div>

        {/* Badge type */}
        <div>
          <label className="text-xs font-mono text-[#8888aa] uppercase block mb-2">Badge Type</label>
          <div className="flex flex-wrap gap-2">
            {BADGE_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setBadgeType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  badgeType.id === type.id
                    ? "bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88]"
                    : "bg-[#0a0a0f] border border-[#2a2a3a] text-gray-400 hover:text-white hover:border-gray-600"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] font-mono text-gray-600 mt-1.5">{badgeType.description}</p>
        </div>

        {/* Style */}
        <div>
          <label className="text-xs font-mono text-[#8888aa] uppercase block mb-2">Style</label>
          <div className="flex gap-2">
            {STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  style === s
                    ? "bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88]"
                    : "bg-[#0a0a0f] border border-[#2a2a3a] text-gray-400 hover:text-white hover:border-gray-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="text-xs font-mono text-[#8888aa] uppercase block mb-3">Preview</label>
          <div className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg p-6 flex items-center justify-center min-h-[60px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={badgeUrl}
              alt="AgentProof Trust Badge Preview"
              className="max-h-[28px]"
              key={badgeUrl}
            />
          </div>
        </div>
      </div>

      {/* Embed snippets */}
      <div className="space-y-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Embed Code</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-[#8888aa] uppercase block mb-2">Markdown (GitHub README)</label>
            <CodeBlock code={markdownSnippet} lang="markdown" />
          </div>

          <div>
            <label className="text-xs font-mono text-[#8888aa] uppercase block mb-2">HTML</label>
            <CodeBlock code={htmlSnippet} lang="html" />
          </div>

          <div>
            <label className="text-xs font-mono text-[#8888aa] uppercase block mb-2">Direct URL</label>
            <CodeBlock code={badgeUrl} lang="url" />
          </div>
        </div>
      </div>

      {/* API Reference */}
      <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">API Reference</h2>

        <div className="space-y-3">
          {[
            { method: "GET", path: "/api/v1/badge/{agent_id}.svg", desc: "Score + tier badge" },
            { method: "GET", path: "/api/v1/badge/tier/{agent_id}.svg", desc: "Tier-only badge" },
            { method: "GET", path: "/api/v1/badge/score/{agent_id}.svg", desc: "Numeric score badge" },
            { method: "GET", path: "/api/v1/badge/recommendation/{agent_id}.svg", desc: "Recommendation badge" },
          ].map((endpoint) => (
            <div key={endpoint.path} className="flex items-center gap-3 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-[#00ff88]/10 text-[#00ff88] font-bold">{endpoint.method}</span>
              <code className="text-gray-300">{endpoint.path}</code>
              <span className="text-gray-600 ml-auto">{endpoint.desc}</span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-[#2a2a3a]">
          <p className="text-[10px] font-mono text-gray-600">
            Query params: <code className="text-gray-400">style</code> (flat | flat-square | for-the-badge),{" "}
            <code className="text-gray-400">label</code> (custom left text),{" "}
            <code className="text-gray-400">chain</code> (source chain filter).
            No API key required. Badges cached for 5 minutes.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center gap-4">
        <Link
          href="/agents"
          className="px-5 py-2.5 bg-[#00ff88] text-black font-bold text-sm rounded-lg hover:bg-[#00dd77] transition-colors"
        >
          Find Your Agent ID
        </Link>
        <a
          href="https://github.com/BuilderBenv1/agentproof"
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 border border-[#2a2a3a] text-gray-300 font-semibold text-sm rounded-lg hover:border-gray-600 transition-colors flex items-center gap-2"
        >
          GitHub <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
