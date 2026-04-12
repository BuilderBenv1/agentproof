"use client";

/**
 * AgentProof Homepage — precision dark terminal aesthetic.
 *
 * Sections: Hero → Stats → Deployer Storm → Top Agents → How It Works
 * → Trust Tiers → SDK/API CTA → Evidence Preview
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, Users, TrendingUp,
  Zap, Lock, BarChart3, ExternalLink,
  Terminal, Code2, Search,
} from "lucide-react";
import AgentCard from "@/components/agents/AgentCard";
import CountUp from "@/components/ui/CountUp";
import DeployerStorm from "@/components/sections/DeployerStorm";
import { EvidencePreview } from "@/components/sections/EvidenceWall";
import { apiFetch, backendFetch } from "@/lib/supabase";
// formatNumber available from @/lib/utils if needed

interface OverviewData {
  total_agents: number;
  total_feedback: number;
  total_validations: number;
  total_liveness: number;
  avg_score: number;
  tier_distribution?: Record<string, number>;
}

interface AgentData {
  agent_id: number;
  name: string | null;
  category: string;
  composite_score: number;
  tier: string;
  total_feedback: number;
  rank: number | null;
  image_url: string | null;
  source_chain?: string;
}

export default function HomePage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [topAgents, setTopAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [overviewRes, agentsRes] = await Promise.allSettled([
          apiFetch<OverviewData>("/api/v1/network/stats"),
          backendFetch<{ agents: AgentData[] }>("/agents", {
            params: { sort_by: "composite_score", order: "desc", page_size: 5 },
          }),
        ]);

        if (overviewRes.status === "fulfilled") setOverview(overviewRes.value);
        if (agentsRes.status === "fulfilled") setTopAgents(agentsRes.value.agents || []);
      } catch {
        // API might not be running yet
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-0">

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="py-20 md:py-28 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/3 to-transparent rounded-3xl" />
        <div className="relative text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-3">
            Know Your Agent.
          </h1>
          <p className="text-lg md:text-xl text-[#8888aa] max-w-xl mx-auto mb-8">
            On-chain reputation oracle for AI agents.
          </p>

          {/* Live counter bar */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-mono text-gray-400 mb-10">
            <span>
              <CountUp end={overview?.total_agents || 67700} className="text-white font-bold" suffix="+" /> agents
            </span>
            <span className="text-[#2a2a3a]">·</span>
            <span>
              <CountUp end={overview?.total_feedback || 167100} className="text-white font-bold" suffix="+" /> evaluations
            </span>
            <span className="text-[#2a2a3a]">·</span>
            <span>
              <span className="text-white font-bold font-mono">24</span> chains
            </span>
            <span className="text-[#2a2a3a]">·</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
              Oracle live
            </span>
          </div>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/agents"
              className="px-6 py-3 bg-[#00ff88] text-black font-bold text-sm rounded-lg hover:bg-[#00dd77] transition-colors flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Explore Agent Directory
            </Link>
            <Link
              href="/docs"
              className="px-6 py-3 border border-[#2a2a3a] text-gray-300 font-semibold text-sm rounded-lg hover:border-[#00ff88]/30 hover:text-white transition-colors"
            >
              API Docs
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats Strip ──────────────────────────────────── */}
      <section className="pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Agents Indexed", value: overview?.total_agents || 0, suffix: "" },
            { label: "Evaluations", value: overview?.total_feedback || 0, suffix: "" },
            { label: "Avg Score", value: 0, raw: overview?.avg_score?.toFixed(1) || "—" },
            { label: "Screenings", value: overview?.total_validations || 0, suffix: "" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-5 hover:border-[#00ff88]/20 transition-colors"
            >
              <p className="text-[10px] font-mono text-[#8888aa] uppercase tracking-wider mb-2">{s.label}</p>
              <p className="text-2xl font-mono font-bold text-white" style={{ textShadow: "0 0 20px rgba(0,255,136,0.15)" }}>
                {s.raw ?? <CountUp end={s.value} />}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Deployer Storm ───────────────────────────────── */}
      <section className="pb-16 -mx-4 sm:-mx-6 lg:-mx-8">
        <div className="px-4 sm:px-6 lg:px-8 mb-6">
          <p className="text-[10px] font-mono text-[#8888aa] uppercase tracking-[0.2em] mb-1">
            Live Threat Intelligence
          </p>
          <h2 className="text-2xl font-bold text-white">Deployer Storm</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-2xl">
            Each node is one agent. Shared deployer rings reveal coordinated deployment.
            Ring color = deployer wallet age. Red rings = brand new infrastructure.
          </p>
        </div>

        <div className="bg-[#0a0a0f] border-y border-[#2a2a3a]">
          <DeployerStorm />
        </div>

        <div className="px-4 sm:px-6 lg:px-8 mt-4 text-right">
          <Link
            href="/agents"
            className="text-sm font-mono text-[#00ff88] hover:text-[#00dd77] inline-flex items-center gap-1 transition-colors"
          >
            View Agent Directory <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>

      {/* ── Top Agents ───────────────────────────────────── */}
      <section className="pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#00ff88]" />
            Top Agents
          </h2>
          <Link
            href="/leaderboard"
            className="text-sm font-mono text-[#00ff88] hover:text-[#00dd77] flex items-center gap-1 transition-colors"
          >
            View Leaderboard <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {topAgents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {topAgents.map((agent) => (
              <AgentCard
                key={`${agent.agent_id}-${agent.source_chain || "avalanche"}`}
                agentId={agent.agent_id}
                name={agent.name}
                category={agent.category}
                compositeScore={agent.composite_score}
                tier={agent.tier}
                feedbackCount={agent.total_feedback}
                rank={agent.rank}
                imageUrl={agent.image_url}
                sourceChain={agent.source_chain}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-[#111118] border border-[#2a2a3a] rounded-xl">
            <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 font-mono text-sm">
              {loading ? "Loading agents..." : "No agents registered yet"}
            </p>
            <Link
              href="/register"
              className="inline-block mt-3 text-sm text-[#00ff88] hover:text-[#00dd77]"
            >
              Be the first to register
            </Link>
          </div>
        )}
      </section>

      {/* ── How It Works ─────────────────────────────────── */}
      <section className="pb-16">
        <h2 className="text-xl font-bold text-white mb-8 text-center">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              step: "01",
              title: "Register On-Chain",
              desc: "Agent mints a soulbound identity NFT on ERC-8004. 0.1 AVAX bond as anti-sybil measure. One address, one identity.",
              icon: <Lock className="w-5 h-5" />,
            },
            {
              step: "02",
              title: "9-Signal Scoring",
              desc: "AgentProof runs composite scoring across chain history: ratings, volume, consistency, validation, age, uptime, deployer, URI stability, and coding metrics.",
              icon: <BarChart3 className="w-5 h-5" />,
            },
            {
              step: "03",
              title: "Oracle Publishes",
              desc: "Trust score pushed to on-chain oracle. Queryable by any smart contract (ERC-8183 hooks) or API consumer (REST, A2A, MCP).",
              icon: <Zap className="w-5 h-5" />,
            },
          ].map((item) => (
            <div key={item.step} className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6 hover:border-[#00ff88]/20 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl font-bold font-mono text-[#00ff88]/20">{item.step}</span>
                <div className="w-9 h-9 rounded-lg bg-[#00ff88]/10 flex items-center justify-center text-[#00ff88]">
                  {item.icon}
                </div>
              </div>
              <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>
              <p className="text-xs text-[#8888aa] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trust Tiers ──────────────────────────────────── */}
      <section className="pb-16">
        <h2 className="text-xl font-bold text-white mb-8 text-center">Trust Tiers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: "High Trust",
              range: "Score 70+",
              color: "#00ff88",
              desc: "Eligible for Insurable tag. Full ReputationGate access. Lowest collateral requirements in RiskAssessedHook. Qualifies for Diamond/Platinum/Gold tiers.",
              unlocks: ["Insurance pool eligible", "Max exposure: 100-1000 ETH", "50-75% collateral rate"],
            },
            {
              name: "Watch",
              range: "Score 40-69",
              color: "#ffaa00",
              desc: "Limited exposure. Higher collateral requirements. Building track record. Silver and Bronze tiers — operational but not yet fully trusted.",
              unlocks: ["Reduced max exposure", "85-95% collateral rate", "Rate-limited delegation"],
            },
            {
              name: "Flagged",
              range: "Score <40 or risk flags",
              color: "#ff3344",
              desc: "Blocked by ReputationGate. Maximum collateral required. Risk flags active: concentrated feedback, score volatility, URI churn, or serial deployer patterns.",
              unlocks: ["Blocked by hook gates", "100% collateral required", "Cannot participate in escrow"],
            },
          ].map((tier) => (
            <div
              key={tier.name}
              className="bg-[#111118] rounded-xl p-6 transition-colors"
              style={{ border: `1px solid ${tier.color}20`, boxShadow: `0 0 30px ${tier.color}06` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: tier.color, boxShadow: `0 0 10px ${tier.color}60` }}
                />
                <h3 className="text-sm font-bold text-white">{tier.name}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded ml-auto" style={{ color: tier.color, backgroundColor: `${tier.color}15` }}>
                  {tier.range}
                </span>
              </div>
              <p className="text-xs text-[#8888aa] leading-relaxed mb-4">{tier.desc}</p>
              <ul className="space-y-1.5">
                {tier.unlocks.map((u) => (
                  <li key={u} className="text-[11px] font-mono text-gray-500 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: tier.color }} />
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── SDK / API CTA ────────────────────────────────── */}
      <section className="pb-16">
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-8 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Terminal className="w-5 h-5 text-[#00ff88]" />
                <h2 className="text-xl font-bold text-white">Integrate in Minutes</h2>
              </div>
              <p className="text-sm text-[#8888aa] mb-6">
                Query trust scores from any language. REST API, Python SDK, TypeScript SDK,
                A2A protocol, or MCP tools — pick your interface.
              </p>
              <div className="flex items-center gap-3">
                <Link
                  href="/docs"
                  className="px-5 py-2.5 bg-[#00ff88] text-black font-bold text-sm rounded-lg hover:bg-[#00dd77] transition-colors flex items-center gap-2"
                >
                  <Code2 className="w-4 h-4" />
                  View Docs
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
            <div className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg p-5 font-mono text-sm overflow-x-auto">
              <p className="text-[#8888aa]"># Install</p>
              <p className="text-white">pip install agentproof</p>
              <p className="text-white mt-1">npm i @agentproof/sdk</p>
              <p className="text-[#8888aa] mt-4"># Query a trust score (free, no API key needed)</p>
              <p className="text-white ml-0">
                <span className="text-[#00ff88]">import </span>
                <span className="text-white">requests</span>
              </p>
              <p className="text-white mt-1">
                score = requests.get(<span className="text-[#ffaa00]">&quot;https://oracle.agentproof.sh/api/v1/trust/42&quot;</span>).json()
              </p>
              <p className="text-[#8888aa] mt-1">
                {`# => {score: 72.5, tier: "gold", agent_id: 42}`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Chain Coverage ────────────────────────────────── */}
      <section className="pb-16">
        <p className="text-[10px] font-mono text-[#8888aa] uppercase tracking-[0.2em] mb-3 text-center">
          Indexing Agents Across
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {["Avalanche", "Base", "Ethereum", "Linea", "Polygon", "Arbitrum", "Optimism", "Solana"].map((chain) => (
            <span
              key={chain}
              className="text-xs font-mono text-gray-400 px-3 py-1.5 border border-[#2a2a3a] rounded-lg hover:border-gray-600 hover:text-white transition-colors"
            >
              {chain}
            </span>
          ))}
          <span className="text-xs font-mono text-[#8888aa] px-3 py-1.5">
            +13 more
          </span>
        </div>
      </section>

      {/* ── Evidence Preview ──────────────────────────────── */}
      <EvidencePreview />
    </div>
  );
}
