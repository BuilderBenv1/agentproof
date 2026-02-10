"use client";

import { useState } from "react";
import { Search, Shield, AlertTriangle, CheckCircle, Info } from "lucide-react";
import type { TrustEvaluation } from "@/lib/api";
import { getScoreColor, getTierColor } from "@/lib/constants";

const API = process.env.NEXT_PUBLIC_API_URL || "https://api.agent402.sh";

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-2 w-24 text-right">{label}</span>
      <div className="flex-1 bg-surface-2 rounded-full h-2">
        <div
          className="bg-primary rounded-full h-2 transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="text-xs text-white font-mono w-10 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function LookupPage() {
  const [agentId, setAgentId] = useState("");
  const [result, setResult] = useState<TrustEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLookup = async () => {
    if (!agentId.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`${API}/api/v1/trust/${agentId.trim()}`);
      if (res.status === 402) {
        setError(
          "This is a paid endpoint ($0.01 USDC via x402). Use the x402 Python SDK to query programmatically."
        );
        return;
      }
      if (res.status === 404) {
        setError(`Agent #${agentId} not found.`);
        return;
      }
      if (!res.ok) {
        setError(`API error: ${res.status}`);
        return;
      }
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Failed to connect to API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="font-sans text-3xl font-bold text-white">
          Trust Lookup
        </h1>
        <p className="text-muted mt-2">
          Query the trust score for any indexed AI agent
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-8">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-muted-3 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Enter agent ID (e.g. 42)"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            className="w-full bg-surface border border-surface-2 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-muted-3 font-mono text-sm focus:outline-none focus:border-primary/50"
          />
        </div>
        <button
          onClick={handleLookup}
          disabled={loading}
          className="bg-primary hover:bg-primary-light text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Lookup"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 text-sm text-danger flex items-start gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p>{error}</p>
            {error.includes("x402") && (
              <pre className="mt-3 text-xs bg-background p-3 rounded border border-surface-2 text-muted overflow-x-auto">
{`pip install x402[evm]
from x402.http.client import httpx_client
client = httpx_client(your_wallet)
r = client.get("${API}/api/v1/trust/${agentId}")
print(r.json())`}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Info banner */}
      {!result && !error && (
        <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 text-sm text-muted flex items-start gap-3">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
          <div>
            <p>
              Trust evaluations cost <strong className="text-white">$0.01 USDC</strong>{" "}
              via the x402 protocol. The browser preview may return a 402 — use the{" "}
              <code className="text-primary">x402</code> Python SDK for paid queries.
            </p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Header card */}
          <div className="bg-surface border border-surface-2 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-sans text-xl font-bold text-white">
                  {result.name || `Agent #${result.agent_id}`}
                </h2>
                <span className="text-xs text-muted font-mono">
                  ID: {result.agent_id}
                </span>
              </div>
              <span
                className={`text-xs px-3 py-1 rounded-full border font-mono uppercase ${getTierColor(
                  result.tier
                )}`}
              >
                {result.tier}
              </span>
            </div>

            <div className="flex items-end gap-2 mb-6">
              <span className={`text-5xl font-bold ${getScoreColor(result.composite_score)}`}>
                {result.composite_score}
              </span>
              <span className="text-muted text-sm mb-1">/ 100</span>
            </div>

            {/* Recommendation */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono ${
                result.recommendation === "TRUSTED"
                  ? "bg-success/10 text-success border border-success/30"
                  : result.recommendation === "HIGH_RISK"
                  ? "bg-danger/10 text-danger border border-danger/30"
                  : result.recommendation === "CAUTION"
                  ? "bg-warning/10 text-warning border border-warning/30"
                  : "bg-muted/10 text-muted border border-muted/30"
              }`}
            >
              {result.recommendation === "TRUSTED" ? (
                <CheckCircle className="w-4 h-4" />
              ) : result.recommendation === "HIGH_RISK" ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              {result.recommendation}
            </div>
          </div>

          {/* Score breakdown */}
          <div className="bg-surface border border-surface-2 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">
              Score Breakdown
            </h3>
            <div className="space-y-3">
              <ScoreBar label="Rating" value={result.score_breakdown.rating_score} />
              <ScoreBar label="Volume" value={result.score_breakdown.volume_score} />
              <ScoreBar label="Consistency" value={result.score_breakdown.consistency_score} />
              <ScoreBar label="Validation" value={result.score_breakdown.validation_score} />
              <ScoreBar label="Age" value={result.score_breakdown.age_score} />
              <ScoreBar label="Uptime" value={result.score_breakdown.uptime_score} />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-surface border border-surface-2 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">{result.feedback_count}</div>
              <div className="text-xs text-muted-2">Feedback</div>
            </div>
            <div className="bg-surface border border-surface-2 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">
                {result.average_rating.toFixed(1)}
              </div>
              <div className="text-xs text-muted-2">Avg Rating</div>
            </div>
            <div className="bg-surface border border-surface-2 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">
                {result.validation_success_rate.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-2">Validation</div>
            </div>
            <div className="bg-surface border border-surface-2 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">
                {result.account_age_days}d
              </div>
              <div className="text-xs text-muted-2">Age</div>
            </div>
          </div>

          {/* Risk flags */}
          {result.risk_flags.length > 0 && (
            <div className="bg-warning/5 border border-warning/20 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-warning mb-2">
                Risk Flags
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.risk_flags.map((flag) => (
                  <span
                    key={flag}
                    className="text-xs bg-warning/10 text-warning border border-warning/20 px-2 py-1 rounded font-mono"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
