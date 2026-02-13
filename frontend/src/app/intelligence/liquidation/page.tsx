"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
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
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";
}

function formatUSD(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function LiquidationPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await intelligenceFetch<Position[]>("/api/v1/liquidation/positions", {
          params: { limit: 50 },
        });
        setPositions(data);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const critical = positions.filter((p) => p.risk_level === "critical").length;
  const high = positions.filter((p) => p.risk_level === "high").length;
  const totalDebt = positions.reduce((s, p) => s + (p.debt_usd || 0), 0);

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Positions" value={positions.length} sublabel="monitored" />
        <StatCard label="Critical" value={critical} sublabel="immediate risk" />
        <StatCard label="High Risk" value={high} sublabel="approaching threshold" />
        <StatCard label="Total Debt" value={formatUSD(totalDebt)} sublabel="at-risk value" />
      </div>

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
