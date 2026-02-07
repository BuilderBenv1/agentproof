"use client";

import { useParams } from "next/navigation";
import { useAgent } from "@/hooks/useAgents";
import AgentProfile from "@/components/agents/AgentProfile";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = Number(params.agentId);
  const { agent, loading, error } = useAgent(agentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 font-mono text-sm mb-4">
          {error || "Agent not found"}
        </p>
        <Link
          href="/agents"
          className="text-emerald-400 text-sm hover:text-emerald-300 flex items-center gap-1 justify-center"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Explorer
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/agents"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-400 transition-colors mb-6"
      >
        <ArrowLeft className="w-3 h-3" /> Back to Explorer
      </Link>

      <AgentProfile agent={agent} />
    </div>
  );
}
