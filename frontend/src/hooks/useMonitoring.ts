"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/supabase";

export interface UptimeCheck {
  id: number;
  agent_id: number;
  endpoint_index: number;
  is_up: boolean;
  latency_ms: number | null;
  response_code: number | null;
  checked_at: string;
  source: string;
}

export interface UptimeDailySummary {
  id: number;
  agent_id: number;
  summary_date: string;
  total_checks: number;
  successful_checks: number;
  uptime_pct: number;
  avg_latency_ms: number;
}

export interface MonitoringEndpoint {
  id: number;
  agent_id: number;
  endpoint_index: number;
  url: string;
  endpoint_type: string;
  is_active: boolean;
  registered_at: string;
}

export interface MonitoringOverview {
  agent_id: number;
  endpoints: MonitoringEndpoint[];
  uptime_pct: number;
  avg_latency_ms: number;
  total_checks: number;
  last_check: UptimeCheck | null;
}

export function useMonitoring(agentId: number) {
  const [data, setData] = useState<MonitoringOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<MonitoringOverview>(`/monitoring/agent/${agentId}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch monitoring data");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useUptimeHistory(agentId: number, days: number = 30) {
  const [summaries, setSummaries] = useState<UptimeDailySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const result = await apiFetch<{ summaries: UptimeDailySummary[] }>(
          `/monitoring/agent/${agentId}/history`,
          { params: { days } }
        );
        setSummaries(result.summaries);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [agentId, days]);

  return { summaries, loading };
}
