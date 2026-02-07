"use client";

import Link from "next/link";
import CategoryBadge from "@/components/reputation/CategoryBadge";
import { formatScore, getTierColor } from "@/lib/utils";


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

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  loading?: boolean;
}

export default function LeaderboardTable({ entries, loading }: LeaderboardTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-gray-900/30 rounded-lg h-14 animate-pulse" />
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
            <th className="text-left text-xs font-mono text-gray-500 uppercase py-3 px-4 w-16">Rank</th>
            <th className="text-left text-xs font-mono text-gray-500 uppercase py-3 px-4">Agent</th>
            <th className="text-left text-xs font-mono text-gray-500 uppercase py-3 px-4 hidden md:table-cell">Category</th>
            <th className="text-right text-xs font-mono text-gray-500 uppercase py-3 px-4">Score</th>
            <th className="text-right text-xs font-mono text-gray-500 uppercase py-3 px-4 hidden sm:table-cell">Rating</th>
            <th className="text-right text-xs font-mono text-gray-500 uppercase py-3 px-4 hidden sm:table-cell">Feedback</th>
            <th className="text-right text-xs font-mono text-gray-500 uppercase py-3 px-4">Tier</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.agent_id}
              className="border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors"
            >
              <td className="py-3 px-4">
                <span className={`font-mono font-bold text-sm ${
                  entry.leaderboard_rank <= 3 ? "text-emerald-400" : "text-gray-500"
                }`}>
                  {entry.leaderboard_rank}
                </span>
              </td>
              <td className="py-3 px-4">
                <Link
                  href={`/agents/${entry.agent_id}`}
                  className="flex items-center gap-3 hover:text-emerald-400 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-sm font-bold font-mono text-emerald-400 flex-shrink-0">
                    {entry.image_url ? (
                      <img src={entry.image_url} alt="" className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      entry.name?.[0]?.toUpperCase() || "#"
                    )}
                  </div>
                  <span className="text-sm font-medium text-white">
                    {entry.name || `Agent #${entry.agent_id}`}
                  </span>
                </Link>
              </td>
              <td className="py-3 px-4 hidden md:table-cell">
                <CategoryBadge category={entry.category} />
              </td>
              <td className="py-3 px-4 text-right">
                <span className="font-mono font-bold text-white">
                  {formatScore(entry.composite_score)}
                </span>
              </td>
              <td className="py-3 px-4 text-right hidden sm:table-cell">
                <span className="font-mono text-sm text-gray-400">
                  {entry.average_rating.toFixed(1)}
                </span>
              </td>
              <td className="py-3 px-4 text-right hidden sm:table-cell">
                <span className="font-mono text-sm text-gray-400">
                  {entry.total_feedback}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold uppercase"
                  style={{
                    color: getTierColor(entry.tier),
                    backgroundColor: `${getTierColor(entry.tier)}15`,
                  }}
                >
                  {entry.tier}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
