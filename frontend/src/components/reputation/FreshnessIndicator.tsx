"use client";

import { Clock } from "lucide-react";

interface FreshnessIndicatorProps {
  multiplier: number;
}

export default function FreshnessIndicator({ multiplier }: FreshnessIndicatorProps) {
  if (multiplier >= 1.0) return null;

  const penalty = Math.round((1 - multiplier) * 100);

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
      style={{
        color: "#f59e0b",
        backgroundColor: "#f59e0b15",
        border: "1px solid #f59e0b30",
      }}
    >
      <Clock className="w-3 h-3" />
      -{penalty}% newness penalty
    </span>
  );
}
