"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DollarSign, ArrowLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, CartesianGrid, ZAxis,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
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
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  max_drawdown: number | null;
  volatility_30d: number | null;
  var_95: number | null;
  profit_factor: number | null;
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
  if (!tvl && tvl !== 0) return "\u2014";
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`;
  if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
  return `$${tvl.toFixed(0)}`;
}

function barFill(score: number) {
  if (score <= 30) return "#10b981";
  if (score <= 60) return "#eab308";
  return "#ef4444";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-white font-bold">{d.name || d.protocol}</p>
      {d.apy !== undefined && <p className="text-emerald-400">APY: {d.apy.toFixed(2)}%</p>}
      {d.risk_score !== undefined && <p className="text-gray-400">Risk: {d.risk_score}</p>}
      {d.tvl_usd !== undefined && <p className="text-gray-400">TVL: {formatTVL(d.tvl_usd)}</p>}
      {d.sharpe !== undefined && <p className="text-cyan-400">Sharpe: {d.sharpe?.toFixed(2) ?? "N/A"}</p>}
    </div>
  );
};

export default function YieldPage() {
  const [opportunities, setOpportunities] = useState<YieldOpp[]>([]);
  const [health, setHealth] = useState<YieldHealth | null>(null);
  const [sortBy, setSortBy] = useState<"risk_adjusted_apy" | "apy" | "tvl_usd" | "risk_score" | "sharpe_ratio">("risk_adjusted_apy");
  const [since, setSince] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const params: Record<string, string | number> = { sort_by: sortBy, limit: 50 };
        if (since) params.since = since;
        const [h, opps] = await Promise.all([
          intelligenceFetch<YieldHealth>("/api/v1/yield/health"),
          intelligenceFetch<YieldOpp[]>("/api/v1/yield/opportunities", { params }),
        ]);
        setHealth(h);
        setOpportunities(opps);
      } catch {}
      setLoading(false);
    }
    load();
  }, [sortBy, since]);

  const sorted = [...opportunities].sort((a, b) => {
    if (sortBy === "risk_adjusted_apy") return b.risk_adjusted_apy - a.risk_adjusted_apy;
    if (sortBy === "apy") return b.apy - a.apy;
    if (sortBy === "tvl_usd") return b.tvl_usd - a.tvl_usd;
    if (sortBy === "sharpe_ratio") return (b.sharpe_ratio ?? 0) - (a.sharpe_ratio ?? 0);
    return a.risk_score - b.risk_score;
  });

  // Chart data: top 10 by risk-adjusted APY
  const chartData = sorted.slice(0, 10).map((o) => ({
    name: o.pool_name || [o.token_a, o.token_b].filter(Boolean).join("/") || o.protocol,
    apy: o.apy,
    risk_adjusted_apy: o.risk_adjusted_apy,
    risk_score: o.risk_score,
    protocol: o.protocol,
  }));

  // Scatter data: risk vs return
  const scatterData = sorted.map((o) => ({
    name: o.pool_name || [o.token_a, o.token_b].filter(Boolean).join("/") || o.protocol,
    risk_score: o.risk_score,
    apy: o.apy,
    tvl_usd: o.tvl_usd || 1000,
    sharpe: o.sharpe_ratio,
    protocol: o.protocol,
  }));

  // Avg Sharpe across all with data
  const sharpeVals = opportunities.filter((o) => o.sharpe_ratio != null).map((o) => o.sharpe_ratio!);
  const avgSharpe = sharpeVals.length > 0 ? (sharpeVals.reduce((a, b) => a + b, 0) / sharpeVals.length).toFixed(2) : "\u2014";

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Opportunities" value={health?.opportunities_tracked ?? "\u2014"} sublabel="active pools" />
        <StatCard label="Avg APY" value={health ? `${health.avg_apy.toFixed(1)}%` : "\u2014"} sublabel="across all pools" />
        <StatCard label="Best Risk-Adj" value={health ? `${health.best_risk_adjusted_apy.toFixed(1)}%` : "\u2014"} sublabel="top pick" />
        <StatCard label="Avg Sharpe" value={avgSharpe} sublabel="risk-adj return" />
        <StatCard label="Protocols" value={new Set(opportunities.map((o) => o.protocol)).size || "\u2014"} sublabel="monitored" />
      </div>

      {/* Date Range + Sort */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DateRangeFilter value={since} onChange={setSince} />
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-500 uppercase">Sort by:</span>
          {(["risk_adjusted_apy", "apy", "tvl_usd", "risk_score", "sharpe_ratio"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
                sortBy === key
                  ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                  : "border-gray-800 text-gray-500 hover:text-white hover:border-gray-700"
              }`}
            >
              {key === "risk_adjusted_apy" ? "RISK-ADJ" : key === "tvl_usd" ? "TVL" : key === "sharpe_ratio" ? "SHARPE" : key.toUpperCase().replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      {sorted.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* APY Bar Chart */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Top 10 by APY</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
                <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10, fontFamily: "monospace" }} width={75} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="apy" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={barFill(entry.risk_score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Risk vs Return Scatter */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Risk vs Return</h3>
            <ResponsiveContainer width="100%" height={250}>
              <ScatterChart margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" dataKey="risk_score" name="Risk" tick={{ fill: "#6b7280", fontSize: 11, fontFamily: "monospace" }} axisLine={false} />
                <YAxis type="number" dataKey="apy" name="APY" tick={{ fill: "#6b7280", fontSize: 11, fontFamily: "monospace" }} axisLine={false} />
                <ZAxis type="number" dataKey="tvl_usd" range={[20, 400]} />
                <Tooltip content={<CustomTooltip />} />
                <Scatter data={scatterData} fill="#10b981" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
                <th className="text-right px-4 py-3 text-xs font-mono text-gray-500 uppercase">Sharpe</th>
                <th className="text-right px-4 py-3 text-xs font-mono text-gray-500 uppercase">Sortino</th>
                <th className="text-center px-4 py-3 text-xs font-mono text-gray-500 uppercase">Signal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-600 font-mono text-sm">
                    Loading yield data...
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-600 font-mono text-sm">
                    No opportunities found
                  </td>
                </tr>
              ) : (
                sorted.map((opp, i) => (
                  <tr key={opp.id} className="border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-600 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-300 uppercase">{opp.protocol}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-white font-medium">{opp.pool_name || [opp.token_a, opp.token_b].filter(Boolean).join("/") || "\u2014"}</span>
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
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono text-xs ${(opp.sharpe_ratio ?? 0) >= 1 ? "text-emerald-400" : (opp.sharpe_ratio ?? 0) >= 0.5 ? "text-yellow-400" : "text-gray-500"}`}>
                        {opp.sharpe_ratio != null ? opp.sharpe_ratio.toFixed(2) : "\u2014"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-xs text-gray-500">
                        {opp.sortino_ratio != null ? opp.sortino_ratio.toFixed(2) : "\u2014"}
                      </span>
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

      <p className="text-xs text-gray-600 text-center font-mono">
        Data refreshed every 15 minutes. Risk scores are AI-generated estimates, not financial advice.
        All predictions proven on-chain via AgentProof Oracle.
      </p>
    </div>
  );
}
