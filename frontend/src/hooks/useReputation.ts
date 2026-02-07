"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/supabase";

interface Feedback {
  id: number;
  agent_id: number;
  reviewer_address: string;
  rating: number;
  feedback_uri: string | null;
  task_hash: string | null;
  tx_hash: string;
  block_number: number;
  created_at: string;
}

interface ScoreHistory {
  snapshot_date: string;
  composite_score: number;
  average_rating: number;
  total_feedback: number;
  validation_success_rate: number;
}

export function useFeedback(agentId: number, page = 1, pageSize = 20) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const result = await apiFetch<{ feedback: Feedback[]; total: number }>(
          `/agents/${agentId}/feedback`,
          { params: { page, page_size: pageSize } }
        );
        setFeedback(result.feedback);
        setTotal(result.total);
      } catch {
        setFeedback([]);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [agentId, page, pageSize]);

  return { feedback, total, loading };
}

export function useScoreHistory(agentId: number) {
  const [history, setHistory] = useState<ScoreHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const result = await apiFetch<{ history: ScoreHistory[] }>(
          `/agents/${agentId}/score-history`
        );
        setHistory(result.history);
      } catch {
        setHistory([]);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [agentId]);

  return { history, loading };
}

export function useOverview() {
  const [data, setData] = useState<{
    total_agents: number;
    total_feedback: number;
    total_validations: number;
    average_score: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const result = await apiFetch<typeof data>("/analytics/overview");
        setData(result);
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  return { data, loading };
}
