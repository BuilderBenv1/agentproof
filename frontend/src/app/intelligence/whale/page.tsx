"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, ArrowLeft, ExternalLink } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { intelligenceFetch } from "@/lib/intelligence";
import { timeAgo } from "@/lib/utils";

interface WhaleTx {
  id: number;
  wallet_address: string;
  token_symbol: string;
  action: string;
  amount_usd: number;
  significance: string;
  analysis: string;
  detected_at: string;
  tx_hash: string | null;
}

interface WhaleSummary {
  period: string;
  total_transactions: number;
  total_volume_usd: number;
  unique_tokens: number;
  top_tokens: { token: string; tx_count: number; volume_usd: number }[];
  significance_distribution: Record<string, number>;
}

function sigColor(sig: string) {
  if (sig === "critical") return "text-red-400 bg-red-500/10";
  if (sig === "high") return "text-orange-400 bg-orange-500/10";
  if (sig === "medium") return "text-yellow-400 bg-yellow-500/10";
  return "text-gray-400 bg-gray-500/10";
}

const SIG_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};

function formatUSD(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function truncAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "\u2014";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-white font-bold">{d.token || d.name}</p>
      {d.volume_usd !== undefined && <p className="text-emerald-400">Vol: {formatUSD(d.volume_usd)}</p>}
      {d.tx_count !== undefined && <p className="text-gray-400">{d.tx_count} txns</p>}
      {d.value !== undefined && <p className="text-gray-400">{d.value} signals</p>}
    </div>
  );
};

export default function WhalePage() {
  const [transactions, setTransactions] = useState<WhaleTx[]>([]);
  const [summary, setSummary] = useState<WhaleSummary | null>(null);
  const [since, setSince] = useState("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { limit: 50 };
        if (since) params.since = since;
        const [txs, sum] = await Promise.all([
          intelligenceFetch<WhaleTx[]>("/api/v1/whale/transactions", { params }),
          intelligenceFetch<WhaleSummary>("/api/v1/analytics/whale/summary", {
            params: { since: since || "30d" },
          }).catch(() => null),
        ]);
        setTransactions(txs);
        setSummary(sum);
      } catch {}
      setLoading(false);
    }
    load();
  }, [since]);

  const criticalCount = transactions.filter((t) => t.significance === "critical" || t.significance === "high").length;
  const totalVolume = summary?.total_volume_usd || transactions.reduce((s, t) => s + (t.amount_usd || 0), 0);
  const tokens = summary?.unique_tokens || new Set(transactions.map((t) => t.token_symbol)).size;

  // Chart data
  const tokenChartData = (summary?.top_tokens || []).slice(0, 8).map((t) => ({
    token: t.token,
    volume_usd: t.volume_usd,
    tx_count: t.tx_count,
  }));

  const sigData = Object.entries(summary?.significance_distribution || {}).map(([name, value]) => ({
    name,
    value,
    fill: SIG_COLORS[name] || "#6b7280",
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Eye className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Whale Tracker</h1>
            <p className="text-xs text-gray-500 font-mono">Monitoring top Avalanche wallets for significant moves</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <DateRangeFilter value={since} onChange={setSince} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Transactions" value={summary?.total_transactions || transactions.length} sublabel="in period" />
        <StatCard label="High Significance" value={criticalCount} sublabel="critical + high" />
        <StatCard label="Volume" value={formatUSD(totalVolume)} sublabel="total tracked" />
        <StatCard label="Tokens" value={tokens} sublabel="unique tokens" />
      </div>

      {/* Charts */}
      {(tokenChartData.length > 0 || sigData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tokenChartData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Top Tokens by Volume</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={tokenChartData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis dataKey="token" tick={{ fill: "#9ca3af", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatUSD(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="volume_usd" radius={[4, 4, 0, 0]} fill="#06b6d4" fillOpacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {sigData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Significance Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={sigData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {sigData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-600 font-mono text-sm">Loading whale data...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
            <Eye className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 font-mono text-sm">No whale transactions yet</p>
          </div>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${sigColor(tx.significance)}`}>
                    {tx.significance}
                  </span>
                  <span className="text-white font-bold font-mono">{tx.token_symbol}</span>
                  <span className="text-xs text-gray-500 font-mono uppercase">{tx.action}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-emerald-400 font-bold">{formatUSD(tx.amount_usd)}</span>
                  <span className="text-xs text-gray-600 font-mono">{timeAgo(tx.detected_at)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 line-clamp-1 flex-1 mr-4">
                  {tx.analysis || "Pending analysis..."}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-gray-600">{truncAddr(tx.wallet_address)}</span>
                  {tx.tx_hash && (
                    <a
                      href={`https://snowscan.xyz/tx/${tx.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-cyan-400 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
