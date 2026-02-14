"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Grid3X3, ArrowLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { intelligenceFetch } from "@/lib/intelligence";
import { timeAgo } from "@/lib/utils";

interface GridConfig {
  id: number;
  wallet_address: string;
  token_symbol: string;
  token_address: string;
  lower_price: number;
  upper_price: number;
  grid_levels: number;
  amount_per_grid: number;
  is_active: boolean;
  total_profit_usd: number;
  completed_cycles: number;
  created_at: string;
}

interface GridOrder {
  id: number;
  config_id: number;
  level_index: number;
  order_type: string;
  price: number;
  amount: number;
  status: string;
  fill_tx_hash: string | null;
  filled_at: string | null;
  created_at: string;
}

interface GridHealth {
  active_grids: number;
  total_cycles: number;
}

interface GridStats {
  active_grids: number;
  total_cycles: number;
  total_profit_usd: number;
  orders_pending: number;
  orders_filled: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-white font-bold">{d.name || d.token_symbol}</p>
      {d.total_profit_usd !== undefined && <p className="text-emerald-400">Profit: ${d.total_profit_usd.toFixed(2)}</p>}
      {d.completed_cycles !== undefined && <p className="text-cyan-400">Cycles: {d.completed_cycles}</p>}
      {d.value !== undefined && <p className="text-gray-400">{d.value}</p>}
    </div>
  );
};

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

export default function GridPage() {
  const [configs, setConfigs] = useState<GridConfig[]>([]);
  const [orders, setOrders] = useState<GridOrder[]>([]);
  const [health, setHealth] = useState<GridHealth | null>(null);
  const [stats, setStats] = useState<GridStats | null>(null);
  const [since, setSince] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [h, c, o, s] = await Promise.all([
          intelligenceFetch<GridHealth>("/api/v1/grid/health"),
          intelligenceFetch<GridConfig[]>("/api/v1/grid/configs"),
          intelligenceFetch<GridOrder[]>("/api/v1/grid/orders", { params: { limit: 50 } }),
          intelligenceFetch<GridStats>("/api/v1/grid/stats"),
        ]);
        setHealth(h);
        setConfigs(c);
        setOrders(o);
        setStats(s);
      } catch {}
      setLoading(false);
    }
    load();
  }, [since]);

  const totalProfit = configs.reduce((s, c) => s + (c.total_profit_usd || 0), 0);
  const totalCycles = configs.reduce((s, c) => s + (c.completed_cycles || 0), 0);
  const activeGrids = configs.filter((c) => c.is_active).length;
  const filledOrders = orders.filter((o) => o.status === "filled").length;

  const profitChartData = configs.map((c) => ({
    name: c.token_symbol,
    token_symbol: c.token_symbol,
    total_profit_usd: c.total_profit_usd || 0,
    completed_cycles: c.completed_cycles || 0,
  }));

  const orderStatusData = [
    { name: "Pending", value: stats?.orders_pending || orders.filter((o) => o.status === "pending").length },
    { name: "Filled", value: stats?.orders_filled || filledOrders },
    { name: "Cancelled", value: orders.filter((o) => o.status === "cancelled").length },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Grid3X3 className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Grid Trading</h1>
            <p className="text-xs text-gray-500 font-mono">Automated grid orders on Avalanche DEX</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <DateRangeFilter value={since} onChange={setSince} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Grids" value={health?.active_grids ?? activeGrids} sublabel="grid strategies" />
        <StatCard label="Total Profit" value={`$${totalProfit.toFixed(2)}`} sublabel="across all grids" />
        <StatCard label="Cycles Done" value={health?.total_cycles ?? totalCycles} sublabel="buy→sell cycles" />
        <StatCard label="Orders Filled" value={stats?.orders_filled ?? filledOrders} sublabel={`${stats?.orders_pending ?? 0} pending`} />
      </div>

      {configs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {profitChartData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Profit by Token</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={profitChartData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total_profit_usd" radius={[4, 4, 0, 0]} fill="#8b5cf6" fillOpacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {orderStatusData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Order Status</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={orderStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {orderStatusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.8} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Grid Configs */}
      <div>
        <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Grid Strategies</h3>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-600 font-mono text-sm">Loading grid data...</div>
          ) : configs.length === 0 ? (
            <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
              <Grid3X3 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 font-mono text-sm">No grid configs yet</p>
            </div>
          ) : (
            configs.map((cfg) => (
              <div key={cfg.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-violet-500/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold font-mono">{cfg.token_symbol}</span>
                    <span className="text-xs font-mono text-gray-500">${cfg.lower_price.toFixed(2)} — ${cfg.upper_price.toFixed(2)}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono text-violet-400 bg-violet-500/10">{cfg.grid_levels} levels</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${cfg.is_active ? "text-emerald-400 bg-emerald-500/10" : "text-gray-500 bg-gray-500/10"}`}>
                    {cfg.is_active ? "ACTIVE" : "PAUSED"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                  <span>Profit: ${cfg.total_profit_usd?.toFixed(2) ?? "0.00"}</span>
                  <span>Cycles: {cfg.completed_cycles ?? 0}</span>
                  <span>${cfg.amount_per_grid}/level</span>
                  <span>Since: {timeAgo(cfg.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Orders */}
      {orders.length > 0 && (
        <div>
          <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Recent Orders</h3>
          <div className="space-y-2">
            {orders.slice(0, 15).map((o) => (
              <div key={o.id} className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-bold ${o.order_type === "buy" ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                    {o.order_type.toUpperCase()}
                  </span>
                  <span className="text-sm font-mono text-white">${o.price.toFixed(4)}</span>
                  <span className="text-xs font-mono text-gray-500">Lvl {o.level_index}</span>
                  <span className={`text-xs font-mono ${o.status === "filled" ? "text-emerald-400" : o.status === "pending" ? "text-yellow-400" : "text-gray-500"}`}>
                    {o.status.toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-gray-600 font-mono">{o.filled_at ? timeAgo(o.filled_at) : timeAgo(o.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
