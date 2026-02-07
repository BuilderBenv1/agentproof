"use client";

import { useState, useEffect } from "react";
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/supabase";
import { TIERS } from "@/lib/constants";

interface InsuranceStats {
  total_staked_agents: number;
  total_staked_amount: number;
  total_claims: number;
  pending_claims: number;
  approved_claims: number;
  rejected_claims: number;
  resolution_rate: number;
}

interface InsuranceClaim {
  claim_id: number;
  agent_id: number;
  claimant_address: string;
  amount: number;
  status: string;
  filed_at: string;
  resolved_at: string | null;
  evidence_uri: string | null;
}

export default function InsurancePage() {
  const [stats, setStats] = useState<InsuranceStats | null>(null);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [claimsTotal, setClaimsTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [statsResult, claimsResult] = await Promise.all([
          apiFetch<InsuranceStats>("/insurance/stats"),
          apiFetch<{ claims: InsuranceClaim[]; total: number }>("/insurance/claims", {
            params: {
              status: statusFilter || undefined,
              page,
              page_size: 20,
            },
          }),
        ]);
        setStats(statsResult);
        setClaims(claimsResult.claims);
        setClaimsTotal(claimsResult.total);
      } catch {
        // API not available, use empty state
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [statusFilter, page]);

  const statCards = stats
    ? [
        { label: "Insured Agents", value: stats.total_staked_agents, icon: Shield },
        { label: "Total Staked", value: `${stats.total_staked_amount.toFixed(2)} AVAX`, icon: Shield },
        { label: "Total Claims", value: stats.total_claims, icon: AlertTriangle },
        { label: "Resolution Rate", value: `${stats.resolution_rate}%`, icon: CheckCircle },
      ]
    : [];

  function getStatusColor(status: string) {
    switch (status) {
      case "pending":
        return "text-yellow-400 bg-yellow-500/10";
      case "disputed":
        return "text-orange-400 bg-orange-500/10";
      case "approved":
        return "text-emerald-400 bg-emerald-500/10";
      case "rejected":
        return "text-red-400 bg-red-500/10";
      default:
        return "text-gray-400 bg-gray-500/10";
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "pending":
        return <Clock className="w-3.5 h-3.5" />;
      case "disputed":
        return <AlertTriangle className="w-3.5 h-3.5" />;
      case "approved":
        return <CheckCircle className="w-3.5 h-3.5" />;
      case "rejected":
        return <XCircle className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-400" />
          Insurance Pools
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Agent staking and claims — economic skin-in-the-game for AI agents
        </p>
      </div>

      {/* How it Works */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-3">How Insurance Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-emerald-400 font-mono font-bold">1. Stake</div>
            <p className="text-gray-400">
              Agent owners stake AVAX proportional to their tier. Higher reputation = lower required stake.
            </p>
          </div>
          <div className="space-y-1">
            <div className="text-emerald-400 font-mono font-bold">2. Claim</div>
            <p className="text-gray-400">
              If an agent fails a validated task, counterparties can file claims against the staked collateral.
            </p>
          </div>
          <div className="space-y-1">
            <div className="text-emerald-400 font-mono font-bold">3. Resolve</div>
            <p className="text-gray-400">
              Claims are reviewed and resolved. Approved claims pay out from the agent&apos;s stake.
            </p>
          </div>
        </div>
      </div>

      {/* Tier Minimums */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-mono text-gray-400 mb-3">MINIMUM STAKE BY TIER</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Object.entries(TIERS).map(([key, tier]) => {
            const stakeMap: Record<string, string> = {
              diamond: "0.05",
              platinum: "0.1",
              gold: "0.2",
              silver: "0.3",
              bronze: "0.5",
              unranked: "1.0",
            };
            return (
              <div key={key} className="text-center p-3 rounded-lg bg-gray-800/30 border border-gray-800">
                <div className="text-xs font-mono uppercase" style={{ color: tier.color }}>
                  {tier.label}
                </div>
                <div className="text-lg font-bold text-white mt-1">{stakeMap[key]} AVAX</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-mono">
                <card.icon className="w-3.5 h-3.5" />
                {card.label}
              </div>
              <div className="text-xl font-bold text-white mt-1">{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Claims List */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-mono text-gray-400">RECENT CLAIMS</h3>
          <div className="flex gap-2">
            {["", "pending", "disputed", "approved", "rejected"].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                  statusFilter === s
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                {s || "All"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 font-mono text-sm">Loading...</div>
        ) : claims.length === 0 ? (
          <div className="p-8 text-center text-gray-500 font-mono text-sm">No claims found</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {claims.map((claim) => (
              <div key={claim.claim_id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-gray-500">#{claim.claim_id}</span>
                  <div>
                    <Link
                      href={`/agents/${claim.agent_id}`}
                      className="text-sm font-mono text-white hover:text-emerald-400 transition-colors"
                    >
                      Agent #{claim.agent_id}
                    </Link>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">
                      {new Date(claim.filed_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-white">{claim.amount} AVAX</span>
                  <span
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono ${getStatusColor(
                      claim.status
                    )}`}
                  >
                    {getStatusIcon(claim.status)}
                    {claim.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {claimsTotal > 20 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg text-sm font-mono border border-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm font-mono text-gray-500">
            Page {page} of {Math.ceil(claimsTotal / 20)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= Math.ceil(claimsTotal / 20)}
            className="px-4 py-2 rounded-lg text-sm font-mono border border-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
