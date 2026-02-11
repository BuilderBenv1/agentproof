"use client";

import { useEffect, useState } from "react";
import { Trophy, ArrowUpRight, Filter } from "lucide-react";
import type { TrustedAgent } from "@/lib/api";
import { getScoreColor, getTierColor } from "@/lib/constants";

const API = process.env.NEXT_PUBLIC_API_URL || "https://api.agent402.sh";

const CATEGORIES = [
  { slug: "", label: "All" },
  { slug: "defi", label: "DeFi" },
  { slug: "gaming", label: "Gaming" },
  { slug: "rwa", label: "RWA" },
  { slug: "payments", label: "Payments" },
  { slug: "data", label: "Data" },
  { slug: "general", label: "General" },
];

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<TrustedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (category) params.set("category", category);

    fetch(`${API}/api/v1/agents/top?${params}`)
      .then((r) => {
        if (r.status === 402) {
          setError("Paid endpoint — use x402 SDK");
          return [];
        }
        return r.ok ? r.json() : [];
      })
      .then((data) => {
        if (Array.isArray(data)) setAgents(data);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy className="w-6 h-6 text-primary" />
          <h1 className="font-sans text-3xl font-bold text-white">
            Leaderboard
          </h1>
        </div>
        <p className="text-muted">
          Top-rated AI agents by composite trust score
        </p>
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Filter className="w-4 h-4 text-muted-3" />
        {CATEGORIES.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => setCategory(cat.slug)}
            className={`text-xs px-3 py-1.5 rounded-lg font-mono transition-colors ${
              category === cat.slug
                ? "bg-primary text-white"
                : "bg-surface border border-surface-2 text-muted hover:text-white hover:border-primary/30"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 text-sm text-danger mb-6">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-surface-2 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-2 text-xs text-muted-2 uppercase tracking-wider">
              <th className="text-left px-4 py-3 w-12">#</th>
              <th className="text-left px-4 py-3">Agent</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Category</th>
              <th className="text-left px-4 py-3">Tier</th>
              <th className="text-right px-4 py-3">Score</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Feedback</th>
              <th className="text-right px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted">
                  Loading...
                </td>
              </tr>
            ) : agents.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted">
                  No agents found
                </td>
              </tr>
            ) : (
              agents.map((agent, i) => (
                <tr
                  key={agent.agent_id}
                  className="border-b border-surface-2/50 hover:bg-surface-2/30 transition-colors"
                >
                  <td className="px-4 py-3 text-muted-2 font-mono text-sm">
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white text-sm">
                      {agent.name || `Agent #${agent.agent_id}`}
                    </div>
                    <div className="text-xs text-muted-3 font-mono">
                      #{agent.agent_id}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-muted font-mono">
                      {agent.category || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded border font-mono uppercase ${getTierColor(
                        agent.tier
                      )}`}
                    >
                      {agent.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-bold font-mono ${getScoreColor(
                        agent.composite_score
                      )}`}
                    >
                      {agent.composite_score.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell text-sm text-muted">
                    {agent.feedback_count}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/lookup?id=${agent.agent_id}`}
                      className="text-primary hover:text-primary-light"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
