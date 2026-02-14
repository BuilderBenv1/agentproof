"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import { intelligenceFetch } from "@/lib/intelligence";

interface AgentAccuracy {
  agent: string;
  total_predictions?: number;
  flagged?: number;
  confirmed_outcomes?: number;
  correct_predictions?: number;
  accuracy?: number;
  total_opportunities?: number;
  avg_sharpe_ratio?: number;
  strong_buy_count?: number;
}

interface AccuracyData {
  agents: AgentAccuracy[];
}

const AGENT_COLORS: Record<string, string> = {
  "Rug Auditor": "#ef4444",
  "Liquidation Sentinel": "#eab308",
  "Yield Oracle": "#10b981",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-white font-bold">{d.agent}</p>
      {d.accuracy !== undefined && <p className="text-emerald-400">Accuracy: {d.accuracy}%</p>}
      {d.total_predictions !== undefined && <p className="text-gray-400">Predictions: {d.total_predictions}</p>}
      {d.correct_predictions !== undefined && <p className="text-gray-400">Correct: {d.correct_predictions}</p>}
    </div>
  );
};

export default function AnalyticsPage() {
  const [accuracy, setAccuracy] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await intelligenceFetch<AccuracyData>("/api/v1/analytics/accuracy");
        setAccuracy(data);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const agents = accuracy?.agents || [];

  // Accuracy bar chart data
  const accuracyBarData = agents
    .filter((a) => a.accuracy !== undefined)
    .map((a) => ({
      agent: a.agent,
      accuracy: a.accuracy || 0,
      total_predictions: a.total_predictions || 0,
      correct_predictions: a.correct_predictions || 0,
    }));

  const yieldAgent = agents.find((a) => a.agent === "Yield Oracle");

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Target className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Agent Accuracy</h1>
            <p className="text-xs text-gray-500 font-mono">Prediction accuracy across all intelligence agents</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-600 font-mono text-sm">Loading accuracy data...</div>
      ) : (
        <>
          {/* Agent Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.agent}
                className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: AGENT_COLORS[agent.agent] || "#6b7280" }}
                  />
                  <h3 className="text-sm font-bold text-white">{agent.agent}</h3>
                </div>

                {agent.accuracy !== undefined && (
                  <div className="mb-4">
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-3xl font-bold font-mono text-white">{agent.accuracy}%</span>
                      <span className="text-xs text-gray-500 font-mono mb-1">accuracy</span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${agent.accuracy}%`,
                          backgroundColor: agent.accuracy >= 70 ? "#10b981" : agent.accuracy >= 50 ? "#eab308" : "#ef4444",
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {agent.total_predictions !== undefined && (
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-gray-500">Total Predictions</span>
                      <span className="text-gray-300">{agent.total_predictions}</span>
                    </div>
                  )}
                  {agent.correct_predictions !== undefined && (
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-gray-500">Correct</span>
                      <span className="text-emerald-400">{agent.correct_predictions}</span>
                    </div>
                  )}
                  {agent.flagged !== undefined && (
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-gray-500">Flagged</span>
                      <span className="text-orange-400">{agent.flagged}</span>
                    </div>
                  )}
                  {agent.confirmed_outcomes !== undefined && (
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-gray-500">Confirmed Rugs</span>
                      <span className="text-red-400">{agent.confirmed_outcomes}</span>
                    </div>
                  )}
                  {agent.total_opportunities !== undefined && (
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-gray-500">Active Opportunities</span>
                      <span className="text-emerald-400">{agent.total_opportunities}</span>
                    </div>
                  )}
                  {agent.avg_sharpe_ratio !== undefined && (
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-gray-500">Avg Sharpe Ratio</span>
                      <span className="text-cyan-400">{agent.avg_sharpe_ratio}</span>
                    </div>
                  )}
                  {agent.strong_buy_count !== undefined && (
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-gray-500">Strong Buy Signals</span>
                      <span className="text-emerald-400">{agent.strong_buy_count}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Accuracy Bar Chart */}
          {accuracyBarData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Prediction Accuracy Comparison</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={accuracyBarData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis dataKey="agent" tick={{ fill: "#9ca3af", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                    {accuracyBarData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={AGENT_COLORS[entry.agent] || "#6b7280"}
                        fillOpacity={0.7}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Agents Tracked"
              value={agents.length}
              sublabel="with accuracy data"
            />
            <StatCard
              label="Total Predictions"
              value={agents.reduce((s, a) => s + (a.total_predictions || 0), 0)}
              sublabel="across all agents"
            />
            <StatCard
              label="Yield Opportunities"
              value={yieldAgent?.total_opportunities ?? "\u2014"}
              sublabel="active pools"
            />
            <StatCard
              label="Strong Buys"
              value={yieldAgent?.strong_buy_count ?? "\u2014"}
              sublabel="yield oracle"
            />
          </div>
        </>
      )}

      <p className="text-xs text-gray-600 text-center font-mono">
        Accuracy is tracked on-chain via ERC-8004 proofs. All predictions are verifiable.
      </p>
    </div>
  );
}
