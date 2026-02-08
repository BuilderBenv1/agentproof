"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useAudit, useAuditSummary } from "@/hooks/useAudit";
import AuditTimeline from "@/components/audit/AuditTimeline";
import AuditExportButton from "@/components/audit/AuditExportButton";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";

const ACTION_FILTERS = [
  "all",
  "registered",
  "feedback_received",
  "validation_requested",
  "endpoint_registered",
  "listing_created",
  "task_accepted",
  "task_completed",
  "split_created",
  "payment_created",
];

export default function AuditPage() {
  const params = useParams();
  const agentId = Number(params.agentId);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, loading } = useAudit(agentId, filter === "all" ? undefined : filter, page);
  const { summary } = useAuditSummary(agentId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href={`/agents/${agentId}`}
        className="inline-flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-white"
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Agent
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            Audit Trail — Agent #{agentId}
          </h1>
          {summary && (
            <p className="text-xs text-gray-500 font-mono mt-1">
              {summary.total_events} events from {summary.unique_actors} actors
            </p>
          )}
        </div>
        <AuditExportButton agentId={agentId} />
      </div>

      {/* Summary Cards */}
      {summary && Object.keys(summary.action_counts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.action_counts)
            .sort(([, a], [, b]) => b - a)
            .map(([action, count]) => (
              <span
                key={action}
                className="text-[10px] font-mono px-2 py-1 bg-gray-900/50 border border-gray-800 rounded text-gray-400"
              >
                {action}: {count}
              </span>
            ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-1.5">
        {ACTION_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`text-[10px] font-mono px-2.5 py-1 rounded-full transition-colors ${
              filter === f
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-gray-800 text-gray-500 border border-transparent hover:text-gray-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          <AuditTimeline logs={data?.logs || []} />

          {data && data.total > 50 && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="text-xs font-mono text-gray-400 hover:text-white disabled:opacity-30 px-3 py-1.5 bg-gray-800 rounded"
              >
                Prev
              </button>
              <span className="text-xs font-mono text-gray-500 px-3 py-1.5">
                Page {page}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(data.total / 50)}
                className="text-xs font-mono text-gray-400 hover:text-white disabled:opacity-30 px-3 py-1.5 bg-gray-800 rounded"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
