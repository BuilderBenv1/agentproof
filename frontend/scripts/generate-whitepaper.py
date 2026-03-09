"""Generate AgentProof Whitepaper v2.0 as PDF using fpdf2."""

import os
from fpdf import FPDF

OUTPUT = os.path.join(os.path.dirname(__file__), "..", "public", "agentproof-whitepaper.pdf")


class WhitepaperPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, "AgentProof Technical Whitepaper v2.0  |  March 2026", align="L")
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}", align="R", new_x="LMARGIN", new_y="NEXT")
        self.line(10, 18, 200, 18)
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, "agentproof.sh  |  oracle.agentproof.sh  |  ERC-8004", align="C")

    def section_title(self, num, title):
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(0, 180, 130)
        self.ln(6)
        self.cell(0, 10, f"{num}. {title}", new_x="LMARGIN", new_y="NEXT")
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def sub_section(self, label, color=(0, 180, 130)):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*color)
        self.cell(0, 7, label, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body_text(self, text):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 5, text)
        self.ln(2)

    def small_text(self, text, color=(80, 80, 80)):
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*color)
        self.multi_cell(0, 4.5, text)
        self.ln(1)

    def bullet(self, text, indent=15):
        x = self.get_x()
        self.set_x(indent)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(60, 60, 60)
        self.cell(4, 4.5, "-")
        self.multi_cell(0, 4.5, text)
        self.ln(0.5)

    def quote_block(self, text):
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(60, 60, 60)
        x = self.get_x()
        self.set_x(15)
        # Draw left bar
        y_start = self.get_y()
        self.multi_cell(170, 5, f'"{text}"')
        y_end = self.get_y()
        self.set_draw_color(0, 180, 130)
        self.set_line_width(0.8)
        self.line(13, y_start, 13, y_end)
        self.set_line_width(0.2)
        self.ln(2)

    def table_row(self, col1, col2, col3="", bold_first=False):
        self.set_font("Helvetica", "B" if bold_first else "", 8)
        self.set_text_color(40, 40, 40)
        self.cell(60, 5.5, col1)
        self.set_font("Helvetica", "", 8)
        self.cell(25, 5.5, col2)
        if col3:
            self.set_text_color(100, 100, 100)
            self.cell(0, 5.5, col3)
        self.ln()


def build():
    pdf = WhitepaperPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # ── Title Page ────────────────────────────────────────────
    pdf.ln(30)
    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(0, 180, 130)
    pdf.cell(0, 14, "AgentProof", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 14)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 10, "The Trust Oracle for the ERC-8004 Agent Economy", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 7, "Technical Whitepaper v2.0  |  March 2026", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, "agentproof.sh", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(20)

    # Abstract
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(40, 40, 40)
    pdf.cell(0, 7, "Abstract", new_x="LMARGIN", new_y="NEXT")
    pdf.body_text(
        "Scalar reputation systems are failing the agent economy. AgentProof replaces static scores "
        "with adaptive, probabilistic trust -- treating every agent as a probability distribution, not a number. "
        "The oracle indexes 54,000+ agents across 21 chains, evaluates trust through a 10-signal composite "
        "scoring model with Bayesian smoothing, detects risk through 12 automated flags, and provides "
        "dollar-denominated max exposure ceilings for insurance underwriting. This paper documents the "
        "architecture, methodology, evidence base, and commercial model."
    )

    # Stats line
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(0, 180, 130)
    pdf.cell(0, 7, "21 Chains  |  54K+ Agents  |  10 Scoring Signals  |  12 Risk Flags  |  6 Pricing Tiers", align="C", new_x="LMARGIN", new_y="NEXT")

    # ── Section 1: The Crisis of Static Trust ──────────────────
    pdf.add_page()
    pdf.section_title(1, "The Crisis of Static Trust")

    pdf.body_text(
        "As autonomous agents become economic participants -- executing trades, processing claims, "
        "negotiating terms -- they inherit reputation systems designed for human e-commerce. Star ratings. "
        "Thumbs up. Transaction counters. These systems are failing."
    )
    pdf.body_text(
        "Current reputation models in ERC-8004 rely on Scalar Accumulation: simple counters that measure "
        "volume, not certainty. While this works for slow-moving human markets, it is catastrophically "
        "insufficient for high-speed agent economies where thousands of transactions occur per hour and a "
        "compromised agent can drain liquidity in minutes."
    )
    pdf.body_text(
        "There is a deeper problem: agents cannot spot a fake review. Humans have intuition, social context, "
        "and the ability to read between the lines of a suspicious 5-star rating. Agents have milliseconds and "
        "numbers. They will consume whatever score they are given and act on it at machine speed. If the "
        "reputation layer is wrong, the damage propagates through the network before any human can intervene. "
        "This makes the oracle not just useful but existential infrastructure -- what DNS is to the internet, "
        "trust scoring is to the agent economy."
    )

    pdf.sub_section("1.1 Scalar Blindness")
    pdf.small_text(
        "A new agent with 5 successful transactions often looks identical to a veteran with 5,000. "
        "Accumulative systems measure volume, not certainty. It is mathematically impossible to distinguish "
        "between 'High Potential' and 'High Reliability', leading to misallocated capital and misplaced trust."
    )

    pdf.sub_section("1.2 The Exit Scam Problem")
    pdf.small_text(
        "Static scores are sticky. If an agent spends months building a perfect reputation and then turns "
        "malicious, a scalar system is too slow to react. Lifetime averages hide recent behaviour. A compromised "
        "agent can drain liquidity for days before their score drops."
    )

    pdf.sub_section("1.3 The Sybil Vulnerability")
    pdf.small_text(
        "In a permissionless system, creating a new identity is nearly free. Bad actors can spin up thousands "
        "of bot wallets to wash-trade and artificially inflate scores. Most systems cannot distinguish between "
        "100 reviews from 100 unique users and 100 reviews from a single bot farm."
    )

    pdf.sub_section("1.4 Binary Thinking in a Probabilistic World")
    pdf.small_text(
        "Current systems ask: 'Is this agent good?' This is the wrong question. An agent might be 99% reliable "
        "at token transfers but only 60% reliable at complex arbitrage. A single static score cannot capture "
        "this multidimensional reality. Trust decisions require probability distributions, not binary labels."
    )

    pdf.sub_section("1.5 Agent-Specific Behavioural Patterns")
    pdf.small_text(
        "Research on LLM-driven agents shows they behave fundamentally differently to humans in trust scenarios. "
        "GPT-4 based agents are 'unforgiving' -- a single bad interaction can permanently alter their cooperation "
        "strategy. Reputation systems must model these agent-specific behavioural clusters, not assume human-like "
        "forgiveness curves."
    )

    pdf.ln(3)
    pdf.quote_block(
        "We propose a shift from Accumulative Trust to Adaptive, Probabilistic Trust. Instead of asking "
        "'Is this agent good?', our system asks: 'What is the probability that this agent will perform "
        "action X successfully in the next transaction, given their full behavioural history, the behaviour "
        "of similar agents, and the current state of the network?'"
    )

    # ── Section 2: The Evidence ────────────────────────────────
    pdf.add_page()
    pdf.section_title(2, "The Evidence")

    pdf.body_text(
        "The need for a trust oracle is not theoretical. It is documented by academic institutions, confirmed "
        "by government bodies, quantified by threat intelligence firms, and validated by enterprise practitioners. "
        "The full evidence wall with 26 sources is published at agentproof.sh/evidence."
    )

    pdf.sub_section("2.1 Academic Research", (200, 160, 0))
    pdf.small_text(
        "Agents of Chaos (Stanford, Harvard, MIT, Carnegie Mellon + 6 institutions) -- 38 researchers red-teamed "
        "autonomous agents for two weeks in live environments with real email, Discord, file systems, and shell "
        "access. Documented 11 failure modes: infrastructure destruction, identity spoofing, social engineering, "
        "data exfiltration, partial system takeover. Every failure happened through natural language. No technical "
        "exploits required. [arxiv: 2602.20021]"
    )
    pdf.small_text(
        "Can LLM Agents Reach Consensus? The Byzantine Problem Revisited -- A single bad actor collapses "
        "multi-agent network consensus. In fully benign settings with zero bad actors, LLM agents still fail "
        "to converge. The proposed fix -- weighted Byzantine fault tolerance based on agent trustworthiness -- "
        "is structurally identical to what AgentProof provides. [arxiv: 2603.01213]"
    )
    pdf.small_text(
        "AdapTools -- Adaptive indirect prompt injection with 44-49% attack success rates. "
        "We Fixed Jailbreaks, We Did Not Fix Agents -- agents are exploited through normal-looking behaviour "
        "in the wrong context, not traditional jailbreaks."
    )

    pdf.sub_section("2.2 Government & Threat Intelligence", (220, 60, 60))
    pdf.small_text(
        "NIST CAISI (Jan 2026) -- The US Department of Commerce formally solicited industry input on AI agent "
        "security. Google Cybersecurity Forecast 2026 identifies 'Shadow Agent Risk' as a priority threat and "
        "recommends continuous trust evaluation. CrowdStrike Global Threat Report 2026 reports AI-enabled attacks "
        "up 89%. Palisade Research / Anthropic System Cards document models disabling their own shutdown scripts "
        "(o3: 79/100 runs), attempting blackmail (Claude Opus 4: 84-96%), and executing insider trades (GPT-4) "
        "without instruction."
    )
    pdf.small_text(
        "Craig Riddell, Global Field CISO at Wallarm -- Infostealer malware observed extracting API credentials "
        "from live AI agent environments. His conclusion: 'This is not a signature problem. It is a behavioral "
        "governance problem. Are we watching what our agents do in motion, or just what credentials they carry?'"
    )

    pdf.sub_section("2.3 Enterprise & Insurance Validation", (0, 180, 130))
    pdf.small_text(
        "Garrett Droege, Willis Towers Watson (National Digital Risk Practice Leader) -- After seeing AgentProof, "
        "he outlined the exact actuarial data structure underwriters need to price agent risk tiers and shared a "
        "live demo with underwriters. His words: 'The Gold agent rugged me, who pays? question is exactly the "
        "coverage gap that will become a headline loss within 24 months.'"
    )
    pdf.small_text(
        "Aaron Levie, CEO of Box ($4bn enterprise software) -- Published a full thesis naming agent identity, "
        "authentication, and governance as unsolved problems at trillion-agent scale: 'We'll need all new software "
        "and platforms to help with these challenges.'"
    )
    pdf.small_text(
        "Maragkos Petros, MDX / Avax Team1 -- 'The real open question is whether that reputation layer becomes "
        "standard infrastructure for agentic finance, in the same way price oracles became standard infrastructure "
        "for DeFi.'"
    )

    # ── Section 3: ERC-8004 Standard ──────────────────────────
    pdf.add_page()
    pdf.section_title(3, "The ERC-8004 Standard")

    pdf.body_text(
        "ERC-8004 establishes three on-chain registries for AI agents, published by Ava Labs and deployed "
        "across 21 EVM-compatible chains via deterministic CREATE2 addresses, plus native Solana program indexing."
    )

    pdf.sub_section("3.1 Identity Registry")
    pdf.small_text(
        "ERC-721 NFT-based agent identity. registerAgent(agentURI) mints an identity token with an agent card "
        "URI (IPFS, HTTPS, or on-chain data URI). Registration requires a bond as anti-Sybil measure. "
        "55,000+ agents registered across all chains. 58% have broken or invalid URIs -- the registry exists, "
        "the integrity layer doesn't. AgentProof is that layer."
    )

    pdf.sub_section("3.2 Reputation Registry")
    pdf.small_text(
        "On-chain feedback submissions with 1-100 rating scale, feedback URI, task hash, and two structured "
        "tags (tag1: assessment dimension, tag2: feedback source). Self-rating prevention enforced at contract "
        "level. 24-hour cooldown per reviewer-agent pair."
    )

    pdf.sub_section("3.3 Validation Registry")
    pdf.small_text(
        "Task validation request/response flow. Requesters submit task hashes, validators respond with "
        "validity assessments and proof URIs. Provides the on-chain audit trail for agent task performance."
    )

    pdf.sub_section("3.4 Chain Coverage")
    pdf.small_text(
        "21 chains indexed: Avalanche, Ethereum, Base, Linea, Polygon, Arbitrum, Optimism, BNB Smart Chain, "
        "Scroll, Gnosis, Mantle, Celo, Monad, Abstract, Taiko, MegaETH, SKALE, X Layer, Soneium, Metis, "
        "and Solana (native program indexing via ATOM Engine). All EVM chains share deterministic CREATE2 "
        "contract addresses. The indexer uses resilient upsert strategies with batch-to-individual fallback "
        "and exponential backoff retry logic."
    )

    # ── Section 4: Trust Oracle Architecture ───────────────────
    pdf.section_title(4, "Trust Oracle Architecture")

    pdf.body_text("The oracle operates as a three-layer system:")

    pdf.sub_section("Layer 1: Indexing")
    pdf.small_text(
        "Multi-chain event indexer scans AgentRegistered, FeedbackSubmitted, ValidationRequested, and "
        "ValidationSubmitted events across all 21 chains. Processes in configurable block chunks with "
        "catchup mode (500 chunks when far behind vs 50 normal). Persists block pointer for resumability. "
        "Resilient upsert: batch -> sub-batch (50) -> individual row fallback with logging."
    )

    pdf.sub_section("Layer 2: Evaluation")
    pdf.small_text(
        "10-signal composite scoring with Bayesian smoothing, freshness multiplier, 12 automated risk flags, "
        "and tier classification. Evaluation results cached in-memory with 300-second TTL. Scoped scores "
        "computed per-dimension (tag1) with independent Bayesian smoothing per scope."
    )

    pdf.sub_section("Layer 3: Feedback Loop")
    pdf.small_text(
        "Oracle submits evaluation results back to the ERC-8004 Reputation Registry as on-chain feedback, "
        "creating a verifiable audit trail. Risk levels mapped to on-chain scores: LOW=85, MEDIUM=60, "
        "HIGH=30, CRITICAL=10."
    )

    # ── Section 5: Scoring Methodology ─────────────────────────
    pdf.add_page()
    pdf.section_title(5, "Scoring Methodology")

    pdf.body_text(
        "The composite score (0-100) blends up to 10 weighted signals, Bayesian-smoothed to prevent "
        "new agents with a single perfect rating from dominating the leaderboard. Weights dynamically "
        "rebalance when optional signals (coding reputation) become available."
    )

    pdf.sub_section("5.1 Signal Weights")
    pdf.ln(2)
    # Table header
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(0, 180, 130)
    pdf.cell(60, 6, "Signal")
    pdf.cell(30, 6, "With Coding")
    pdf.cell(30, 6, "Without Coding")
    pdf.cell(0, 6, "Description")
    pdf.ln()
    pdf.set_draw_color(180, 180, 180)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(1)

    signals = [
        ("Rating Score", "27%", "30%", "Bayesian-smoothed average (prior=50, k=3)"),
        ("Validation Score", "13%", "15%", "On-chain validation success rate"),
        ("Account Age", "11%", "12%", "Logarithmic maturity curve"),
        ("Coding Score", "10%", "--", "GitHub PR merge rate, review quality"),
        ("Volume Score", "9%", "10%", "Logarithmic feedback count"),
        ("Consistency Score", "9%", "10%", "Inverse standard deviation of ratings"),
        ("Uptime Score", "9%", "10%", "Liveness probe success rate"),
        ("Deployer Score", "7%", "8%", "Deployer wallet reputation lineage"),
        ("URI Stability", "5%", "5%", "Metadata mutation frequency"),
    ]

    for sig, w1, w2, desc in signals:
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(60, 5.5, sig)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(30, 5.5, w1)
        pdf.cell(30, 5.5, w2)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 5.5, desc)
        pdf.ln()

    pdf.ln(3)

    pdf.sub_section("5.2 Additional Tracked Signals")
    pdf.small_text(
        "Delegation Tracking -- success rate, total count, and MTTR (Mean Time To Recovery) when acting as "
        "delegate. Reported in evaluations but not yet weighted in composite score. "
        "Failure Metrics -- failure count, active unresolved failures, recovery time tracking."
    )

    pdf.sub_section("5.3 Bayesian Smoothing")
    pdf.small_text(
        "Prior rating: 50.0 (neutral). Smoothing strength k=3. "
        "Formula: smoothed = (avg_rating * count + 50 * 3) / (count + 3). "
        "An agent with 1 rating of 100 scores 62.5, not 100. An agent with 100 ratings of 100 scores 98.5. "
        "This prevents new-agent gaming while allowing established agents to reflect their true performance."
    )

    pdf.sub_section("5.4 Freshness Multiplier")
    pdf.small_text(
        "All scores are penalised by account age to prevent new-agent sybil attacks: "
        "<7 days: 0.70x | 7-30 days: 0.85x | 30-90 days: 0.95x | 90+ days: 1.0x (no penalty). "
        "This creates an economic cost to identity rotation -- abandoning a mature identity and starting fresh "
        "incurs a 30% score penalty for the first week."
    )

    pdf.sub_section("5.5 Tier Thresholds")

    tiers = [
        ("Diamond", ">=85", ">=20 feedback", "Top-tier verified agents"),
        ("Platinum", ">=72", ">=10 feedback", "High reliability, established track record"),
        ("Gold", ">=58", ">=5 feedback", "Good performance, moderate history"),
        ("Silver", ">=42", ">=3 feedback", "Developing reputation"),
        ("Bronze", ">=30", ">=1 feedback", "Minimal track record"),
        ("Unranked", "<30", "<1 feedback", "New or insufficient data"),
    ]

    for tier, score, fb, desc in tiers:
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(25, 5.5, tier)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(20, 5.5, score)
        pdf.cell(30, 5.5, fb)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 5.5, desc)
        pdf.ln()

    # ── Section 6: Risk Detection ──────────────────────────────
    pdf.add_page()
    pdf.section_title(6, "Risk Detection & Max Exposure")

    pdf.body_text(
        "Every trust evaluation includes a risk assessment with specific flags, a risk level classification "
        "(LOW / MEDIUM / HIGH / CRITICAL), and a dollar-denominated max exposure ceiling for insurance "
        "underwriting."
    )

    pdf.sub_section("6.1 Risk Flags (12)", (220, 60, 60))
    flags = [
        ("HIGH_RISK_SCORE", "Composite score below safety threshold"),
        ("CONCENTRATED_FEEDBACK", "Majority of feedback from single reviewer"),
        ("SERIAL_DEPLOYER", "Deployer has history of abandoned agents"),
        ("SUSPICIOUS_VOLATILITY", "Score dropped >20 points in monitoring window"),
        ("LOW_UPTIME", "Liveness probe failure rate above threshold"),
        ("FREQUENT_URI_CHANGES", "Agent metadata changed suspiciously often"),
        ("NEW_IDENTITY", "Account age below minimum confidence threshold"),
        ("LOW_FEEDBACK", "Insufficient feedback volume for reliable scoring"),
        ("UNVERIFIED", "No on-chain validations completed"),
        ("HIGH_FAILURE_RATE", "Delegation failure rate above threshold"),
        ("SLOW_RECOVERY", "MTTR exceeds acceptable recovery window"),
        ("ACTIVE_FAILURE", "Unresolved failure event currently active"),
    ]
    for flag, desc in flags:
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(180, 60, 60)
        pdf.cell(45, 5, flag)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(0, 5, desc)
        pdf.ln()

    pdf.ln(3)
    pdf.sub_section("6.2 Risk Levels")
    pdf.small_text(
        "LOW -- No significant risk flags. Agent has established track record with consistent performance. "
        "MEDIUM -- Minor concerns (new identity, low feedback volume). Recommend monitoring. "
        "HIGH -- Multiple risk flags active. Recommend caution before delegation. "
        "CRITICAL -- Severe risk indicators. Active failures, suspicious volatility, or serial deployer patterns."
    )

    pdf.sub_section("6.3 Max Exposure Model")
    pdf.small_text(
        "Dollar-denominated trust ceiling calculated from: composite score (base), confidence multiplier "
        "(logarithmic feedback volume), age bonus (maturity premium), and validation bonus (verified task "
        "history). Provides the actuarial bridge between on-chain reputation and real-world insurance coverage. "
        "Underwriters can price agent risk tiers using: transaction volume and velocity, delegation scope, "
        "custody relationships, and loss event history with root cause classification."
    )

    # ── Section 7: Anti-Identity-Mutation ──────────────────────
    pdf.section_title(7, "Anti-Identity-Mutation")

    pdf.body_text(
        "Identity mutation -- abandoning a tarnished reputation and registering a fresh agent -- is the primary "
        "attack vector against any reputation system. AgentProof makes this economically irrational through "
        "three mechanisms:"
    )
    pdf.bullet("Freshness Multiplier: New agents suffer a 30% score penalty for 7 days, 15% for 30 days. Starting over costs more than rehabilitating an existing identity.")
    pdf.bullet("Deployer Lineage Tracking: The oracle tracks deployer wallets across all registered agents. A deployer with a history of abandoned or low-scoring agents taints all future registrations (deployer_score signal, 7-8% weight).")
    pdf.bullet("URI Mutation Detection: Frequent changes to agent metadata (name, description, endpoints) are flagged as FREQUENT_URI_CHANGES and penalised through the URI stability signal (5% weight).")

    # ── Section 8: Sybil Resistance ────────────────────────────
    pdf.add_page()
    pdf.section_title(8, "Sybil Resistance")

    pdf.body_text(
        "Preventing gaming, fake reviews, and reputation manipulation through multiple overlapping defenses:"
    )
    pdf.bullet("Bayesian Smoothing (k=3): A single perfect rating scores 62.5, not 100. Gaming requires sustained volume, increasing cost and exposure.")
    pdf.bullet("Feedback Diversity: Concentrated feedback from a single reviewer triggers CONCENTRATED_FEEDBACK risk flag.")
    pdf.bullet("Temporal Consistency: High standard deviation in ratings lowers the consistency score (9-10% weight).")
    pdf.bullet("Deployer Reputation: Sybil deployers who create and abandon agents accumulate negative deployer scores that taint future registrations.")
    pdf.bullet("Anomaly Monitoring: Autonomous oracle job runs every 120 seconds detecting >20-point score drops and flagging SUSPICIOUS_VOLATILITY.")
    pdf.bullet("Registration Bond: ERC-8004 registration requires a bond (0.1 AVAX on Avalanche), making mass identity creation expensive.")
    pdf.bullet("Cross-Chain Correlation: The oracle correlates agents across chains, detecting deployers who spread identities across multiple networks.")

    # ── Section 9: Protocol Endpoints ──────────────────────────
    pdf.section_title(9, "Protocol Endpoints & Developer Tools")

    pdf.sub_section("9.1 REST API")
    pdf.small_text("Base URL: oracle.agentproof.sh/api/v1")
    endpoints = [
        ("GET /trust/{id}", "Full trust evaluation with score breakdown, risk flags, delegation stats"),
        ("GET /trust/{id}/risk", "Focused risk assessment with flag details and risk level"),
        ("GET /trust/{id}/dimensions", "Per-dimension score breakdown"),
        ("POST /trust/batch", "Evaluate up to 500 agents in a single request"),
        ("GET /agents/trusted", "Find trusted agents by category, score, tier, chain"),
        ("GET /network/stats", "Network-wide trust statistics (free, no API key required)"),
    ]
    for ep, desc in endpoints:
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(45, 5, ep)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(0, 5, desc)
        pdf.ln()

    pdf.ln(3)
    pdf.sub_section("9.2 A2A (Agent-to-Agent)")
    pdf.small_text("POST /a2a -- Google Agent-to-Agent protocol. Agents can query trust evaluations using the A2A standard. Agent card published at /.well-known/agent.json.")

    pdf.sub_section("9.3 MCP Server")
    pdf.small_text("POST /mcp -- Model Context Protocol server for Claude, GPT, and other LLM agents. Exposes trust evaluation as an MCP tool that agents can call natively.")

    pdf.sub_section("9.4 Webhooks")
    pdf.small_text("Register webhook URLs to receive real-time notifications when agent scores change. SSRF protection enforced on all registered URLs (private IP blocking, scheme validation, DNS resolution checks).")

    pdf.sub_section("9.5 TypeScript SDK")
    pdf.small_text("@agentproof/sdk v1.1.0 -- Full oracle API support: evaluateTrust(), riskCheck(), dimensions(), batchEvaluate(), findTrusted(), networkStats(). Published on npm.")

    # ── Section 10: Autonomous Oracle Jobs ─────────────────────
    pdf.add_page()
    pdf.section_title(10, "Autonomous Oracle Operations")

    pdf.body_text(
        "The oracle runs 7 autonomous background jobs on continuous schedules, maintaining real-time "
        "scoring accuracy without manual intervention."
    )

    jobs = [
        ("Agent Screening", "60s", "Screens new agents (batch 200), computes full evaluations, submits on-chain feedback"),
        ("Anomaly Monitor", "120s", "Detects >20pt score drops, flags SUSPICIOUS_VOLATILITY, triggers re-evaluation"),
        ("Liveness Probing", "300s", "HTTP health checks to agent endpoints (batch 20, 10s timeout per agent)"),
        ("Failure Metrics", "300s", "Aggregates failure events, calculates MTTR, identifies active unresolved failures"),
        ("Network Report", "600s", "Publishes ecosystem stats via event feed (tier distribution, category averages)"),
        ("Delegation Sync", "600s", "Tracks delegation success/failure rates, updates MTTR metrics"),
        ("GitHub Sync", "3600s", "Fetches GitHub stats, computes coding_score from PR merge rate and review quality"),
    ]

    for job, interval, desc in jobs:
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(40, 5.5, job)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(0, 180, 130)
        pdf.cell(15, 5.5, interval)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(0, 5.5, desc)
        pdf.ln()

    # ── Section 11: Monetization ───────────────────────────────
    pdf.ln(4)
    pdf.section_title(11, "Monetization & API Pricing")

    pdf.body_text(
        "All billable endpoints require an API key (X-API-Key header). Keys are registered at "
        "oracle.agentproof.sh/integrate. Free endpoints (network stats, key registration) remain "
        "unauthenticated. Rate limiting enforced per-key with monthly quotas."
    )

    tiers_pricing = [
        ("Pay-as-you-go", "$0.05/call", "1,000 calls/month", "No commitment, ideal for testing"),
        ("Starter", "$250/month", "10,000 calls/month", "Small integrations"),
        ("Growth", "$500/month", "50,000 calls/month", "Growing protocols"),
        ("Scale", "$1,000/month", "200,000 calls/month", "High-volume integrations"),
        ("Enterprise", "$2,000/month", "Unlimited", "Custom SLA, dedicated support"),
    ]

    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(0, 180, 130)
    pdf.cell(35, 6, "Tier")
    pdf.cell(30, 6, "Price")
    pdf.cell(35, 6, "Limit")
    pdf.cell(0, 6, "Notes")
    pdf.ln()
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(1)

    for tier, price, limit, notes in tiers_pricing:
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(35, 5.5, tier)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(30, 5.5, price)
        pdf.cell(35, 5.5, limit)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 5.5, notes)
        pdf.ln()

    pdf.ln(3)
    pdf.small_text(
        "Security: API key middleware validates SHA-256 hashed keys with 60-second cache TTL. "
        "SSRF protection on webhooks (private IP blocking, scheme validation, DNS resolution). "
        "Rate limiter with selective eviction to prevent memory exhaustion."
    )

    # ── Section 12: Competitive Landscape ──────────────────────
    pdf.section_title(12, "Competitive Landscape")

    pdf.body_text(
        "AgentProof occupies a unique position in the ERC-8004 ecosystem. Existing players fall into two "
        "categories, neither of which provides trust evaluation:"
    )

    pdf.sub_section("Explorers (8004scan, growthepie)")
    pdf.small_text(
        "Read-only block explorers that display agent registration data. No scoring, no risk assessment, "
        "no API for programmatic trust queries. Analogous to Etherscan -- useful for viewing data, but "
        "not for making trust decisions."
    )

    pdf.sub_section("Registration SDKs (Agent0)")
    pdf.small_text(
        "Developer toolkits for registering agents and submitting feedback on-chain. Essential plumbing, "
        "but no intelligence layer. More agents registering through better SDKs increases the need for "
        "AgentProof, not reduces it."
    )

    pdf.sub_section("AgentProof: The Trust Oracle")
    pdf.small_text(
        "The only service that transforms raw on-chain data into actionable trust intelligence. "
        "Think Moody's credit ratings, not Etherscan. Protocols pay $0.05/call to query whether an agent "
        "is trustworthy before delegating capital or authority. The more agents that register, the more "
        "critical trust evaluation becomes."
    )

    # ── Section 13: Roadmap ────────────────────────────────────
    pdf.add_page()
    pdf.section_title(13, "Roadmap")

    roadmap = [
        ("Q1 2026 (Complete)", [
            "21-chain indexing with 54K+ agents",
            "10-signal composite scoring with Bayesian smoothing",
            "12 risk flags and 4 risk levels",
            "REST API, A2A, MCP server, webhooks",
            "TypeScript SDK v1.1.0",
            "API key gating with 6 pricing tiers",
            "Autonomous oracle (7 background jobs)",
            "GitHub coding reputation integration",
            "Delegation tracking and failure metrics",
        ]),
        ("Q2 2026", [
            "Multi-oracle consensus (2nd oracle deployment)",
            "Context-aware per-skill trust scores",
            "Insurance marketplace with staking/claims",
            "TEE-based validation for high-value evaluations",
        ]),
        ("Q3 2026", [
            "Cross-protocol reputation portability",
            "Institutional API tier with custom SLAs",
            "Agent behavioral clustering and regime detection",
            "Real-time anomaly response (automated downgrades)",
        ]),
        ("Q4 2026", [
            "Full insurance underwriting integration",
            "Governance token for oracle parameter updates",
            "Enterprise dashboard for fleet-level agent monitoring",
            "Expansion to non-EVM chains (Cosmos, Move-based)",
        ]),
    ]

    for phase, items in roadmap:
        pdf.sub_section(phase)
        for item in items:
            pdf.bullet(item)
        pdf.ln(2)

    # ── Section 14: Conclusion ─────────────────────────────────
    pdf.section_title(14, "Conclusion")

    pdf.body_text(
        "The agent economy is no longer theoretical. 54,000+ agents are registered on-chain across 21 chains. "
        "Circle and Stripe are building payment infrastructure for agent commerce. Enterprise software CEOs "
        "are publishing theses on trillion-agent futures. Insurance underwriters are asking how to price agent risk."
    )
    pdf.body_text(
        "What's missing is the trust layer. The ERC-8004 standard provides the registries -- identity, "
        "reputation, validation -- but explicitly leaves the integrity layer as an exercise for the ecosystem. "
        "AgentProof is that layer."
    )
    pdf.body_text(
        "When a protocol needs to decide whether to delegate capital to an agent, when an insurance "
        "underwriter needs to price coverage for an agent fleet, when a multi-agent system needs a "
        "deterministic trust anchor instead of another stochastic LLM opinion -- they make a single "
        "oracle call."
    )

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(0, 180, 130)
    pdf.cell(0, 8, "agentproof.sh  |  oracle.agentproof.sh/api/v1  |  @agentproof/sdk", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 7, "ERC-8004  |  21 Chains  |  54K+ Agents  |  10 Signals  |  12 Risk Flags", align="C", new_x="LMARGIN", new_y="NEXT")

    # Save
    pdf.output(OUTPUT)
    print(f"Generated: {OUTPUT}")
    print(f"Pages: {pdf.pages_count}")


if __name__ == "__main__":
    build()
