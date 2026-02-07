"use client";

import ScoreGauge from "@/components/reputation/ScoreGauge";
import CategoryBadge from "@/components/reputation/CategoryBadge";
import ReputationChart from "@/components/reputation/ReputationChart";
import ReputationHistory from "@/components/reputation/ReputationHistory";
import FeedbackForm from "@/components/reputation/FeedbackForm";
import { truncateAddress, formatDate, getTierColor } from "@/lib/utils";
import { useFeedback, useScoreHistory } from "@/hooks/useReputation";
import { ExternalLink, Copy, Calendar, Shield } from "lucide-react";
import type { Agent } from "@/hooks/useAgents";

interface AgentProfileProps {
  agent: Agent;
}

export default function AgentProfile({ agent }: AgentProfileProps) {
  const { feedback, loading: feedbackLoading } = useFeedback(agent.agent_id);
  const { history } = useScoreHistory(agent.agent_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="w-20 h-20 rounded-xl bg-gray-800 flex items-center justify-center text-3xl font-bold font-mono text-emerald-400 flex-shrink-0">
            {agent.image_url ? (
              <img src={agent.image_url} alt={agent.name || "Agent"} className="w-full h-full rounded-xl object-cover" />
            ) : (
              agent.name?.[0]?.toUpperCase() || "#"
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">
                {agent.name || `Agent #${agent.agent_id}`}
              </h1>
              <CategoryBadge category={agent.category} />
              <span
                className="px-2 py-0.5 rounded text-xs font-mono font-bold uppercase"
                style={{
                  color: getTierColor(agent.tier),
                  backgroundColor: `${getTierColor(agent.tier)}15`,
                }}
              >
                {agent.tier}
              </span>
            </div>

            {agent.description && (
              <p className="text-gray-400 text-sm mb-3">{agent.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-gray-500">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Owner: {truncateAddress(agent.owner_address)}
                <button
                  onClick={() => navigator.clipboard.writeText(agent.owner_address)}
                  className="hover:text-emerald-400 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Registered: {formatDate(agent.registered_at)}
              </span>
              {agent.agent_uri && (
                <a
                  href={agent.agent_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> Metadata
                </a>
              )}
            </div>
          </div>

          <div className="flex-shrink-0">
            <ScoreGauge score={agent.composite_score} tier={agent.tier} size="lg" />
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <p className="text-xs font-mono text-gray-500 uppercase mb-1">Avg Rating</p>
          <p className="text-xl font-bold font-mono text-white">{agent.average_rating.toFixed(1)}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <p className="text-xs font-mono text-gray-500 uppercase mb-1">Feedback</p>
          <p className="text-xl font-bold font-mono text-white">{agent.total_feedback}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <p className="text-xs font-mono text-gray-500 uppercase mb-1">Validation Rate</p>
          <p className="text-xl font-bold font-mono text-white">{agent.validation_success_rate.toFixed(0)}%</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <p className="text-xs font-mono text-gray-500 uppercase mb-1">Global Rank</p>
          <p className="text-xl font-bold font-mono text-white">#{agent.rank || "—"}</p>
        </div>
      </div>

      {/* Rate This Agent */}
      <FeedbackForm
        agentId={agent.agent_id}
        agentName={agent.name || `Agent #${agent.agent_id}`}
        ownerAddress={agent.owner_address}
      />

      {/* Score History Chart */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Score History</h2>
        <ReputationChart data={history} />
      </div>

      {/* Recent Feedback */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Feedback</h2>
        <ReputationHistory feedback={feedback} loading={feedbackLoading} />
      </div>
    </div>
  );
}
