"use client";

import { Split } from "@/hooks/useSplits";

interface SplitCardProps {
  split: Split;
}

export default function SplitCard({ split }: SplitCardProps) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-gray-500">Split #{split.split_id}</span>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
            split.is_active
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : "text-gray-500 bg-gray-800 border-gray-700"
          }`}
        >
          {split.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="space-y-2">
        {split.agent_ids.map((agentId, i) => {
          const share = split.shares_bps[i] || 0;
          const pct = (share / 100).toFixed(1);

          return (
            <div key={agentId} className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-400 w-20">
                Agent #{agentId}
              </span>
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full"
                  style={{ width: `${share / 100}%` }}
                />
              </div>
              <span className="text-xs font-mono text-emerald-400 w-12 text-right">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] font-mono text-gray-600 mt-3">
        Created {new Date(split.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
