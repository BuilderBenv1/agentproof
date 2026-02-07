"use client";

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: "up" | "down" | "stable";
}

export default function StatCard({ label, value, sublabel, trend }: StatCardProps) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 hover:border-emerald-500/30 transition-colors">
      <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-1">
        {label}
      </p>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold font-mono text-white">{value}</p>
        {trend && trend !== "stable" && (
          <span
            className={`text-xs font-mono ${
              trend === "up" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {trend === "up" ? "+" : "-"}
          </span>
        )}
      </div>
      {sublabel && (
        <p className="text-xs text-gray-600 mt-1 font-mono">{sublabel}</p>
      )}
    </div>
  );
}
