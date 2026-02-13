"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, ArrowLeft, Zap } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
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

function dirColor(dir: string) {
  if (dir === "bullish") return "text-emerald-400 bg-emerald-500/10";
  if (dir === "bearish") return "text-red-400 bg-red-500/10";
  return "text-yellow-400 bg-yellow-500/10";
}

export default function ConvergencePage() {
  const [signals, setSignals] = useState<ConvergenceSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await intelligenceFetch<ConvergenceSignal[]>("/api/v1/convergence/signals", {
          params: { limit: 30 },
        });
        setSignals(data);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const threeAgent = signals.filter((s) => s.agent_count >= 3).length;
  const avgScore = signals.length > 0
    ? (signals.reduce((s, x) => s + x.convergence_score, 0) / signals.length).toFixed(1)
    : "—";
  const bullish = signals.filter((s) => s.signal_direction === "bullish").length;

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
