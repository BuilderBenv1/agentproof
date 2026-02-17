"use client";

import { AlertTriangle, UserCheck, UserPlus, Users } from "lucide-react";

interface DeployerInfo {
  owner_address: string;
  total_agents: number;
  active_agents: number;
  abandoned_agents: number;
  avg_agent_score: number;
  best_agent_score: number;
  oldest_agent_age_days: number;
  deployer_score: number;
}

const LABELS: Record<string, { text: string; color: string; icon: React.ElementType }> = {
  serial_deployer_warning: { text: "Serial Deployer", color: "#ef4444", icon: AlertTriangle },
  new_deployer: { text: "New Deployer", color: "#6b7280", icon: UserPlus },
  recent_deployer: { text: "Recent Deployer", color: "#f59e0b", icon: UserPlus },
  established: { text: "Trusted Deployer", color: "#10b981", icon: UserCheck },
};

function getLabel(info: DeployerInfo) {
  const { total_agents, abandoned_agents, oldest_agent_age_days } = info;
  if (total_agents > 10 && abandoned_agents / Math.max(total_agents, 1) > 0.5) {
    return "serial_deployer_warning";
  }
  if (oldest_agent_age_days < 7) return "new_deployer";
  if (oldest_agent_age_days < 30) return "recent_deployer";
  return "established";
}

export default function DeployerBadge({ info }: { info: DeployerInfo }) {
  const labelKey = getLabel(info);
  const label = LABELS[labelKey];
  const Icon = label.icon;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono text-gray-500 uppercase flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          Deployer History
        </h3>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
          style={{
            color: label.color,
            backgroundColor: `${label.color}15`,
            border: `1px solid ${label.color}30`,
          }}
        >
          <Icon className="w-3 h-3" />
          {label.text}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] font-mono text-gray-600 uppercase">Deployer Score</p>
          <p className="text-sm font-mono font-bold text-white">{info.deployer_score.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-[10px] font-mono text-gray-600 uppercase">Total Agents</p>
          <p className="text-sm font-mono font-bold text-white">{info.total_agents}</p>
        </div>
        <div>
          <p className="text-[10px] font-mono text-gray-600 uppercase">Avg Score</p>
          <p className="text-sm font-mono font-bold text-white">{info.avg_agent_score.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-[10px] font-mono text-gray-600 uppercase">Oldest Agent</p>
          <p className="text-sm font-mono font-bold text-white">{info.oldest_agent_age_days}d</p>
        </div>
      </div>

      {info.abandoned_agents > 0 && (
        <p className="text-[10px] font-mono text-gray-600">
          {info.abandoned_agents} abandoned agent{info.abandoned_agents > 1 ? "s" : ""} ({((info.abandoned_agents / Math.max(info.total_agents, 1)) * 100).toFixed(0)}% abandonment rate)
        </p>
      )}
    </div>
  );
}
