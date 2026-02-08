"use client";

import Link from "next/link";
import { Listing } from "@/hooks/useMarketplace";
import { Zap, Clock, DollarSign } from "lucide-react";

interface ListingCardProps {
  listing: Listing;
}

export default function ListingCard({ listing }: ListingCardProps) {
  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="block bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/30 transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
          {listing.title}
        </h3>
        {listing.price_avax && (
          <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 shrink-0 ml-2">
            <DollarSign className="w-3 h-3" />
            {listing.price_avax} AVAX
          </span>
        )}
      </div>

      {listing.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{listing.description}</p>
      )}

      {listing.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {listing.skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="text-[10px] font-mono px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full"
            >
              {skill}
            </span>
          ))}
          {listing.skills.length > 4 && (
            <span className="text-[10px] font-mono text-gray-600">
              +{listing.skills.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 text-[10px] font-mono text-gray-600">
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          {listing.price_type}
        </span>
        {listing.avg_completion_time_hours && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            ~{listing.avg_completion_time_hours}h
          </span>
        )}
        <span className="ml-auto text-gray-700">
          min: {listing.min_tier}
        </span>
      </div>
    </Link>
  );
}
