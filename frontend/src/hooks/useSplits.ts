"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/supabase";

export interface Split {
  id: number;
  split_id: number;
  creator_agent_id: number;
  agent_ids: number[];
  shares_bps: number[];
  is_active: boolean;
  created_at: string;
  tx_hash: string;
}

export interface SplitPayment {
  id: number;
  split_payment_id: number;
  split_id: number;
  amount: number;
  token_address: string;
  payer_address: string;
  distributed: boolean;
  created_at: string;
  distributed_at: string | null;
}

export function useAgentSplits(agentId: number) {
  const [data, setData] = useState<{ splits: Split[]; total_split_revenue: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const result = await apiFetch<{ splits: Split[]; total_split_revenue: number }>(
          `/splits/agent/${agentId}`
        );
        setData(result);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [agentId]);

  return { data, loading };
}

export function useSplitDetail(splitId: number) {
  const [data, setData] = useState<{ split: Split; participants: Array<{ agent_id: number; name: string; tier: string }> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const result = await apiFetch<typeof data>(`/splits/${splitId}`);
        setData(result);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [splitId]);

  return { data, loading };
}
