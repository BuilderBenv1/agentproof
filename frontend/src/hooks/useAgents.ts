"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/supabase";

export interface Agent {
  id: number;
  agent_id: number;
  owner_address: string;
  agent_uri: string;
  name: string | null;
  description: string | null;
  category: string;
  image_url: string | null;
  endpoints: string[];
  registered_at: string;
  updated_at: string | null;
  total_feedback: number;
  average_rating: number;
  composite_score: number;
  validation_success_rate: number;
  rank: number | null;
  tier: string;
  source_chain?: string;
}

interface AgentListResult {
  agents: Agent[];
  total: number;
  page: number;
  page_size: number;
}

interface UseAgentsOptions {
  category?: string;
  chain?: string;
  search?: string;
  tier?: string;
  sortBy?: string;
  order?: string;
  page?: number;
  pageSize?: number;
}

export function useAgents(options: UseAgentsOptions = {}) {
  const [data, setData] = useState<AgentListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<AgentListResult>("/agents", {
        params: {
          category: options.category,
          chain: options.chain,
          search: options.search,
          tier: options.tier,
          sort_by: options.sortBy,
          order: options.order,
          page: options.page,
          page_size: options.pageSize,
        },
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch agents");
    } finally {
      setLoading(false);
    }
  }, [options.category, options.chain, options.search, options.tier, options.sortBy, options.order, options.page, options.pageSize]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { data, loading, error, refetch: fetchAgents };
}

export function useAgent(agentId: number) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const result = await apiFetch<Agent>(`/agents/${agentId}`);
        setAgent(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch agent");
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [agentId]);

  return { agent, loading, error };
}
