"use client";

import { useState, useEffect } from "react";
import { Trophy, Users, BarChart3, TrendingUp, Shield } from "lucide-react";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import FilterBar from "@/components/leaderboard/FilterBar";
import { apiFetch } from "@/lib/supabase";
import { formatNumber, getTierColor } from "@/lib/utils";

interface LeaderboardEntry {
  agent_id: number;
  name: string | null;
  category: string;
  composite_score: number;
  average_rating: number;
  total_feedback: number;
  validation_success_rate: number;
  tier: string;
  rank: number | null;
  leaderboard_rank: number;
  image_url: string | null;
}

interface OverviewData {
  total_agents: number;
  total_feedback: number;
  total_validations: number;
  average_score: number;
  tier_distribution?: Record<string, number>;
}

const TIER_ORDER = ["diamond", "platinum", "gold", "silver", "bronze", "unranked"] as const;

export default function LeaderboardPage() {
  const [category, setCategory] = useState("");
  const [chain, setChain] = useState("");
  const [timeRange, setTimeRange] = useState("all");
  const [tierFilter, setTierFilter] = useState("");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [overview, setOverview] = useState<OverviewData | null>(null);

  useEffect(() => {
    apiFetch<OverviewData>("/analytics/overview")
      .then(setOverview)
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const result = await apiFetch<{
          entries: LeaderboardEntry[];
          total: number;
        }>("/leaderboard", {
          params: {
            category: category || undefined,
            chain: chain || undefined,
            time_range: timeRange,
            tier: tierFilter || undefined,
            page,
            page_size: 50,
          },
        });
        setEntries(result.entries);
        setTotal(result.total);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [category, chain, timeRange, tierFilter, page]);

  const tierDist = overview?.tier_distribution || {};
  const totalAgents = overview?.total_agents || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-emerald-400" />
            Leaderboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {formatNumber(total)} agents ranked by composite reputation score
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live scoring
          </span>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-mono text-gray-500 uppercase">Agents Tracked</span>
          </div>
          <p className="text-xl font-bold font-mono text-white">{formatNumber(totalAgents)}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-mono text-gray-500 uppercase">Total Evaluations</span>
          </div>
          <p className="text-xl font-bold font-mono text-white">{formatNumber(overview?.total_feedback || 0)}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-mono text-gray-500 uppercase">Avg Score</span>
          </div>
          <p className="text-xl font-bold font-mono text-white">{overview?.average_score?.toFixed(1) || "---"}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-mono text-gray-500 uppercase">Screenings</span>
          </div>
          <p className="text-xl font-bold font-mono text-white">{formatNumber(overview?.total_validations || 0)}</p>
        </div>
      </div>

      {/* Tier Distribution Bar */}
      {totalAgents > 0 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-gray-500 uppercase">Tier Distribution</span>
            <span className="text-xs font-mono text-gray-600">{formatNumber(totalAgents)} total</span>
          </div>
          {/* Visual bar */}
          <div className="flex rounded-full overflow-hidden h-3 bg-gray-800">
            {TIER_ORDER.map((tier) => {
              const count = tierDist[tier] || 0;
              const pct = totalAgents > 0 ? (count / totalAgents) * 100 : 0;
              if (pct < 0.5) return null;
              return (
                <div
                  key={tier}
                  className="transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: getTierColor(tier),
                    opacity: 0.8,
                  }}
                  title={`${tier}: ${count} agents (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {TIER_ORDER.map((tier) => {
              const count = tierDist[tier] || 0;
              if (count === 0) return null;
              return (
                <button
                  key={tier}
                  onClick={() => setTierFilter(tierFilter === tier ? "" : tier)}
                  className={`flex items-center gap-1.5 text-xs font-mono transition-colors ${
                    tierFilter === tier ? "text-white" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getTierColor(tier) }}
                  />
                  <span className="capitalize">{tier}</span>
                  <span className="text-gray-600">{formatNumber(count)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <FilterBar
        selectedCategory={category}
        onCategoryChange={(c) => {
          setCategory(c);
          setPage(1);
        }}
        selectedTimeRange={timeRange}
        onTimeRangeChange={(r) => {
          setTimeRange(r);
          setPage(1);
        }}
        selectedChain={chain}
        onChainChange={(c) => {
          setChain(c);
          setPage(1);
        }}
      />

      {/* Table */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
        <LeaderboardTable entries={entries} loading={loading} />
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg text-sm font-mono border border-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm font-mono text-gray-500">
            Page {page} of {Math.ceil(total / 50)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= Math.ceil(total / 50)}
            className="px-4 py-2 rounded-lg text-sm font-mono border border-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
