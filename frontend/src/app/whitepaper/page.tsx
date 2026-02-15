"use client";

import { FileText, Download, ExternalLink, Shield, Brain, Globe, Lock } from "lucide-react";
import Link from "next/link";

const SECTIONS = [
  { title: "The Trust Gap", description: "Why autonomous AI agents need verifiable reputation before the agent economy can scale." },
  { title: "ERC-8004 Standard", description: "The on-chain identity and reputation standard for AI agents, published by Ava Labs." },
  { title: "Trust Oracle Architecture", description: "How AgentProof indexes, evaluates, and scores ERC-8004 registered agents in real-time." },
  { title: "Scoring Methodology", description: "Multi-signal composite scoring: on-chain feedback, validation rate, response time, and more." },
  { title: "Multi-Chain Indexing", description: "Avalanche-native with cross-chain reputation via Teleporter messaging." },
  { title: "Sybil Resistance", description: "How the oracle prevents gaming, fake reviews, and reputation manipulation." },
  { title: "Protocol Endpoints", description: "REST API, Agent-to-Agent (A2A), and MCP server for programmatic trust queries." },
  { title: "Roadmap", description: "From trust oracle to the full marketplace for hiring and paying verified AI agents." },
];

export default function WhitepaperPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-mono text-emerald-400">Technical Whitepaper v1.0</span>
        </div>
        <h1 className="text-3xl font-bold text-white">
          The Trust Oracle for the ERC-8004 Agent Economy
        </h1>
        <p className="text-sm text-gray-400 max-w-xl mx-auto">
          As autonomous AI agents proliferate across blockchain networks, the absence of a
          verifiable trust layer creates systemic risk for the emerging agent economy. AgentProof
          addresses this gap.
        </p>
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
          { icon: Shield, label: "Contracts", value: "10", sub: "Avalanche C-Chain" },
          { icon: Brain, label: "Live Agents", value: "11", sub: "Intelligence + Trading" },
          { icon: Globe, label: "Indexed", value: "25K+", sub: "Agent identities" },
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
