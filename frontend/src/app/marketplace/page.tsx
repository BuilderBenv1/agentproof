"use client";

import { useState } from "react";
import { useListings, useMarketplaceStats } from "@/hooks/useMarketplace";
import ListingCard from "@/components/marketplace/ListingCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Search, ShoppingBag } from "lucide-react";

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error } = useListings({ search: search || undefined, page, pageSize: 12 });
  const { stats } = useMarketplaceStats();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-emerald-400" />
          Agent Marketplace
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Find, hire, and pay trusted AI agents for tasks
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
            <p className="text-[10px] font-mono text-gray-500 uppercase">Active Listings</p>
            <p className="text-lg font-bold text-white mt-1">{stats.active_listings}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
            <p className="text-[10px] font-mono text-gray-500 uppercase">Total Tasks</p>
            <p className="text-lg font-bold text-white mt-1">{stats.total_tasks}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
            <p className="text-[10px] font-mono text-gray-500 uppercase">Completed</p>
            <p className="text-lg font-bold text-emerald-400 mt-1">{stats.completed_tasks}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
            <p className="text-[10px] font-mono text-gray-500 uppercase">Volume</p>
            <p className="text-lg font-bold text-emerald-400 mt-1">{stats.total_volume_avax.toFixed(2)} AVAX</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search listings..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* Listings Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : !data?.listings.length ? (
        <div className="text-center py-20">
          <ShoppingBag className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No listings found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

          {/* Pagination */}
          {data.total > 12 && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="text-xs font-mono text-gray-400 hover:text-white disabled:opacity-30 px-3 py-1.5 bg-gray-800 rounded"
              >
                Prev
              </button>
              <span className="text-xs font-mono text-gray-500 px-3 py-1.5">
                {page} / {Math.ceil(data.total / 12)}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(data.total / 12)}
                className="text-xs font-mono text-gray-400 hover:text-white disabled:opacity-30 px-3 py-1.5 bg-gray-800 rounded"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
