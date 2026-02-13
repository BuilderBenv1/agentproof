"use client";

import { CATEGORIES } from "@/lib/constants";

const CHAINS = [
  { value: "", label: "All Chains" },
  { value: "avalanche", label: "Avalanche", color: "#E84142" },
  { value: "ethereum", label: "Ethereum", color: "#627EEA" },
] as const;

interface FilterBarProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedTimeRange: string;
  onTimeRangeChange: (range: string) => void;
  selectedChain?: string;
  onChainChange?: (chain: string) => void;
}

export default function FilterBar({
  selectedCategory,
  onCategoryChange,
  selectedTimeRange,
  onTimeRangeChange,
  selectedChain = "",
  onChainChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Chain Filter */}
      {onChainChange && (
        <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-800 rounded-lg p-1">
          {CHAINS.map((chain) => (
            <button
              key={chain.value}
              onClick={() => onChainChange(chain.value)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-colors flex items-center gap-1.5 ${
                selectedChain === chain.value
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {chain.value && (
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: chain.color }}
                />
              )}
              {chain.label}
            </button>
          ))}
        </div>
      )}

      {/* Category Filter */}
      <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-800 rounded-lg p-1">
        <button
          onClick={() => onCategoryChange("")}
          className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
            !selectedCategory
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => onCategoryChange(cat.slug)}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-colors capitalize ${
              selectedCategory === cat.slug
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {cat.slug}
          </button>
        ))}
      </div>

      {/* Time Range Filter */}
      <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-800 rounded-lg p-1">
        {["all", "30d", "7d"].map((range) => (
          <button
            key={range}
            onClick={() => onTimeRangeChange(range)}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
              selectedTimeRange === range
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {range === "all" ? "All Time" : range}
          </button>
        ))}
      </div>
    </div>
  );
}
