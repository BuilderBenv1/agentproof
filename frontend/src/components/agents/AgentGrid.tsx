"use client";

import AgentCard from "./AgentCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import type { Agent } from "@/hooks/useAgents";

interface AgentGridProps {
  agents: Agent[];
  loading?: boolean;
}

export default function AgentGrid({ agents, loading }: AgentGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 font-mono text-sm">No agents found</p>
        <p className="text-gray-700 text-xs mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {agents.map((agent) => (
        <AgentCard
          key={agent.agent_id}
          agentId={agent.agent_id}
          name={agent.name}
          category={agent.category}
          compositeScore={agent.composite_score}
          tier={agent.tier}
          feedbackCount={agent.total_feedback}
          rank={agent.rank}
          imageUrl={agent.image_url}
        />
      ))}
    </div>
  );
}
