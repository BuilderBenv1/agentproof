import type {
  Agent,
  AgentProfile,
  AgentListParams,
  AnalyticsOverview,
  BatchResult,
  CategoryStats,
  DeployerProfile,
  DiscoverParams,
  FeedbackEntry,
  InsuranceInfo,
  LeaderboardEntry,
  LeaderboardParams,
  MaxExposure,
  MonitoringOverview,
  Mover,
  NetworkStats,
  Paginated,
  ReputationSummary,
  RiskAssessment,
  ScoreSnapshot,
  TrendingAgent,
  TrustEvaluation,
  TrustedAgent,
  ValidationRecord,
} from "./types";

export interface AgentProofConfig {
  /** Your API key from https://agentproof.sh/integrate */
  apiKey: string;
  /** Base URL override (default: https://oracle.agentproof.sh/api/v1) */
  baseUrl?: string;
  /** Request timeout in ms (default: 15000) */
  timeout?: number;
}

function stripUndefined(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  return out;
}

export class AgentProof {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(config: AgentProofConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || "https://oracle.agentproof.sh/api/v1").replace(/\/+$/, "");
    this.timeout = config.timeout ?? 15_000;
  }

  private async request<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(stripUndefined(params))) {
        url.searchParams.set(k, v);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url.toString(), {
        headers: {
          "X-API-Key": this.apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new AgentProofError(res.status, body || res.statusText, path);
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AgentProofError(res.status, text || res.statusText, path);
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Trust (Oracle) ──────────────────────────────────────────

  /** Get a full trust evaluation for an agent (billable) */
  async evaluateTrust(agentId: number, chain?: string): Promise<TrustEvaluation> {
    return this.request<TrustEvaluation>(`/trust/${agentId}`, { chain });
  }

  /** Get a risk assessment for an agent (billable) */
  async riskCheck(agentId: number): Promise<RiskAssessment> {
    return this.request<RiskAssessment>(`/trust/${agentId}/risk`);
  }

  /** Get per-dimension trust scores for an agent (billable) */
  async dimensions(agentId: number, chain?: string): Promise<{ agent_id: number; dimensions: Record<string, unknown> }> {
    return this.request(`/trust/${agentId}/dimensions`, { chain });
  }

  /** Evaluate multiple agents in one request (billable, each agent counts as 1 call) */
  async batchEvaluate(agentIds: number[], chain?: string): Promise<BatchResult> {
    return this.post<BatchResult>("/trust/batch", { agent_ids: agentIds, chain });
  }

  /** Find trusted agents matching criteria (billable) */
  async findTrusted(params?: {
    category?: string;
    min_score?: number;
    min_feedback?: number;
    tier?: string;
    chain?: string;
    limit?: number;
  }): Promise<TrustedAgent[]> {
    return this.request<TrustedAgent[]>("/agents/trusted", params as Record<string, unknown>);
  }

  /** Get network-wide trust statistics (free) */
  async networkStats(): Promise<NetworkStats> {
    return this.request<NetworkStats>("/network/stats");
  }

  // ─── Agents ────────────────────────────────────────────────

  /** List agents with optional filters */
  async listAgents(params?: AgentListParams): Promise<Paginated<Agent>> {
    const r = await this.request<{ agents: Agent[]; total: number; page: number; page_size: number }>(
      "/agents",
      params as Record<string, unknown>,
    );
    return { data: r.agents, total: r.total, page: r.page, page_size: r.page_size };
  }

  /** Get full agent profile by ID */
  async getAgent(agentId: number, chain?: string): Promise<AgentProfile> {
    return this.request<AgentProfile>(`/agents/${agentId}`, { chain });
  }

  /** Get paginated feedback for an agent */
  async getAgentFeedback(agentId: number, page?: number, pageSize?: number): Promise<Paginated<FeedbackEntry>> {
    const r = await this.request<{ feedback: FeedbackEntry[]; total: number; page: number; page_size: number }>(
      `/agents/${agentId}/feedback`,
      { page, page_size: pageSize },
    );
    return { data: r.feedback, total: r.total, page: r.page, page_size: r.page_size };
  }

  /** Get paginated validations for an agent */
  async getAgentValidations(agentId: number, page?: number, pageSize?: number): Promise<Paginated<ValidationRecord>> {
    const r = await this.request<{ validations: ValidationRecord[]; total: number; page: number; page_size: number }>(
      `/agents/${agentId}/validations`,
      { page, page_size: pageSize },
    );
    return { data: r.validations, total: r.total, page: r.page, page_size: r.page_size };
  }

  /** Get score history snapshots for an agent */
  async getScoreHistory(agentId: number): Promise<ScoreSnapshot[]> {
    const r = await this.request<{ history: ScoreSnapshot[] }>(`/agents/${agentId}/score-history`);
    return r.history;
  }

  // ─── Discover ──────────────────────────────────────────────

  /** Full-text search with filters */
  async search(params?: DiscoverParams): Promise<Paginated<Agent>> {
    const r = await this.request<{ agents: Agent[]; total: number; page: number; page_size: number }>(
      "/discover/search",
      params as Record<string, unknown>,
    );
    return { data: r.agents, total: r.total, page: r.page, page_size: r.page_size };
  }

  /** Get trending agents */
  async trending(period?: "7d" | "30d", limit?: number): Promise<TrendingAgent[]> {
    const r = await this.request<{ trending: TrendingAgent[] }>("/discover/trending", { period, limit });
    return r.trending;
  }

  /** Get newest agents */
  async newest(limit?: number): Promise<Agent[]> {
    const r = await this.request<{ agents: Agent[] }>("/discover/new", { limit });
    return r.agents;
  }

  /** Find similar agents */
  async similar(agentId: number, limit?: number): Promise<Agent[]> {
    const r = await this.request<{ similar_agents: Agent[] }>(`/discover/similar/${agentId}`, { limit });
    return r.similar_agents;
  }

  /** Compare 2-5 agents side by side */
  async compare(agentIds: number[]): Promise<Agent[]> {
    const r = await this.request<{ agents: Agent[] }>("/discover/compare", { agents: agentIds.join(",") });
    return r.agents;
  }

  /** Get per-category statistics */
  async categoryStats(): Promise<CategoryStats[]> {
    const r = await this.request<{ categories: CategoryStats[] }>("/discover/categories/stats");
    return r.categories;
  }

  // ─── Reputation ────────────────────────────────────────────

  /** Get reputation summary for an agent */
  async reputationSummary(agentId: number): Promise<ReputationSummary> {
    return this.request<ReputationSummary>(`/reputation/${agentId}/summary`);
  }

  /** Get reputation history */
  async reputationHistory(agentId: number, limit?: number): Promise<ScoreSnapshot[]> {
    const r = await this.request<{ history: ScoreSnapshot[] }>(`/reputation/${agentId}/history`, { limit });
    return r.history;
  }

  /** Get deployer reputation profile */
  async deployerProfile(address: string): Promise<DeployerProfile> {
    return this.request<DeployerProfile>(`/reputation/deployer/${address}`);
  }

  /** Get max exposure (insurance ceiling) for an agent */
  async maxExposure(agentId: number): Promise<MaxExposure> {
    return this.request<MaxExposure>(`/reputation/${agentId}/max-exposure`);
  }

  // ─── Leaderboard ───────────────────────────────────────────

  /** Get ranked leaderboard */
  async leaderboard(params?: LeaderboardParams): Promise<Paginated<LeaderboardEntry>> {
    const r = await this.request<{ entries: LeaderboardEntry[]; total: number; page: number; page_size: number }>(
      "/leaderboard",
      params as Record<string, unknown>,
    );
    return { data: r.entries, total: r.total, page: r.page, page_size: r.page_size };
  }

  /** Get biggest score movers */
  async movers(period?: "7d" | "30d", limit?: number): Promise<{ risers: Mover[]; fallers: Mover[] }> {
    return this.request<{ risers: Mover[]; fallers: Mover[] }>("/leaderboard/movers", { period, limit });
  }

  // ─── Analytics ─────────────────────────────────────────────

  /** Get ecosystem overview stats */
  async overview(): Promise<AnalyticsOverview> {
    return this.request<AnalyticsOverview>("/analytics/overview");
  }

  /** Get registration/feedback trends over time */
  async trends(period?: "7d" | "30d" | "90d"): Promise<{
    registrations: Record<string, number>;
    feedback: Record<string, number>;
    validations: Record<string, number>;
  }> {
    return this.request("/analytics/trends", { period });
  }

  // ─── Monitoring ────────────────────────────────────────────

  /** Get uptime monitoring overview for an agent */
  async monitoring(agentId: number): Promise<MonitoringOverview> {
    return this.request<MonitoringOverview>(`/monitoring/agent/${agentId}`);
  }

  // ─── Insurance ─────────────────────────────────────────────

  /** Get insurance status for an agent */
  async insurance(agentId: number): Promise<InsuranceInfo> {
    return this.request<InsuranceInfo>(`/insurance/agent/${agentId}`);
  }
}

export class AgentProofError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string,
  ) {
    super(`AgentProof API error ${status} on ${path}: ${body}`);
    this.name = "AgentProofError";
  }
}
