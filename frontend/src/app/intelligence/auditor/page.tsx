"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, ArrowLeft, ExternalLink } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { intelligenceFetch } from "@/lib/intelligence";
import { timeAgo } from "@/lib/utils";

interface ContractScan {
  id: number;
  contract_address: string;
  token_symbol: string;
  risk_label: string;
  overall_risk_score: number;
  honeypot_score: number;
  ownership_concentration_score: number;
  liquidity_lock_score: number;
  red_flags: string[];
  analysis_summary: string | null;
  scanned_at: string;
}

const RISK_COLORS: Record<string, string> = {
  safe: "#10b981",
  caution: "#eab308",
  danger: "#f97316",
  rug: "#ef4444",
};

function riskColor(label: string) {
  const map: Record<string, string> = {
    safe: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    caution: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    danger: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    rug: "text-red-400 bg-red-500/10 border-red-500/20",
  };
  return map[label] || "text-gray-400 bg-gray-500/10 border-gray-500/20";
}

function scoreBar(score: number, label: string) {
  const color = score <= 30 ? "bg-emerald-500" : score <= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-gray-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-400 w-8 text-right">{score}</span>
    </div>
  );
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
      <p className="text-white font-bold">{d.name || d.token_symbol}</p>
      {d.overall_risk_score !== undefined && <p className="text-gray-400">Risk: {d.overall_risk_score}/100</p>}
      {d.value !== undefined && <p className="text-gray-400">Count: {d.value}</p>}
    </div>
  );
};

export default function AuditorPage() {
  const [scans, setScans] = useState<ContractScan[]>([]);
  const [since, setSince] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { limit: 30 };
        if (since) params.since = since;
        const data = await intelligenceFetch<ContractScan[]>("/api/v1/auditor/scans", { params });
        setScans(data);
      } catch {}
      setLoading(false);
    }
    load();
  }, [since]);

  const dangerous = scans.filter((s) => s.risk_label === "danger" || s.risk_label === "rug").length;
  const safe = scans.filter((s) => s.risk_label === "safe").length;
  const avgRisk = scans.length > 0
    ? (scans.reduce((s, x) => s + x.overall_risk_score, 0) / scans.length).toFixed(0)
    : "\u2014";

  // Risk distribution pie chart
  const riskDist: Record<string, number> = {};
  scans.forEach((s) => { riskDist[s.risk_label] = (riskDist[s.risk_label] || 0) + 1; });
  const pieData = Object.entries(riskDist).map(([name, value]) => ({
    name,
    value,
    fill: RISK_COLORS[name] || "#6b7280",
  }));

  // Top 10 riskiest contracts
  const riskBarData = [...scans]
    .sort((a, b) => b.overall_risk_score - a.overall_risk_score)
    .slice(0, 8)
    .map((s) => ({
      token_symbol: s.token_symbol || truncAddr(s.contract_address),
      overall_risk_score: s.overall_risk_score,
      honeypot_score: s.honeypot_score,
      ownership_concentration_score: s.ownership_concentration_score,
    }));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Rug Auditor</h1>
            <p className="text-xs text-gray-500 font-mono">Smart contract security scanning on Avalanche</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <DateRangeFilter value={since} onChange={setSince} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Contracts Scanned" value={scans.length} sublabel="total" />
        <StatCard label="Flagged Dangerous" value={dangerous} sublabel="danger + rug" />
        <StatCard label="Verified Safe" value={safe} sublabel="clean contracts" />
        <StatCard label="Avg Risk Score" value={avgRisk} sublabel="out of 100" />
      </div>

      {/* Charts */}
      {scans.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pieData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Risk Distribution</h3>
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

          {riskBarData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Riskiest Contracts</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={riskBarData} layout="vertical" margin={{ left: 60, right: 20, top: 5, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 11, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="token_symbol" tick={{ fill: "#9ca3af", fontSize: 10, fontFamily: "monospace" }} width={55} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="overall_risk_score" radius={[0, 4, 4, 0]}>
                    {riskBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.overall_risk_score > 60 ? "#ef4444" : entry.overall_risk_score > 30 ? "#eab308" : "#10b981"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-600 font-mono text-sm">Loading scan data...</div>
        ) : scans.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
            <Shield className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 font-mono text-sm">No contract scans yet</p>
          </div>
        ) : (
          scans.map((scan) => (
            <div
              key={scan.id}
              className={`bg-gray-900/50 border rounded-xl p-5 ${riskColor(scan.risk_label)} transition-colors`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold font-mono text-white">{scan.token_symbol}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${riskColor(scan.risk_label)}`}>
                    {scan.risk_label}
                  </span>
                  <span className="text-xs font-mono text-gray-600">{truncAddr(scan.contract_address)}</span>
                  <a
                    href={`https://snowscan.xyz/address/${scan.contract_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold font-mono text-white">{scan.overall_risk_score}</span>
                  <span className="text-xs text-gray-500 font-mono">/100 risk</span>
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                {scoreBar(scan.honeypot_score, "Honeypot")}
                {scoreBar(scan.ownership_concentration_score, "Ownership")}
                {scoreBar(scan.liquidity_lock_score, "Liquidity")}
              </div>

              {scan.red_flags && scan.red_flags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {scan.red_flags.map((flag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-red-500/10 text-xs font-mono text-red-400">
                      {flag}
                    </span>
                  ))}
                </div>
              )}

              {scan.analysis_summary && (
                <p className="text-xs text-gray-500 leading-relaxed">{scan.analysis_summary}</p>
              )}

              <div className="text-right mt-2">
                <span className="text-xs text-gray-600 font-mono">{timeAgo(scan.scanned_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
