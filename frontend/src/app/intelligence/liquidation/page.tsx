"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { intelligenceFetch } from "@/lib/intelligence";
import { timeAgo } from "@/lib/utils";

interface Position {
  id: number;
  wallet_address: string;
  protocol: string;
  health_factor: number;
  collateral_usd: number;
  debt_usd: number;
  risk_level: string;
  distance_to_liquidation: number;
  prediction_analysis: string | null;
  last_checked: string;
}

const RISK_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#10b981",
};

function riskBadge(level: string) {
  const map: Record<string, string> = {
    critical: "text-red-400 bg-red-500/10",
    high: "text-orange-400 bg-orange-500/10",
    medium: "text-yellow-400 bg-yellow-500/10",
    low: "text-emerald-400 bg-emerald-500/10",
  };
  return map[level] || "text-gray-400 bg-gray-500/10";
}

function truncAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "\u2014";
}

function formatUSD(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-white font-bold">{d.name || d.protocol}</p>
      {d.debt !== undefined && <p className="text-red-400">Debt: {formatUSD(d.debt)}</p>}
      {d.collateral !== undefined && <p className="text-emerald-400">Collateral: {formatUSD(d.collateral)}</p>}
      {d.value !== undefined && <p className="text-gray-400">Count: {d.value}</p>}
      {d.health_factor !== undefined && <p className="text-gray-400">HF: {d.health_factor.toFixed(3)}</p>}
    </div>
  );
};

export default function LiquidationPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [since, setSince] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { limit: 50 };
        if (since) params.since = since;
        const data = await intelligenceFetch<Position[]>("/api/v1/liquidation/positions", { params });
        setPositions(data);
      } catch {}
      setLoading(false);
    }
    load();
  }, [since]);

  const critical = positions.filter((p) => p.risk_level === "critical").length;
  const high = positions.filter((p) => p.risk_level === "high").length;
  const totalDebt = positions.reduce((s, p) => s + (p.debt_usd || 0), 0);

  // Risk distribution pie
  const riskDist: Record<string, number> = {};
  positions.forEach((p) => { riskDist[p.risk_level] = (riskDist[p.risk_level] || 0) + 1; });
  const pieData = Object.entries(riskDist).map(([name, value]) => ({
    name,
    value,
    fill: RISK_COLORS[name] || "#6b7280",
  }));

  // Protocol debt bar chart
  const protocolDebt: Record<string, { debt: number; collateral: number; count: number }> = {};
  positions.forEach((p) => {
    if (!protocolDebt[p.protocol]) protocolDebt[p.protocol] = { debt: 0, collateral: 0, count: 0 };
    protocolDebt[p.protocol].debt += p.debt_usd || 0;
    protocolDebt[p.protocol].collateral += p.collateral_usd || 0;
    protocolDebt[p.protocol].count++;
  });
  const debtBarData = Object.entries(protocolDebt).map(([protocol, d]) => ({
    protocol,
    debt: d.debt,
    collateral: d.collateral,
    name: protocol,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Liquidation Sentinel</h1>
            <p className="text-xs text-gray-500 font-mono">Benqi & Aave positions approaching liquidation</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <DateRangeFilter value={since} onChange={setSince} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Positions" value={positions.length} sublabel="monitored" />
        <StatCard label="Critical" value={critical} sublabel="immediate risk" />
        <StatCard label="High Risk" value={high} sublabel="approaching threshold" />
        <StatCard label="Total Debt" value={formatUSD(totalDebt)} sublabel="at-risk value" />
      </div>

      {/* Charts */}
      {positions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pieData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Risk Level Distribution</h3>
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

          {debtBarData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Debt by Protocol</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={debtBarData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis dataKey="protocol" tick={{ fill: "#9ca3af", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatUSD(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="debt" fill="#ef4444" fillOpacity={0.7} radius={[4, 4, 0, 0]} name="Debt" />
                  <Bar dataKey="collateral" fill="#10b981" fillOpacity={0.5} radius={[4, 4, 0, 0]} name="Collateral" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase">Wallet</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase">Protocol</th>
                <th className="text-right px-4 py-3 text-xs font-mono text-gray-500 uppercase">Health Factor</th>
                <th className="text-right px-4 py-3 text-xs font-mono text-gray-500 uppercase">Collateral</th>
                <th className="text-right px-4 py-3 text-xs font-mono text-gray-500 uppercase">Debt</th>
                <th className="text-center px-4 py-3 text-xs font-mono text-gray-500 uppercase">Risk</th>
                <th className="text-right px-4 py-3 text-xs font-mono text-gray-500 uppercase">Dist. to Liq.</th>
                <th className="text-right px-4 py-3 text-xs font-mono text-gray-500 uppercase">Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-600 font-mono text-sm">
                    Loading positions...
                  </td>
                </tr>
              ) : positions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-600 font-mono text-sm">
                    No at-risk positions detected
                  </td>
                </tr>
              ) : (
                positions.map((pos) => (
                  <tr key={pos.id} className="border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{truncAddr(pos.wallet_address)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-300 uppercase">{pos.protocol}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono font-bold ${pos.health_factor < 1.1 ? "text-red-400" : pos.health_factor < 1.25 ? "text-yellow-400" : "text-emerald-400"}`}>
                        {pos.health_factor.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-400">{formatUSD(pos.collateral_usd)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-400">{formatUSD(pos.debt_usd)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${riskBadge(pos.risk_level)}`}>
                        {pos.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">
                      {(pos.distance_to_liquidation * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-600 font-mono">
                      {timeAgo(pos.last_checked)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
