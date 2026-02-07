"use client";

import Link from "next/link";
import ScoreGauge from "@/components/reputation/ScoreGauge";
import CategoryBadge from "@/components/reputation/CategoryBadge";
import { formatNumber, getTierColor } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

interface AgentCardProps {
  agentId: number;
  name: string | null;
  category: string;
  compositeScore: number;
  tier: string;
  feedbackCount: number;
  rank: number | null;
  imageUrl?: string | null;
}

export default function AgentCard({
  agentId,
  name,
  category,
  compositeScore,
  tier,
  feedbackCount,
  rank,
  imageUrl,
}: AgentCardProps) {
  return (
    <Link href={`/agents/${agentId}`}>
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 cursor-pointer group">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-lg font-bold font-mono text-emerald-400 overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} alt={name || "Agent"} className="w-full h-full object-cover" />
              ) : (
                name?.[0]?.toUpperCase() || "#"
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors text-sm">
                {name || `Agent #${agentId}`}
              </h3>
              <CategoryBadge category={category} />
            </div>
          </div>
          {rank && (
            <span className="text-xs font-mono text-gray-600">#{rank}</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <ScoreGauge score={compositeScore} tier={tier} size="sm" />

          <div className="text-right space-y-1">
            <div className="flex items-center justify-end gap-1 text-xs text-gray-500 font-mono">
              <MessageSquare className="w-3 h-3" />
              {formatNumber(feedbackCount)}
            </div>
            <span
              className="inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold uppercase"
              style={{
                color: getTierColor(tier),
                backgroundColor: `${getTierColor(tier)}15`,
              }}
            >
              {tier}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
