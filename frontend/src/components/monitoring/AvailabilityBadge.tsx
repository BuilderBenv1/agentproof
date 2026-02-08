"use client";

interface AvailabilityBadgeProps {
  availability: string;
}

export default function AvailabilityBadge({ availability }: AvailabilityBadgeProps) {
  const config: Record<string, { label: string; color: string; dot: string }> = {
    available: {
      label: "Available",
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      dot: "bg-emerald-400",
    },
    busy: {
      label: "Busy",
      color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
      dot: "bg-yellow-400",
    },
    offline: {
      label: "Offline",
      color: "text-gray-400 bg-gray-500/10 border-gray-500/20",
      dot: "bg-gray-400",
    },
  };

  const cfg = config[availability] || config.offline;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
