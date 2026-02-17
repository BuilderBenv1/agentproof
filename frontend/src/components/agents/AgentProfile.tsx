"use client";

import ScoreGauge from "@/components/reputation/ScoreGauge";
import CategoryBadge from "@/components/reputation/CategoryBadge";
import ReputationChart from "@/components/reputation/ReputationChart";
import ReputationHistory from "@/components/reputation/ReputationHistory";
import FeedbackForm from "@/components/reputation/FeedbackForm";
import DeployerBadge from "@/components/reputation/DeployerBadge";
import FreshnessIndicator from "@/components/reputation/FreshnessIndicator";
import { truncateAddress, formatDate, getTierColor, isNavigableUri, decodeDataUri } from "@/lib/utils";
import { useFeedback, useScoreHistory } from "@/hooks/useReputation";
import {
  ExternalLink, Copy, Calendar, Shield, Star, BarChart3,
  CheckCircle, MessageSquare, Activity, FileText, RefreshCw,
} from "lucide-react";
import { useState } from "react";
import type { Agent } from "@/hooks/useAgents";

function MetadataPopover({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
      >
        <FileText className="w-3 h-3" /> Metadata
      </button>
      {open && (
        <div className="absolute z-50 top-6 left-0 w-72 max-h-60 overflow-auto bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-gray-500 uppercase">Decoded Metadata</span>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-xs">&times;</button>
          </div>
          <pre className="text-[10px] font-mono text-gray-300 whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </span>
  );
}

interface AgentProfileProps {
  agent: Agent;
}

function ScoreBreakdownBar({
  label,
  value,
  maxValue,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  icon: React.ElementType;
}) {
  const pct = Math.min(100, (value / maxValue) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-mono text-gray-400">
          <Icon className="w-3 h-3" style={{ color }} />
          {label}
        </span>
        <span className="text-xs font-mono font-bold text-white">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-800">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}30`,
          }}
        />
      </div>
    </div>
  );
}

export default function AgentProfile({ agent }: AgentProfileProps) {
  const { feedback, loading: feedbackLoading } = useFeedback(agent.agent_id);
  const { history } = useScoreHistory(agent.agent_id);
  const tierColor = getTierColor(agent.tier);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="w-20 h-20 rounded-xl bg-gray-800 flex items-center justify-center text-3xl font-bold font-mono text-emerald-400 flex-shrink-0 overflow-hidden">
            {agent.image_url ? (
              <img src={agent.image_url} alt={agent.name || "Agent"} className="w-full h-full rounded-xl object-cover" />
            ) : (
              agent.name?.[0]?.toUpperCase() || "#"
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white">
                {agent.name || `Agent #${agent.agent_id}`}
              </h1>
              <CategoryBadge category={agent.category} />
              {agent.source_chain && (() => {
                const chainColors: Record<string, string> = {
                  avalanche: "#E84142", ethereum: "#627EEA", base: "#0052FF", linea: "#61DFFF",
                };
                const c = chainColors[agent.source_chain] || "#666";
                return (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase"
                    style={{ color: c, backgroundColor: `${c}12`, border: `1px solid ${c}25` }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                    {agent.source_chain}
                  </span>
                );
              })()}
              <span
                className="px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase"
                style={{
                  color: tierColor,
                  backgroundColor: `${tierColor}12`,
                  border: `1px solid ${tierColor}25`,
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
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {agent.total_feedback} reviews
              </span>
              {agent.agent_uri && (
                isNavigableUri(agent.agent_uri) ? (
                  <a
                    href={agent.agent_uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" /> Metadata
                  </a>
                ) : decodeDataUri(agent.agent_uri) ? (
                  <MetadataPopover data={decodeDataUri(agent.agent_uri)!} />
                ) : null
              )}
            </div>
          </div>

          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            <ScoreGauge score={agent.composite_score} tier={agent.tier} size="lg" showTier />
            {agent.freshness_multiplier != null && agent.freshness_multiplier < 1.0 && (
              <FreshnessIndicator multiplier={agent.freshness_multiplier} />
            )}
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Star className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-mono text-gray-500 uppercase">Avg Rating</span>
            </div>
            <p className="text-xl font-bold font-mono text-white">{agent.average_rating.toFixed(1)}</p>
            <p className="text-xs text-gray-600 font-mono">out of 100</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-mono text-gray-500 uppercase">Reviews</span>
            </div>
            <p className="text-xl font-bold font-mono text-white">{agent.total_feedback}</p>
            <p className="text-xs text-gray-600 font-mono">total feedback</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-mono text-gray-500 uppercase">Validation</span>
            </div>
            <p className="text-xl font-bold font-mono text-white">{agent.validation_success_rate > 0 ? `${agent.validation_success_rate.toFixed(0)}%` : "N/A"}</p>
            <p className="text-xs text-gray-600 font-mono">{agent.validation_success_rate > 0 ? "success rate" : "no validations yet"}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-mono text-gray-500 uppercase">Rank</span>
            </div>
            <p className="text-xl font-bold font-mono text-white">#{agent.rank || "\u2014"}</p>
            <p className="text-xs text-gray-600 font-mono">global position</p>
          </div>
        </div>

        {/* Score Component Bars */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-mono text-gray-500 uppercase mb-3">Score Breakdown</h3>
          <ScoreBreakdownBar
            label="Rating Score"
            value={agent.average_rating}
            maxValue={100}
            color="#facc15"
            icon={Star}
          />
          <ScoreBreakdownBar
            label="Feedback Volume"
            value={Math.min(100, agent.total_feedback > 0 ? Math.log10(agent.total_feedback + 1) / Math.log10(101) * 100 : 0)}
            maxValue={100}
            color="#22d3ee"
            icon={BarChart3}
          />
          <ScoreBreakdownBar
            label="Validation Rate"
            value={agent.validation_success_rate}
            maxValue={100}
            color="#34d399"
            icon={CheckCircle}
          />
          <ScoreBreakdownBar
            label="Composite Score"
            value={agent.composite_score}
            maxValue={100}
            color={tierColor}
            icon={Activity}
          />
        </div>
      </div>

      {/* Deployer History */}
      {agent.deployer_info && (
        <DeployerBadge info={agent.deployer_info} />
      )}

      {/* URI Changes */}
      {agent.uri_changes && agent.uri_changes.length > 0 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-mono text-gray-500 uppercase flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            URI Changes ({agent.uri_changes.length})
          </h3>
          <div className="space-y-2">
            {agent.uri_changes.map((change, i) => (
              <div key={change.id || i} className="flex items-start gap-2 text-[11px] font-mono">
                <span className="text-gray-600 flex-shrink-0 w-28">
                  {new Date(change.changed_at).toLocaleDateString()}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-red-400/60 line-through block truncate">{change.old_uri || "—"}</span>
                  <span className="text-emerald-400/80 block truncate">{change.new_uri}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rate This Agent */}
      <FeedbackForm
        agentId={agent.agent_id}
        agentName={agent.name || `Agent #${agent.agent_id}`}
        ownerAddress={agent.owner_address}
      />

      {/* Score History Chart */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          Score History
        </h2>
        <ReputationChart data={history} />
      </div>

      {/* Recent Feedback */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          Recent Feedback
        </h2>
        <ReputationHistory feedback={feedback} loading={feedbackLoading} />
      </div>
    </div>
  );
}
