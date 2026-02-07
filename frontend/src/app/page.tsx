"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shield, ArrowRight, Activity, Users, TrendingUp } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import AgentCard from "@/components/agents/AgentCard";
import CategoryBadge from "@/components/reputation/CategoryBadge";
import SearchBar from "@/components/ui/SearchBar";
import { CATEGORIES } from "@/lib/constants";
import { apiFetch } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface OverviewData {
  total_agents: number;
  total_feedback: number;
  total_validations: number;
  average_score: number;
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
        // API might not be running yet — that's fine, show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-12">
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
        </div>
      </section>

      {/* Live Stats */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Agents"
            value={overview?.total_agents ?? "—"}
            sublabel="registered"
          />
          <StatCard
            label="Total Feedback"
            value={overview?.total_feedback ?? "—"}
            sublabel="on-chain reviews"
          />
          <StatCard
            label="Avg Score"
            value={overview?.average_score ? overview.average_score.toFixed(1) : "—"}
            sublabel="composite"
          />
          <StatCard
            label="Validations"
            value={overview?.total_validations ?? "—"}
            sublabel="task verifications"
          />
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
    </div>
  );
}
