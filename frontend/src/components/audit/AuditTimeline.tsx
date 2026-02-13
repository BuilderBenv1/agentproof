"use client";

import { explorerTxUrl } from "@/lib/utils";
import { AuditLog } from "@/hooks/useAudit";
import {
  UserPlus,
  MessageSquare,
  Shield,
  DollarSign,
  Globe,
  Activity,
  GitBranch,
  FileText,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const ACTION_CONFIG: Record<string, { icon: typeof Shield; color: string; label: string }> = {
  registered: { icon: UserPlus, color: "text-emerald-400", label: "Registered" },
  feedback_received: { icon: MessageSquare, color: "text-blue-400", label: "Feedback" },
  validation_requested: { icon: Shield, color: "text-purple-400", label: "Validation Requested" },
  validation_submitted: { icon: CheckCircle, color: "text-green-400", label: "Validation Submitted" },
  payment_created: { icon: DollarSign, color: "text-yellow-400", label: "Payment Created" },
  payment_released: { icon: DollarSign, color: "text-emerald-400", label: "Payment Released" },
  endpoint_registered: { icon: Globe, color: "text-blue-400", label: "Endpoint Registered" },
  uptime_check: { icon: Activity, color: "text-cyan-400", label: "Uptime Check" },
  split_created: { icon: GitBranch, color: "text-purple-400", label: "Split Created" },
  listing_created: { icon: FileText, color: "text-yellow-400", label: "Listing Created" },
  task_created: { icon: FileText, color: "text-blue-400", label: "Task Created" },
  task_accepted: { icon: CheckCircle, color: "text-emerald-400", label: "Task Accepted" },
  task_completed: { icon: CheckCircle, color: "text-green-400", label: "Task Completed" },
};

interface AuditTimelineProps {
  logs: AuditLog[];
}

export default function AuditTimeline({ logs }: AuditTimelineProps) {
  if (!logs.length) {
    return (
      <div className="text-center py-10">
        <AlertCircle className="w-8 h-8 text-gray-700 mx-auto mb-2" />
        <p className="text-xs text-gray-600 font-mono">No audit events found</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {logs.map((log, i) => {
        const config = ACTION_CONFIG[log.action] || {
          icon: Shield,
          color: "text-gray-400",
          label: log.action,
        };
        const Icon = config.icon;

        return (
          <div key={log.id} className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center`}>
                <Icon className={`w-3 h-3 ${config.color}`} />
              </div>
              {i < logs.length - 1 && (
                <div className="w-px flex-1 bg-gray-800 min-h-[24px]" />
              )}
            </div>

            {/* Content */}
            <div className="pb-4 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${config.color}`}>
                  {config.label}
                </span>
                <span className="text-[10px] font-mono text-gray-600">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] font-mono text-gray-500 mt-0.5 truncate">
                by {log.actor_address.slice(0, 10)}...
              </p>
              {log.tx_hash && (
                <a
                  href={explorerTxUrl(log.tx_hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-gray-600 hover:text-emerald-400 mt-0.5 inline-block"
                >
                  tx: {log.tx_hash.slice(0, 14)}...
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
