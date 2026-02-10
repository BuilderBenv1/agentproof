const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.agent402.sh";

export async function fetchAPI<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface NetworkStats {
  total_agents: number;
  avg_score: number;
  tier_distribution: Record<string, number>;
  total_feedback: number;
  total_screenings: number;
  total_payments: number;
}

export interface TrustEvaluation {
  agent_id: number;
  name: string | null;
  composite_score: number;
  tier: string;
  recommendation: string;
  risk_flags: string[];
  score_breakdown: {
    rating_score: number;
    volume_score: number;
    consistency_score: number;
    validation_score: number;
    age_score: number;
    uptime_score: number;
  };
  feedback_count: number;
  average_rating: number;
  validation_success_rate: number;
  account_age_days: number;
  uptime_pct: number;
  evaluated_at: string;
}

export interface TrustedAgent {
  agent_id: number;
  name: string | null;
  composite_score: number;
  tier: string;
  category: string | null;
  feedback_count: number;
}

export interface PaymentStats {
  total_payments: number;
  total_revenue_usd: number;
  unique_payers: number;
}

export interface PricingInfo {
  protocol: string;
  network: string;
  pay_to: string;
  facilitator: string;
  endpoints: Record<string, { price: string; description: string }>;
  free_endpoints: string[];
}
