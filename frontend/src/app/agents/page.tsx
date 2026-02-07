"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAgents } from "@/hooks/useAgents";
import AgentGrid from "@/components/agents/AgentGrid";
import SearchBar from "@/components/ui/SearchBar";
import FilterBar from "@/components/leaderboard/FilterBar";
import { Users } from "lucide-react";

export default function AgentsPage() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "";
  const initialSearch = searchParams.get("search") || "";

  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState(initialSearch);
  const [sortBy, setSortBy] = useState("composite_score");
  const [page, setPage] = useState(1);

  const { data, loading, error } = useAgents({
    category: category || undefined,
    search: search || undefined,
    sortBy,
    order: "desc",
    page,
    pageSize: 20,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            Agent Explorer
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {data?.total ?? 0} agents registered
          </p>
        </div>
        <SearchBar
          placeholder="Search agents..."
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          className="w-full md:w-80"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterBar
          selectedCategory={category}
          onCategoryChange={(c) => {
            setCategory(c);
            setPage(1);
          }}
          selectedTimeRange="all"
          onTimeRangeChange={() => {}}
        />

        <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-800 rounded-lg p-1 ml-auto">
          {[
            { value: "composite_score", label: "Score" },
            { value: "registered_at", label: "Newest" },
            { value: "total_feedback", label: "Reviews" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                sortBy === opt.value
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
          Failed to load agents. Make sure the API is running.
        </div>
      )}

      <AgentGrid agents={data?.agents ?? []} loading={loading} />

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg text-sm font-mono border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm font-mono text-gray-500">
            Page {page} of {Math.ceil(data.total / data.page_size)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= Math.ceil(data.total / data.page_size)}
            className="px-4 py-2 rounded-lg text-sm font-mono border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
