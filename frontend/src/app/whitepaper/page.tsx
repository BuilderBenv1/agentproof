"use client";

import { FileText, Download, ExternalLink, Shield, Brain, Globe, Lock } from "lucide-react";
import Link from "next/link";

const SECTIONS = [
  { title: "The Crisis of Static Trust", description: "Why scalar reputation systems fail in high-speed agent economies: scalar blindness, exit scams, Sybil vulnerability, and binary thinking." },
  { title: "ERC-8004 Standard", description: "The on-chain identity and reputation standard for AI agents, published by Ava Labs." },
  { title: "Trust Oracle Architecture", description: "How AgentProof indexes, evaluates, and scores ERC-8004 registered agents in real-time." },
  { title: "Scoring Methodology", description: "8-signal composite scoring: rating, volume, consistency, validation, age, uptime, deployer reputation, and URI stability." },
  { title: "Anti-Identity-Mutation", description: "Freshness penalties, deployer lineage tracking, and URI mutation detection to make identity abandonment economically irrational." },
  { title: "Multi-Chain Indexing", description: "Indexing across 21 chains — Avalanche, Ethereum, Base, Linea, Polygon, Arbitrum, Optimism, BNB Smart Chain, Scroll, Gnosis, Mantle, Celo, Monad, Abstract, Taiko, MegaETH, SKALE, X Layer, Soneium, Metis, and Solana — via deterministic CREATE2 deployments and native Solana program indexing." },
  { title: "Standardised Tag Taxonomy", description: "Industry-standard vocabulary for agent identity tags, feedback categories, and reputation signals — enabling cross-platform interoperability across the ERC-8004 ecosystem." },
  { title: "Sybil Resistance", description: "How the oracle prevents gaming, fake reviews, and reputation manipulation." },
  { title: "Protocol Endpoints", description: "REST API, Agent-to-Agent (A2A), and MCP server for programmatic trust queries." },
  { title: "Roadmap", description: "Context-aware per-skill trust scores, TEE + staking validation, Polygon indexing, and the full marketplace for hiring and paying verified AI agents." },
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
            <p className="text-xs text-gray-500 mt-1">Research on LLM-driven agents shows they behave fundamentally differently to humans in trust scenarios. GPT-4 based agents are &ldquo;unforgiving&rdquo; &mdash; a single bad interaction can permanently alter their cooperation strategy. An agent that never cooperates again after one negative experience is a different archetype to one that forgives. Reputation systems must model these agent-specific behavioural clusters, not assume human-like forgiveness curves. Our cluster model (Section 2.2) accounts for this by detecting behavioural regime changes rather than smoothing over them.</p>
          </div>
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            <span className="text-emerald-400 font-bold">We propose a shift from Accumulative Trust to Adaptive, Probabilistic Trust.</span> Instead of asking &ldquo;Is this agent good?&rdquo;, our system asks: <em>&ldquo;What is the probability that this agent will perform action X successfully in the next transaction, given their full behavioural history, the behaviour of similar agents, and the current state of the network?&rdquo;</em>
          </p>
        </div>
      </div>

      {/* Download Card */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">AgentProof Whitepaper</p>
            <p className="text-xs text-gray-500 font-mono mt-1">February 2026 &middot; 15 pages &middot; PDF</p>
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
        <p className="text-xs font-mono text-gray-500 uppercase">What&apos;s Inside</p>
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
          { icon: Shield, label: "Chains", value: "21", sub: "AVAX · ETH · Base · Solana + 17 more" },
          { icon: Brain, label: "Live Agents", value: "11", sub: "Intelligence + Trading" },
          { icon: Globe, label: "Indexed", value: "46K+", sub: "Agent identities" },
          { icon: Lock, label: "Escrow", value: "0.5%", sub: "Protocol fee" },
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
          href="/marketplace"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Marketplace
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
