"use client";

import Link from "next/link";
import { useState } from "react";
import { Zap, BarChart3, Shield, ArrowRight, Copy, CheckCircle, ExternalLink } from "lucide-react";

const ORACLE_URL = "https://oracle.agentproof.sh";

const TIERS = [
  {
    name: "Pay-per-call",
    slug: "paygo",
    perCall: "$0.05",
    monthly: "Usage-based",
    calls: "Unlimited",
    batch: 50,
    webhooks: 3,
    highlight: false,
    description: "No commitment. Pay only for what you use.",
  },
  {
    name: "Starter",
    slug: "starter",
    perCall: "$0.025",
    monthly: "$250",
    calls: "10,000",
    batch: 100,
    webhooks: 5,
    highlight: false,
    description: "For protocols starting to integrate trust scoring.",
  },
  {
    name: "Growth",
    slug: "growth",
    perCall: "$0.02",
    monthly: "$500",
    calls: "25,000",
    batch: 200,
    webhooks: 10,
    highlight: true,
    description: "Most popular for production protocols.",
  },
  {
    name: "Scale",
    slug: "scale",
    perCall: "$0.013",
    monthly: "$1,000",
    calls: "75,000",
    batch: 300,
    webhooks: 25,
    highlight: false,
    description: "High-volume integrations with priority support.",
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    perCall: "$0.01",
    monthly: "$2,000",
    calls: "200,000",
    batch: 500,
    webhooks: "Unlimited",
    highlight: false,
    description: "Maximum volume with dedicated support.",
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-gray-500 hover:text-emerald-400 transition-colors"
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Trust Scoring <span className="text-emerald-400">API</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Trust scores are free for everyone. No API key, no signup, no paywall.
            Batch evaluation, webhooks, and advanced features require an API key.
          </p>
        </div>

        {/* PPC highlight */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 mb-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-bold text-lg">Trust scores are free. No API key required.</span>
          </div>
          <p className="text-gray-400 text-sm">
            Query any agent&apos;s trust score instantly — no signup, no key, no paywall.
            Batch evaluation, webhooks, and advanced risk assessment require an API key.
            Subscription plans available for production-scale access.
          </p>
        </div>

        {/* Pricing Table */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-16">
          {TIERS.map((tier) => (
            <div
              key={tier.slug}
              className={`rounded-xl p-5 flex flex-col ${
                tier.highlight
                  ? "bg-emerald-500/10 border-2 border-emerald-500/40 relative"
                  : "bg-gray-900/40 border border-gray-800"
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                  Popular
                </span>
              )}
              <h3 className="text-white font-bold text-lg mb-1">{tier.name}</h3>
              <p className="text-gray-500 text-xs mb-4 min-h-[2.5rem]">{tier.description}</p>
              <div className="text-2xl font-bold text-white mb-1">{tier.monthly}</div>
              <div className="text-emerald-400 text-sm font-mono mb-4">{tier.perCall}/call</div>
              <div className="space-y-2 text-sm text-gray-400 mt-auto">
                <div className="flex justify-between"><span>Monthly calls</span><span className="text-white">{tier.calls}</span></div>
                <div className="flex justify-between"><span>Batch size</span><span className="text-white">{tier.batch}</span></div>
                <div className="flex justify-between"><span>Webhooks</span><span className="text-white">{tier.webhooks}</span></div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Start */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            Quick Start
          </h2>

          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">Query trust scores (free, no API key)</h3>
                <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 font-mono text-sm">
                  <div className="flex items-start justify-between">
                    <code className="text-emerald-400 whitespace-pre-wrap break-all">{`curl ${ORACLE_URL}/api/v1/trust/1380`}</code>
                    <CopyButton text={`curl ${ORACLE_URL}/api/v1/trust/1380`} />
                  </div>
                  <p className="text-gray-500 text-xs mt-2">
                    Returns: composite_score, tier, recommendation, risk_flags, score_breakdown. No signup required.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">Need batch, webhooks, or feedback? Get an API key</h3>
                <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 font-mono text-sm">
                  <div className="flex items-start justify-between">
                    <code className="text-emerald-400 whitespace-pre-wrap break-all">{`curl -X POST ${ORACLE_URL}/api/v1/integrations/register \\
  -H "Content-Type: application/json" \\
  -d '{"protocol_name": "My Protocol", "contact_email": "dev@example.com"}'`}</code>
                    <CopyButton text={`curl -X POST ${ORACLE_URL}/api/v1/integrations/register -H "Content-Type: application/json" -d '{"protocol_name": "My Protocol", "contact_email": "dev@example.com"}'`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">Gate by reputation</h3>
                <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 font-mono text-sm">
                  <code className="text-emerald-400 whitespace-pre-wrap">{`// Solidity — on-chain integration
ITrustScoreOracle oracle = ITrustScoreOracle(ORACLE_ADDRESS);
(uint16 score, uint8 tier, ) = oracle.getScore{value: oracle.queryFee()}(agentId);
require(tier >= 3, "Agent must be Gold or above");`}</code>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  TrustScoreOracle live on Avalanche and Base. On-chain queries cost 0.001 native token.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Integration options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-6">
            <Zap className="w-8 h-8 text-emerald-400 mb-3" />
            <h3 className="text-white font-bold mb-2">REST API</h3>
            <p className="text-gray-400 text-sm mb-3">
              Evaluate any agent with a single HTTP call. Batch endpoint for high-volume queries.
            </p>
            <Link href="/docs" className="text-emerald-400 text-sm flex items-center gap-1 hover:underline">
              API Docs <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-6">
            <Shield className="w-8 h-8 text-cyan-400 mb-3" />
            <h3 className="text-white font-bold mb-2">On-Chain Oracle</h3>
            <p className="text-gray-400 text-sm mb-3">
              TrustScoreOracle smart contract on Avalanche and Base. Read scores directly from your contracts.
            </p>
            <span className="text-gray-500 text-xs font-mono">
              AVAX: 0x62FE...8ad &middot; Base: 0x4E23...d5F
            </span>
          </div>
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-6">
            <BarChart3 className="w-8 h-8 text-purple-400 mb-3" />
            <h3 className="text-white font-bold mb-2">Webhooks</h3>
            <p className="text-gray-400 text-sm mb-3">
              Get notified when agent scores or tiers change. Real-time integration without polling.
            </p>
            <a
              href={`${ORACLE_URL}/integrate`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 text-sm flex items-center gap-1 hover:underline"
            >
              Full docs <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <a
            href={`${ORACLE_URL}/integrate`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-8 rounded-lg transition-colors"
          >
            Get API Key <ArrowRight className="w-4 h-4" />
          </a>
          <p className="text-gray-500 text-sm mt-3">
            Questions? <a href="mailto:team@agentproof.sh" className="text-emerald-400 hover:underline">team@agentproof.sh</a>
          </p>
        </div>
      </div>
    </div>
  );
}
