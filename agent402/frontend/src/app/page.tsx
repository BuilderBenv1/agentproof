"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Zap,
  DollarSign,
  Search,
  ArrowRight,
  CheckCircle,
  Activity,
  Users,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import type { NetworkStats, PaymentStats } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "https://api.agent402.sh";

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
}) {
  return (
    <div className="bg-surface border border-surface-2 rounded-lg p-5 text-center">
      <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-muted-2 mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function StepCard({
  num,
  title,
  desc,
}: {
  num: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {num}
      </div>
      <div>
        <div className="font-semibold text-white">{title}</div>
        <div className="text-sm text-muted mt-1">{desc}</div>
      </div>
    </div>
  );
}

function PriceCard({
  endpoint,
  price,
  desc,
  free,
}: {
  endpoint: string;
  price: string;
  desc: string;
  free?: boolean;
}) {
  return (
    <div className="bg-surface border border-surface-2 rounded-lg p-4 hover:border-primary/30 transition-colors">
      <div className="font-mono text-primary font-semibold text-sm">{endpoint}</div>
      <div className="mt-2">
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            free
              ? "bg-success/10 text-success border border-success/30"
              : "bg-primary/10 text-primary border border-primary/30"
          }`}
        >
          {price}
        </span>
      </div>
      <div className="text-xs text-muted mt-2">{desc}</div>
    </div>
  );
}

export default function Home() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [payments, setPayments] = useState<PaymentStats | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/network/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
    fetch(`${API}/api/v1/payments/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setPayments)
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4">
      {/* Hero */}
      <section className="text-center py-16 md:py-24">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-mono mb-6">
          <Zap className="w-3 h-3" /> x402 Protocol &middot; USDC on Base &middot;
          $0.01/call
        </div>
        <h1 className="font-sans text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
          Pay-Per-Use Trust Oracle
          <br />
          <span className="text-primary">for AI Agents</span>
        </h1>
        <p className="text-muted text-lg mt-4 max-w-2xl mx-auto">
          Transparent reputation scores, risk assessments, and trust evaluations.
          Query any agent for $0.01 USDC — verified on-chain via x402 micropayments.
        </p>
        <div className="flex gap-3 justify-center mt-8">
          <a
            href="/lookup"
            className="bg-primary hover:bg-primary-light text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
          >
            <Search className="w-4 h-4" /> Look Up Agent
          </a>
          <a
            href="/docs"
            className="bg-surface border border-surface-2 hover:border-primary/30 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
          >
            API Docs <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Live Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-16">
        <StatCard
          icon={Users}
          value={stats ? stats.total_agents.toLocaleString() : "—"}
          label="Agents Indexed"
        />
        <StatCard
          icon={Activity}
          value={stats ? stats.avg_score.toFixed(1) : "—"}
          label="Avg Trust Score"
        />
        <StatCard
          icon={MessageSquare}
          value={stats ? stats.total_feedback.toLocaleString() : "—"}
          label="Total Feedback"
        />
        <StatCard
          icon={CreditCard}
          value={payments ? payments.total_payments.toLocaleString() : "0"}
          label="x402 Payments"
        />
      </section>

      {/* How It Works */}
      <section className="mb-16">
        <h2 className="font-sans text-2xl font-bold text-white mb-8 text-center">
          How It Works
        </h2>
        <div className="bg-surface border border-surface-2 rounded-xl p-6 md:p-8 space-y-6">
          <StepCard
            num={1}
            title="Request"
            desc="Call any premium endpoint (e.g. /api/v1/trust/42). Get a 402 Payment Required response with USDC payment instructions."
          />
          <StepCard
            num={2}
            title="Sign"
            desc="Your wallet signs a USDC transfer on Base. The x402 SDK handles this automatically — one line of code."
          />
          <StepCard
            num={3}
            title="Pay & Receive"
            desc="Retry with the payment proof. Coinbase verifies and settles on-chain. You get the trust evaluation instantly."
          />
        </div>
      </section>

      {/* Code Example */}
      <section className="mb-16">
        <h2 className="font-sans text-2xl font-bold text-white mb-8 text-center">
          Three Lines of Code
        </h2>
        <div className="bg-surface border border-surface-2 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-2">
            <div className="w-3 h-3 rounded-full bg-danger/50" />
            <div className="w-3 h-3 rounded-full bg-warning/50" />
            <div className="w-3 h-3 rounded-full bg-success/50" />
            <span className="text-xs text-muted-3 ml-2 font-mono">client.py</span>
          </div>
          <pre className="p-4 md:p-6 text-sm overflow-x-auto">
            <code className="text-muted">
              <span className="text-primary">from</span>{" "}
              <span className="text-white">x402.http.client</span>{" "}
              <span className="text-primary">import</span>{" "}
              <span className="text-white">httpx_client</span>
              {"\n"}
              <span className="text-primary">from</span>{" "}
              <span className="text-white">eth_account</span>{" "}
              <span className="text-primary">import</span>{" "}
              <span className="text-white">Account</span>
              {"\n\n"}
              <span className="text-muted-2"># Your Base wallet (has USDC)</span>
              {"\n"}
              <span className="text-white">wallet</span>{" "}
              <span className="text-muted">=</span>{" "}
              <span className="text-white">Account.from_key</span>
              <span className="text-muted">(</span>
              <span className="text-success">&quot;0x...&quot;</span>
              <span className="text-muted">)</span>
              {"\n\n"}
              <span className="text-muted-2"># That&apos;s it. x402 handles payment automatically.</span>
              {"\n"}
              <span className="text-white">client</span>{" "}
              <span className="text-muted">=</span>{" "}
              <span className="text-white">httpx_client</span>
              <span className="text-muted">(</span>
              <span className="text-white">wallet</span>
              <span className="text-muted">)</span>
              {"\n"}
              <span className="text-white">resp</span>{" "}
              <span className="text-muted">=</span>{" "}
              <span className="text-white">client.get</span>
              <span className="text-muted">(</span>
              <span className="text-success">&quot;https://api.agent402.sh/api/v1/trust/42&quot;</span>
              <span className="text-muted">)</span>
              {"\n\n"}
              <span className="text-primary">print</span>
              <span className="text-muted">(</span>
              <span className="text-white">resp.json</span>
              <span className="text-muted">())</span>
              {"\n"}
              <span className="text-muted-2">
                {"# "}&#123;&quot;agent_id&quot;: 42, &quot;composite_score&quot;: 87.3,
                &quot;tier&quot;: &quot;platinum&quot;, ...&#125;
              </span>
            </code>
          </pre>
        </div>
      </section>

      {/* Pricing Grid */}
      <section className="mb-16" id="pricing">
        <h2 className="font-sans text-2xl font-bold text-white mb-8 text-center">
          Endpoints & Pricing
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PriceCard
            endpoint="/api/v1/trust/{id}"
            price="$0.01 USDC"
            desc="Full trust evaluation — composite score, tier, risk flags, score breakdown"
          />
          <PriceCard
            endpoint="/api/v1/trust/{id}/risk"
            price="$0.01 USDC"
            desc="Risk assessment with concentrated-feedback detection and volatility checks"
          />
          <PriceCard
            endpoint="/api/v1/agents/trusted"
            price="$0.01 USDC"
            desc="Search agents by category, score, tier, and feedback count"
          />
          <PriceCard
            endpoint="/api/v1/network/stats"
            price="$0.005 USDC"
            desc="Network-wide statistics, tier distribution, payment totals"
          />
          <PriceCard
            endpoint="/api/v1/health"
            price="FREE"
            desc="Health check"
            free
          />
          <PriceCard
            endpoint="/api/v1/pricing"
            price="FREE"
            desc="Machine-readable pricing for x402 clients"
            free
          />
          <PriceCard
            endpoint="/.well-known/agent.json"
            price="FREE"
            desc="A2A agent card for discovery"
            free
          />
          <PriceCard
            endpoint="/api/v1/payments/stats"
            price="FREE"
            desc="Payment statistics and revenue"
            free
          />
        </div>
      </section>

      {/* Protocols */}
      <section className="mb-16">
        <h2 className="font-sans text-2xl font-bold text-white mb-8 text-center">
          Protocol Support
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface border border-surface-2 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-primary" />
              <span className="font-semibold text-white">REST API + x402</span>
            </div>
            <p className="text-sm text-muted">
              Standard JSON endpoints. Premium routes return 402 with USDC payment
              instructions. Any HTTP client works.
            </p>
            <div className="mt-3 font-mono text-xs text-primary">/api/v1/*</div>
          </div>
          <div className="bg-surface border border-surface-2 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-success" />
              <span className="font-semibold text-white">A2A Protocol</span>
            </div>
            <p className="text-sm text-muted">
              Google Agent-to-Agent protocol. Discover via agent card, query via JSON-RPC.
              Built for AI-to-AI communication.
            </p>
            <div className="mt-3 font-mono text-xs text-success">
              /.well-known/agent.json
            </div>
          </div>
          <div className="bg-surface border border-surface-2 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-warning" />
              <span className="font-semibold text-white">x402 Payment</span>
            </div>
            <p className="text-sm text-muted">
              Coinbase x402 protocol. USDC micropayments on Base. Facilitator-verified,
              settled on-chain. No API keys needed.
            </p>
            <div className="mt-3 font-mono text-xs text-warning">USDC on Base</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-12 mb-8">
        <div className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-xl p-8">
          <h2 className="font-sans text-2xl font-bold text-white">
            Start querying in 30 seconds
          </h2>
          <p className="text-muted mt-2 max-w-xl mx-auto">
            No API keys. No signup. Just USDC and a wallet. pip install x402 and
            go.
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <a
              href="/docs"
              className="bg-primary hover:bg-primary-light text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors"
            >
              Read the Docs
            </a>
            <a
              href="/leaderboard"
              className="bg-surface border border-surface-2 hover:border-primary/30 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors"
            >
              View Leaderboard
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
