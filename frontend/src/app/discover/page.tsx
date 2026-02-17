"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Filter, TrendingUp, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/supabase";
import { CATEGORIES, TIERS } from "@/lib/constants";

interface Agent {
  agent_id: number;
  name: string | null;
  description: string | null;
  category: string;
  composite_score: number;
  total_feedback: number;
  tier: string;
  image_url: string | null;
  registered_at: string;
}

interface TrendingAgent extends Agent {
  recent_feedback_count: number;
}

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tier, setTier] = useState("");
  const [chain, setChain] = useState("");
  const [minScore, setMinScore] = useState("");
  const [sort, setSort] = useState("score");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [trending, setTrending] = useState<TrendingAgent[]>([]);
  const [newAgents, setNewAgents] = useState<Agent[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{ agents: Agent[]; total: number }>("/discover/search", {
        params: {
          q: query || undefined,
          category: category || undefined,
          tier: tier || undefined,
          chain: chain || undefined,
          min_score: minScore || undefined,
          sort,
          page,
          page_size: 20,
        },
      });
      setAgents(result.agents);
      setTotal(result.total);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [query, category, tier, chain, minScore, sort, page]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Load trending and new on mount
  useEffect(() => {
    async function loadSidebar() {
      try {
        const [trendingResult, newResult] = await Promise.all([
          apiFetch<{ trending: TrendingAgent[] }>("/discover/trending", { params: { period: "7d", limit: 5 } }),
          apiFetch<{ agents: Agent[] }>("/discover/new", { params: { limit: 5 } }),
        ]);
        setTrending(trendingResult.trending);
        setNewAgents(newResult.agents);
      } catch {
        // API not available
      }
    }
    loadSidebar();
  }, []);

  function getTierColor(tierKey: string) {
    const t = TIERS[tierKey as keyof typeof TIERS];
    return t?.color || "#666";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Search className="w-6 h-6 text-emerald-400" />
          Discover Agents
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Search, filter, and find AI agents across the ERC-8004 ecosystem
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          placeholder="Search by name, description, category, or address..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-mono text-gray-500 block mb-1">Chain</label>
            <select
              value={chain}
              onChange={(e) => { setChain(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono"
            >
              <option value="">All Chains</option>
              <option value="avalanche">Avalanche</option>
              <option value="ethereum">Ethereum</option>
              <option value="base">Base</option>
              <option value="linea">Linea</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-mono text-gray-500 block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono"
            >
              <option value="">All</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono text-gray-500 block mb-1">Tier</label>
            <select
              value={tier}
              onChange={(e) => { setTier(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono"
            >
              <option value="">All</option>
              {Object.entries(TIERS).map(([key, t]) => (
                <option key={key} value={key}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono text-gray-500 block mb-1">Min Score</label>
            <input
              type="number"
              value={minScore}
              onChange={(e) => { setMinScore(e.target.value); setPage(1); }}
              placeholder="0"
              min={0}
              max={100}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-gray-500 block mb-1">Sort</label>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono"
            >
              <option value="score">Highest Score</option>
              <option value="newest">Newest</option>
              <option value="most_reviewed">Most Reviewed</option>
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Results */}
        <div className="lg:col-span-3">
          <div className="text-xs font-mono text-gray-500 mb-3">
            {total} agent{total !== 1 ? "s" : ""} found
          </div>

          {loading ? (
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8 text-center text-gray-500 font-mono text-sm">
              Searching...
            </div>
          ) : agents.length === 0 ? (
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8 text-center">
              <Search className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">No agents found</h3>
              <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <Link
                  key={agent.agent_id}
                  href={`/agents/${agent.agent_id}`}
                  className="block bg-gray-900/30 border border-gray-800 rounded-xl p-4 hover:border-emerald-500/30 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-sm font-mono text-gray-400 shrink-0">
                        #{agent.agent_id}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-mono text-white group-hover:text-emerald-400 transition-colors truncate">
                          {agent.name || `Agent #${agent.agent_id}`}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {agent.description || agent.category}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded border"
                        style={{
                          color: getTierColor(agent.tier),
                          borderColor: getTierColor(agent.tier) + "40",
                          backgroundColor: getTierColor(agent.tier) + "10",
                        }}
                      >
                        {agent.tier}
                      </span>
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono text-white">
                          {agent.composite_score}
                        </div>
                        <div className="text-xs text-gray-500">{agent.total_feedback} reviews</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {total > 20 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg text-sm font-mono border border-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm font-mono text-gray-500">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(total / 20)}
                className="px-4 py-2 rounded-lg text-sm font-mono border border-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Trending */}
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-gray-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono text-gray-400">TRENDING (7D)</span>
            </div>
            {trending.length === 0 ? (
              <div className="p-4 text-xs text-gray-500 font-mono">No trending data</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {trending.map((agent) => (
                  <Link
                    key={agent.agent_id}
                    href={`/agents/${agent.agent_id}`}
                    className="block p-3 hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="text-xs font-mono text-white">
                      {agent.name || `Agent #${agent.agent_id}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      +{agent.recent_feedback_count} reviews
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* New Agents */}
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-gray-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono text-gray-400">NEWEST AGENTS</span>
            </div>
            {newAgents.length === 0 ? (
              <div className="p-4 text-xs text-gray-500 font-mono">No agents yet</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {newAgents.map((agent) => (
                  <Link
                    key={agent.agent_id}
                    href={`/agents/${agent.agent_id}`}
                    className="block p-3 hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="text-xs font-mono text-white">
                      {agent.name || `Agent #${agent.agent_id}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(agent.registered_at).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
