"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity, TrendingUp, Shield, Eye, Zap, BarChart3,
  AlertTriangle, DollarSign, ArrowRight, Target,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import { intelligenceFetch } from "@/lib/intelligence";

interface GatewayHealth {
  status: string;
  agents: number;
  database: string;
}

interface YieldHealth {
  opportunities_tracked: number;
  avg_apy: number;
  best_risk_adjusted_apy: number;
}

interface WhaleHealth {
  wallets_tracked: number;
  transactions_today: number;
}

interface TipsterHealth {
  channels_active: number;
  signals_today: number;
}

const AGENTS = [
  {
    name: "Tipster",
    desc: "Parses Telegram alpha channels for trade signals, tracks accuracy on-chain",
    icon: <Zap className="w-5 h-5" />,
    color: "emerald",
    href: "/intelligence/tipster",
    endpoint: "/api/v1/tipster/health",
  },
  {
    name: "Whale Tracker",
    desc: "Monitors top 20 Avalanche wallets for significant token movements",
    icon: <Eye className="w-5 h-5" />,
    color: "cyan",
    href: "/intelligence/whale",
    endpoint: "/api/v1/whale/health",
  },
  {
    name: "Narrative",
    desc: "Analyzes social sentiment and trend momentum across crypto media",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "purple",
    href: "/intelligence/narrative",
    endpoint: "/api/v1/narrative/health",
  },
  {
    name: "Rug Auditor",
    desc: "Scans smart contracts for honeypots, ownership risks, and red flags",
    icon: <Shield className="w-5 h-5" />,
    color: "red",
    href: "/intelligence/auditor",
    endpoint: "/api/v1/auditor/health",
  },
  {
    name: "Liquidation Sentinel",
    desc: "Monitors Benqi & Aave positions approaching liquidation thresholds",
    icon: <AlertTriangle className="w-5 h-5" />,
    color: "yellow",
    href: "/intelligence/liquidation",
    endpoint: "/api/v1/liquidation/health",
  },
  {
    name: "Yield Oracle",
    desc: "Ranks DeFi yield opportunities by risk-adjusted returns across Avalanche",
    icon: <DollarSign className="w-5 h-5" />,
    color: "emerald",
    href: "/intelligence/yield",
    endpoint: "/api/v1/yield/health",
  },
  {
    name: "Convergence",
    desc: "Detects when 2+ agents independently flag the same token — multi-source signal",
    icon: <BarChart3 className="w-5 h-5" />,
    color: "orange",
    href: "/intelligence/convergence",
    endpoint: "/health",
  },
];

const colorMap: Record<string, string> = {
  emerald: "border-emerald-500/30 hover:border-emerald-500/50",
  cyan: "border-cyan-500/30 hover:border-cyan-500/50",
  purple: "border-purple-500/30 hover:border-purple-500/50",
  red: "border-red-500/30 hover:border-red-500/50",
  yellow: "border-yellow-500/30 hover:border-yellow-500/50",
  orange: "border-orange-500/30 hover:border-orange-500/50",
};

const iconColorMap: Record<string, string> = {
  emerald: "text-emerald-400 bg-emerald-500/10",
  cyan: "text-cyan-400 bg-cyan-500/10",
  purple: "text-purple-400 bg-purple-500/10",
  red: "text-red-400 bg-red-500/10",
  yellow: "text-yellow-400 bg-yellow-500/10",
  orange: "text-orange-400 bg-orange-500/10",
};

export default function IntelligencePage() {
  const [gateway, setGateway] = useState<GatewayHealth | null>(null);
  const [yieldData, setYieldData] = useState<YieldHealth | null>(null);
  const [whaleData, setWhaleData] = useState<WhaleHealth | null>(null);
  const [, setTipsterData] = useState<TipsterHealth | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      try {
        const health = await intelligenceFetch<GatewayHealth>("/health");
        setGateway(health);
      } catch { /* API offline */ }

      try {
        const y = await intelligenceFetch<YieldHealth>("/api/v1/yield/health");
        setYieldData(y);
      } catch {}

      try {
        const w = await intelligenceFetch<WhaleHealth>("/api/v1/whale/health");
        setWhaleData(w);
      } catch {}

      try {
        const t = await intelligenceFetch<TipsterHealth>("/api/v1/tipster/health");
        setTipsterData(t);
      } catch {}

      // Check all agent statuses
      const statuses: Record<string, string> = {};
      for (const agent of AGENTS) {
        try {
          const res = await intelligenceFetch<{ status: string }>(agent.endpoint);
          statuses[agent.name] = res.status === "ok" ? "live" : "degraded";
        } catch {
          statuses[agent.name] = "offline";
        }
      }
      setAgentStatuses(statuses);
    }
    load();
  }, []);

  return (
    <div className="space-y-12">
      {/* Header */}
      <section className="text-center py-10">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Activity className="w-7 h-7 text-emerald-400" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">
          Intelligence <span className="text-emerald-400">Network</span>
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          7 autonomous AI agents monitoring Avalanche DeFi in real-time.
          Every prediction is scored and proven on-chain via ERC-8004.
        </p>
      </section>

      {/* Live Stats */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Agents Live"
            value={gateway?.agents ?? "—"}
            sublabel={gateway?.database === "connected" ? "all systems go" : "checking..."}
          />
          <StatCard
            label="Yield Opportunities"
            value={yieldData?.opportunities_tracked ?? "—"}
            sublabel={yieldData ? `avg ${yieldData.avg_apy.toFixed(1)}% APY` : "loading"}
          />
          <StatCard
            label="Wallets Tracked"
            value={whaleData?.wallets_tracked ?? "—"}
            sublabel={whaleData ? `${whaleData.transactions_today} txns today` : "loading"}
          />
          <StatCard
            label="Best Risk-Adj APY"
            value={yieldData ? `${yieldData.best_risk_adjusted_apy.toFixed(1)}%` : "—"}
            sublabel="yield oracle pick"
          />
        </div>
      </section>

      {/* Agent Grid */}
      <section>
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          Agent Network
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map((agent) => {
            const status = agentStatuses[agent.name];
            return (
              <Link
                key={agent.name}
                href={agent.href}
                className={`bg-gray-900/50 border ${colorMap[agent.color]} rounded-xl p-5 transition-all hover:shadow-lg group`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconColorMap[agent.color]}`}>
                      {agent.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{agent.name}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {status === "live" && (
                      <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE
                      </span>
                    )}
                    {status === "degraded" && (
                      <span className="flex items-center gap-1.5 text-xs font-mono text-yellow-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                        DEGRADED
                      </span>
                    )}
                    {status === "offline" && (
                      <span className="flex items-center gap-1.5 text-xs font-mono text-red-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        OFFLINE
                      </span>
                    )}
                    {!status && (
                      <span className="text-xs font-mono text-gray-600">...</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">{agent.desc}</p>
                <div className="flex items-center text-xs font-mono text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  View Dashboard <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Quick Links */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/intelligence/yield"
          className="bg-gray-900/50 border border-emerald-500/20 rounded-xl p-6 hover:border-emerald-500/40 transition-all group"
        >
          <DollarSign className="w-6 h-6 text-emerald-400 mb-3" />
          <h3 className="font-bold text-white mb-1">Yield Opportunities</h3>
          <p className="text-xs text-gray-500">
            {yieldData?.opportunities_tracked ?? "—"} pools ranked by risk-adjusted APY
          </p>
        </Link>
        <Link
          href="/intelligence/convergence"
          className="bg-gray-900/50 border border-orange-500/20 rounded-xl p-6 hover:border-orange-500/40 transition-all group"
        >
          <BarChart3 className="w-6 h-6 text-orange-400 mb-3" />
          <h3 className="font-bold text-white mb-1">Convergence Signals</h3>
          <p className="text-xs text-gray-500">
            Multi-agent signals where 2+ agents agree on the same token
          </p>
        </Link>
        <Link
          href="/intelligence/whale"
          className="bg-gray-900/50 border border-cyan-500/20 rounded-xl p-6 hover:border-cyan-500/40 transition-all group"
        >
          <Eye className="w-6 h-6 text-cyan-400 mb-3" />
          <h3 className="font-bold text-white mb-1">Whale Movements</h3>
          <p className="text-xs text-gray-500">
            {whaleData?.wallets_tracked ?? "—"} wallets monitored for significant trades
          </p>
        </Link>
        <Link
          href="/intelligence/analytics"
          className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-6 hover:border-purple-500/40 transition-all group"
        >
          <Target className="w-6 h-6 text-purple-400 mb-3" />
          <h3 className="font-bold text-white mb-1">Agent Accuracy</h3>
          <p className="text-xs text-gray-500">
            Prediction accuracy and performance metrics across all agents
          </p>
        </Link>
      </section>
    </div>
  );
}
