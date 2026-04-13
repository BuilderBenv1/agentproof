"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Rocket, Shield, Zap, Globe, CheckCircle, AlertCircle,
  ArrowRight, ExternalLink, Plus, X, Loader2,
} from "lucide-react";
import { CATEGORIES } from "@/lib/constants";

const FACTORY_API = process.env.NEXT_PUBLIC_FACTORY_URL || "https://factory.agentproof.sh";

interface LaunchResult {
  agent_id: number;
  owner: string;
  metadata_uri: string;
  profile_url: string;
  explorer_url: string;
  scan_url: string;
  trust_evaluation: Record<string, unknown> | null;
  message: string;
}

export default function LaunchPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [endpointType, setEndpointType] = useState("https");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [ownerWallet, setOwnerWallet] = useState("");

  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [error, setError] = useState("");

  function addTag() {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  }

  async function handleLaunch(e: React.FormEvent) {
    e.preventDefault();
    setLaunching(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`${FACTORY_API}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          category,
          image_url: imageUrl,
          endpoints: endpointUrl
            ? [{ name: endpointType, endpoint: endpointUrl }]
            : [],
          tags,
          owner_wallet: ownerWallet,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "Launch failed" }));
        throw new Error(body.detail || `Error ${res.status}`);
      }

      const data: LaunchResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-gray-900/50 border border-emerald-500/30 rounded-xl p-8 text-center space-y-4">
          <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Agent Launched</h2>
          <p className="text-gray-400 text-sm">
            Your agent is live on SKALE Base with an AgentProof trust handshake built in.
          </p>

          <div className="bg-gray-800/50 rounded-lg p-4 space-y-2 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-mono">Agent ID</span>
              <span className="text-emerald-400 font-mono font-bold">#{result.agent_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-mono">Chain</span>
              <span className="text-[#4DFFD2] font-mono">SKALE Base</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-mono">Trust</span>
              <span className="text-gray-400 font-mono">
                {result.trust_evaluation
                  ? `${(result.trust_evaluation as Record<string, unknown>).composite_score}/100`
                  : "Scoring..."}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-mono">Cost</span>
              <span className="text-emerald-400 font-mono">$0.00</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href={`/agents/${result.agent_id}?chain=skale`}
              className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg text-sm font-mono hover:bg-emerald-500/20 transition-colors"
            >
              View Profile <ArrowRight className="w-3 h-3" />
            </Link>
            <a
              href={result.explorer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gray-800 text-gray-300 px-4 py-2 rounded-lg text-sm font-mono hover:bg-gray-700 transition-colors"
            >
              Explorer <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <button
            onClick={() => { setResult(null); setName(""); setDescription(""); setEndpointUrl(""); setTags([]); }}
            className="text-xs text-gray-600 hover:text-gray-400 font-mono mt-4"
          >
            Launch another agent
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Rocket className="w-6 h-6 text-emerald-400" />
          Launch Agent
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Register your agent on SKALE Base with built-in trust. Zero gas. Instant scoring.
        </p>
      </div>

      {/* Value props */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-sm text-gray-400 space-y-3">
        <p className="font-mono text-xs text-gray-500 uppercase">What your agent gets</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <Globe className="w-4 h-4 text-[#4DFFD2] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-300">ERC-8004 Identity</p>
              <p className="text-xs text-gray-600">On-chain, cross-chain portable</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-300">Trust Score</p>
              <p className="text-xs text-gray-600">AgentProof evaluation from birth</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-300">Built-in Handshake</p>
              <p className="text-xs text-gray-600">requireTrust() for agent-to-agent</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-300">Zero Cost</p>
              <p className="text-xs text-gray-600">Gasless on SKALE. No wallet needed.</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-emerald-400/60 font-mono border-t border-gray-800 pt-2">
          Already have an agent on another chain? Register it here to get a second passport with trust baked in.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleLaunch} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
            Agent Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            placeholder="My DeFi Agent"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What does your agent do?"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500/50"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.slug} value={cat.slug}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Endpoint */}
        <div>
          <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
            <Globe className="w-3 h-3 inline mr-1" />
            Endpoint URL
          </label>
          <div className="flex gap-2">
            <select
              value={endpointType}
              onChange={(e) => setEndpointType(e.target.value)}
              className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-400 focus:outline-none focus:border-emerald-500/50 w-28"
            >
              <option value="https">HTTPS</option>
              <option value="a2a">A2A</option>
              <option value="mcp">MCP</option>
              <option value="websocket">WebSocket</option>
            </select>
            <input
              type="url"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://api.myagent.com/v1"
              className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">Where your agent lives. We&apos;ll verify it during scoring.</p>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
            Tags
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              placeholder="e.g. defi, x402, trading..."
              maxLength={30}
              className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
            />
            <button
              type="button"
              onClick={addTag}
              disabled={!tagInput.trim() || tags.length >= 10}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 px-3 py-2.5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono px-2.5 py-1 rounded-full">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Image URL */}
        <div>
          <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
            Image URL (optional)
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Owner Wallet */}
        <div>
          <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
            Owner Wallet (optional)
          </label>
          <input
            type="text"
            value={ownerWallet}
            onChange={(e) => setOwnerWallet(e.target.value)}
            placeholder="0x... (leave empty to use factory default)"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
          />
          <p className="text-xs text-gray-600 mt-1">Your wallet address for on-chain attribution. No gas needed.</p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400 font-mono">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={launching || !name.trim()}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-3 rounded-lg text-sm font-mono transition-colors flex items-center justify-center gap-2"
        >
          {launching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Launching on SKALE...
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4" />
              Launch Agent — Free
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-600 font-mono">
          Gasless on SKALE Base. No wallet connection required. Trust score assigned automatically.
        </p>
      </form>
    </div>
  );
}
