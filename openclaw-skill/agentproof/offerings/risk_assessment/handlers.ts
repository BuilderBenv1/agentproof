/**
 * AgentProof Risk Assessment — ACP offering handler
 *
 * Queries the AgentProof oracle for a deep risk assessment: concentrated feedback,
 * score volatility, deployer reputation, failure history, and recommendation.
 */

const ORACLE_BASE = "https://oracle.agentproof.sh/api/v1";
const API_KEY = process.env.AGENTPROOF_API_KEY || "";

interface RiskAssessment {
  agent_id: number;
  risk_level: string;
  risk_score: number;
  flags: string[];
  recommendation: string;
  details: Record<string, any>;
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
  return `Deep risk assessment for agent #${request.agent_id} — deployer analysis, feedback concentration, score volatility, failure history`;
}

export async function executeJob(request: any): Promise<ExecuteJobResult> {
  const agentId = request.agent_id;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_KEY) {
    headers["X-Api-Key"] = API_KEY;
  }

  // Fetch both trust evaluation and risk check in parallel
  const [trustRes, riskRes, failuresRes] = await Promise.all([
    fetch(`${ORACLE_BASE}/trust/${agentId}`, { headers }),
    fetch(`${ORACLE_BASE}/trust/${agentId}/risk`, { headers }),
    fetch(`${ORACLE_BASE}/agents/${agentId}/failures?limit=10`, { headers }),
  ]);

  if (!trustRes.ok && trustRes.status === 404) {
    return {
      deliverable: `Agent #${agentId} not found in AgentProof. It may not be ERC-8004 registered or hasn't been indexed.`,
    };
  }

  const trust = trustRes.ok ? await trustRes.json() : null;
  const risk = riskRes.ok ? await riskRes.json() : null;
  const failures = failuresRes.ok ? await failuresRes.json() : null;

  const lines: string[] = [
    `AGENTPROOF RISK ASSESSMENT — Agent #${agentId}`,
    `${"=".repeat(50)}`,
  ];

  if (trust) {
    lines.push(
      `Name: ${trust.name || "Unknown"}`,
      `Composite Score: ${trust.composite_score}/100`,
      `Tier: ${trust.tier}`,
      `Recommendation: ${trust.recommendation}`,
      "",
    );
  }

  if (risk) {
    lines.push(
      `RISK LEVEL: ${risk.risk_level?.toUpperCase() || "UNKNOWN"}`,
      `Risk Score: ${risk.risk_score}/100`,
      "",
    );

    if (risk.flags?.length > 0) {
      lines.push("RISK FLAGS:");
      for (const flag of risk.flags) {
        lines.push(`  - ${flag}`);
      }
      lines.push("");
    } else {
      lines.push("No risk flags detected.", "");
    }

    if (risk.details) {
      lines.push("RISK DETAILS:");
      for (const [key, value] of Object.entries(risk.details)) {
        lines.push(`  ${key}: ${JSON.stringify(value)}`);
      }
      lines.push("");
    }
  }

  if (failures) {
    lines.push(
      `FAILURE HISTORY:`,
      `  Total failures: ${failures.failure_count || 0}`,
      `  Active failures: ${failures.active_failures || 0}`,
      `  MTTR: ${failures.mttr_seconds ? `${Math.round(failures.mttr_seconds / 60)} minutes` : "N/A"}`,
      "",
    );
  }

  // Decision guidance
  const score = trust?.composite_score ?? 0;
  const riskLevel = risk?.risk_level || "unknown";
  lines.push("DECISION GUIDANCE:");
  if (score >= 70 && riskLevel === "low") {
    lines.push("  Safe for high-value escrow and transactions.");
  } else if (score >= 50 && riskLevel !== "critical") {
    lines.push("  Acceptable for moderate transactions. Monitor closely.");
  } else if (score >= 30) {
    lines.push("  Proceed with caution. Low-value interactions only.");
  } else {
    lines.push("  NOT RECOMMENDED for any financial interaction without manual verification.");
  }

  lines.push("", `Source: https://agentproof.sh/agents/${agentId}`);

  return { deliverable: lines.join("\n") };
}
