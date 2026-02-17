"use client";

import Link from "next/link";
import CategoryBadge from "@/components/reputation/CategoryBadge";
import { formatScore, getTierColor } from "@/lib/utils";
import { Crown, Medal, Award, MessageSquare, ShieldCheck } from "lucide-react";

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
  source_chain?: string;
}

const CHAIN_COLORS: Record<string, string> = {
  avalanche: "#E84142",
  ethereum: "#627EEA",
  base: "#0052FF",
  linea: "#61DFFF",
};

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  loading?: boolean;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
        <Crown className="w-4 h-4 text-yellow-400" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-400/10 border border-gray-400/30">
        <Medal className="w-4 h-4 text-gray-300" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-700/10 border border-amber-700/30">
        <Award className="w-4 h-4 text-amber-600" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-8 h-8">
      <span className="font-mono font-bold text-sm text-gray-500">{rank}</span>
    </div>
  );
}

function ScoreBar({ score, tier }: { score: number; tier: string }) {
  const color = getTierColor(tier);
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono font-bold text-white text-sm w-10 text-right">
        {formatScore(score)}
      </span>
      <div className="w-20 h-1.5 rounded-full bg-gray-800 hidden lg:block">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(100, score)}%`,
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}40`,
          }}
        />
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const color = getTierColor(tier);
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wide"
      style={{
        color: color,
        backgroundColor: `${color}12`,
        border: `1px solid ${color}25`,
      }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {tier}
    </span>
  );
}

export default function LeaderboardTable({ entries, loading }: LeaderboardTableProps) {
  if (loading) {
    return (
      <div className="space-y-1 p-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-gray-900/30 rounded-lg h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-16 text-gray-600 font-mono text-sm">
        No agents found for this filter
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left text-xs font-mono text-gray-500 uppercase py-3 px-4 w-14">Rank</th>
            <th className="text-left text-xs font-mono text-gray-500 uppercase py-3 px-4">Agent</th>
            <th className="text-left text-xs font-mono text-gray-500 uppercase py-3 px-4 hidden md:table-cell">Category</th>
            <th className="text-right text-xs font-mono text-gray-500 uppercase py-3 px-4">Score</th>
            <th className="text-right text-xs font-mono text-gray-500 uppercase py-3 px-4 hidden sm:table-cell">Rating</th>
            <th className="text-right text-xs font-mono text-gray-500 uppercase py-3 px-4 hidden sm:table-cell">Reviews</th>
            <th className="text-right text-xs font-mono text-gray-500 uppercase py-3 px-4 hidden lg:table-cell">Verified</th>
            <th className="text-right text-xs font-mono text-gray-500 uppercase py-3 px-4">Tier</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isTop3 = entry.leaderboard_rank <= 3;
            return (
              <tr
                key={entry.agent_id}
                className={`border-b border-gray-800/50 transition-colors ${
                  isTop3
                    ? "bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04]"
                    : "hover:bg-gray-900/30"
                }`}
              >
                <td className="py-3 px-4">
                  <RankBadge rank={entry.leaderboard_rank} />
                </td>
                <td className="py-3 px-4">
                  <Link
                    href={`/agents/${entry.agent_id}`}
                    className="flex items-center gap-3 hover:text-emerald-400 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center text-sm font-bold font-mono text-emerald-400 flex-shrink-0 overflow-hidden">
                      {entry.image_url ? (
                        <img src={entry.image_url} alt="" className="w-full h-full rounded-lg object-cover" />
                      ) : (
                        entry.name?.[0]?.toUpperCase() || "#"
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors block">
                        {entry.name || `Agent #${entry.agent_id}`}
                      </span>
                      <span className="text-xs text-gray-600 font-mono flex items-center gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full inline-block"
                          style={{ backgroundColor: CHAIN_COLORS[entry.source_chain || "avalanche"] || "#666" }}
                          title={entry.source_chain || "avalanche"}
                        />
                        ID: {entry.agent_id}
                      </span>
                    </div>
                  </Link>
                </td>
                <td className="py-3 px-4 hidden md:table-cell">
                  <CategoryBadge category={entry.category} />
                </td>
                <td className="py-3 px-4">
                  <div className="flex justify-end">
                    <ScoreBar score={entry.composite_score} tier={entry.tier} />
                  </div>
                </td>
                <td className="py-3 px-4 text-right hidden sm:table-cell">
                  <span className="font-mono text-sm text-gray-400">
                    {entry.average_rating.toFixed(1)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right hidden sm:table-cell">
                  <span className="font-mono text-sm text-gray-400 flex items-center justify-end gap-1">
                    <MessageSquare className="w-3 h-3 text-gray-600" />
                    {entry.total_feedback}
                  </span>
                </td>
                <td className="py-3 px-4 text-right hidden lg:table-cell">
                  {entry.validation_success_rate > 0 ? (
                    <span className="font-mono text-sm text-emerald-400 flex items-center justify-end gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {entry.validation_success_rate.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-gray-600">---</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <TierBadge tier={entry.tier} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
