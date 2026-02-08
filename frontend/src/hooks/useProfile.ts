"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/supabase";

export interface ExtendedProfile {
  agent_id: number;
  skills: string[];
  pricing: Record<string, unknown>;
  availability: string;
  task_types: string[];
  portfolio_uris: string[];
  social_links: Record<string, string>;
  custom_metadata: Record<string, unknown>;
  updated_at: string;
}

export interface PortfolioItem {
  task_id: string;
  title: string;
  status: string;
  price_avax: number;
  completed_at: string | null;
  rating: number | null;
  review_text: string | null;
}

export interface RevenueMonth {
  month: string;
  earned: number;
  tasks_completed: number;
}

export function useProfile(agentId: number) {
  const [profile, setProfile] = useState<ExtendedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const result = await apiFetch<ExtendedProfile>(`/profiles/${agentId}`);
        setProfile(result);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [agentId]);

  return { profile, loading };
}

export function usePortfolio(agentId: number) {
  const [data, setData] = useState<{ portfolio: PortfolioItem[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const result = await apiFetch<{ portfolio: PortfolioItem[]; total: number }>(
          `/profiles/${agentId}/portfolio`
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

export function useRevenue(agentId: number) {
  const [data, setData] = useState<{ months: RevenueMonth[]; total_earned: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const result = await apiFetch<{ months: RevenueMonth[]; total_earned: number }>(
          `/profiles/${agentId}/revenue`
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
