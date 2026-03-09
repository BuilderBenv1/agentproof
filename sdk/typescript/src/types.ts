// ─── Public response types ─────────────────────────────────────
// These types represent the data returned by the AgentProof API.
// No internal scoring logic, oracle methodology, or proprietary
// algorithms are exposed through these interfaces.

export interface Agent {
  agent_id: number;
  name: string | null;
  description: string | null;
  category: string;
  composite_score: number;
  total_feedback: number;
  tier: string;
  image_url: string | null;
  registered_at: string;
  source_chain?: string;
  owner_address?: string;
  endpoints?: string[];
  autonomy_level?: string | null;
  financial_access?: string | null;
  open_source?: boolean | null;
  audited_by?: string[] | null;
  supported_protocols?: string[] | null;
}

export interface AgentProfile extends Agent {
  average_rating: number;
  validation_success_rate: number;
  rank: number | null;
  feedback_count: number;
  validation_count: number;
  score_trajectory?: {
    delta_7d: number | null;
    delta_30d: number | null;
    trend: "rising" | "falling" | "stable" | "new";
  };
  max_exposure_usd?: number;
  coverage_tier?: string;
  insurable?: boolean;
  cross_chain_agents?: {
    agent_id: number;
    name: string | null;
    source_chain: string;
    composite_score: number;
    tier: string;
  }[];
}

export interface TrendingAgent extends Agent {
  recent_feedback_count: number;
}

export interface FeedbackEntry {
  id: number;
  agent_id: number;
  reviewer_address: string;
  rating: number;
  feedback_uri: string | null;
  task_hash: string | null;
  tag1: string | null;
  tag2: string | null;
  tx_hash: string;
  created_at: string;
}

export interface ValidationRecord {
  id: number;
  validation_id: number;
  agent_id: number;
  task_hash: string;
  requester_address: string;
  validator_address: string | null;
  is_valid: boolean | null;
  requested_at: string;
  validated_at: string | null;
}

export interface ReputationSummary {
  agent_id: number;
  average_rating: number;
  composite_score: number;
  total_feedback: number;
  validation_success_rate: number;
  tier: string;
  rank: number | null;
  rating_distribution: Record<string, number>;
  total_ratings: number;
}

export interface ScoreSnapshot {
  composite_score: number;
  snapshot_date: string;
}

export interface LeaderboardEntry {
  agent_id: number;
  name: string | null;
  category: string;
  composite_score: number;
  tier: string;
  rank: number;
  leaderboard_rank: number;
  delta_7d: number | null;
  trend: string | null;
  total_feedback: number;
  source_chain?: string;
}

export interface Mover {
  agent_id: number;
  name: string | null;
  category: string;
  tier: string;
  current_score: number;
  previous_score: number;
  change: number;
  direction: string;
}

export interface AnalyticsOverview {
  total_agents: number;
  total_feedback: number;
  total_validations: number;
  total_liveness: number;
  average_score: number;
  category_breakdown: Record<string, number>;
  tier_distribution: Record<string, number>;
  chain_breakdown: Record<string, number>;
  protocol_breakdown: Record<string, number>;
}

export interface DeployerProfile {
  deployer: {
    owner_address: string;
    deployer_score: number;
    total_agents: number;
    abandoned_agents: number;
  };
  label: string;
  agents: Agent[];
}

export interface MaxExposure {
  agent_id: number;
  max_exposure_usd: number;
  note: string;
}

export interface MonitoringOverview {
  agent_id: number;
  uptime_pct: number;
  avg_latency_ms: number;
  total_checks: number;
}

export interface InsuranceInfo {
  agent_id: number;
  is_insured: boolean;
  total_claims: number;
}

export interface CategoryStats {
  category: string;
  agent_count: number;
  avg_score: number;
  total_feedback: number;
  tier_distribution: Record<string, number>;
}

// ─── Oracle trust evaluation types ────────────────────────────

export interface ScoreBreakdown {
  rating_score: number;
  volume_score: number;
  consistency_score: number;
  validation_score: number;
  age_score: number;
  uptime_score: number;
  deployer_score: number;
  uri_stability_score: number;
  coding_score: number | null;
  job_score: number | null;
  delegation_score: number | null;
}

export interface TrustEvaluation {
  agent_id: number;
  name: string | null;
  composite_score: number;
  tier: string;
  recommendation: "TRUSTED" | "CAUTION" | "HIGH_RISK" | "UNVERIFIED";
  risk_flags: string[];
  score_breakdown: ScoreBreakdown;
  feedback_count: number;
  average_rating: number;
  validation_success_rate: number;
  account_age_days: number;
  uptime_pct: number;
  evaluated_at: string;
  scoped_scores: Record<string, { score: number; count: number; avg_rating: number }> | null;
  delegation_success_rate: number | null;
  delegation_count: number;
  failure_count: number;
  mttr_seconds: number | null;
  last_failure_at: string | null;
  /** ERC-8183 job completion rate (0-100), null if no job data */
  job_completion_rate: number | null;
  /** Total ERC-8183 jobs as provider */
  job_count: number;
}

export interface RiskAssessment {
  agent_id: number;
  recommendation: string;
  risk_flags: string[];
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: Record<string, unknown>;
}

export interface TrustedAgent {
  agent_id: number;
  name: string | null;
  composite_score: number;
  tier: string;
  category: string;
  feedback_count: number;
  source_chain: string | null;
}

export interface NetworkStats {
  total_agents: number;
  avg_score: number;
  tier_distribution: Record<string, number>;
  total_feedback: number;
  total_validations: number;
  total_liveness: number;
}

export interface BatchResult {
  evaluations: TrustEvaluation[];
  errors: { agent_id: number; error: string }[] | null;
  count: number;
}

// ─── ERC-8183 Hook gate check types ────────────────────────────

export interface HookGateCheck {
  agent_id: number;
  address: string;
  allowed: boolean;
  score: number;
  tier: string;
  tier_num: number;
  score_age_seconds: number;
  checks: {
    registered: boolean;
    scored: boolean;
    score_meets_minimum: boolean;
    tier_meets_minimum: boolean;
    score_fresh: boolean;
  };
  hook_config: {
    min_score: number;
    min_tier: number;
    max_score_age: number;
  };
  rejection_reason: string | null;
}

export interface AddressResolution {
  address: string;
  agent_id: number;
  score: number;
  tier: string;
  tier_num: number;
  updated_at: string;
}

// ─── Query parameter types ─────────────────────────────────────

export interface AgentListParams {
  category?: string;
  chain?: string;
  search?: string;
  tier?: string;
  sort_by?: "composite_score" | "registered_at" | "total_feedback";
  order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface DiscoverParams {
  q?: string;
  category?: string;
  tier?: string;
  chain?: string;
  min_score?: number;
  open_source?: string;
  audited?: string;
  autonomy_level?: string;
  financial_access?: string;
  sort?: "score" | "newest" | "most_reviewed" | "relevance";
  page?: number;
  page_size?: number;
}

export interface LeaderboardParams {
  category?: string;
  chain?: string;
  tier?: string;
  time_range?: "all" | "30d" | "7d";
  page?: number;
  page_size?: number;
}

// ─── Paginated response wrapper ────────────────────────────────

export interface Paginated<T> {
  total: number;
  page: number;
  page_size: number;
  data: T[];
}
