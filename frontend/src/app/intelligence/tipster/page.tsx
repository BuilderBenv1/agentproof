"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { intelligenceFetch } from "@/lib/intelligence";
import { timeAgo } from "@/lib/utils";

interface Signal {
  id: number;
  channel_name: string;
  signal_type: string;
  token_symbol: string;
  confidence: number;
  entry_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  current_price: number | null;
  pnl_percent: number | null;
  is_valid: boolean;
  outcome: string | null;
  raw_text: string | null;
  created_at: string;
}

interface TipsterHealth {
  channels_active: number;
  signals_today: number;
}

const TYPE_COLORS: Record<string, string> = {
  buy: "#10b981",
  sell: "#ef4444",
  long: "#06b6d4",
  short: "#f97316",
};

function typeColor(t: string) {
  if (t === "buy" || t === "long") return "text-emerald-400 bg-emerald-500/10";
  if (t === "sell" || t === "short") return "text-red-400 bg-red-500/10";
  return "text-gray-400 bg-gray-500/10";
}

function confColor(c: number) {
  if (c >= 0.8) return "text-emerald-400";
  if (c >= 0.5) return "text-yellow-400";
  return "text-gray-500";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-white font-bold">{d.name || d.token}</p>
      {d.count !== undefined && <p className="text-gray-400">{d.count} signals</p>}
      {d.value !== undefined && <p className="text-gray-400">Count: {d.value}</p>}
      {d.avg_confidence !== undefined && <p className="text-emerald-400">Avg Confidence: {(d.avg_confidence * 100).toFixed(0)}%</p>}
    </div>
  );
};

export default function TipsterPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [health, setHealth] = useState<TipsterHealth | null>(null);
  const [since, setSince] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { limit: 50 };
        if (since) params.since = since;
        const [h, sigs] = await Promise.all([
          intelligenceFetch<TipsterHealth>("/api/v1/tipster/health"),
          intelligenceFetch<Signal[]>("/api/v1/tipster/signals", { params }),
        ]);
        setHealth(h);
        setSignals(sigs);
      } catch {}
      setLoading(false);
    }
    load();
  }, [since]);

  const buyCount = signals.filter((s) => s.signal_type === "buy" || s.signal_type === "long").length;
  const sellCount = signals.filter((s) => s.signal_type === "sell" || s.signal_type === "short").length;
  const avgConf = signals.length > 0
    ? (signals.reduce((s, x) => s + (x.confidence || 0), 0) / signals.length * 100).toFixed(0)
    : "\u2014";
  const tokens = new Set(signals.map((s) => s.token_symbol)).size;

  // Signal type pie chart
  const typeDist: Record<string, number> = {};
  signals.forEach((s) => { typeDist[s.signal_type] = (typeDist[s.signal_type] || 0) + 1; });
  const pieData = Object.entries(typeDist).map(([name, value]) => ({
    name,
    value,
    fill: TYPE_COLORS[name] || "#6b7280",
  }));

  // Top tokens bar chart
  const tokenCount: Record<string, { count: number; totalConf: number }> = {};
  signals.forEach((s) => {
    if (!tokenCount[s.token_symbol]) tokenCount[s.token_symbol] = { count: 0, totalConf: 0 };
    tokenCount[s.token_symbol].count++;
    tokenCount[s.token_symbol].totalConf += s.confidence || 0;
  });
  const tokenBarData = Object.entries(tokenCount)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([token, d]) => ({
      token,
      count: d.count,
      avg_confidence: d.totalConf / d.count,
      name: token,
    }));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tipster</h1>
            <p className="text-xs text-gray-500 font-mono">Telegram alpha channel signal parser & tracker</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <DateRangeFilter value={since} onChange={setSince} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Signals" value={signals.length} sublabel={health ? `${health.signals_today} today` : "total"} />
        <StatCard label="Buy/Long" value={buyCount} sublabel="bullish signals" />
        <StatCard label="Sell/Short" value={sellCount} sublabel="bearish signals" />
        <StatCard label="Avg Confidence" value={`${avgConf}%`} sublabel={`${tokens} tokens`} />
      </div>

      {/* Charts */}
      {signals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pieData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Signal Type Distribution</h3>
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
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Top Tokens by Signal Count</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={tokenBarData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis dataKey="token" tick={{ fill: "#9ca3af", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#10b981" fillOpacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Signals List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-600 font-mono text-sm">Loading signals...</div>
        ) : signals.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
            <Zap className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 font-mono text-sm">No signals yet</p>
          </div>
        ) : (
          signals.map((sig) => (
            <div
              key={sig.id}
              className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${typeColor(sig.signal_type)}`}>
                    {sig.signal_type}
                  </span>
                  <span className="text-white font-bold font-mono">{sig.token_symbol}</span>
                  <span className={`text-xs font-mono font-bold ${confColor(sig.confidence)}`}>
                    {(sig.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {sig.pnl_percent != null && (
                    <span className={`font-mono text-sm font-bold ${sig.pnl_percent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {sig.pnl_percent >= 0 ? "+" : ""}{sig.pnl_percent.toFixed(1)}%
                    </span>
                  )}
                  <span className="text-xs text-gray-600 font-mono">{timeAgo(sig.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                  {sig.entry_price != null && <span>Entry: ${sig.entry_price.toFixed(4)}</span>}
                  {sig.target_price != null && <span>Target: ${sig.target_price.toFixed(4)}</span>}
                  {sig.stop_loss != null && <span>SL: ${sig.stop_loss.toFixed(4)}</span>}
                  {sig.current_price != null && <span>Current: ${sig.current_price.toFixed(4)}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-600">{sig.channel_name}</span>
                  {sig.outcome && (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                      sig.outcome === "win" ? "text-emerald-400 bg-emerald-500/10" :
                      sig.outcome === "loss" ? "text-red-400 bg-red-500/10" :
                      "text-gray-400 bg-gray-500/10"
                    }`}>
                      {sig.outcome}
                    </span>
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
