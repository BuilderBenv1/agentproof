"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, ArrowLeft, ExternalLink } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
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
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";
}

export default function AuditorPage() {
  const [scans, setScans] = useState<ContractScan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await intelligenceFetch<ContractScan[]>("/api/v1/auditor/scans", {
          params: { limit: 30 },
        });
        setScans(data);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const dangerous = scans.filter((s) => s.risk_label === "danger" || s.risk_label === "rug").length;
  const safe = scans.filter((s) => s.risk_label === "safe").length;
  const avgRisk = scans.length > 0
    ? (scans.reduce((s, x) => s + x.overall_risk_score, 0) / scans.length).toFixed(0)
    : "—";

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Contracts Scanned" value={scans.length} sublabel="total" />
        <StatCard label="Flagged Dangerous" value={dangerous} sublabel="danger + rug" />
        <StatCard label="Verified Safe" value={safe} sublabel="clean contracts" />
        <StatCard label="Avg Risk Score" value={avgRisk} sublabel="out of 100" />
      </div>

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
