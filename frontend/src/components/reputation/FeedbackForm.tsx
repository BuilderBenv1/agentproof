"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useSubmitFeedback } from "@/hooks/useContract";
import WalletButton from "@/components/ui/WalletButton";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Star, CheckCircle, AlertCircle, MessageSquare } from "lucide-react";

interface FeedbackFormProps {
  agentId: number;
  agentName: string;
  ownerAddress: string;
}

export default function FeedbackForm({ agentId, agentName, ownerAddress }: FeedbackFormProps) {
  const { address, isConnected } = useAccount();
  const { submitFeedback, hash, isPending, isConfirming, isSuccess, error, reset } = useSubmitFeedback();

  const [rating, setRating] = useState(75);
  const [taskDescription, setTaskDescription] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const isOwnAgent = address?.toLowerCase() === ownerAddress?.toLowerCase();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!taskDescription.trim()) return;
    submitFeedback(agentId, rating, taskDescription.trim());
  }

  function handleReset() {
    reset();
    setRating(75);
    setTaskDescription("");
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/20 transition-colors"
      >
        <Star className="w-4 h-4" />
        Rate This Agent
      </button>
    );
  }

  if (isSuccess && hash) {
    return (
      <div className="bg-gray-900/50 border border-emerald-500/30 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Feedback Submitted!</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Your rating of {rating}/100 has been recorded on-chain.
        </p>
        <div className="flex items-center gap-3">
          <a
            href={`https://testnet.snowtrace.io/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 text-xs font-mono hover:underline"
          >
            View transaction
          </a>
          <button
            onClick={handleReset}
            className="text-gray-500 text-xs hover:text-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          Rate {agentName || `Agent #${agentId}`}
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 text-xs hover:text-gray-300"
        >
          Cancel
        </button>
      </div>

      {!isConnected ? (
        <div className="text-center py-4">
          <p className="text-gray-400 text-sm mb-3">Connect your wallet to submit feedback</p>
          <div className="flex justify-center">
            <WalletButton />
          </div>
        </div>
      ) : isOwnAgent ? (
        <div className="flex items-center gap-2 text-yellow-400 text-sm py-4">
          <AlertCircle className="w-4 h-4" />
          You cannot rate your own agent.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rating Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono text-gray-400 uppercase">Rating</label>
              <span
                className="text-lg font-bold font-mono"
                style={{
                  color: rating >= 80 ? "#00E5A0" : rating >= 60 ? "#facc15" : rating >= 40 ? "#f97316" : "#ef4444",
                }}
              >
                {rating}/100
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-gray-600 mt-1">
              <span>Poor</span>
              <span>Average</span>
              <span>Excellent</span>
            </div>
          </div>

          {/* Task Description */}
          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
              Task Description *
            </label>
            <input
              type="text"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              required
              placeholder="e.g. Completed yield rebalance #42"
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{(error as Error).message || "Transaction failed"}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || isConfirming || !taskDescription.trim()}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isPending || isConfirming ? (
              <>
                <LoadingSpinner size="sm" />
                {isPending ? "Confirm in wallet..." : "Confirming..."}
              </>
            ) : (
              <>
                <Star className="w-4 h-4" />
                Submit Rating ({rating}/100)
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
