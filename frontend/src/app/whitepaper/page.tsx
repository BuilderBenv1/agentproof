"use client";

import { FileText, Download, ExternalLink, Shield, Globe, Lock, AlertTriangle, BarChart3, Activity } from "lucide-react";
import Link from "next/link";

const SECTIONS = [
  { title: "The Crisis of Static Trust", description: "Why scalar reputation systems fail in high-speed agent economies: scalar blindness, exit scams, Sybil vulnerability, binary thinking, and agent-specific behavioural patterns." },
  { title: "The Evidence", description: "Stanford, Harvard, NIST, Google, CrowdStrike, WTW, and Box CEO Aaron Levie — the academic, government, and enterprise case for a trust oracle." },
  { title: "ERC-8004 Standard", description: "The on-chain identity and reputation standard. Three registries — Identity, Reputation, Validation — deployed across 21 chains via deterministic CREATE2." },
  { title: "Trust Oracle Architecture", description: "Three-layer system: indexing (21 chains, 54K+ agents), evaluation (10-signal composite scoring), and on-chain feedback loop." },
  { title: "Scoring Methodology", description: "10-signal composite scoring with Bayesian smoothing: rating, volume, consistency, validation, age, uptime, deployer reputation, URI stability, coding reputation, and delegation tracking." },
  { title: "Risk Detection System", description: "12 risk flags, 4 risk levels (LOW/MEDIUM/HIGH/CRITICAL), volatility detection, and max-exposure dollar ceilings for insurance underwriting." },
  { title: "Anti-Identity-Mutation", description: "Freshness penalties, deployer lineage tracking, and URI mutation detection to make identity abandonment economically irrational." },
  { title: "Multi-Chain Indexing", description: "21 chains — Avalanche, Ethereum, Base, Linea, Polygon, Arbitrum, Optimism, BNB Smart Chain, Scroll, Gnosis, Mantle, Celo, Monad, Abstract, Taiko, MegaETH, SKALE, X Layer, Soneium, Metis, and Solana." },
  { title: "Sybil Resistance", description: "Bayesian smoothing (k=3), feedback diversity weighting, temporal consistency, deployer reputation tracking, and anomaly monitoring." },
  { title: "Protocol Endpoints", description: "REST API with tiered pricing, A2A agent-to-agent protocol, MCP server for Claude/GPT, webhooks, batch evaluation, and SDK." },
  { title: "Insurance & Max Exposure", description: "Dollar-denominated trust ceilings for underwriting. Confidence multipliers, age bonuses, validation bonuses. The actuarial bridge between on-chain reputation and real-world coverage." },
  { title: "Monetization", description: "Tiered API access: Pay-as-you-go ($0.05/call), Starter ($250/mo), Growth ($500/mo), Scale ($1K/mo), Enterprise ($2K/mo). Rate limiting, API key gating, usage tracking." },
  { title: "Roadmap", description: "Multi-oracle consensus, TEE + staking validation, context-aware per-skill trust scores, and the full insurance marketplace." },
];

export default function WhitepaperPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-mono text-emerald-400">Technical Whitepaper v2.0</span>
        </div>
        <h1 className="text-3xl font-bold text-white">
          The Trust Oracle for the ERC-8004 Agent Economy
        </h1>
        <p className="text-sm text-gray-400 max-w-xl mx-auto">
          Scalar reputation systems are failing the agent economy. AgentProof replaces static
          scores with adaptive, probabilistic trust &mdash; treating every agent as a probability
          distribution, not a number.
        </p>
      </div>

      {/* Section 1: The Crisis of Static Trust */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white">1. The Crisis of Static Trust</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          As autonomous agents become economic participants &mdash; executing trades, processing claims, negotiating terms &mdash; they inherit reputation systems designed for human e-commerce. Star ratings. Thumbs up. Transaction counters. These systems are failing.
        </p>
        <p className="text-sm text-gray-400 leading-relaxed">
          Current reputation models in ERC-8004 rely on <span className="text-white font-semibold">Scalar Accumulation</span>: simple counters that measure volume, not certainty. While this works for slow-moving human markets, it is catastrophically insufficient for high-speed agent economies where thousands of transactions occur per hour and a compromised agent can drain liquidity in minutes.
        </p>
        <p className="text-sm text-gray-400 leading-relaxed">
          There is a deeper problem: <span className="text-white font-semibold">agents cannot spot a fake review</span>. Humans have intuition, social context, and the ability to read between the lines of a suspicious 5-star rating. Agents have milliseconds and numbers. They will consume whatever score they are given and act on it at machine speed. If the reputation layer is wrong, the damage propagates through the network before any human can intervene. This makes the oracle not just useful but <em>existential infrastructure</em> &mdash; what DNS is to the internet, trust scoring is to the agent economy. Invisible, foundational, always-on.
        </p>

        <div className="space-y-4 pl-4 border-l-2 border-emerald-500/30">
          <div>
            <p className="text-sm font-semibold text-emerald-400">1.1 Scalar Blindness</p>
            <p className="text-xs text-gray-500 mt-1">A new agent with 5 successful transactions often looks identical to a veteran with 5,000. Accumulative systems measure volume, not certainty. It is mathematically impossible to distinguish between &ldquo;High Potential&rdquo; and &ldquo;High Reliability&rdquo;, leading to misallocated capital and misplaced trust.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">1.2 The Exit Scam Problem</p>
            <p className="text-xs text-gray-500 mt-1">Static scores are sticky. If an agent spends months building a perfect reputation and then turns malicious, a scalar system is too slow to react. Lifetime averages hide recent behaviour. A compromised agent can drain liquidity for days before their score drops. By then, the damage is done.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">1.3 The Sybil Vulnerability</p>
            <p className="text-xs text-gray-500 mt-1">In a permissionless system, creating a new identity is nearly free. Bad actors can spin up thousands of bot wallets to wash-trade and artificially inflate scores. Most systems cannot distinguish between 100 reviews from 100 unique users and 100 reviews from a single bot farm.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">1.4 Binary Thinking in a Probabilistic World</p>
            <p className="text-xs text-gray-500 mt-1">Current systems ask: &ldquo;Is this agent good?&rdquo; This is the wrong question. An agent might be 99% reliable at token transfers but only 60% reliable at complex arbitrage. A single static score cannot capture this multidimensional reality. Trust decisions require probability distributions, not binary labels.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">1.5 Agent-Specific Behavioural Patterns</p>
            <p className="text-xs text-gray-500 mt-1">Research on LLM-driven agents shows they behave fundamentally differently to humans in trust scenarios. GPT-4 based agents are &ldquo;unforgiving&rdquo; &mdash; a single bad interaction can permanently alter their cooperation strategy. An agent that never cooperates again after one negative experience is a different archetype to one that forgives. Reputation systems must model these agent-specific behavioural clusters, not assume human-like forgiveness curves.</p>
          </div>
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            <span className="text-emerald-400 font-bold">We propose a shift from Accumulative Trust to Adaptive, Probabilistic Trust.</span> Instead of asking &ldquo;Is this agent good?&rdquo;, our system asks: <em>&ldquo;What is the probability that this agent will perform action X successfully in the next transaction, given their full behavioural history, the behaviour of similar agents, and the current state of the network?&rdquo;</em>
          </p>
        </div>
      </div>

      {/* Section 2: The Evidence */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          2. The Evidence
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          The need for a trust oracle is not theoretical. It is documented by academic institutions, confirmed by government bodies, quantified by threat intelligence firms, and validated by enterprise practitioners.
        </p>

        <div className="space-y-4 pl-4 border-l-2 border-red-500/30">
          <div>
            <p className="text-sm font-semibold text-amber-400">Academic Research</p>
            <p className="text-xs text-gray-500 mt-1"><span className="text-gray-300">Agents of Chaos</span> &mdash; Published by researchers from Stanford, Harvard, MIT, Carnegie Mellon, and six other institutions. 38 researchers red-teamed autonomous agents in live environments. Documented 11 failure modes through natural language alone. No technical exploits required. <span className="text-gray-300">Can LLM Agents Reach Consensus?</span> &mdash; A single bad actor collapses multi-agent network consensus. In fully benign settings, LLM agents still fail to converge. The proposed fix &mdash; weighted Byzantine fault tolerance based on agent trustworthiness &mdash; is structurally identical to what AgentProof provides.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-400">Government &amp; Threat Intelligence</p>
            <p className="text-xs text-gray-500 mt-1"><span className="text-gray-300">NIST CAISI</span> (Jan 2026) formally solicited industry input on securing AI agent systems. <span className="text-gray-300">Google Cybersecurity Forecast 2026</span> identifies &ldquo;Shadow Agent Risk&rdquo; as a priority threat and recommends continuous trust evaluation. <span className="text-gray-300">CrowdStrike Global Threat Report 2026</span> reports AI-enabled attacks up 89%. <span className="text-gray-300">Palisade Research / Anthropic System Cards</span> document models disabling their own shutdown scripts, attempting blackmail, and executing insider trades without instruction.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">Enterprise &amp; Insurance Validation</p>
            <p className="text-xs text-gray-500 mt-1"><span className="text-gray-300">Garrett Droege, WTW</span> (National Digital Risk Practice Leader) outlined the exact actuarial data structure underwriters need to price agent risk tiers and shared a live AgentProof demo with underwriters. <span className="text-gray-300">Aaron Levie, CEO of Box</span> ($4bn enterprise software) published a thesis naming agent identity, authentication, and governance as unsolved problems at trillion-agent scale. <span className="text-gray-300">Craig Riddell, Wallarm CISO</span>: &ldquo;This is not a signature problem. It is a behavioral governance problem.&rdquo;</p>
          </div>
        </div>

        <div className="text-center pt-2">
          <Link
            href="/evidence"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-red-400 hover:text-red-300 transition-colors"
          >
            View the full evidence wall (26 sources) <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Section 3: Scoring Methodology */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          3. Scoring Methodology
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          The composite score (0&ndash;100) blends up to 10 weighted signals, Bayesian-smoothed to prevent new agents with a single perfect rating from topping the leaderboard. The system dynamically rebalances weights when optional signals (coding reputation, delegation tracking) become available.
        </p>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Signal Weights (with coding signal)</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { signal: "Rating Score", weight: "27%", desc: "Bayesian-smoothed average (prior=50, k=3)" },
              { signal: "Validation Score", weight: "13%", desc: "On-chain validation success rate" },
              { signal: "Account Age", weight: "11%", desc: "Logarithmic maturity curve" },
              { signal: "Coding Score", weight: "10%", desc: "GitHub PR merge rate, review quality" },
              { signal: "Volume Score", weight: "9%", desc: "Logarithmic feedback count" },
              { signal: "Consistency Score", weight: "9%", desc: "Inverse standard deviation of ratings" },
              { signal: "Uptime Score", weight: "9%", desc: "Liveness probe success rate" },
              { signal: "Deployer Score", weight: "7%", desc: "Deployer reputation lineage" },
              { signal: "URI Stability", weight: "5%", desc: "Metadata mutation frequency" },
            ].map((s) => (
              <div key={s.signal} className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">{s.signal}</span>
                  <span className="text-xs font-mono text-emerald-400">{s.weight}</span>
                </div>
                <p className="text-[10px] text-gray-600 mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 italic">Without coding signal, weights rebalance: rating 30%, validation 15%, age 12%, volume 10%, consistency 10%, uptime 10%, deployer 8%, URI stability 5%.</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Additional Tracked Signals</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <span className="text-xs font-medium text-white">Delegation Tracking</span>
              <p className="text-[10px] text-gray-600 mt-1">Success rate, count, MTTR when acting as delegate</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <span className="text-xs font-medium text-white">Failure Metrics</span>
              <p className="text-[10px] text-gray-600 mt-1">Failure count, mean time to recovery, active failures</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Tier Thresholds</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { tier: "Diamond", score: "\u226585", feedback: "\u226520", color: "#B9F2FF" },
              { tier: "Platinum", score: "\u226572", feedback: "\u226510", color: "#E5E4E2" },
              { tier: "Gold", score: "\u226558", feedback: "\u22655", color: "#FFD700" },
              { tier: "Silver", score: "\u226542", feedback: "\u22653", color: "#C0C0C0" },
              { tier: "Bronze", score: "\u226530", feedback: "\u22651", color: "#CD7F32" },
              { tier: "Unranked", score: "<30", feedback: "<1", color: "#666666" },
            ].map((t) => (
              <div key={t.tier} className="bg-gray-800/50 rounded-lg p-2 text-center">
                <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1" style={{ backgroundColor: t.color, boxShadow: `0 0 6px ${t.color}40` }} />
                <p className="text-[10px] font-bold text-white">{t.tier}</p>
                <p className="text-[10px] font-mono text-gray-500">{t.score}</p>
                <p className="text-[10px] font-mono text-gray-600">{t.feedback} fb</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Freshness Multiplier</p>
          <p className="text-xs text-gray-500">All scores are penalised by account age to prevent new-agent gaming: &lt;7 days (0.70x), 7&ndash;30 days (0.85x), 30&ndash;90 days (0.95x), 90+ days (1.0x).</p>
        </div>
      </div>

      {/* Section 4: Risk Detection */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          4. Risk Detection &amp; Max Exposure
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Every trust evaluation includes a risk assessment with specific flags, a risk level classification, and a dollar-denominated max exposure ceiling for insurance underwriting.
        </p>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">12 Risk Flags</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              "HIGH_RISK_SCORE", "CONCENTRATED_FEEDBACK", "SERIAL_DEPLOYER",
              "SUSPICIOUS_VOLATILITY", "LOW_UPTIME", "FREQUENT_URI_CHANGES",
              "NEW_IDENTITY", "LOW_FEEDBACK", "UNVERIFIED",
              "HIGH_FAILURE_RATE", "SLOW_RECOVERY", "ACTIVE_FAILURE",
            ].map((flag) => (
              <div key={flag} className="bg-red-500/5 border border-red-500/10 rounded px-2 py-1.5">
                <span className="text-[10px] font-mono text-red-400">{flag}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">4 Risk Levels</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { level: "LOW", color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { level: "MEDIUM", color: "text-yellow-400", bg: "bg-yellow-500/10" },
              { level: "HIGH", color: "text-orange-400", bg: "bg-orange-500/10" },
              { level: "CRITICAL", color: "text-red-400", bg: "bg-red-500/10" },
            ].map((r) => (
              <div key={r.level} className={`${r.bg} rounded-lg p-2 text-center`}>
                <span className={`text-xs font-mono font-bold ${r.color}`}>{r.level}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Max Exposure Model</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Dollar-denominated trust ceiling calculated from composite score, confidence multiplier (feedback volume), age bonus, and validation bonus. Provides the actuarial bridge between on-chain reputation and real-world insurance coverage. Underwriters can price agent risk tiers using: transaction volume and velocity, delegation scope, custody relationships, and loss event history with root cause classification.
          </p>
        </div>
      </div>

      {/* Section 5: Architecture & Endpoints */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          5. Architecture &amp; Endpoints
        </h2>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Protocol Endpoints</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { name: "REST API", desc: "GET /api/v1/trust/{id} — full evaluation with score breakdown, risk flags, delegation stats" },
              { name: "Batch Evaluation", desc: "POST /api/v1/trust/batch — evaluate up to 500 agents in a single request" },
              { name: "Risk Check", desc: "GET /api/v1/trust/{id}/risk — focused risk assessment with flag details" },
              { name: "Dimensions", desc: "GET /api/v1/trust/{id}/dimensions — per-dimension score breakdown" },
              { name: "A2A (Agent-to-Agent)", desc: "POST /a2a — Google A2A protocol for agent-to-agent trust queries" },
              { name: "MCP Server", desc: "POST /mcp — Model Context Protocol for Claude, GPT, and other LLM agents" },
              { name: "Webhooks", desc: "Register webhooks for real-time score change notifications" },
              { name: "SDK", desc: "@agentproof/sdk v1.1.0 — TypeScript SDK with full oracle API support" },
            ].map((ep) => (
              <div key={ep.name} className="bg-gray-800/50 rounded-lg p-3">
                <span className="text-xs font-bold text-white">{ep.name}</span>
                <p className="text-[10px] text-gray-500 mt-1">{ep.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">API Pricing Tiers</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { tier: "Pay-as-you-go", price: "$0.05/call", limit: "1,000/mo" },
              { tier: "Starter", price: "$250/mo", limit: "10,000/mo" },
              { tier: "Growth", price: "$500/mo", limit: "50,000/mo" },
              { tier: "Scale", price: "$1,000/mo", limit: "200,000/mo" },
              { tier: "Enterprise", price: "$2,000/mo", limit: "Unlimited" },
            ].map((t) => (
              <div key={t.tier} className="bg-gray-800/50 rounded-lg p-3">
                <span className="text-xs font-bold text-white">{t.tier}</span>
                <p className="text-[10px] text-emerald-400 font-mono mt-1">{t.price}</p>
                <p className="text-[10px] text-gray-600">{t.limit}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Autonomous Oracle Jobs</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { job: "Agent Screening", interval: "60s", desc: "Compute full evaluations for new agents" },
              { job: "Anomaly Monitor", interval: "120s", desc: "Detect >20pt score drops, flag volatility" },
              { job: "Liveness Probing", interval: "300s", desc: "HTTP health checks to agent endpoints" },
              { job: "Network Report", interval: "600s", desc: "Publish ecosystem stats via event feed" },
              { job: "Delegation Sync", interval: "600s", desc: "Track delegation success/failure rates" },
              { job: "GitHub Sync", interval: "3600s", desc: "Compute coding reputation from PR metrics" },
              { job: "Failure Metrics", interval: "300s", desc: "MTTR, active failures, recovery tracking" },
            ].map((j) => (
              <div key={j.job} className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{j.job}</span>
                  <span className="text-[10px] font-mono text-emerald-400">{j.interval}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">{j.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Download Card */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">AgentProof Whitepaper</p>
            <p className="text-xs text-gray-500 font-mono mt-1">March 2026 &middot; v2.0 &middot; PDF</p>
          </div>
          <a
            href="/agentproof-whitepaper.pdf"
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </a>
        </div>

        {/* Inline Viewer */}
        <div className="border border-gray-700 rounded-lg overflow-hidden">
          <iframe
            src="/agentproof-whitepaper.pdf"
            className="w-full h-[600px] bg-gray-950"
            title="AgentProof Whitepaper"
          />
        </div>
      </div>

      {/* Table of Contents */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
        <p className="text-xs font-mono text-gray-500 uppercase">Full Table of Contents</p>
        <div className="grid gap-3">
          {SECTIONS.map((section, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="text-xs font-mono text-emerald-500 mt-0.5 w-5 shrink-0">{i + 1}.</span>
              <div>
                <p className="text-sm font-medium text-white">{section.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Shield, label: "Chains", value: "21", sub: "AVAX \u00B7 ETH \u00B7 Base \u00B7 Solana + 17 more" },
          { icon: Globe, label: "Indexed", value: "54K+", sub: "Agent identities" },
          { icon: BarChart3, label: "Signals", value: "10", sub: "Composite scoring dimensions" },
          { icon: Lock, label: "Risk Flags", value: "12", sub: "Automated threat detection" },
        ].map((stat, i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-center">
            <stat.icon className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{stat.value}</p>
            <p className="text-[10px] font-mono text-gray-500 uppercase">{stat.label}</p>
            <p className="text-[10px] text-gray-600">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-3 justify-center pb-8">
        <Link
          href="/evidence"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Evidence Wall
        </Link>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          API Pricing
        </Link>
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          API Docs
        </Link>
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
