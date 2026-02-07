"use client";

import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import FilterBar from "@/components/leaderboard/FilterBar";
import { apiFetch } from "@/lib/supabase";

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

export default function LeaderboardPage() {
  const [category, setCategory] = useState("");
  const [timeRange, setTimeRange] = useState("all");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

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
            time_range: timeRange,
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
  }, [category, timeRange, page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-emerald-400" />
          Leaderboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {total} agents ranked by composite reputation score
        </p>
      </div>

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
      />

      <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
        <LeaderboardTable entries={entries} loading={loading} />
      </div>

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
