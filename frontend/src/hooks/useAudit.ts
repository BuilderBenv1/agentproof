"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/supabase";

export interface AuditLog {
  id: number;
  agent_id: number;
  action: string;
  actor_address: string;
  details: Record<string, unknown>;
  tx_hash: string | null;
  block_number: number | null;
  source: string;
  created_at: string;
}

export interface AuditSummary {
  agent_id: number;
  total_events: number;
  action_counts: Record<string, number>;
  unique_actors: number;
  first_event: string | null;
  last_event: string | null;
}

export function useAudit(agentId: number, action?: string, page: number = 1) {
  const [data, setData] = useState<{ logs: AuditLog[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{ logs: AuditLog[]; total: number }>(
        `/audit/${agentId}`,
        { params: { action, page, page_size: 50 } }
      );
      setData(result);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [agentId, action, page]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useAuditSummary(agentId: number) {
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const result = await apiFetch<AuditSummary>(`/audit/${agentId}/summary`);
        setSummary(result);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [agentId]);

  return { summary, loading };
}
