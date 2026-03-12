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
  TrendingUp, TrendingDown, Minus, DollarSign, Link2,
} from "lucide-react";
import { useState } from "react";
import type { Agent } from "@/hooks/useAgents";

function MetadataPopover({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 hover:text-[#00ff88] transition-colors"
      >
        <FileText className="w-3 h-3" /> Metadata
      </button>
      {open && (
        <div className="absolute z-50 top-6 left-0 w-72 max-h-60 overflow-auto bg-[#111118] border border-[#2a2a3a] rounded-lg p-3 shadow-xl">
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
      {/* Disclaimer */}
      <p className="text-[10px] font-mono text-gray-600 border border-[#2a2a3a] rounded px-3 py-1.5">
        Trust scores are informational only and do not constitute financial advice, endorsement, or guarantee of reliability.{" "}
        <a href="/terms" className="text-gray-500 hover:text-emerald-400 underline">Terms</a>
      </p>

      {/* Header */}
      <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="w-20 h-20 rounded-xl bg-gray-800 flex items-center justify-center text-3xl font-bold font-mono text-[#00ff88] flex-shrink-0 overflow-hidden">
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
                  polygon: "#8247E5", arbitrum: "#28A0F0", optimism: "#FF0420", bsc: "#F0B90B",
                  scroll: "#FFEEDA", gnosis: "#3E6957", mantle: "#000000", celo: "#FCFF52",
                  monad: "#836EF9", abstract: "#0066FF", taiko: "#E81899", megaeth: "#FF6B35",
                  skale: "#4DFFD2", xlayer: "#1E1E1E", soneium: "#7B61FF", metis: "#00DACC",
                  solana: "#9945FF",
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
                  onClick={() => navigator.clipboard?.writeText(agent.owner_address).catch(() => {})}
                  className="hover:text-[#00ff88] transition-colors"
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
                    className="flex items-center gap-1 hover:text-[#00ff88] transition-colors"
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
          <div className="bg-[#111118] border border-[#2a2a3a] rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Star className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-mono text-gray-500 uppercase">Avg Rating</span>
            </div>
            <p className="text-xl font-bold font-mono text-white">{agent.average_rating.toFixed(1)}</p>
            <p className="text-xs text-gray-600 font-mono">out of 100</p>
          </div>
          <div className="bg-[#111118] border border-[#2a2a3a] rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-mono text-gray-500 uppercase">Reviews</span>
            </div>
            <p className="text-xl font-bold font-mono text-white">{agent.total_feedback}</p>
            <p className="text-xs text-gray-600 font-mono">total feedback</p>
          </div>
          <div className="bg-[#111118] border border-[#2a2a3a] rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-[#00ff88]" />
              <span className="text-xs font-mono text-gray-500 uppercase">Validation</span>
            </div>
            <p className="text-xl font-bold font-mono text-white">{agent.validation_success_rate > 0 ? `${agent.validation_success_rate.toFixed(0)}%` : "N/A"}</p>
            <p className="text-xs text-gray-600 font-mono">{agent.validation_success_rate > 0 ? "success rate" : "no validations yet"}</p>
          </div>
          <div className="bg-[#111118] border border-[#2a2a3a] rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-mono text-gray-500 uppercase">Rank</span>
            </div>
            <p className="text-xl font-bold font-mono text-white">#{agent.rank || "\u2014"}</p>
            <p className="text-xs text-gray-600 font-mono">global position</p>
          </div>
        </div>

        {/* Score Component Bars */}
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-lg p-4 space-y-3">
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

      {/* Score Trajectory + Max Exposure Row */}
      {(agent.score_trajectory || agent.max_exposure_usd != null) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Score Trajectory */}
          {agent.score_trajectory && (
            <div className="bg-[#111118] border border-[#2a2a3a] rounded-lg p-4">
              <h3 className="text-xs font-mono text-gray-500 uppercase mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Score Trajectory
              </h3>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs font-mono text-gray-500 block mb-1">7-Day</span>
                  {agent.score_trajectory.delta_7d != null ? (
                    <span className={`text-lg font-bold font-mono flex items-center gap-1 ${
                      agent.score_trajectory.delta_7d > 0 ? "text-[#00ff88]" :
                      agent.score_trajectory.delta_7d < 0 ? "text-red-400" : "text-gray-400"
                    }`}>
                      {agent.score_trajectory.delta_7d > 0 ? <TrendingUp className="w-4 h-4" /> :
                       agent.score_trajectory.delta_7d < 0 ? <TrendingDown className="w-4 h-4" /> :
                       <Minus className="w-4 h-4" />}
                      {agent.score_trajectory.delta_7d > 0 ? "+" : ""}{agent.score_trajectory.delta_7d.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-sm font-mono text-gray-600">N/A</span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-mono text-gray-500 block mb-1">30-Day</span>
                  {agent.score_trajectory.delta_30d != null ? (
                    <span className={`text-lg font-bold font-mono flex items-center gap-1 ${
                      agent.score_trajectory.delta_30d > 0 ? "text-[#00ff88]" :
                      agent.score_trajectory.delta_30d < 0 ? "text-red-400" : "text-gray-400"
                    }`}>
                      {agent.score_trajectory.delta_30d > 0 ? <TrendingUp className="w-4 h-4" /> :
                       agent.score_trajectory.delta_30d < 0 ? <TrendingDown className="w-4 h-4" /> :
                       <Minus className="w-4 h-4" />}
                      {agent.score_trajectory.delta_30d > 0 ? "+" : ""}{agent.score_trajectory.delta_30d.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-sm font-mono text-gray-600">N/A</span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-mono text-gray-500 block mb-1">Trend</span>
                  <span className={`text-sm font-bold font-mono uppercase ${
                    agent.score_trajectory.trend === "rising" ? "text-[#00ff88]" :
                    agent.score_trajectory.trend === "falling" ? "text-red-400" :
                    agent.score_trajectory.trend === "new" ? "text-cyan-400" : "text-gray-400"
                  }`}>
                    {agent.score_trajectory.trend}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Max Exposure */}
          {agent.max_exposure_usd != null && (
            <div className="bg-[#111118] border border-[#2a2a3a] rounded-lg p-4">
              <h3 className="text-xs font-mono text-gray-500 uppercase mb-3 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> Max Exposure
              </h3>
              <p className="text-2xl font-bold font-mono text-white mb-1">
                ${agent.max_exposure_usd >= 1000
                  ? `${(agent.max_exposure_usd / 1000).toFixed(1)}K`
                  : agent.max_exposure_usd.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 font-mono">
                Recommended maximum trust value for this agent based on reputation signals, feedback volume, account age, and insurance.
              </p>
              {(agent.coverage_tier || agent.insurable != null) && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#2a2a3a]">
                  {agent.coverage_tier && agent.coverage_tier !== "none" && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded border border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88]">
                      Coverage: {agent.coverage_tier}
                    </span>
                  )}
                  {agent.insurable != null && (
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                      agent.insurable
                        ? "border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88]"
                        : "border-gray-700 bg-gray-800 text-gray-500"
                    }`}>
                      {agent.insurable ? "Insurable" : "Not Insurable"}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cross-Chain Identity */}
      {agent.cross_chain_agents && agent.cross_chain_agents.length > 0 && (
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-lg p-4">
          <h3 className="text-xs font-mono text-gray-500 uppercase mb-3 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> Cross-Chain Identity ({agent.cross_chain_agents.length} linked agents)
          </h3>
          <p className="text-xs text-gray-500 font-mono mb-3">
            Same deployer detected on other chains. Linked reputation across networks.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {agent.cross_chain_agents.map((linked) => {
              const chainColors: Record<string, string> = {
                avalanche: "#E84142", ethereum: "#627EEA", base: "#0052FF", linea: "#61DFFF",
                polygon: "#8247E5", arbitrum: "#28A0F0", optimism: "#FF0420", bsc: "#F0B90B",
                scroll: "#FFEEDA", gnosis: "#3E6957", mantle: "#000000", celo: "#FCFF52", monad: "#836EF9", abstract: "#0066FF",
              };
              const lc = chainColors[linked.source_chain] || "#666";
              const lt = getTierColor(linked.tier);
              return (
                <a
                  key={`${linked.agent_id}-${linked.source_chain}`}
                  href={`/agents/${linked.agent_id}?chain=${linked.source_chain}`}
                  className="flex items-center gap-2 bg-gray-800/50 border border-[#2a2a3a] rounded-lg p-2 hover:border-[#00ff88]/30 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lc }} />
                  <span className="text-xs font-mono text-gray-300 truncate flex-1">
                    {linked.name || `Agent #${linked.agent_id}`}
                  </span>
                  <span className="text-xs font-mono font-bold" style={{ color: lt }}>
                    {linked.composite_score.toFixed(1)}
                  </span>
                  <span className="text-[10px] font-mono uppercase text-gray-500">
                    {linked.source_chain}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Agent Capabilities (ERC-8004 Identity Tags) */}
      {(agent.autonomy_level || agent.financial_access || agent.data_access_level ||
        agent.open_source != null || agent.human_in_loop != null ||
        (agent.audited_by && agent.audited_by.length > 0) ||
        (agent.supported_protocols && agent.supported_protocols.length > 0) ||
        agent.owner_type || agent.upgrade_pattern) && (
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-lg p-4">
          <h3 className="text-xs font-mono text-gray-500 uppercase mb-3 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Agent Capabilities
          </h3>
          <div className="flex flex-wrap gap-2">
            {agent.autonomy_level && (
              <span className="text-xs font-mono px-2 py-1 rounded border border-[#2a2a3a] bg-gray-800 text-gray-300 capitalize">
                {agent.autonomy_level.replace("_", " ")}
              </span>
            )}
            {agent.financial_access && (
              <span className={`text-xs font-mono px-2 py-1 rounded border ${
                agent.financial_access === "unlimited" ? "border-red-500/30 bg-red-500/10 text-red-400" :
                agent.financial_access === "write" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
                "border-gray-700 bg-gray-800 text-gray-300"
              }`}>
                Financial: {agent.financial_access}
              </span>
            )}
            {agent.data_access_level && (
              <span className="text-xs font-mono px-2 py-1 rounded border border-[#2a2a3a] bg-gray-800 text-gray-300">
                Data: {agent.data_access_level}
              </span>
            )}
            {agent.owner_type && (
              <span className="text-xs font-mono px-2 py-1 rounded border border-[#2a2a3a] bg-gray-800 text-gray-300 uppercase">
                {agent.owner_type}
              </span>
            )}
            {agent.upgrade_pattern && (
              <span className="text-xs font-mono px-2 py-1 rounded border border-[#2a2a3a] bg-gray-800 text-gray-300">
                {agent.upgrade_pattern.replace("_", " ")}
              </span>
            )}
            {agent.open_source && (
              <span className="text-xs font-mono px-2 py-1 rounded border border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88]">
                Open Source
              </span>
            )}
            {agent.human_in_loop && (
              <span className="text-xs font-mono px-2 py-1 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400">
                Human Override
              </span>
            )}
            {agent.audited_by && agent.audited_by.length > 0 && (
              <span className="text-xs font-mono px-2 py-1 rounded border border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88]">
                Audited ({agent.audited_by.join(", ")})
              </span>
            )}
            {agent.can_delegate && (
              <span className="text-xs font-mono px-2 py-1 rounded border border-[#2a2a3a] bg-gray-800 text-gray-300">
                Can Delegate
              </span>
            )}
            {agent.can_be_delegated && (
              <span className="text-xs font-mono px-2 py-1 rounded border border-[#2a2a3a] bg-gray-800 text-gray-300">
                Accepts Delegation
              </span>
            )}
          </div>
          {agent.supported_protocols && agent.supported_protocols.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#2a2a3a]">
              <span className="text-[10px] font-mono text-gray-600 uppercase">Protocols: </span>
              {agent.supported_protocols.map((p) => (
                <span key={p} className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 mr-1 uppercase">
                  {p}
                </span>
              ))}
            </div>
          )}
          {(agent.jurisdiction || (agent.compliance_tags && agent.compliance_tags.length > 0)) && (
            <div className="mt-3 pt-3 border-t border-[#2a2a3a] flex flex-wrap gap-2">
              {agent.jurisdiction && (
                <span className="text-xs font-mono px-2 py-0.5 rounded border border-[#2a2a3a] bg-gray-800 text-gray-400">
                  {agent.jurisdiction}
                </span>
              )}
              {agent.compliance_tags?.map((tag) => (
                <span key={tag} className="text-xs font-mono px-2 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 uppercase">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {agent.source_url && (
            <div className="mt-3 pt-3 border-t border-[#2a2a3a]">
              <a href={agent.source_url} target="_blank" rel="noopener noreferrer"
                className="text-xs font-mono text-[#00ff88] hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Source Code
              </a>
            </div>
          )}
        </div>
      )}

      {/* Deployer History */}
      {agent.deployer_info && (
        <DeployerBadge info={agent.deployer_info} />
      )}

      {/* URI Changes */}
      {agent.uri_changes && agent.uri_changes.length > 0 && (
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-lg p-4 space-y-3">
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
                  <span className="text-[#00ff88]/80 block truncate">{change.new_uri}</span>
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
      <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#00ff88]" />
          Score History
        </h2>
        <ReputationChart data={history} />
      </div>

      {/* Recent Feedback */}
      <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          Recent Feedback
        </h2>
        <ReputationHistory feedback={feedback} loading={feedbackLoading} />
      </div>
    </div>
  );
}
