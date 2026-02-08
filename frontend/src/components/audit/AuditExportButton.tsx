"use client";

import { useState } from "react";
import { Download, ChevronDown } from "lucide-react";
import { API_URL } from "@/lib/constants";

interface AuditExportButtonProps {
  agentId: number;
}

export default function AuditExportButton({ agentId }: AuditExportButtonProps) {
  const [open, setOpen] = useState(false);

  function handleExport(format: "csv" | "json") {
    window.open(`${API_URL}/audit/${agentId}/export?format=${format}`, "_blank");
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
      >
        <Download className="w-3 h-3" />
        Export
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 overflow-hidden">
          <button
            onClick={() => handleExport("csv")}
            className="block w-full text-left text-xs font-mono text-gray-300 hover:bg-gray-700 px-4 py-2"
          >
            CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            className="block w-full text-left text-xs font-mono text-gray-300 hover:bg-gray-700 px-4 py-2"
          >
            JSON
          </button>
        </div>
      )}
    </div>
  );
}
