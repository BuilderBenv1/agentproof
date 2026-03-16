/**
 * AgentProof Trust Check — ACP offering handler
 *
 * Queries the AgentProof oracle for a full trust evaluation of an ERC-8004 agent.
 * Returns composite score, tier, 10-signal breakdown, risk flags, and recommendation.
 */

const ORACLE_BASE = "https://oracle.agentproof.sh/api/v1";
const API_KEY = process.env.AGENTPROOF_API_KEY || "";

interface TrustEvaluation {
  agent_id: number;
  name: string;
  composite_score: number;
  tier: string;
  recommendation: string;
  risk_flags: string[];
  score_breakdown: Record<string, number | null>;
  feedback_count: number;
  average_rating: number;
  account_age_days: number;
  evaluated_at: string;
}

interface ExecuteJobResult {
  deliverable: string | { type: string; value: unknown };
}

export function validateRequirements(request: any): { valid: boolean; reason?: string } {
  const agentId = request?.agent_id;
  if (agentId === undefined || agentId === null) {
    return { valid: false, reason: "agent_id is required" };
  }
  if (typeof agentId !== "number" || agentId < 0 || !Number.isInteger(agentId)) {
    return { valid: false, reason: "agent_id must be a positive integer" };
  }
  return { valid: true };
}

export function requestPayment(request: any): string {
  const chain = request?.chain ? ` on ${request.chain}` : "";
  return `Trust evaluation for agent #${request.agent_id}${chain} — powered by AgentProof oracle (113K+ agents, 21 chains)`;
}

export async function executeJob(request: any): Promise<ExecuteJobResult> {
  const agentId = request.agent_id;
  const chain = request?.chain;

  let url = `${ORACLE_BASE}/trust/${agentId}`;
  if (chain) {
    url += `?chain=${encodeURIComponent(chain)}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_KEY) {
    headers["X-Api-Key"] = API_KEY;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 404) {
      return {
        deliverable: `Agent #${agentId} not found in the AgentProof registry. It may not be an ERC-8004 registered agent, or it hasn't been indexed yet.`,
      };
    }
    return {
      deliverable: `Failed to evaluate agent #${agentId}: ${response.status} ${body}`,
    };
  }

  const data: TrustEvaluation = await response.json();

  // Build a human-readable summary alongside the raw data
  const riskWarning =
    data.risk_flags.length > 0
      ? `\n\nRISK FLAGS: ${data.risk_flags.join(", ")}`
      : "\n\nNo risk flags detected.";

  const summary = [
    `AGENTPROOF TRUST EVALUATION — Agent #${data.agent_id}`,
    `Name: ${data.name || "Unknown"}`,
    `Composite Score: ${data.composite_score}/100`,
    `Tier: ${data.tier}`,
    `Recommendation: ${data.recommendation}`,
    `Feedback Count: ${data.feedback_count}`,
    `Average Rating: ${data.average_rating}`,
    `Account Age: ${data.account_age_days} days`,
    riskWarning,
    `\nScore Breakdown:`,
    ...Object.entries(data.score_breakdown)
      .filter(([_, v]) => v !== null)
      .map(([k, v]) => `  ${k}: ${v}`),
    `\nEvaluated at: ${data.evaluated_at}`,
    `Source: https://agentproof.sh/agents/${data.agent_id}`,
  ].join("\n");

  return { deliverable: summary };
}
