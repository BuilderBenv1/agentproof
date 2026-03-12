"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/supabase";
import { formatScore } from "@/lib/utils";
import {
  Trophy,
  Zap,
  Activity,
  Wifi,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  agent_id: number;
  name: string;
  category: string | null;
  source_chain: string | null;
  current_score: number;
  first_score: number;
  score_velocity: number;
  velocity_per_day: number;
  hackathon_score: number;
  activity_count: number;
  avg_uptime: number;
  tier: string;
  days_active: number;
  total_feedback: number;
  validation_success_rate: number;
}

interface HackathonStats {
  total_teams: number;
  total_agents_scored: number;
  avg_velocity: number;
  top_velocity: number;
  hackathon_start: string;
  hackathon_active: boolean;
}

interface ScoringWeights {
  score_velocity: string;
  activity_volume: string;
  liveness: string;
  current_score: string;
  note: string;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  hackathon_stats: HackathonStats;
  scoring_weights: ScoringWeights;
}

type SortBy = "velocity" | "score" | "activity" | "liveness";

const SORT_OPTIONS: { key: SortBy; label: string; icon: React.ReactNode }[] = [
  { key: "velocity", label: "Velocity", icon: <Zap className="w-3 h-3" /> },
  { key: "score", label: "Hackathon Score", icon: <Trophy className="w-3 h-3" /> },
  { key: "activity", label: "Activity", icon: <Activity className="w-3 h-3" /> },
  { key: "liveness", label: "Liveness", icon: <Wifi className="w-3 h-3" /> },
];

const CHAIN_COLORS: Record<string, string> = {
  avalanche: "#E84142",
  ethereum: "#627EEA",
  base: "#0052FF",
  solana: "#9945FF",
  polygon: "#8247E5",
  arbitrum: "#28A0F0",
  optimism: "#FF0420",
  bsc: "#F0B90B",
  linea: "#61DFFF",
};

function VelocityArrow({ velocity }: { velocity: number }) {
  if (velocity > 0.5)
    return <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />;
  if (velocity < -0.5)
    return <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-600" />;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="text-lg">
        <span className="text-yellow-400 font-bold font-mono">1</span>
      </span>
    );
  if (rank === 2)
    return (
      <span className="text-lg">
        <span className="text-gray-300 font-bold font-mono">2</span>
      </span>
    );
  if (rank === 3)
    return (
      <span className="text-lg">
        <span className="text-amber-600 font-bold font-mono">3</span>
      </span>
    );
  return <span className="text-sm font-mono text-gray-500">{rank}</span>;
}

function VelocityBar({ velocity, maxVelocity }: { velocity: number; maxVelocity: number }) {
  const pct = maxVelocity > 0 ? Math.max(0, Math.min(100, (velocity / maxVelocity) * 100)) : 0;
  const color =
    velocity > 20 ? "bg-emerald-400" : velocity > 10 ? "bg-emerald-500/70" : velocity > 0 ? "bg-emerald-600/50" : "bg-red-500/50";

  return (
    <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function SynthesisPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("velocity");
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<LeaderboardResponse>(
          "/api/v1/synthesis/leaderboard",
          { params: { sort_by: sortBy, limit: 100 } }
        );
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sortBy]);

  const stats = data?.hackathon_stats;
  const entries = data?.leaderboard || [];
  const maxVelocity = entries.length > 0 ? Math.max(...entries.map((e) => e.score_velocity), 1) : 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-widest">
              Live Hackathon
            </p>
            <h1 className="text-2xl font-bold text-white">The Synthesis</h1>
          </div>
        </div>
        <p className="text-sm text-gray-400 max-w-xl mt-2">
          Real-time leaderboard ranked by score velocity — who is building the
          most reputable agent, fastest. Time-dependent signals are de-weighted.
          Only activity during the hackathon counts.
        </p>
      </div>

      {/* Stats Strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Teams", value: stats.total_teams, mono: true },
            { label: "Agents Scored", value: stats.total_agents_scored, mono: true },
            {
              label: "Avg Velocity",
              value: `+${stats.avg_velocity.toFixed(1)}`,
              mono: true,
              color: "text-emerald-400",
            },
            {
              label: "Top Velocity",
              value: `+${stats.top_velocity.toFixed(1)}`,
              mono: true,
              color: "text-yellow-400",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-[#111118] border border-[#2a2a3a] rounded-lg px-4 py-3"
            >
              <p className="text-[10px] font-mono text-gray-500 uppercase">
                {s.label}
              </p>
              <p
                className={`text-lg font-bold font-mono ${s.color || "text-white"} mt-0.5`}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Scoring Weights Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-6 text-[10px] font-mono text-gray-500">
        <span className="uppercase tracking-wider text-gray-600">Weights:</span>
        <span>
          <span className="text-emerald-400">35%</span> velocity
        </span>
        <span>
          <span className="text-blue-400">25%</span> activity
        </span>
        <span>
          <span className="text-purple-400">20%</span> liveness
        </span>
        <span>
          <span className="text-yellow-400">20%</span> score
        </span>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-mono text-gray-500">
          {entries.length} agent{entries.length !== 1 ? "s" : ""}
        </p>
        <div className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#111118] border border-[#2a2a3a] rounded-lg text-xs font-mono text-gray-300 hover:border-emerald-400/30 transition-colors"
          >
            {SORT_OPTIONS.find((s) => s.key === sortBy)?.icon}
            {SORT_OPTIONS.find((s) => s.key === sortBy)?.label}
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-1 bg-[#111118] border border-[#2a2a3a] rounded-lg shadow-xl z-20 overflow-hidden">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setSortBy(opt.key);
                    setSortOpen(false);
                  }}
                  className={`flex items-center gap-2 w-full px-4 py-2 text-xs font-mono text-left hover:bg-emerald-400/5 transition-colors ${
                    sortBy === opt.key ? "text-emerald-400" : "text-gray-400"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-20">
          <p className="text-red-400 font-mono text-sm">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-20 border border-[#2a2a3a] rounded-xl bg-[#111118]">
          <Zap className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-mono text-sm mb-1">
            No agents scored yet
          </p>
          <p className="text-gray-600 text-xs">
            The leaderboard populates once hackathon builders start registering
            and scoring agents.
          </p>
        </div>
      )}

      {/* Leaderboard Table */}
      {!loading && !error && entries.length > 0 && (
        <div className="border border-[#2a2a3a] rounded-xl overflow-hidden bg-[#111118]">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-[#0d0d14] border-b border-[#2a2a3a] text-[10px] font-mono text-gray-500 uppercase tracking-wider">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-4">Agent</div>
            <div className="col-span-2 text-right">Velocity</div>
            <div className="col-span-2 text-right">Score</div>
            <div className="col-span-1 text-right">Activity</div>
            <div className="col-span-1 text-right">Uptime</div>
            <div className="col-span-1 text-right">H-Score</div>
          </div>

          {/* Rows */}
          {entries.map((entry) => (
            <Link
              key={entry.agent_id}
              href={`/agents/${entry.agent_id}`}
              className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-[#1a1a24] hover:bg-emerald-400/[0.02] transition-colors group items-center"
            >
              {/* Rank */}
              <div className="col-span-1 text-center">
                <RankBadge rank={entry.rank} />
              </div>

              {/* Agent Name + Chain */}
              <div className="col-span-4 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white font-medium truncate group-hover:text-emerald-400 transition-colors">
                    {entry.name}
                  </p>
                  <ExternalLink className="w-3 h-3 text-gray-700 group-hover:text-emerald-400/50 flex-shrink-0" />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {entry.source_chain && (
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{
                        color: CHAIN_COLORS[entry.source_chain] || "#888",
                        backgroundColor: `${CHAIN_COLORS[entry.source_chain] || "#888"}15`,
                      }}
                    >
                      {entry.source_chain}
                    </span>
                  )}
                  {entry.category && entry.category !== "general" && (
                    <span className="text-[10px] font-mono text-gray-600">
                      {entry.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Velocity */}
              <div className="col-span-2 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <VelocityBar
                    velocity={entry.score_velocity}
                    maxVelocity={maxVelocity}
                  />
                  <VelocityArrow velocity={entry.score_velocity} />
                  <span
                    className={`text-xs font-mono font-semibold ${
                      entry.score_velocity > 0
                        ? "text-emerald-400"
                        : entry.score_velocity < 0
                        ? "text-red-400"
                        : "text-gray-500"
                    }`}
                  >
                    {entry.score_velocity > 0 ? "+" : ""}
                    {entry.score_velocity.toFixed(1)}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-gray-600 mt-0.5">
                  {entry.velocity_per_day > 0 ? "+" : ""}
                  {entry.velocity_per_day.toFixed(1)}/day
                </p>
              </div>

              {/* Current Score */}
              <div className="col-span-2 text-right">
                <span className="text-sm font-mono text-white">
                  {formatScore(entry.current_score)}
                </span>
                <p className="text-[10px] font-mono text-gray-600 mt-0.5">
                  from {formatScore(entry.first_score)}
                </p>
              </div>

              {/* Activity */}
              <div className="col-span-1 text-right">
                <span className="text-xs font-mono text-gray-300">
                  {entry.activity_count}
                </span>
              </div>

              {/* Uptime */}
              <div className="col-span-1 text-right">
                <span
                  className={`text-xs font-mono ${
                    entry.avg_uptime >= 99
                      ? "text-emerald-400"
                      : entry.avg_uptime >= 90
                      ? "text-yellow-400"
                      : entry.avg_uptime > 0
                      ? "text-red-400"
                      : "text-gray-600"
                  }`}
                >
                  {entry.avg_uptime > 0 ? `${entry.avg_uptime.toFixed(0)}%` : "—"}
                </span>
              </div>

              {/* Hackathon Score */}
              <div className="col-span-1 text-right">
                <span className="text-xs font-mono font-semibold text-emerald-400">
                  {entry.hackathon_score.toFixed(1)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Footer Disclaimer */}
      <p className="text-[10px] font-mono text-gray-600 mt-6 text-center">
        Scores are informational only and do not constitute financial advice or
        endorsement.{" "}
        <Link href="/terms" className="text-gray-500 hover:text-emerald-400 underline">
          Terms
        </Link>
      </p>
    </div>
  );
}
