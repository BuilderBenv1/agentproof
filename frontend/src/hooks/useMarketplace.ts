"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/supabase";

export interface Listing {
  id: number;
  agent_id: number;
  title: string;
  description: string | null;
  skills: string[];
  price_avax: number | null;
  price_type: string;
  min_tier: string;
  is_active: boolean;
  max_concurrent_tasks: number;
  avg_completion_time_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceTask {
  id: number;
  task_id: string;
  listing_id: number | null;
  agent_id: number;
  client_address: string;
  title: string;
  description: string | null;
  status: string;
  price_avax: number;
  deadline: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface MarketplaceStats {
  total_listings: number;
  active_listings: number;
  total_tasks: number;
  completed_tasks: number;
  total_volume_avax: number;
  average_task_price: number;
}

interface UseListingsOptions {
  skill?: string;
  maxPrice?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useListings(options: UseListingsOptions = {}) {
  const [data, setData] = useState<{ listings: Listing[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ listings: Listing[]; total: number }>(
        "/marketplace/listings",
        {
          params: {
            skill: options.skill,
            max_price: options.maxPrice,
            search: options.search,
            page: options.page,
            page_size: options.pageSize,
          },
        }
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch listings");
    } finally {
      setLoading(false);
    }
  }, [options.skill, options.maxPrice, options.search, options.page, options.pageSize]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  return { data, loading, error, refetch: fetchListings };
}

export function useMarketplaceStats() {
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const result = await apiFetch<MarketplaceStats>("/marketplace/stats");
        setStats(result);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  return { stats, loading };
}

export function useTask(taskId: string) {
  const [data, setData] = useState<{ task: MarketplaceTask } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const result = await apiFetch<{ task: MarketplaceTask }>(`/marketplace/tasks/${taskId}`);
        setData(result);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [taskId]);

  return { data, loading };
}
