"use client";

const RANGES = [
  { label: "24h", value: "1d" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "All", value: "" },
] as const;

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function DateRangeFilter({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono text-gray-500 uppercase mr-1">Period:</span>
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-colors ${
            value === r.value
              ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
              : "border-gray-800 text-gray-500 hover:text-white hover:border-gray-700"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
