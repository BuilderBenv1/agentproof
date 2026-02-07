"use client";

import { truncateAddress, timeAgo } from "@/lib/utils";

interface FeedbackItem {
  id: number;
  reviewer_address: string;
  rating: number;
  created_at: string;
  tx_hash: string;
}

interface ReputationHistoryProps {
  feedback: FeedbackItem[];
  loading?: boolean;
}

export default function ReputationHistory({ feedback, loading }: ReputationHistoryProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-900/50 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-800 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!feedback || feedback.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 font-mono text-sm">
        No feedback received yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {feedback.map((item) => (
        <div
          key={item.id}
          className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3 flex items-center justify-between hover:border-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm"
              style={{
                backgroundColor:
                  item.rating >= 80
                    ? "rgba(0, 229, 160, 0.1)"
                    : item.rating >= 50
                    ? "rgba(232, 65, 66, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                color:
                  item.rating >= 80
                    ? "#00E5A0"
                    : item.rating >= 50
                    ? "#E84142"
                    : "#ef4444",
              }}
            >
              {item.rating}
            </div>
            <div>
              <p className="text-xs font-mono text-gray-400">
                {truncateAddress(item.reviewer_address)}
              </p>
              <p className="text-xs text-gray-600">{timeAgo(item.created_at)}</p>
            </div>
          </div>
          <a
            href={`https://testnet.snowtrace.io/tx/${item.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-gray-600 hover:text-emerald-400 transition-colors"
          >
            {truncateAddress(item.tx_hash, 6, 4)}
          </a>
        </div>
      ))}
    </div>
  );
}
