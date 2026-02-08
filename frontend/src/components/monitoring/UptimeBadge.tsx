"use client";

interface UptimeBadgeProps {
  uptimePct: number;
  size?: "sm" | "md";
}

export default function UptimeBadge({ uptimePct, size = "sm" }: UptimeBadgeProps) {
  const color =
    uptimePct >= 99 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    uptimePct >= 95 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" :
    "text-red-400 bg-red-500/10 border-red-500/20";

  const dot =
    uptimePct >= 99 ? "bg-emerald-400" :
    uptimePct >= 95 ? "bg-yellow-400" :
    "bg-red-400";

  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span className={`inline-flex items-center gap-1.5 ${textSize} font-mono px-2 py-0.5 rounded-full border ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} animate-pulse`} />
      {uptimePct.toFixed(1)}%
    </span>
  );
}
