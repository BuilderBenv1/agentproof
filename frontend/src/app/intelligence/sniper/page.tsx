"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crosshair, ArrowLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { intelligenceFetch } from "@/lib/intelligence";
import { timeAgo } from "@/lib/utils";

interface SniperConfig {
  id: number;
  wallet_address: string;
  max_buy_amount_usd: number;
  min_liquidity_usd: number;
  max_buy_tax_pct: number;
  require_renounced: boolean;
  require_lp_burned: boolean;
  take_profit_multiplier: number;
  stop_loss_pct: number;
  is_active: boolean;
  created_at: string;
}

interface SniperTrade {
  id: number;
  config_id: number;
  token_address: string;
  token_symbol: string;
  buy_price: number;
  buy_amount_usd: number;
  buy_tx_hash: string | null;
  sell_price: number | null;
  sell_amount_usd: number | null;
  sell_tx_hash: string | null;
  pnl_usd: number | null;
  pnl_pct: number | null;
  status: string;
  safety_score: number | null;
  bought_at: string;
  sold_at: string | null;
}

interface SniperLaunch {
  id: number;
  token_address: string;
  token_symbol: string;
  pair_address: string;
  initial_liquidity_usd: number;
  deployer_address: string;
  passed_filters: boolean;
  reason_rejected: string | null;
  detected_at: string;
}

interface SniperHealth {
  active_configs: number;
  launches_detected: number;
  open_trades: number;
  win_rate: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-white font-bold">{d.name || d.token_symbol}</p>
      {d.pnl_usd !== undefined && d.pnl_usd !== null && (
        <p className={d.pnl_usd >= 0 ? "text-emerald-400" : "text-red-400"}>
          P&L: ${d.pnl_usd.toFixed(2)} ({d.pnl_pct?.toFixed(1)}%)
        </p>
      )}
      {d.buy_amount_usd !== undefined && <p className="text-gray-400">Buy: ${d.buy_amount_usd.toFixed(2)}</p>}
      {d.initial_liquidity_usd !== undefined && <p className="text-cyan-400">Liq: ${d.initial_liquidity_usd.toFixed(0)}</p>}
    </div>
  );
};

export default function SniperPage() {
  const [configs, setConfigs] = useState<SniperConfig[]>([]);
  const [trades, setTrades] = useState<SniperTrade[]>([]);
  const [launches, setLaunches] = useState<SniperLaunch[]>([]);
  const [health, setHealth] = useState<SniperHealth | null>(null);
  const [since, setSince] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { limit: 50 };
        if (since) params.since = since;
        const [h, c, t, l] = await Promise.all([
          intelligenceFetch<SniperHealth>("/api/v1/sniper/health"),
          intelligenceFetch<SniperConfig[]>("/api/v1/sniper/configs"),
          intelligenceFetch<SniperTrade[]>("/api/v1/sniper/trades", { params }),
          intelligenceFetch<SniperLaunch[]>("/api/v1/sniper/launches", { params: { limit: 50 } }),
        ]);
        setHealth(h);
        setConfigs(c);
        setTrades(t);
        setLaunches(l);
      } catch {}
      setLoading(false);
    }
    load();
  }, [since]);

  const openTrades = trades.filter((t) => t.status === "open").length;
  const closedTrades = trades.filter((t) => t.status !== "open");
  const wins = closedTrades.filter((t) => (t.pnl_usd ?? 0) > 0).length;
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length * 100) : 0;
  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl_usd ?? 0), 0);
  const passedLaunches = launches.filter((l) => l.passed_filters).length;

  // P&L chart — last 20 closed trades
  const pnlChartData = [...closedTrades].slice(0, 20).reverse().map((t) => ({
    name: t.token_symbol,
    token_symbol: t.token_symbol,
    pnl_usd: t.pnl_usd ?? 0,
    pnl_pct: t.pnl_pct ?? 0,
    buy_amount_usd: t.buy_amount_usd,
  }));

  // Launches liquidity chart
  const launchChartData = [...launches].slice(0, 15).reverse().map((l) => ({
    name: l.token_symbol || l.token_address.slice(0, 8),
    initial_liquidity_usd: l.initial_liquidity_usd,
    passed: l.passed_filters,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Crosshair className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Sniper Bot</h1>
            <p className="text-xs text-gray-500 font-mono">New token launch scanner with safety filters</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <DateRangeFilter value={since} onChange={setSince} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Win Rate" value={health?.win_rate ? `${health.win_rate}%` : `${winRate.toFixed(1)}%`} sublabel={`${wins}/${closedTrades.length} trades`} />
        <StatCard label="Total P&L" value={`$${totalPnl.toFixed(2)}`} sublabel={totalPnl >= 0 ? "profitable" : "net loss"} />
        <StatCard label="Open Trades" value={health?.open_trades ?? openTrades} sublabel="positions active" />
        <StatCard label="Launches Found" value={health?.launches_detected ?? launches.length} sublabel={`${passedLaunches} passed filters`} />
      </div>

      {(pnlChartData.length > 0 || launchChartData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pnlChartData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Trade P&L</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={pnlChartData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="pnl_usd" radius={[4, 4, 0, 0]}>
                    {pnlChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.pnl_usd >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {launchChartData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Launch Liquidity</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={launchChartData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="initial_liquidity_usd" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Configs */}
      <div>
        <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Sniper Configs</h3>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-600 font-mono text-sm">Loading sniper data...</div>
          ) : configs.length === 0 ? (
            <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
              <Crosshair className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 font-mono text-sm">No sniper configs yet</p>
            </div>
          ) : (
            configs.map((cfg) => (
              <div key={cfg.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-amber-500/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold font-mono text-sm">{cfg.wallet_address.slice(0, 6)}...{cfg.wallet_address.slice(-4)}</span>
                    <span className="text-xs font-mono text-gray-500">Max ${cfg.max_buy_amount_usd}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono text-amber-400 bg-amber-500/10">
                      TP {cfg.take_profit_multiplier}x
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono text-red-400 bg-red-500/10">
                      SL -{cfg.stop_loss_pct}%
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${cfg.is_active ? "text-emerald-400 bg-emerald-500/10" : "text-gray-500 bg-gray-500/10"}`}>
                    {cfg.is_active ? "ACTIVE" : "PAUSED"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                  <span>Min Liq: ${cfg.min_liquidity_usd}</span>
                  <span>Max Tax: {cfg.max_buy_tax_pct}%</span>
                  {cfg.require_renounced && <span className="text-emerald-400">Renounced</span>}
                  {cfg.require_lp_burned && <span className="text-emerald-400">LP Burned</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Open Trades */}
      {trades.filter((t) => t.status === "open").length > 0 && (
        <div>
          <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Open Positions</h3>
          <div className="space-y-2">
            {trades.filter((t) => t.status === "open").map((t) => (
              <div key={t.id} className="bg-gray-900/30 border border-amber-500/20 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold font-mono">{t.token_symbol}</span>
                  <span className="text-xs font-mono text-gray-500">Buy: ${t.buy_amount_usd.toFixed(2)} @ ${t.buy_price.toFixed(6)}</span>
                  {t.safety_score !== null && (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${t.safety_score >= 70 ? "text-emerald-400 bg-emerald-500/10" : "text-yellow-400 bg-yellow-500/10"}`}>
                      Safety: {t.safety_score}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-600 font-mono">{timeAgo(t.bought_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Closed Trades */}
      {closedTrades.length > 0 && (
        <div>
          <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Closed Trades</h3>
          <div className="space-y-2">
            {closedTrades.slice(0, 15).map((t) => (
              <div key={t.id} className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-bold ${(t.pnl_usd ?? 0) >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                    {(t.pnl_usd ?? 0) >= 0 ? "WIN" : "LOSS"}
                  </span>
                  <span className="text-sm font-mono text-white">{t.token_symbol}</span>
                  <span className={`text-xs font-mono ${(t.pnl_usd ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(t.pnl_usd ?? 0) >= 0 ? "+" : ""}${(t.pnl_usd ?? 0).toFixed(2)} ({(t.pnl_pct ?? 0).toFixed(1)}%)
                  </span>
                </div>
                <span className="text-xs text-gray-600 font-mono">{t.sold_at ? timeAgo(t.sold_at) : timeAgo(t.bought_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Launches */}
      {launches.length > 0 && (
        <div>
          <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Detected Launches</h3>
          <div className="space-y-2">
            {launches.slice(0, 10).map((l) => (
              <div key={l.id} className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-bold ${l.passed_filters ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                    {l.passed_filters ? "PASS" : "REJECTED"}
                  </span>
                  <span className="text-sm font-mono text-white">{l.token_symbol || l.token_address.slice(0, 10)}</span>
                  <span className="text-xs font-mono text-gray-500">Liq: ${l.initial_liquidity_usd.toFixed(0)}</span>
                  {l.reason_rejected && <span className="text-xs font-mono text-red-400">{l.reason_rejected}</span>}
                </div>
                <span className="text-xs text-gray-600 font-mono">{timeAgo(l.detected_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
