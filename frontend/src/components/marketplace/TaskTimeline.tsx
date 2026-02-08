"use client";

import { CheckCircle, Circle, Clock, XCircle, Play } from "lucide-react";

interface TaskTimelineProps {
  status: string;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
}

const STEPS = [
  { key: "pending", label: "Created", icon: Circle },
  { key: "accepted", label: "Accepted", icon: Play },
  { key: "in_progress", label: "In Progress", icon: Clock },
  { key: "completed", label: "Completed", icon: CheckCircle },
];

function getStepIndex(status: string): number {
  if (status === "cancelled" || status === "disputed") return -1;
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function TaskTimeline({ status }: TaskTimelineProps) {
  const currentIdx = getStepIndex(status);
  const isCancelled = status === "cancelled" || status === "disputed";

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-xs font-mono">
        <XCircle className="w-4 h-4" />
        {status === "cancelled" ? "Cancelled" : "Disputed"}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isActive = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <Icon
                className={`w-4 h-4 ${
                  isCurrent
                    ? "text-emerald-400"
                    : isActive
                    ? "text-gray-400"
                    : "text-gray-700"
                }`}
              />
              <span
                className={`text-[9px] font-mono mt-0.5 ${
                  isCurrent ? "text-emerald-400" : isActive ? "text-gray-500" : "text-gray-700"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-8 h-px mx-1 ${
                  i < currentIdx ? "bg-gray-500" : "bg-gray-800"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
