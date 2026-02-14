"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, ArrowLeft, Zap } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { intelligenceFetch } from "@/lib/intelligence";
import { timeAgo } from "@/lib/utils";

interface ConvergenceSignal {
  id: number;
  token_symbol: string;
  agent_count: number;
  agents_involved: string[];
  convergence_score: number;
  convergence_multiplier: number;
  signal_direction: string;
  direction_agreement: boolean;
  convergence_analysis: string | null;
  proof_tx_hash: string | null;
  created_at: string;
}

interface TokenCorrelation {
  tokens: { token: string; agent_mentions: number; agents: string[]; convergence_count: number }[];
  total_signals: number;
}

const DIR_COLORS: Record<string, string> = {
  bullish: "#10b981",
  bearish: "#ef4444",
  mixed: "#eab308",
};

function dirColor(dir: string) {
  if (dir === "bullish") return "text-emerald-400 bg-emerald-500/10";
  if (dir === "bearish") return "text-red-400 bg-red-500/10";
  return "text-yellow-400 bg-yellow-500/10";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-white font-bold">{d.token || d.name}</p>
      {d.convergence_score !== undefined && <p className="text-orange-400">Score: {d.convergence_score.toFixed(1)}</p>}
      {d.convergence_count !== undefined && <p className="text-gray-400">{d.convergence_count} signals</p>}
      {d.agent_mentions !== undefined && <p className="text-gray-400">{d.agent_mentions} agent mentions</p>}
      {d.value !== undefined && <p className="text-gray-400">Count: {d.value}</p>}
    </div>
  );
};

export default function ConvergencePage() {
  const [signals, setSignals] = useState<ConvergenceSignal[]>([]);
  const [correlation, setCorrelation] = useState<TokenCorrelation | null>(null);
  const [since, setSince] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { limit: 30 };
        if (since) params.since = since;
        const [data, corr] = await Promise.all([
          intelligenceFetch<ConvergenceSignal[]>("/api/v1/convergence/signals", { params }),
          intelligenceFetch<TokenCorrelation>("/api/v1/analytics/correlation").catch(() => null),
        ]);
        setSignals(data);
        setCorrelation(corr);
      } catch {}
      setLoading(false);
    }
    load();
  }, [since]);

  const threeAgent = signals.filter((s) => s.agent_count >= 3).length;
  const avgScore = signals.length > 0
    ? (signals.reduce((s, x) => s + x.convergence_score, 0) / signals.length).toFixed(1)
    : "\u2014";
  const bullish = signals.filter((s) => s.signal_direction === "bullish").length;

  // Direction distribution pie
  const dirDist: Record<string, number> = {};
  signals.forEach((s) => { dirDist[s.signal_direction] = (dirDist[s.signal_direction] || 0) + 1; });
  const pieData = Object.entries(dirDist).map(([name, value]) => ({
    name,
    value,
    fill: DIR_COLORS[name] || "#6b7280",
  }));

  // Top tokens by convergence score
  const tokenScores: Record<string, { score: number; count: number }> = {};
  signals.forEach((s) => {
    if (!tokenScores[s.token_symbol]) tokenScores[s.token_symbol] = { score: 0, count: 0 };
    tokenScores[s.token_symbol].score += s.convergence_score;
    tokenScores[s.token_symbol].count++;
  });
  const tokenBarData = Object.entries(tokenScores)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 8)
    .map(([token, d]) => ({
      token,
      convergence_score: d.score / d.count,
      convergence_count: d.count,
      name: token,
    }));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Convergence Signals</h1>
            <p className="text-xs text-gray-500 font-mono">When 2+ agents independently flag the same token</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <DateRangeFilter value={since} onChange={setSince} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Signals" value={signals.length} sublabel="detected" />
        <StatCard label="3-Agent" value={threeAgent} sublabel="strongest signals" />
        <StatCard label="Avg Score" value={avgScore} sublabel="convergence score" />
        <StatCard label="Bullish" value={bullish} sublabel={`of ${signals.length} signals`} />
      </div>

      {/* Info Banner */}
      <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 flex items-start gap-3">
        <Zap className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-white font-medium mb-1">How Convergence Works</p>
          <p className="text-xs text-gray-400">
            When Tipster, Whale Tracker, and Narrative independently detect the same token within 24 hours,
            a convergence signal fires. 2-agent overlap gets 1.5x confidence boost, 3-agent gets 2.0x.
            Direction agreement adds another 0.2x bonus.
          </p>
        </div>
      </div>

      {/* Charts */}
      {signals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pieData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Signal Direction</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {tokenBarData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Top Tokens by Avg Score</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={tokenBarData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis dataKey="token" tick={{ fill: "#9ca3af", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="convergence_score" radius={[4, 4, 0, 0]} fill="#f97316" fillOpacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Token Correlation Matrix */}
      {correlation && correlation.tokens.length > 0 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Token-Agent Correlation</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-3 py-2 text-xs font-mono text-gray-500">Token</th>
                  <th className="text-center px-3 py-2 text-xs font-mono text-gray-500">Signals</th>
                  <th className="text-center px-3 py-2 text-xs font-mono text-gray-500">Agent Mentions</th>
                  <th className="text-left px-3 py-2 text-xs font-mono text-gray-500">Agents</th>
                </tr>
              </thead>
              <tbody>
                {correlation.tokens.slice(0, 10).map((t) => (
                  <tr key={t.token} className="border-b border-gray-800/50">
                    <td className="px-3 py-2 font-mono text-white font-bold">{t.token}</td>
                    <td className="px-3 py-2 text-center font-mono text-orange-400">{t.convergence_count}</td>
                    <td className="px-3 py-2 text-center font-mono text-gray-400">{t.agent_mentions}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {t.agents.map((a) => (
                          <span key={a} className="px-1.5 py-0.5 rounded bg-gray-800 text-xs font-mono text-gray-300">{a}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-600 font-mono text-sm">Loading convergence data...</div>
        ) : signals.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
            <BarChart3 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 font-mono text-sm">No convergence signals yet</p>
            <p className="text-gray-600 text-xs mt-1">Signals appear when 2+ agents flag the same token within 24h</p>
          </div>
        ) : (
          signals.map((sig) => (
            <div
              key={sig.id}
              className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-orange-500/20 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold font-mono text-white">{sig.token_symbol}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${dirColor(sig.signal_direction)}`}>
                    {sig.signal_direction}
                  </span>
                  {sig.direction_agreement && (
                    <span className="px-2 py-0.5 rounded text-xs font-mono text-emerald-400 bg-emerald-500/10">
                      ALIGNED
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold font-mono text-orange-400">
                    {sig.convergence_score.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-600 font-mono ml-1">score</span>
                </div>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 font-mono">AGENTS:</span>
                  {sig.agents_involved.map((a) => (
                    <span
                      key={a}
                      className="px-2 py-0.5 rounded bg-gray-800 text-xs font-mono text-gray-300"
                    >
                      {a}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-gray-600 font-mono">
                  {sig.convergence_multiplier.toFixed(1)}x boost
                </span>
                <span className="text-xs text-gray-600 font-mono">{timeAgo(sig.created_at)}</span>
              </div>
              {sig.convergence_analysis && (
                <p className="text-xs text-gray-500 leading-relaxed">{sig.convergence_analysis}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
