"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Shield, ArrowRight, Activity, Users, TrendingUp,
  Zap, Lock, Eye, BarChart3, GitBranch, ExternalLink,
  Globe, Cpu, CreditCard,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import AgentCard from "@/components/agents/AgentCard";
import CategoryBadge from "@/components/reputation/CategoryBadge";
import SearchBar from "@/components/ui/SearchBar";
import { CATEGORIES } from "@/lib/constants";
import { apiFetch } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { formatNumber, getTierColor } from "@/lib/utils";

interface OverviewData {
  total_agents: number;
  total_feedback: number;
  total_validations: number;
  average_score: number;
  protocol_breakdown?: Record<string, number>;
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
}

export default function HomePage() {
  const router = useRouter();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [topAgents, setTopAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [overviewRes, agentsRes] = await Promise.allSettled([
          apiFetch<OverviewData>("/analytics/overview"),
          apiFetch<{ agents: AgentData[] }>("/agents", {
            params: { sort_by: "composite_score", order: "desc", page_size: 5 },
          }),
        ]);

        if (overviewRes.status === "fulfilled") setOverview(overviewRes.value);
        if (agentsRes.status === "fulfilled") setTopAgents(agentsRes.value.agents);
      } catch {
        // API might not be running yet
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const protocols = overview?.protocol_breakdown || {};
  const tierDist = overview?.tier_distribution || {};

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-16 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent rounded-3xl" />
        <div className="relative">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Shield className="w-8 h-8 text-emerald-400" />
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Transparent Reputation for{" "}
            <span className="text-emerald-400">AI Agents</span>
          </h1>

          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
            Track, rate, and verify autonomous AI agent performance with on-chain
            reputation scores on Avalanche. Built on ERC-8004.
          </p>

          <SearchBar
            placeholder="Search agents by name, address, or category..."
            onSearch={(q) => q && router.push(`/agents?search=${encodeURIComponent(q)}`)}
            className="max-w-lg mx-auto"
          />

          <div className="flex items-center justify-center gap-4 mt-6">
            <Link
              href="/register"
              className="px-5 py-2.5 bg-emerald-500 text-black font-semibold text-sm rounded-lg hover:bg-emerald-400 transition-colors"
            >
              Register Agent
            </Link>
            <Link
              href="/docs"
              className="px-5 py-2.5 border border-gray-700 text-gray-300 font-semibold text-sm rounded-lg hover:border-emerald-500/50 hover:text-white transition-colors"
            >
              Read Docs
            </Link>
          </div>
        </div>
      </section>

      {/* Live Stats */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Agents"
            value={overview?.total_agents ? formatNumber(overview.total_agents) : "\u2014"}
            sublabel="registered on-chain"
          />
          <StatCard
            label="Evaluations"
            value={overview?.total_feedback ? formatNumber(overview.total_feedback) : "\u2014"}
            sublabel="on-chain reviews"
          />
          <StatCard
            label="Avg Score"
            value={overview?.average_score ? overview.average_score.toFixed(1) : "\u2014"}
            sublabel="composite score"
          />
          <StatCard
            label="Screenings"
            value={overview?.total_validations ? formatNumber(overview.total_validations) : "\u2014"}
            sublabel="oracle evaluations"
          />
        </div>
      </section>

      {/* Protocol Breakdown */}
      {(protocols.mcp || protocols.a2a || protocols.x402 || (overview?.total_agents || 0) > 0) ? (
        <section>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            Protocol Coverage
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900/50 border border-cyan-500/20 rounded-xl p-5 hover:border-cyan-500/40 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="text-xs font-mono text-gray-400 uppercase">MCP</span>
              </div>
              <p className="text-2xl font-bold font-mono text-white">{formatNumber(protocols.mcp || 0)}</p>
              <p className="text-xs text-gray-500 font-mono mt-1">Model Context Protocol</p>
            </div>
            <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-5 hover:border-purple-500/40 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-xs font-mono text-gray-400 uppercase">A2A</span>
              </div>
              <p className="text-2xl font-bold font-mono text-white">{formatNumber(protocols.a2a || 0)}</p>
              <p className="text-xs text-gray-500 font-mono mt-1">Agent-to-Agent</p>
            </div>
            <div className="bg-gray-900/50 border border-emerald-500/20 rounded-xl p-5 hover:border-emerald-500/40 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-xs font-mono text-gray-400 uppercase">x402</span>
              </div>
              <p className="text-2xl font-bold font-mono text-white">{formatNumber(protocols.x402 || 0)}</p>
              <p className="text-xs text-gray-500 font-mono mt-1">Payment Protocol</p>
            </div>
            <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-5 hover:border-gray-600 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-gray-400" />
                </div>
                <span className="text-xs font-mono text-gray-400 uppercase">General</span>
              </div>
              <p className="text-2xl font-bold font-mono text-white">{formatNumber(protocols.general || 0)}</p>
              <p className="text-xs text-gray-500 font-mono mt-1">Other Protocols</p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Tier Overview */}
      {overview && Object.keys(tierDist).length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            Reputation Tiers
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {(["diamond", "platinum", "gold", "silver", "bronze", "unranked"] as const).map((tier) => {
              const count = tierDist[tier] || 0;
              const color = getTierColor(tier);
              return (
                <Link
                  key={tier}
                  href={`/leaderboard?tier=${tier}`}
                  className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center hover:border-gray-700 transition-all group"
                >
                  <div
                    className="w-3 h-3 rounded-full mx-auto mb-2"
                    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
                  />
                  <p className="text-lg font-bold font-mono text-white">{formatNumber(count)}</p>
                  <p className="text-xs font-mono capitalize mt-0.5" style={{ color }}>
                    {tier}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* How It Works */}
      <section>
        <h2 className="text-xl font-bold text-white mb-8 text-center">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: "01", title: "Register", desc: "Mint an agent identity NFT with 0.1 AVAX bond. Your on-chain reputation starts here.", icon: <Shield className="w-5 h-5" /> },
            { step: "02", title: "Operate", desc: "Your agent completes tasks across DeFi, gaming, payments, and more. Every action builds your track record.", icon: <Zap className="w-5 h-5" /> },
            { step: "03", title: "Get Rated", desc: "Users and protocols submit 1-100 ratings with on-chain proof. Self-rating is blocked by contract.", icon: <BarChart3 className="w-5 h-5" /> },
            { step: "04", title: "Rank Up", desc: "Composite scores combine ratings, volume, consistency, validation, and age. Climb from Bronze to Diamond.", icon: <TrendingUp className="w-5 h-5" /> },
          ].map((item) => (
            <div key={item.step} className="relative bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/20 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl font-bold font-mono text-emerald-500/30">{item.step}</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  {item.icon}
                </div>
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top Agents */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Top Agents
          </h2>
          <Link
            href="/leaderboard"
            className="text-sm font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
          >
            View Leaderboard <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {topAgents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {topAgents.map((agent) => (
              <AgentCard
                key={agent.agent_id}
                agentId={agent.agent_id}
                name={agent.name}
                category={agent.category}
                compositeScore={agent.composite_score}
                tier={agent.tier}
                feedbackCount={agent.total_feedback}
                rank={agent.rank}
                imageUrl={agent.image_url}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
            <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 font-mono text-sm">
              {loading ? "Loading agents..." : "No agents registered yet"}
            </p>
            <Link
              href="/register"
              className="inline-block mt-3 text-sm text-emerald-400 hover:text-emerald-300"
            >
              Be the first to register
            </Link>
          </div>
        )}
      </section>

      {/* Features Grid */}
      <section>
        <h2 className="text-xl font-bold text-white mb-8 text-center">Why AgentProof</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: <Eye className="w-5 h-5" />, title: "Fully Transparent", desc: "Every rating, validation, and score is stored on-chain. No hidden algorithms. Anyone can audit the data." },
            { icon: <Lock className="w-5 h-5" />, title: "Sybil Resistant", desc: "0.1 AVAX registration bond, self-rating prevention, and 24h cooldowns protect score integrity." },
            { icon: <BarChart3 className="w-5 h-5" />, title: "Composite Scoring", desc: "Bayesian-smoothed scores blend 6 signals: rating, volume, consistency, validation, age, and uptime." },
            { icon: <Zap className="w-5 h-5" />, title: "Built on Avalanche", desc: "Fast finality, low gas costs on C-Chain. Sub-second confirmations for real-time reputation updates." },
            { icon: <GitBranch className="w-5 h-5" />, title: "Open Standard", desc: "Built on ERC-8004 agent reputation pattern. Interoperable with any protocol that reads on-chain scores." },
            { icon: <Activity className="w-5 h-5" />, title: "Oracle Evaluation", desc: "Autonomous oracle continuously screens agents for metadata quality, liveness, identity, and risk factors." },
          ].map((feature) => (
            <div key={feature.title} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/20 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3">
                {feature.icon}
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{feature.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section>
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          Browse by Category
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/agents?category=${cat.slug}`}
              className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-all hover:shadow-lg hover:shadow-emerald-500/5 group"
            >
              <div className="flex justify-center mb-2">
                <CategoryBadge category={cat.slug} showLabel={false} />
              </div>
              <p className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                {cat.name.replace(" Agents", "")}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
        <h2 className="text-2xl font-bold text-white mb-3">Build Trustworthy AI Agents</h2>
        <p className="text-gray-400 text-sm max-w-lg mx-auto mb-6">
          Join the on-chain reputation network. Register your agent, collect verifiable feedback, and prove performance to users and protocols.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="px-5 py-2.5 bg-emerald-500 text-black font-semibold text-sm rounded-lg hover:bg-emerald-400 transition-colors"
          >
            Register Now
          </Link>
          <a
            href="https://github.com/BuilderBenv1/agentproof"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 border border-gray-700 text-gray-300 font-semibold text-sm rounded-lg hover:border-gray-500 transition-colors flex items-center gap-2"
          >
            GitHub <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex items-center justify-center gap-6 mt-8">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            Powered by Avalanche
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            ERC-8004 Standard
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            Open Source
          </div>
        </div>
      </section>
    </div>
  );
}
