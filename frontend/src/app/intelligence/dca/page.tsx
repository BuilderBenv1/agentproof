"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, ArrowLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { intelligenceFetch } from "@/lib/intelligence";
import { timeAgo } from "@/lib/utils";

interface DCAConfig {
  id: number;
  wallet_address: string;
  token_symbol: string;
  token_address: string;
  amount_usd: number;
  frequency: string;
  buy_dips: boolean;
  dip_threshold_pct: number;
  is_active: boolean;
  total_invested_usd: number;
  total_tokens_bought: number;
  avg_cost_basis: number;
  next_execution_at: string | null;
}

interface DCAPurchase {
  id: number;
  config_id: number;
  amount_usd: number;
  tokens_received: number;
  price_at_buy: number;
  tx_hash: string | null;
  was_dip_buy: boolean;
  executed_at: string;
}

interface DCAHealth {
  active_configs: number;
  total_purchases: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-white font-bold">{d.name || d.token_symbol}</p>
      {d.total_invested_usd !== undefined && <p className="text-emerald-400">Invested: ${d.total_invested_usd.toFixed(0)}</p>}
      {d.amount_usd !== undefined && <p className="text-gray-400">${d.amount_usd.toFixed(2)}</p>}
      {d.price_at_buy !== undefined && <p className="text-cyan-400">Price: ${d.price_at_buy.toFixed(4)}</p>}
    </div>
  );
};

export default function DCAPage() {
  const [configs, setConfigs] = useState<DCAConfig[]>([]);
  const [purchases, setPurchases] = useState<DCAPurchase[]>([]);
  const [health, setHealth] = useState<DCAHealth | null>(null);
  const [since, setSince] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { limit: 50 };
        if (since) params.since = since;
        const [h, c, p] = await Promise.all([
          intelligenceFetch<DCAHealth>("/api/v1/dca/health"),
          intelligenceFetch<DCAConfig[]>("/api/v1/dca/configs"),
          intelligenceFetch<DCAPurchase[]>("/api/v1/dca/purchases", { params }),
        ]);
        setHealth(h);
        setConfigs(c);
        setPurchases(p);
      } catch {}
      setLoading(false);
    }
    load();
  }, [since]);

  const totalInvested = configs.reduce((s, c) => s + (c.total_invested_usd || 0), 0);
  const totalPurchases = purchases.length;
  const dipBuys = purchases.filter((p) => p.was_dip_buy).length;
  const activeConfigs = configs.filter((c) => c.is_active).length;

  // Config investment chart
  const configChartData = configs.map((c) => ({
    name: c.token_symbol,
    token_symbol: c.token_symbol,
    total_invested_usd: c.total_invested_usd || 0,
    avg_cost_basis: c.avg_cost_basis || 0,
  }));

  // Purchase timeline (last 20)
  const timelineData = [...purchases].slice(0, 20).reverse().map((p) => ({
    name: new Date(p.executed_at).toLocaleDateString(),
    amount_usd: p.amount_usd,
    price_at_buy: p.price_at_buy,
    was_dip: p.was_dip_buy,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">DCA Bot</h1>
            <p className="text-xs text-gray-500 font-mono">Automated Dollar-Cost Averaging on Avalanche</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <DateRangeFilter value={since} onChange={setSince} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Configs" value={health?.active_configs ?? activeConfigs} sublabel="DCA strategies" />
        <StatCard label="Total Invested" value={`$${totalInvested.toFixed(0)}`} sublabel="across all configs" />
        <StatCard label="Purchases" value={totalPurchases} sublabel={`${dipBuys} dip buys`} />
        <StatCard label="Avg Cost Basis" value={configs[0]?.avg_cost_basis ? `$${configs[0].avg_cost_basis.toFixed(4)}` : "\u2014"} sublabel="first config" />
      </div>

      {configs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {configChartData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Investment by Token</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={configChartData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total_invested_usd" radius={[4, 4, 0, 0]} fill="#3b82f6" fillOpacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {timelineData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Purchase Timeline</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={timelineData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="amount_usd" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Configs */}
      <div>
        <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">DCA Strategies</h3>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-600 font-mono text-sm">Loading DCA data...</div>
          ) : configs.length === 0 ? (
            <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
              <RefreshCw className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 font-mono text-sm">No DCA configs yet</p>
            </div>
          ) : (
            configs.map((cfg) => (
              <div key={cfg.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-blue-500/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold font-mono">{cfg.token_symbol}</span>
                    <span className="text-xs font-mono text-gray-500">${cfg.amount_usd}/</span>
                    <span className="text-xs font-mono text-gray-500 uppercase">{cfg.frequency}</span>
                    {cfg.buy_dips && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-mono text-blue-400 bg-blue-500/10">DIP 2x</span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${cfg.is_active ? "text-emerald-400 bg-emerald-500/10" : "text-gray-500 bg-gray-500/10"}`}>
                    {cfg.is_active ? "ACTIVE" : "PAUSED"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                  <span>Invested: ${cfg.total_invested_usd?.toFixed(0) ?? 0}</span>
                  <span>Tokens: {cfg.total_tokens_bought?.toFixed(4) ?? 0}</span>
                  <span>Avg: ${cfg.avg_cost_basis?.toFixed(4) ?? 0}</span>
                  {cfg.next_execution_at && <span>Next: {timeAgo(cfg.next_execution_at)}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Purchases */}
      {purchases.length > 0 && (
        <div>
          <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Recent Purchases</h3>
          <div className="space-y-2">
            {purchases.slice(0, 15).map((p) => (
              <div key={p.id} className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {p.was_dip_buy && <span className="px-1.5 py-0.5 rounded text-xs font-mono text-blue-400 bg-blue-500/10">DIP</span>}
                  <span className="text-sm font-mono text-white">${p.amount_usd.toFixed(2)}</span>
                  <span className="text-xs font-mono text-gray-500">{p.tokens_received.toFixed(4)} tokens @ ${p.price_at_buy.toFixed(4)}</span>
                </div>
                <span className="text-xs text-gray-600 font-mono">{timeAgo(p.executed_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
