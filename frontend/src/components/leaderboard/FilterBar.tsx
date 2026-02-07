"use client";

import { CATEGORIES } from "@/lib/constants";

interface FilterBarProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedTimeRange: string;
  onTimeRangeChange: (range: string) => void;
}

export default function FilterBar({
  selectedCategory,
  onCategoryChange,
  selectedTimeRange,
  onTimeRangeChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
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
