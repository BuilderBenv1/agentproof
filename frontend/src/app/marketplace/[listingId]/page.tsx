"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/supabase";
import { Listing } from "@/hooks/useMarketplace";
import { MonitoringOverview } from "@/hooks/useMonitoring";
import SkillTag from "@/components/marketplace/SkillTag";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { ArrowLeft, DollarSign, Clock, Shield, Zap, Globe, Copy, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function ListingDetailPage() {
  const params = useParams();
  const listingId = params.listingId as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [agent, setAgent] = useState<Record<string, unknown> | null>(null);
  const [monitoring, setMonitoring] = useState<MonitoringOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

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
      </div>
    </div>
  );
}
