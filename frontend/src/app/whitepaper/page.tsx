import type { Metadata } from "next";
import { FileText, Download, ExternalLink, Shield, Globe, Lock, AlertTriangle, BarChart3, Activity, Layers, Zap, Link2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Whitepaper — ERC-8004 Trust Oracle Architecture",
  description: "AgentProof technical whitepaper. 9-signal behavioral scoring, deployer analysis, cross-chain reputation, and insurance primitives for autonomous AI agents on ERC-8004.",
  keywords: ["AgentProof whitepaper", "ERC-8004 whitepaper", "AI agent scoring architecture", "agent trust oracle design", "on-chain reputation"],
  alternates: { canonical: "https://agentproof.sh/whitepaper" },
  openGraph: {
    title: "AgentProof Whitepaper — ERC-8004 Trust Oracle Architecture",
    description: "Technical whitepaper covering 9-signal behavioral scoring for autonomous AI agents.",
    url: "https://agentproof.sh/whitepaper",
  },
};
import Link from "next/link";

const SECTIONS = [
  { title: "The Infrastructure Gap", description: "128,400+ agents registered on-chain. Zero trust infrastructure. The registries exist — the integrity layer doesn't." },
  { title: "The Evidence", description: "Stanford, Harvard, NIST, Google, CrowdStrike, WTW, and Box CEO Aaron Levie — the academic, government, and enterprise case for a trust oracle." },
  { title: "What AgentProof Is", description: "Not a scoring model. Infrastructure. An on-chain oracle that other protocols query before delegating capital, hiring agents, or underwriting coverage." },
  { title: "Commerce Integration (ERC-ACP)", description: "The AgentProofHook gates provider assignment in real job escrow flows. Untrusted agents are blocked at the smart contract level, not flagged after the fact." },
  { title: "Multi-Oracle Consensus", description: "Multiple independent oracle operators push scores. The contract averages them, detects divergence, and flags disagreement on-chain. No single point of failure." },
  { title: "Scoring Methodology", description: "11-signal composite with Bayesian smoothing. The signals are inputs to the oracle — not the product. The product is the infrastructure that makes scores queryable." },
  { title: "Risk Detection & Max Exposure", description: "14 automated risk flags, 4 risk levels, and dollar-denominated trust ceilings for insurance underwriting." },
  { title: "Multi-Chain Indexing", description: "21 chains — Avalanche, Ethereum, Base, Linea, Polygon, Arbitrum, Optimism, BNB, Scroll, Gnosis, Mantle, Celo, Monad, Abstract, Taiko, MegaETH, SKALE, X Layer, Soneium, Metis, Solana." },
  { title: "Protocol Endpoints", description: "REST API, A2A agent-to-agent protocol, MCP server, webhooks, TypeScript SDK. Every interface an agent or protocol needs to query trust." },
  { title: "Deployer Reputation", description: "Tracking who built the agent, not just the agent. Serial deployers who spawn and abandon agents are flagged across all future registrations." },
  { title: "Autonomous Oracle Operations", description: "8 background jobs running continuously — screening, anomaly detection, liveness probing, failure tracking, delegation sync." },
  { title: "Insurance & Actuarial Bridge", description: "Dollar-denominated max exposure ceilings. The data structure underwriters need to price agent risk tiers — validated by Willis Towers Watson." },
  { title: "Roadmap", description: "TEE validation, context-aware per-skill scores, insurance marketplace, cross-protocol reputation portability." },
];

export default function WhitepaperPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-mono text-emerald-400">Technical Whitepaper v2.2</span>
        </div>
        <h1 className="text-3xl font-bold text-white">
          Trust Infrastructure for the Agent Economy
        </h1>
        <p className="text-sm text-gray-400 max-w-xl mx-auto">
          128,400+ agents registered on-chain across 21 chains. 214.6K+ evaluations. 307.2K+ screenings. 43.8 average trust score. Protocols need to know which ones to trust
          before delegating capital. AgentProof is the oracle they query.
        </p>
      </div>

      {/* Section 1: The Infrastructure Gap */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white">1. The Infrastructure Gap</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          ERC-8004 gave agents an identity standard. Three on-chain registries &mdash; identity, reputation, validation &mdash; deployed across 21 chains via deterministic CREATE2 addresses. 128,400+ agents registered. The standard works.
        </p>
        <p className="text-sm text-gray-400 leading-relaxed">
          But the standard explicitly leaves the <span className="text-white font-semibold">integrity layer</span> as an exercise for the ecosystem. The registries store data. They don&rsquo;t evaluate it. A 5-star rating from a bot farm sits next to a 5-star rating from a verified counterparty. The contract can&rsquo;t tell the difference. Neither can the agent querying it at machine speed.
        </p>
        <p className="text-sm text-gray-400 leading-relaxed">
          This is the gap AgentProof fills. Not a better scoring model &mdash; <span className="text-white font-semibold">the infrastructure that makes trust queryable</span>. An on-chain oracle that protocols call before delegating capital. A hook that blocks untrusted agents at the smart contract level. An API that agents query before hiring other agents.
        </p>

        <div className="space-y-4 pl-4 border-l-2 border-emerald-500/30">
          <div>
            <p className="text-sm font-semibold text-emerald-400">1.1 The Registries Exist. The Oracle Doesn&rsquo;t.</p>
            <p className="text-xs text-gray-500 mt-1">ERC-8004 block explorers (8004scan, growthepie) display registration data. Developer SDKs (Agent0) make it easy to register and submit feedback. But nobody transforms that raw data into actionable trust signals that protocols can consume programmatically. 58% of registered agents have broken or invalid URIs. The data is there. The intelligence isn&rsquo;t.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">1.2 Agents Can&rsquo;t Read Between the Lines</p>
            <p className="text-xs text-gray-500 mt-1">Humans have intuition, social context, the ability to spot a suspicious 5-star review. Agents have milliseconds and numbers. They consume whatever score they&rsquo;re given and act on it at machine speed. If the trust layer is wrong, the damage propagates through the network before any human can intervene. This makes the oracle existential infrastructure &mdash; what DNS is to the internet, trust scoring is to the agent economy.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">1.3 Commerce Is Already Here</p>
            <p className="text-xs text-gray-500 mt-1">ERC-ACP (Agentic Commerce Protocol) by Virtuals Protocol adds job escrow with Client-Provider-Evaluator lifecycle. Circle and Stripe are building payment rails for agent commerce. x402 enables pay-per-call agent services. The commerce layer is live. The trust layer isn&rsquo;t. Every job assigned to an unvetted agent is a liability without a score.</p>
          </div>
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            <span className="text-emerald-400 font-bold">AgentProof is not a scoring model. It is infrastructure.</span> The on-chain oracle that other contracts query. The hook that blocks untrusted providers. The API that agents call before delegating work. The data pipeline that underwriters use to price coverage. Scoring is an input. Infrastructure is the product.
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
          The need for trust infrastructure is documented by academic institutions, confirmed by government bodies, quantified by threat intelligence firms, and validated by enterprise practitioners.
        </p>

        <div className="space-y-4 pl-4 border-l-2 border-red-500/30">
          <div>
            <p className="text-sm font-semibold text-amber-400">Academic Research</p>
            <p className="text-xs text-gray-500 mt-1"><span className="text-gray-300">Agents of Chaos</span> &mdash; Published by researchers from Stanford, Harvard, MIT, Carnegie Mellon, and six other institutions. 38 researchers red-teamed autonomous agents in live environments. Documented 11 failure modes through natural language alone. No technical exploits required. <span className="text-gray-300">Can LLM Agents Reach Consensus?</span> &mdash; A single bad actor collapses multi-agent network consensus. The proposed fix &mdash; weighted Byzantine fault tolerance based on agent trustworthiness &mdash; requires exactly the kind of queryable trust oracle AgentProof provides.</p>
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

      {/* Section 3: Commerce Integration (ERC-ACP) */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Link2 className="w-5 h-5 text-emerald-400" />
          3. Commerce Integration (ERC-ACP Hooks)
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Scoring an agent after a transaction fails is forensics. Blocking an untrusted agent before the transaction executes is infrastructure. AgentProof does the latter.
        </p>

        <div className="space-y-4 pl-4 border-l-2 border-emerald-500/30">
          <div>
            <p className="text-sm font-semibold text-emerald-400">3.1 AgentProofHook (IACPHook)</p>
            <p className="text-xs text-gray-500 mt-1">An on-chain hook conforming to the canonical ERC-ACP spec. When a protocol calls <code className="text-emerald-400/70">setProvider(jobId, provider)</code>, the hook fires <code className="text-emerald-400/70">beforeAction</code>: resolves the provider address to an ERC-8004 agent ID, reads their trust score from the on-chain oracle, and reverts the transaction if the score or tier is below threshold. The agent never gets hired. The capital never moves.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">3.2 Job Outcome Tracking</p>
            <p className="text-xs text-gray-500 mt-1">On <code className="text-emerald-400/70">afterAction</code> for complete/reject, the hook records per-agent job stats &mdash; completion count, rejection count, last job timestamp. These feed back into the oracle&rsquo;s scoring pipeline as the <code className="text-emerald-400/70">job_completion</code> signal (8% weight). A closed feedback loop: trust gates commerce, commerce builds trust.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">3.3 Optional Attestation Gate</p>
            <p className="text-xs text-gray-500 mt-1">Deployers can attach an <code className="text-emerald-400/70">IAttestationProvider</code> for credential verification alongside reputation. Example: &ldquo;provider must have score &ge; 30 AND hold a specific NFT.&rdquo; Works with InsumerAPI (32-chain attestation) or any compatible verifier. Composable, not monolithic.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">3.4 Score Staleness Enforcement</p>
            <p className="text-xs text-gray-500 mt-1">Configurable <code className="text-emerald-400/70">maxScoreAge</code> (uint40, seconds). If the oracle hasn&rsquo;t updated a score within the window, the hook reverts with <code className="text-emerald-400/70">ScoreExpired</code>. Prevents stale scores from gating live commerce. Default: 3600 seconds (1 hour). Set to 0 to disable.</p>
          </div>
        </div>
      </div>

      {/* Section 4: Multi-Oracle Consensus */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-400" />
          4. Multi-Oracle Consensus
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          A single oracle is a single point of failure. A compromised oracle can manipulate scores silently. AgentProof V2 eliminates this by supporting multiple independent oracle operators.
        </p>

        <div className="space-y-4 pl-4 border-l-2 border-emerald-500/30">
          <div>
            <p className="text-sm font-semibold text-emerald-400">4.1 Independent Operator Scores</p>
            <p className="text-xs text-gray-500 mt-1">Each authorized oracle pushes scores independently. The contract stores per-oracle scores in <code className="text-emerald-400/70">oracleScores[agentId][oracle]</code>. Consumers can read individual operator scores or the consensus view. No operator can overwrite another&rsquo;s data.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">4.2 On-Chain Consensus</p>
            <p className="text-xs text-gray-500 mt-1">The consensus score is the average across all operators who have scored that agent. Tier is auto-computed from the average via <code className="text-emerald-400/70">_scoreTier()</code>. Updated on every write. <code className="text-emerald-400/70">getConsensusScore()</code> returns: average score, consensus tier, oracle count, and a divergence flag.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">4.3 Divergence Detection</p>
            <p className="text-xs text-gray-500 mt-1">When two oracles disagree by more than <code className="text-emerald-400/70">divergenceThreshold</code> (default: 10 points on 0-100 scale), the contract emits <code className="text-emerald-400/70">DivergenceDetected(agentId, minScore, maxScore)</code>. Consumers can check the <code className="text-emerald-400/70">divergent</code> flag before acting on a score. Disagreement is visible, not hidden.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">4.4 Operator Management</p>
            <p className="text-xs text-gray-500 mt-1">Contract owner can <code className="text-emerald-400/70">addOracle(address, name)</code> and <code className="text-emerald-400/70">removeOracle(address)</code>. Each operator is named on-chain. Removal revokes write access but preserves historical scores. Current operators: AgentProof (Operator #1), Agent402 (Operator #2).</p>
          </div>
        </div>
      </div>

      {/* Section 5: Scoring Methodology */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          5. Scoring Methodology
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          The composite score (0&ndash;100) blends up to 11 weighted signals, Bayesian-smoothed to prevent gaming. The scoring model is an input to the oracle infrastructure &mdash; it can be upgraded, replaced, or supplemented by additional oracle operators without changing the on-chain interface.
        </p>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Signal Weights (all signals active)</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { signal: "Rating Score", weight: "30%", desc: "Bayesian-smoothed avg with reviewer trust weighting (prior=50, k=3)" },
              { signal: "Validation Score", weight: "15%", desc: "On-chain validation success rate" },
              { signal: "Account Age", weight: "12%", desc: "Logarithmic maturity curve (365d baseline)" },
              { signal: "Volume Score", weight: "10%", desc: "Logarithmic feedback count (log\u2081\u2080 scale)" },
              { signal: "Consistency Score", weight: "10%", desc: "Inverse standard deviation of ratings" },
              { signal: "Uptime Score", weight: "10%", desc: "30-day rolling liveness probe success rate" },
              { signal: "Deployer Score", weight: "8%", desc: "Cross-agent deployer reputation lineage" },
              { signal: "URI Stability", weight: "5%", desc: "Metadata mutation frequency (3+ changes = flag)" },
              { signal: "Coding Score", weight: "+10%", desc: "GitHub PR merge rate, review sentiment, recency" },
              { signal: "Job Completion", weight: "+8%", desc: "ERC-ACP job completion rate as provider" },
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
          <p className="text-[10px] text-gray-600 italic">Base 8 signals always active (sum to 100%). Coding Score and Job Completion are additive — when present, all weights rebalance proportionally. + denotes optional signal.</p>
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
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Anti-Gaming Defenses</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <span className="text-xs font-medium text-white">Reviewer Trust Weighting</span>
              <p className="text-[10px] text-gray-600 mt-1">Feedback weighted by reviewer&rsquo;s own trust score. A Diamond agent&rsquo;s rating counts more than an Unranked bot&rsquo;s. 60/40 blend with raw Bayesian for stability.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <span className="text-xs font-medium text-white">Bayesian Smoothing</span>
              <p className="text-[10px] text-gray-600 mt-1">Prior=50, k=3. A single perfect rating scores 62.5, not 100. Gaming requires sustained volume from trusted reviewers.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <span className="text-xs font-medium text-white">Freshness Penalty</span>
              <p className="text-[10px] text-gray-600 mt-1">&lt;7d: 0.70x, 7-30d: 0.85x, 30-90d: 0.95x. Identity rotation costs 30% for a week.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <span className="text-xs font-medium text-white">Deployer Lineage</span>
              <p className="text-[10px] text-gray-600 mt-1">Serial deployers who abandon agents taint all future registrations. 40% abandonment ratio, 30% quality, 20% longevity, 10% volume.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <span className="text-xs font-medium text-white">Anomaly Detection</span>
              <p className="text-[10px] text-gray-600 mt-1">Autonomous job runs every 120s. &gt;20pt drops flagged as SUSPICIOUS_VOLATILITY. Feedback bursts detected per reviewer.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <span className="text-xs font-medium text-white">Concentration Detection</span>
              <p className="text-[10px] text-gray-600 mt-1">&gt;60% feedback from single reviewer triggers CONCENTRATED_FEEDBACK flag. Prevents sybil via fake reviews.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 6: Risk Detection */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          6. Risk Detection &amp; Max Exposure
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Every trust evaluation includes a risk assessment with specific flags, a risk level classification, and a dollar-denominated max exposure ceiling for insurance underwriting.
        </p>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">14 Risk Flags</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              "HIGH_RISK_SCORE", "CONCENTRATED_FEEDBACK", "SERIAL_DEPLOYER",
              "SUSPICIOUS_VOLATILITY", "LOW_UPTIME", "FREQUENT_URI_CHANGES",
              "NEW_IDENTITY", "LOW_FEEDBACK", "UNVERIFIED",
              "HIGH_FAILURE_RATE", "SLOW_RECOVERY", "ACTIVE_FAILURE",
              "HIGH_JOB_FAILURE_RATE", "JOB_ABANDONMENT",
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
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Max Exposure Model (Insurance Bridge)</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Dollar-denominated trust ceiling calculated from composite score, confidence multiplier (feedback volume), age bonus, and validation bonus. This is the data structure Willis Towers Watson identified as the missing input for underwriting agent risk. Underwriters can price tiers using: transaction volume/velocity, delegation scope, custody relationships, and loss event history with root cause classification.
          </p>
        </div>
      </div>

      {/* Deployed Contracts */}
      <div className="bg-gray-900/50 border border-emerald-500/20 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          Live Contracts (Verified)
        </h2>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Score Pushing &mdash; TrustScoreOracle V2 (9 chains)</p>
          <div className="grid gap-2">
            {[
              { chain: "Base Mainnet", addr: "0xE74e9C994b8F65db01725DdAE603EAE397aBa432", explorer: "https://basescan.org/address/0xE74e9C994b8F65db01725DdAE603EAE397aBa432#code", label: "Basescan" },
              { chain: "Avalanche Mainnet", addr: "0xA9D7a613Ce349d15827CB8C54F08e24549219B4f", explorer: "https://snowtrace.io/address/0xA9D7a613Ce349d15827CB8C54F08e24549219B4f#code", label: "Snowtrace" },
              { chain: "Ethereum Mainnet", addr: "Deployed", explorer: null, label: null },
              { chain: "Linea", addr: "Deployed", explorer: null, label: null },
              { chain: "BSC (new)", addr: "0xE6D5ad50e7bb5A13b8E2F674FCDEB48f98849371", explorer: "https://bscscan.com/address/0xE6D5ad50e7bb5A13b8E2F674FCDEB48f98849371", label: "BscScan" },
              { chain: "Polygon (new)", addr: "0x7471C0fD57658ABBf8065Ee816080D42F67DBB1c", explorer: "https://polygonscan.com/address/0x7471C0fD57658ABBf8065Ee816080D42F67DBB1c", label: "PolygonScan" },
              { chain: "Celo (new)", addr: "0x7471C0fD57658ABBf8065Ee816080D42F67DBB1c", explorer: "https://celoscan.io/address/0x7471C0fD57658ABBf8065Ee816080D42F67DBB1c", label: "CeloScan" },
              { chain: "Arbitrum (new)", addr: "0x7471C0fD57658ABBf8065Ee816080D42F67DBB1c", explorer: "https://arbiscan.io/address/0x7471C0fD57658ABBf8065Ee816080D42F67DBB1c", label: "Arbiscan" },
              { chain: "Monad (new)", addr: "0xB5Be2426f3b930AdD6Bc4e4A277a76b9cE4855e1", explorer: null, label: null },
            ].map((c) => (
              <div key={c.chain} className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{c.chain}</span>
                  {c.explorer ? (
                    <a href={c.explorer} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300">{c.label} &rarr;</a>
                  ) : (
                    <span className="text-[10px] font-mono text-gray-600">Verified</span>
                  )}
                </div>
                <code className="text-[10px] font-mono text-gray-500 break-all">{c.addr}</code>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Base Mainnet &mdash; ReputationGateV2</p>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">ReputationGateV2</span>
              <a href="https://basescan.org/address/0x882e22FBB913b53Ab062f3f5f42C3E8838373d23#code" target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300">Basescan &rarr;</a>
            </div>
            <code className="text-[10px] font-mono text-gray-500 break-all">0x882e22FBB913b53Ab062f3f5f42C3E8838373d23</code>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Feedback Submission &mdash; 21 EVM chains + Solana</p>
          <p className="text-[10px] text-gray-500">Auto-routes to any chain with an RPC URL via ERC-8004 ReputationRegistry (deterministic CREATE2 addresses).</p>
        </div>

        <p className="text-[10px] text-gray-600 italic">All contracts verified with full source code. Scores pushed autonomously every 5 minutes. 2 oracle operators with on-chain consensus. 5 new oracle deployments added March 2026.</p>
      </div>

      {/* ReputationGateV2 Integration */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-emerald-400" />
          ReputationGateV2 &mdash; Protocol Integration
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Any protocol can gate operations by agent trust. Drop <code className="text-emerald-400/70">ReputationGateV2</code> into your contract and call <code className="text-emerald-400/70">requireTrust(agentId)</code> before sensitive operations. One line. No oracle integration code needed.
        </p>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Core Functions</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { fn: "requireTrust(agentId)", desc: "Reverts if score < minScore, tier < minTier, or score expired" },
              { fn: "isTrusted(agentId)", desc: "Returns bool — safe for view calls" },
              { fn: "isTrustedForValue(agentId, value)", desc: "Value-based gating — per-tier transaction limits" },
              { fn: "getCollateralMultiplier(agentId)", desc: "Risk-adjusted collateral (100-300 basis points)" },
              { fn: "batchCheckTrust(agentIds)", desc: "Filter arrays — returns trusted subset" },
              { fn: "filterTrusted(agentIds)", desc: "Returns only agent IDs that pass trust check" },
            ].map((f) => (
              <div key={f.fn} className="bg-gray-800/50 rounded-lg p-3">
                <code className="text-[10px] font-mono text-emerald-400">{f.fn}</code>
                <p className="text-[10px] text-gray-500 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Integration Example</p>
          <pre className="text-[10px] font-mono text-gray-400 leading-relaxed overflow-x-auto">{`import {ReputationGateV2} from "./ReputationGateV2.sol";

contract MyProtocol {
    ReputationGateV2 gate = ReputationGateV2(0x882e...d23);

    function delegateCapital(uint256 agentId, uint256 amount) external {
        gate.requireTrust(agentId);  // reverts if untrusted
        // ... safe to proceed
    }
}`}</pre>
        </div>
      </div>

      {/* Section 7: Architecture & Endpoints */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          7. Architecture &amp; Endpoints
        </h2>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Three-Layer Architecture</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <span className="text-xs font-bold text-white">Layer 1: Indexing</span>
              <p className="text-[10px] text-gray-600 mt-1">21-chain event indexer. AgentRegistered, FeedbackSubmitted, ValidationRequested events. Batch-to-individual fallback with exponential backoff.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <span className="text-xs font-bold text-white">Layer 2: Evaluation</span>
              <p className="text-[10px] text-gray-600 mt-1">11-signal composite scoring. 14 risk flags. In-memory cache (300s TTL). Scoped per-dimension scores with independent Bayesian smoothing.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <span className="text-xs font-bold text-white">Layer 3: Feedback Loop</span>
              <p className="text-[10px] text-gray-600 mt-1">Oracle writes evaluations back to ERC-8004 Reputation Registry as on-chain feedback. Verifiable audit trail.</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Protocol Endpoints</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { name: "REST API", desc: "GET /api/v1/trust/{id} — full evaluation with score breakdown, risk flags, delegation stats" },
              { name: "Batch Evaluation", desc: "POST /api/v1/trust/batch — evaluate up to 500 agents in a single request" },
              { name: "Hook Gate Check", desc: "GET /api/v1/hook/check/{id} — pre-check if agent would pass the on-chain hook" },
              { name: "Address Resolver", desc: "GET /api/v1/hook/resolve/{addr} — resolve wallet to agent ID and trust score" },
              { name: "A2A (Agent-to-Agent)", desc: "POST /a2a — Google A2A protocol. Agent card at /.well-known/agent.json" },
              { name: "MCP Server", desc: "POST /mcp — Model Context Protocol for Claude, GPT, and other LLM agents" },
              { name: "Webhooks", desc: "Real-time score change notifications with SSRF protection" },
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
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">On-Chain Oracle (TrustScoreOracle V2)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { fn: "getScore(agentId)", desc: "Paid query — returns consensus score, tier, timestamp. Fee: 0.001 native token." },
              { fn: "viewScore(agentId)", desc: "Free view — same data, for off-chain reads and UI display." },
              { fn: "getConsensusScore(agentId)", desc: "Multi-oracle consensus — avg score, tier, oracle count, divergence flag." },
              { fn: "getOracleScore(agentId, oracle)", desc: "Per-operator score — read any specific oracle's assessment." },
            ].map((f) => (
              <div key={f.fn} className="bg-gray-800/50 rounded-lg p-3">
                <code className="text-[10px] font-mono text-emerald-400">{f.fn}</code>
                <p className="text-[10px] text-gray-500 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Autonomous Oracle Jobs</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { job: "Agent Screening", interval: "60s", desc: "Compute evaluations for new agents, submit on-chain" },
              { job: "Anomaly Monitor", interval: "120s", desc: "Detect >20pt score drops, flag volatility" },
              { job: "Liveness Probing", interval: "300s", desc: "HTTP health checks to agent endpoints" },
              { job: "Failure Metrics", interval: "300s", desc: "MTTR, active failures, recovery tracking" },
              { job: "Network Report", interval: "600s", desc: "Publish ecosystem stats via event feed" },
              { job: "Delegation Sync", interval: "600s", desc: "Track delegation success/failure rates" },
              { job: "Job Outcomes", interval: "600s", desc: "Sync ERC-ACP job completion rates" },
              { job: "GitHub Sync", interval: "3600s", desc: "Coding reputation from PR metrics" },
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

      {/* Section 8: API Pricing */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-400" />
          8. Monetization
        </h2>

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

        <p className="text-xs text-gray-500">On-chain queries pay a per-call fee to the TrustScoreOracle contract (0.001 native token). Off-chain API queries use API key authentication with monthly quotas. Both revenue streams compound with adoption.</p>
      </div>

      {/* Download Card */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">AgentProof Whitepaper</p>
            <p className="text-xs text-gray-500 font-mono mt-1">March 2026 &middot; v2.2 &middot; PDF</p>
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
          { icon: Globe, label: "Indexed", value: "128.4K+", sub: "Agent identities" },
          { icon: Layers, label: "Oracles", value: "2", sub: "Independent operators with consensus" },
          { icon: Lock, label: "Signals", value: "11", sub: "Reviewer-weighted, Bayesian-smoothed" },
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
