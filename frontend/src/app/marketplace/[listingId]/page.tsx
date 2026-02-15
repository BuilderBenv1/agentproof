"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/supabase";
import { Listing } from "@/hooks/useMarketplace";
import { MonitoringOverview } from "@/hooks/useMonitoring";
import { useHireAgent } from "@/hooks/useContract";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import SkillTag from "@/components/marketplace/SkillTag";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { ArrowLeft, DollarSign, Clock, Shield, Zap, Globe, Copy, CheckCircle, Loader2, AlertCircle, Lock } from "lucide-react";
import Link from "next/link";

export default function ListingDetailPage() {
  const params = useParams();
  const listingId = params.listingId as string;
  const { address, isConnected } = useAccount();
  const { hire, txHash, paymentId, isPending, isConfirming, isSuccess, statusText, error: hireError, reset: resetHire } = useHireAgent();

  const [listing, setListing] = useState<Listing | null>(null);
  const [agent, setAgent] = useState<Record<string, unknown> | null>(null);
  const [monitoring, setMonitoring] = useState<MonitoringOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [taskDesc, setTaskDesc] = useState("");
  const [showHireForm, setShowHireForm] = useState(false);

  useEffect(() => {
    async function fetch() {
      try {
        const result = await apiFetch<{ listing: Listing; agent: Record<string, unknown> }>(
          `/marketplace/listings/${listingId}`
        );
        setListing(result.listing);
        setAgent(result.agent);

        // Fetch monitoring endpoints for this agent
        if (result.agent?.agent_id) {
          try {
            const mon = await apiFetch<MonitoringOverview>(
              `/monitoring/agent/${result.agent.agent_id}`
            );
            setMonitoring(mon);
          } catch {
            // monitoring data is optional
          }
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [listingId]);

  // When on-chain payment succeeds, create the task in the backend
  useEffect(() => {
    if (isSuccess && listing && address && taskDesc) {
      apiFetch("/marketplace/tasks", {
        method: "POST",
        body: JSON.stringify({
          listing_id: listing.id,
          agent_id: listing.agent_id,
          client_address: address,
          title: `Hire: ${listing.title}`,
          description: taskDesc,
          price_avax: listing.price_avax || 0,
          payment_id: paymentId,
          tx_hash: txHash,
        }),
      }).catch(() => {
        // Task creation is best-effort — the on-chain escrow is the source of truth
      });
    }
  }, [isSuccess, listing, address, taskDesc, paymentId, txHash]);

  function copyEndpoint(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-gray-500">Listing not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-white"
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Marketplace
      </Link>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{listing.title}</h1>
            {agent && (
              <Link
                href={`/agents/${listing.agent_id}`}
                className="text-xs font-mono text-emerald-400 hover:underline mt-1 inline-block"
              >
                Agent #{listing.agent_id} — {(agent.name as string) || "Unknown"}
              </Link>
            )}
          </div>
          {listing.price_avax && (
            <div className="text-right">
              <p className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {listing.price_avax} AVAX
              </p>
              <p className="text-[10px] font-mono text-gray-500">{listing.price_type}</p>
            </div>
          )}
        </div>

        {listing.description && (
          <p className="text-sm text-gray-400">{listing.description}</p>
        )}

        {listing.skills.length > 0 && (
          <div>
            <p className="text-xs font-mono text-gray-500 uppercase mb-2">Skills</p>
            <div className="flex flex-wrap gap-2">
              {listing.skills.map((skill) => (
                <SkillTag key={skill} skill={skill} size="md" />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-800">
          <div>
            <p className="text-[10px] font-mono text-gray-500 uppercase">Min Tier</p>
            <p className="text-sm text-white mt-1 flex items-center gap-1">
              <Shield className="w-3 h-3 text-gray-400" />
              {listing.min_tier}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-gray-500 uppercase">Concurrent Tasks</p>
            <p className="text-sm text-white mt-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-gray-400" />
              {listing.max_concurrent_tasks}
            </p>
          </div>
          {listing.avg_completion_time_hours && (
            <div>
              <p className="text-[10px] font-mono text-gray-500 uppercase">Avg Time</p>
              <p className="text-sm text-white mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-gray-400" />
                ~{listing.avg_completion_time_hours}h
              </p>
            </div>
          )}
        </div>

        {/* Agent Endpoints */}
        {monitoring && monitoring.endpoints.length > 0 && (
          <div className="pt-2 border-t border-gray-800">
            <p className="text-xs font-mono text-gray-500 uppercase mb-3 flex items-center gap-1.5">
              <Globe className="w-3 h-3" />
              Call This Agent
            </p>
            <div className="space-y-2">
              {monitoring.endpoints.filter((ep) => ep.is_active).map((ep) => (
                <div
                  key={ep.id}
                  className="flex items-center gap-3 bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3"
                >
                  <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                    {ep.endpoint_type}
                  </span>
                  <code className="text-sm font-mono text-gray-300 truncate flex-1">
                    {ep.url}
                  </code>
                  <button
                    onClick={() => copyEndpoint(ep.url)}
                    className="text-gray-500 hover:text-emerald-400 transition-colors shrink-0"
                    title="Copy endpoint URL"
                  >
                    {copiedUrl === ep.url ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fallback: show raw endpoints from agent record when no monitoring data */}
        {(!monitoring || monitoring.endpoints.length === 0) && agent && Array.isArray(agent.endpoints) && (agent.endpoints as string[]).length > 0 && (
          <div className="pt-2 border-t border-gray-800">
            <p className="text-xs font-mono text-gray-500 uppercase mb-3 flex items-center gap-1.5">
              <Globe className="w-3 h-3" />
              Call This Agent
            </p>
            <div className="space-y-2">
              {(agent.endpoints as string[]).map((url, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3"
                >
                  <code className="text-sm font-mono text-gray-300 truncate flex-1">
                    {url}
                  </code>
                  <button
                    onClick={() => copyEndpoint(url)}
                    className="text-gray-500 hover:text-emerald-400 transition-colors shrink-0"
                    title="Copy endpoint URL"
                  >
                    {copiedUrl === url ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Hire Agent Section ─── */}
        <div className="pt-4 border-t border-gray-800">
          {!isConnected ? (
            <div className="text-center space-y-3">
              <p className="text-xs font-mono text-gray-500">Connect wallet to hire this agent</p>
              <ConnectButton />
            </div>
          ) : !showHireForm && !isSuccess ? (
            <button
              onClick={() => setShowHireForm(true)}
              className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              Hire Agent — {listing.price_avax} AVAX
            </button>
          ) : isSuccess ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <p className="text-sm font-bold text-emerald-400">Payment Escrowed</p>
              </div>
              <p className="text-xs text-gray-400">
                {listing.price_avax} AVAX locked in escrow. The agent will complete your task, then funds are released (0.5% protocol fee).
              </p>
              {paymentId !== null && (
                <p className="text-xs font-mono text-gray-500">Payment ID: #{paymentId}</p>
              )}
              {txHash && (
                <a
                  href={`https://snowtrace.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-emerald-400 hover:underline inline-block"
                >
                  View on Snowtrace
                </a>
              )}
              <button
                onClick={() => { resetHire(); setShowHireForm(false); setTaskDesc(""); }}
                className="text-xs text-gray-500 hover:text-white mt-2 block"
              >
                Hire again
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-gray-500 uppercase block mb-1.5">
                  Task Description
                </label>
                <textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Describe what you need this agent to do..."
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-emerald-500 focus:outline-none resize-none"
                  rows={3}
                  disabled={isPending || isConfirming}
                />
              </div>

              <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Price</span>
                  <span className="text-white">{listing.price_avax} AVAX</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Protocol fee</span>
                  <span className="text-gray-400">0.5%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Protection</span>
                  <span className="text-gray-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> 7-day escrow refund
                  </span>
                </div>
              </div>

              {hireError && (
                <div className="flex items-center gap-2 text-xs text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  {hireError.message}
                </div>
              )}

              {statusText && (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {statusText}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowHireForm(false); setTaskDesc(""); resetHire(); }}
                  className="px-4 py-2 text-xs font-mono text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors"
                  disabled={isPending || isConfirming}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!taskDesc.trim()) return;
                    hire(listing.agent_id, listing.price_avax || 0, taskDesc);
                  }}
                  disabled={!taskDesc.trim() || isPending || isConfirming}
                  className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {isPending || isConfirming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <DollarSign className="w-4 h-4" />
                  )}
                  {isPending ? "Confirm in Wallet" : isConfirming ? "Escrowing..." : `Pay ${listing.price_avax} AVAX`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
