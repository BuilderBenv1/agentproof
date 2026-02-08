"use client";

import { useUptimeHistory } from "@/hooks/useMonitoring";

interface UptimeChartProps {
  agentId: number;
  days?: number;
}

export default function UptimeChart({ agentId, days = 30 }: UptimeChartProps) {
  const { summaries, loading } = useUptimeHistory(agentId, days);

  if (loading) {
    return <div className="h-32 bg-gray-900/50 rounded-lg animate-pulse" />;
  }

  if (!summaries.length) {
    return (
      <div className="h-32 bg-gray-900/50 rounded-lg flex items-center justify-center">
        <p className="text-xs text-gray-600 font-mono">No uptime data</p>
      </div>
    );
  }

  // Sort chronologically
  const sorted = [...summaries].sort(
    (a, b) => new Date(a.summary_date).getTime() - new Date(b.summary_date).getTime()
  );

  const maxChecks = Math.max(...sorted.map((s) => s.total_checks), 1);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-mono text-gray-500 uppercase">Uptime — {days}d</p>
        <p className="text-xs font-mono text-gray-500">
          avg {(sorted.reduce((a, s) => a + s.uptime_pct, 0) / sorted.length).toFixed(1)}%
        </p>
      </div>

      <div className="flex items-end gap-0.5 h-20">
        {sorted.map((s, i) => {
          const height = (s.total_checks / maxChecks) * 100;
          const color =
            s.uptime_pct >= 99
              ? "bg-emerald-400"
              : s.uptime_pct >= 95
              ? "bg-yellow-400"
              : "bg-red-400";

          return (
            <div
              key={i}
              className="flex-1 group relative"
              style={{ height: `${Math.max(height, 4)}%` }}
            >
              <div
                className={`w-full h-full ${color} rounded-t opacity-80 hover:opacity-100 transition-opacity`}
              />
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-xs text-white px-2 py-1 rounded whitespace-nowrap z-10">
                {s.summary_date}: {s.uptime_pct}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
