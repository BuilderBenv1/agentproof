"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DollarSign, ArrowLeft } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import { intelligenceFetch } from "@/lib/intelligence";

interface YieldOpp {
  id: number;
  protocol: string;
  pool_name: string;
  pool_type: string;
  token_a: string;
  token_b: string | null;
  apy: number;
  tvl_usd: number;
  risk_score: number;
  risk_adjusted_apy: number;
  recommendation: string;
  is_active: boolean;
}

interface YieldHealth {
  opportunities_tracked: number;
  avg_apy: number;
  best_risk_adjusted_apy: number;
}

function riskColor(score: number) {
  if (score <= 30) return "text-emerald-400";
  if (score <= 60) return "text-yellow-400";
  return "text-red-400";
}

function riskLabel(score: number) {
  if (score <= 30) return "LOW";
  if (score <= 60) return "MED";
  return "HIGH";
}

function recColor(rec: string) {
  if (rec === "strong_buy" || rec === "buy") return "text-emerald-400 bg-emerald-500/10";
  if (rec === "hold") return "text-yellow-400 bg-yellow-500/10";
  return "text-red-400 bg-red-500/10";
}

function formatTVL(tvl: number | null | undefined) {
  if (!tvl && tvl !== 0) return "—";
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`;
  if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
  return `$${tvl.toFixed(0)}`;
}

export default function YieldPage() {
  const [opportunities, setOpportunities] = useState<YieldOpp[]>([]);
  const [health, setHealth] = useState<YieldHealth | null>(null);
  const [sortBy, setSortBy] = useState<"risk_adjusted_apy" | "apy" | "tvl_usd" | "risk_score">("risk_adjusted_apy");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [h, opps] = await Promise.all([
          intelligenceFetch<YieldHealth>("/api/v1/yield/health"),
          intelligenceFetch<YieldOpp[]>("/api/v1/yield/opportunities", {
            params: { sort_by: sortBy, limit: 50 },
          }),
        ]);
        setHealth(h);
        setOpportunities(opps);
      } catch {
        // API might be unavailable
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sortBy]);

  const sorted = [...opportunities].sort((a, b) => {
    if (sortBy === "risk_adjusted_apy") return b.risk_adjusted_apy - a.risk_adjusted_apy;
    if (sortBy === "apy") return b.apy - a.apy;
    if (sortBy === "tvl_usd") return b.tvl_usd - a.tvl_usd;
    return a.risk_score - b.risk_score;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Yield Oracle</h1>
            <p className="text-xs text-gray-500 font-mono">Risk-adjusted DeFi yields on Avalanche</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Opportunities"
          value={health?.opportunities_tracked ?? "—"}
          sublabel="active pools"
        />
        <StatCard
          label="Avg APY"
          value={health ? `${health.avg_apy.toFixed(1)}%` : "—"}
          sublabel="across all pools"
        />
        <StatCard
          label="Best Risk-Adj"
          value={health ? `${health.best_risk_adjusted_apy.toFixed(1)}%` : "—"}
          sublabel="top pick"
        />
        <StatCard
          label="Protocols"
          value={new Set(opportunities.map((o) => o.protocol)).size || "—"}
          sublabel="monitored"
        />
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-gray-500 uppercase">Sort by:</span>
        {(["risk_adjusted_apy", "apy", "tvl_usd", "risk_score"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
              sortBy === key
                ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                : "border-gray-800 text-gray-500 hover:text-white hover:border-gray-700"
            }`}
          >
            {key === "risk_adjusted_apy" ? "RISK-ADJ APY" : key === "tvl_usd" ? "TVL" : key.toUpperCase().replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase">#</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase">Protocol</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase">Pool</th>
                <th className="text-right px-4 py-3 text-xs font-mono text-gray-500 uppercase">APY</th>
                <th className="text-right px-4 py-3 text-xs font-mono text-gray-500 uppercase">Risk-Adj APY</th>
                <th className="text-right px-4 py-3 text-xs font-mono text-gray-500 uppercase">TVL</th>
                <th className="text-center px-4 py-3 text-xs font-mono text-gray-500 uppercase">Risk</th>
                <th className="text-center px-4 py-3 text-xs font-mono text-gray-500 uppercase">Signal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-600 font-mono text-sm">
                    Loading yield data...
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-600 font-mono text-sm">
                    No opportunities found
                  </td>
                </tr>
              ) : (
                sorted.map((opp, i) => (
                  <tr
                    key={opp.id}
                    className="border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-gray-600 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-300 uppercase">{opp.protocol}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-white font-medium">{opp.pool_name || [opp.token_a, opp.token_b].filter(Boolean).join("/") || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-emerald-400 font-bold">{opp.apy.toFixed(2)}%</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-white font-bold">{opp.risk_adjusted_apy.toFixed(2)}%</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-gray-400">{formatTVL(opp.tvl_usd)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-mono text-xs font-bold ${riskColor(opp.risk_score)}`}>
                        {riskLabel(opp.risk_score)}
                      </span>
                      <span className="text-gray-600 text-xs ml-1">({opp.risk_score})</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${recColor(opp.recommendation)}`}>
                        {(opp.recommendation || "hold").toUpperCase().replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-600 text-center font-mono">
        Data refreshed every 15 minutes. Risk scores are AI-generated estimates, not financial advice.
        All predictions proven on-chain via AgentProof Oracle.
      </p>
    </div>
  );
}
