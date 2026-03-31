"""Generate AgentProof Whitepaper v2.3 PDF using ReportLab."""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUTPUT = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "agentproof-whitepaper.pdf")

# Colors
DARK_BG = HexColor("#0a0a0a")
EMERALD = HexColor("#34d399")
EMERALD_DIM = HexColor("#065f46")
GRAY_300 = HexColor("#d1d5db")
GRAY_400 = HexColor("#9ca3af")
GRAY_500 = HexColor("#6b7280")
GRAY_600 = HexColor("#4b5563")
GRAY_800 = HexColor("#1f2937")
RED_400 = HexColor("#f87171")
AMBER_400 = HexColor("#fbbf24")
WHITE = HexColor("#ffffff")

VERSION = "v2.3"
DATE = "March 2026"

styles = getSampleStyleSheet()

# Custom styles
title_style = ParagraphStyle(
    "WPTitle", parent=styles["Title"],
    fontSize=24, leading=30, textColor=WHITE, alignment=TA_CENTER,
    spaceAfter=6,
)
subtitle_style = ParagraphStyle(
    "WPSubtitle", parent=styles["Normal"],
    fontSize=10, leading=14, textColor=GRAY_400, alignment=TA_CENTER,
    spaceAfter=12,
)
stats_line_style = ParagraphStyle(
    "StatsLine", parent=styles["Normal"],
    fontSize=8, leading=12, textColor=EMERALD, alignment=TA_CENTER,
    fontName="Courier", spaceAfter=4, spaceBefore=4,
)
section_style = ParagraphStyle(
    "Section", parent=styles["Heading1"],
    fontSize=16, leading=20, textColor=WHITE, spaceBefore=20, spaceAfter=8,
)
subsection_style = ParagraphStyle(
    "Subsection", parent=styles["Heading2"],
    fontSize=11, leading=14, textColor=EMERALD, spaceBefore=10, spaceAfter=4,
)
body_style = ParagraphStyle(
    "WPBody", parent=styles["Normal"],
    fontSize=9, leading=13, textColor=GRAY_300, alignment=TA_JUSTIFY,
    spaceAfter=6,
)
small_style = ParagraphStyle(
    "WPSmall", parent=styles["Normal"],
    fontSize=7.5, leading=10, textColor=GRAY_500, spaceAfter=4,
)
mono_style = ParagraphStyle(
    "WPMono", parent=styles["Normal"],
    fontSize=7.5, leading=10, textColor=EMERALD, fontName="Courier",
    spaceAfter=2,
)
label_style = ParagraphStyle(
    "WPLabel", parent=styles["Normal"],
    fontSize=7, leading=9, textColor=GRAY_500, fontName="Courier",
    spaceAfter=2, spaceBefore=8,
)
footer_style = ParagraphStyle(
    "WPFooter", parent=styles["Normal"],
    fontSize=6.5, leading=8, textColor=GRAY_600, alignment=TA_CENTER,
)


def header_footer(canvas, doc):
    canvas.saveState()
    # Background
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, 0, A4[0], A4[1], fill=1)
    # Header line
    canvas.setStrokeColor(EMERALD_DIM)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, A4[1] - 15*mm, A4[0] - 20*mm, A4[1] - 15*mm)
    # Header text
    canvas.setFillColor(GRAY_600)
    canvas.setFont("Courier", 6.5)
    canvas.drawString(20*mm, A4[1] - 13*mm, f"AgentProof Technical Whitepaper {VERSION} | {DATE}")
    canvas.drawRightString(A4[0] - 20*mm, A4[1] - 13*mm, f"Page {doc.page}")
    # Footer line
    canvas.line(20*mm, 15*mm, A4[0] - 20*mm, 15*mm)
    canvas.drawCentredString(A4[0]/2, 10*mm, f"AgentProof {VERSION} | 21 Chains | 9 Oracle Deployments | 150.9K+ Agents | 15 Risk Flags | {DATE}")
    canvas.restoreState()


def build():
    doc = SimpleDocTemplate(
        OUTPUT, pagesize=A4,
        topMargin=22*mm, bottomMargin=22*mm,
        leftMargin=20*mm, rightMargin=20*mm,
    )

    story = []

    # ===== COVER =====
    story.append(Spacer(1, 40*mm))
    story.append(Paragraph("AgentProof", title_style))
    story.append(Paragraph("Trust Infrastructure for the Agent Economy", ParagraphStyle(
        "CoverSub", parent=subtitle_style, fontSize=13, leading=18, spaceAfter=16,
    )))
    story.append(Paragraph(
        f"Technical Whitepaper {VERSION} &bull; {DATE}",
        ParagraphStyle("CoverVer", parent=stats_line_style, fontSize=9),
    ))
    story.append(Spacer(1, 8*mm))
    story.append(Paragraph(
        "21 Chains Indexed &nbsp;|&nbsp; 9 Oracle Deployments &nbsp;|&nbsp; 150.9K+ Agents &nbsp;|&nbsp; "
        "221.3K+ Evaluations &nbsp;|&nbsp; 2 Oracle Operators &nbsp;|&nbsp; 15 Risk Flags",
        stats_line_style,
    ))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "307.2K+ Screenings &nbsp;|&nbsp; 43.8 Average Trust Score (0-100)",
        stats_line_style,
    ))
    story.append(Spacer(1, 12*mm))
    story.append(Paragraph(
        "150,900+ agents are registered on-chain across 21 chains. Protocols need to know which ones to trust "
        "before delegating capital. AgentProof is the oracle they query.",
        ParagraphStyle("CoverDesc", parent=body_style, alignment=TA_CENTER, fontSize=10, leading=15),
    ))
    story.append(PageBreak())

    # ===== ABSTRACT =====
    story.append(Paragraph("Abstract", section_style))
    story.append(Paragraph(
        "ERC-8004 gave AI agents an on-chain identity standard. Three registries &mdash; identity, reputation, "
        "validation &mdash; deployed across 21 chains via deterministic CREATE2 addresses. 150,900+ agents registered. "
        "221,300+ evaluations computed. 307,200+ screenings performed. Average trust score: 43.8/100. "
        "The standard works. But the standard explicitly leaves the <b>integrity layer</b> as an exercise for the ecosystem.",
        body_style,
    ))
    story.append(Paragraph(
        "AgentProof fills this gap. Not a scoring model &mdash; <b>infrastructure</b>. An on-chain oracle that protocols "
        "call before delegating capital. A hook that blocks untrusted agents at the smart contract level. An API that "
        "agents query before hiring other agents. The data pipeline that underwriters use to price coverage.",
        body_style,
    ))
    story.append(Spacer(1, 6*mm))

    # ===== SECTION 1: THE INFRASTRUCTURE GAP =====
    story.append(Paragraph("1. The Infrastructure Gap", section_style))
    story.append(Paragraph(
        "ERC-8004 gave agents an identity standard. Three on-chain registries &mdash; identity, reputation, validation "
        "&mdash; deployed across 21 chains via deterministic CREATE2 addresses. 150,900+ agents registered. The standard works.",
        body_style,
    ))
    story.append(Paragraph(
        "But the standard explicitly leaves the <b>integrity layer</b> as an exercise for the ecosystem. The registries "
        "store data. They don't evaluate it. A 5-star rating from a bot farm sits next to a 5-star rating from a verified "
        "counterparty. The contract can't tell the difference. Neither can the agent querying it at machine speed.",
        body_style,
    ))
    story.append(Paragraph(
        "This is the gap AgentProof fills. Not a better scoring model &mdash; <b>the infrastructure that makes trust "
        "queryable</b>. An on-chain oracle that protocols call before delegating capital. A hook that blocks untrusted "
        "agents at the smart contract level. An API that agents query before hiring other agents.",
        body_style,
    ))

    story.append(Paragraph("1.1 The Registries Exist. The Oracle Doesn't.", subsection_style))
    story.append(Paragraph(
        "ERC-8004 block explorers (8004scan, growthepie) display registration data. Developer SDKs (Agent0) make it easy "
        "to register and submit feedback. But nobody transforms that raw data into actionable trust signals that protocols "
        "can consume programmatically. 58% of registered agents have broken or invalid URIs. The data is there. "
        "The intelligence isn't.",
        small_style,
    ))
    story.append(Paragraph("1.2 Agents Can't Read Between the Lines", subsection_style))
    story.append(Paragraph(
        "Humans have intuition, social context, the ability to spot a suspicious 5-star review. Agents have milliseconds "
        "and numbers. They consume whatever score they're given and act on it at machine speed. If the trust layer is wrong, "
        "the damage propagates through the network before any human can intervene. This makes the oracle existential "
        "infrastructure &mdash; what DNS is to the internet, trust scoring is to the agent economy.",
        small_style,
    ))
    story.append(Paragraph("1.3 Commerce Is Already Here", subsection_style))
    story.append(Paragraph(
        "ERC-ACP (Agentic Commerce Protocol) by Virtuals Protocol adds job escrow with Client-Provider-Evaluator lifecycle. "
        "Circle and Stripe are building payment rails for agent commerce. x402 enables pay-per-call agent services. "
        "The commerce layer is live. The trust layer isn't. Every job assigned to an unvetted agent is a liability without a score.",
        small_style,
    ))

    # ===== SECTION 2: THE EVIDENCE =====
    story.append(Paragraph("2. The Evidence", section_style))
    story.append(Paragraph(
        "The need for trust infrastructure is documented by academic institutions, confirmed by government bodies, "
        "quantified by threat intelligence firms, and validated by enterprise practitioners.",
        body_style,
    ))
    story.append(Paragraph("Academic Research", subsection_style))
    story.append(Paragraph(
        "<b>Agents of Chaos</b> &mdash; Published by researchers from Stanford, Harvard, MIT, Carnegie Mellon, and six other "
        "institutions. 38 researchers red-teamed autonomous agents in live environments. Documented 11 failure modes through "
        "natural language alone. <b>Can LLM Agents Reach Consensus?</b> &mdash; A single bad actor collapses multi-agent "
        "network consensus. The proposed fix &mdash; weighted Byzantine fault tolerance based on agent trustworthiness &mdash; "
        "requires exactly the kind of queryable trust oracle AgentProof provides.",
        small_style,
    ))
    story.append(Paragraph("Government & Threat Intelligence", subsection_style))
    story.append(Paragraph(
        "<b>NIST CAISI</b> (Jan 2026) formally solicited industry input on securing AI agent systems. "
        "<b>Google Cybersecurity Forecast 2026</b> identifies 'Shadow Agent Risk' as a priority threat. "
        "<b>CrowdStrike Global Threat Report 2026</b> reports AI-enabled attacks up 89%. "
        "<b>Palisade Research / Anthropic System Cards</b> document models disabling shutdown scripts, "
        "attempting blackmail, and executing insider trades without instruction.",
        small_style,
    ))
    story.append(Paragraph("Enterprise & Insurance Validation", subsection_style))
    story.append(Paragraph(
        "<b>Garrett Droege, WTW</b> (National Digital Risk Practice Leader) outlined the exact actuarial data structure "
        "underwriters need to price agent risk tiers and shared a live AgentProof demo with underwriters. "
        "<b>Aaron Levie, CEO of Box</b> ($4bn enterprise software) published a thesis naming agent identity, authentication, "
        "and governance as unsolved problems at trillion-agent scale. "
        "<b>Craig Riddell, Wallarm CISO</b>: 'This is not a signature problem. It is a behavioral governance problem.'",
        small_style,
    ))

    # ===== SECTION 3: COMMERCE INTEGRATION =====
    story.append(Paragraph("3. Commerce Integration (ERC-ACP Hooks)", section_style))
    story.append(Paragraph(
        "Scoring an agent after a transaction fails is forensics. Blocking an untrusted agent before the transaction "
        "executes is infrastructure. AgentProof does the latter.",
        body_style,
    ))
    story.append(Paragraph("3.1 AgentProofHook (IACPHook)", subsection_style))
    story.append(Paragraph(
        "An on-chain hook conforming to the canonical ERC-ACP spec. When a protocol calls setProvider(jobId, provider), "
        "the hook fires beforeAction: resolves the provider address to an ERC-8004 agent ID, reads their trust score from "
        "the on-chain oracle, and reverts the transaction if the score or tier is below threshold.",
        small_style,
    ))
    story.append(Paragraph("3.2 Job Outcome Tracking", subsection_style))
    story.append(Paragraph(
        "On afterAction for complete/reject, the hook records per-agent job stats &mdash; completion count, rejection count, "
        "last job timestamp. These feed back into the oracle's scoring pipeline as the job_completion signal (8% weight).",
        small_style,
    ))
    story.append(Paragraph("3.3 Score Staleness Enforcement", subsection_style))
    story.append(Paragraph(
        "Configurable maxScoreAge (uint40, seconds). If the oracle hasn't updated a score within the window, the hook "
        "reverts with ScoreExpired. Default: 3600 seconds (1 hour). Set to 0 to disable.",
        small_style,
    ))

    # ===== SECTION 4: MULTI-ORACLE CONSENSUS =====
    story.append(Paragraph("4. Multi-Oracle Consensus", section_style))
    story.append(Paragraph(
        "A single oracle is a single point of failure. AgentProof V2 supports multiple independent oracle operators.",
        body_style,
    ))
    story.append(Paragraph("4.1 Independent Operator Scores", subsection_style))
    story.append(Paragraph(
        "Each authorized oracle pushes scores independently. The contract stores per-oracle scores in "
        "oracleScores[agentId][oracle]. No operator can overwrite another's data.",
        small_style,
    ))
    story.append(Paragraph("4.2 On-Chain Consensus", subsection_style))
    story.append(Paragraph(
        "The consensus score is the average across all operators. Tier is auto-computed via _scoreTier(). "
        "getConsensusScore() returns: average score, consensus tier, oracle count, and a divergence flag.",
        small_style,
    ))
    story.append(Paragraph("4.3 Divergence Detection", subsection_style))
    story.append(Paragraph(
        "When two oracles disagree by more than divergenceThreshold (default: 10 points), the contract emits "
        "DivergenceDetected(agentId, minScore, maxScore). Current operators: AgentProof (#1), Agent402 (#2).",
        small_style,
    ))

    # ===== SECTION 5: SCORING METHODOLOGY =====
    story.append(Paragraph("5. Scoring Methodology", section_style))
    story.append(Paragraph(
        "The composite score (0-100) blends up to 11 weighted signals, Bayesian-smoothed to prevent gaming. "
        "Validation score (on-chain, hardest to game) weighted at 20%; rating score (most gameable) at 25%. "
        "Post-composite penalty registry can hard-floor scores for confirmed bad actors. "
        "Current network average: 43.8/100 across 150,900+ agents.",
        body_style,
    ))

    signal_data = [
        ["Signal", "Weight", "Description"],
        ["Rating Score", "25%", "Bayesian-smoothed avg with reviewer trust weighting (prior=50, k=3)"],
        ["Validation Score", "20%", "On-chain validation success rate (hardest signal to game)"],
        ["Account Age", "12%", "Logarithmic maturity curve (365d baseline)"],
        ["Volume Score", "10%", "Logarithmic feedback count (log10 scale)"],
        ["Consistency Score", "10%", "Inverse standard deviation of ratings"],
        ["Uptime Score", "10%", "30-day rolling liveness probe success rate"],
        ["Deployer Score", "8%", "Cross-agent deployer reputation lineage"],
        ["URI Stability", "5%", "Metadata mutation frequency (3+ changes = flag)"],
        ["Coding Score", "+10%", "GitHub PR merge rate, review sentiment, recency"],
        ["Job Completion", "+8%", "ERC-ACP job completion rate as provider"],
    ]
    t = Table(signal_data, colWidths=[80, 40, 290])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GRAY_800),
        ("TEXTCOLOR", (0, 0), (-1, 0), EMERALD),
        ("TEXTCOLOR", (0, 1), (-1, -1), GRAY_300),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 0), (-1, 0), "Courier"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_800),
    ]))
    story.append(t)
    story.append(Spacer(1, 4*mm))

    # Tier thresholds
    story.append(Paragraph("TIER THRESHOLDS", label_style))
    tier_data = [
        ["Tier", "Score", "Min Feedback"],
        ["Diamond", ">=85", ">=20"],
        ["Platinum", ">=72", ">=10"],
        ["Gold", ">=58", ">=5"],
        ["Silver", ">=42", ">=3"],
        ["Bronze", ">=30", ">=1"],
        ["Unranked", "<30", "<1"],
    ]
    t2 = Table(tier_data, colWidths=[70, 60, 70])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GRAY_800),
        ("TEXTCOLOR", (0, 0), (-1, 0), EMERALD),
        ("TEXTCOLOR", (0, 1), (-1, -1), GRAY_300),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 0), (-1, -1), "Courier"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_800),
    ]))
    story.append(t2)
    story.append(Spacer(1, 4*mm))

    # Anti-gaming
    story.append(Paragraph("ANTI-GAMING DEFENSES", label_style))
    for name, desc in [
        ("Reviewer Trust Weighting", "Feedback weighted by reviewer's own trust score. A Diamond agent's rating counts more than an Unranked bot's."),
        ("Reviewer Bootstrap Path", "New reviewers earn weight through accuracy — ratings that align within 15pts of consensus earn up to +20 bonus weight, breaking the bootstrap circularity problem."),
        ("Bayesian Smoothing", "Prior=50, k=3. A single perfect rating scores 62.5, not 100. Gaming requires sustained volume."),
        ("Freshness Penalty", "<7d: 0.70x, 7-30d: 0.85x, 30-90d: 0.95x. Identity rotation costs 30% for a week."),
        ("Penalty Registry", "Hard-floor slash for confirmed malicious behaviour. Critical=0.0x, High=0.1x, Medium=0.3x, Low=0.6x. Recovery through sustained clean operation (30-180 days). Critical penalties cap at 0.5x — never full auto-recovery."),
        ("Deployer Lineage", "Serial deployers who abandon agents taint all future registrations."),
        ("Anomaly Detection", "Autonomous job runs every 15 min. Category-aware thresholds: DeFi agents get 25/45pt alert/critical bands (vs 15/30pt default) to avoid false positives from market regime changes."),
        ("Concentration Detection", ">60% feedback from single reviewer triggers CONCENTRATED_FEEDBACK flag."),
    ]:
        story.append(Paragraph(f"<b>{name}</b> &mdash; {desc}", small_style))

    # ===== SECTION 6: RISK DETECTION =====
    story.append(Paragraph("6. Risk Detection & Max Exposure", section_style))
    story.append(Paragraph(
        "Every trust evaluation includes a risk assessment with specific flags, a risk level classification, "
        "and a dollar-denominated max exposure ceiling for insurance underwriting.",
        body_style,
    ))
    story.append(Paragraph("15 RISK FLAGS", label_style))
    flags = [
        "HIGH_RISK_SCORE", "CONCENTRATED_FEEDBACK", "SERIAL_DEPLOYER",
        "PENALIZED", "SUSPICIOUS_VOLATILITY", "LOW_UPTIME", "FREQUENT_URI_CHANGES",
        "NEW_IDENTITY", "LOW_FEEDBACK", "UNVERIFIED",
        "HIGH_FAILURE_RATE", "SLOW_RECOVERY", "ACTIVE_FAILURE",
        "HIGH_JOB_FAILURE_RATE", "JOB_ABANDONMENT",
    ]
    story.append(Paragraph(" &bull; ".join(flags), ParagraphStyle(
        "Flags", parent=small_style, fontName="Courier", textColor=RED_400, fontSize=7,
    )))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("4 RISK LEVELS", label_style))
    story.append(Paragraph("LOW &bull; MEDIUM &bull; HIGH &bull; CRITICAL", ParagraphStyle(
        "Levels", parent=small_style, fontName="Courier", textColor=AMBER_400, fontSize=8,
    )))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "<b>Max Exposure Model (Insurance Bridge)</b> &mdash; Dollar-denominated trust ceiling calculated from composite score, "
        "confidence multiplier, age bonus, and validation bonus. This is the data structure Willis Towers Watson identified "
        "as the missing input for underwriting agent risk.",
        small_style,
    ))

    # ===== SECTION 6.5: PENALTY REGISTRY =====
    story.append(Paragraph("6.1 Penalty Registry (Slash &amp; Recovery)", subsection_style))
    story.append(Paragraph(
        "A dedicated negative-signal path that can hard-floor an agent's composite score regardless of other signals. "
        "Unlike additive scoring (where bad behaviour can be masked by strong performance in other dimensions), "
        "the penalty registry applies a post-composite multiplier that overrides the weighted score.",
        body_style,
    ))

    penalty_data = [
        ["Severity", "Multiplier", "Recovery (Clean Days)", "Max Recovery"],
        ["Critical", "0.0x", "180 days", "0.5x (manual review required)"],
        ["High", "0.1x", "90 days", "1.0x (full)"],
        ["Medium", "0.3x", "60 days", "1.0x (full)"],
        ["Low", "0.6x", "30 days", "1.0x (full)"],
    ]
    t_penalty = Table(penalty_data, colWidths=[60, 60, 120, 170])
    t_penalty.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GRAY_800),
        ("TEXTCOLOR", (0, 0), (-1, 0), EMERALD),
        ("TEXTCOLOR", (0, 1), (-1, -1), GRAY_300),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 0), (-1, 0), "Courier"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_800),
    ]))
    story.append(t_penalty)
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        "Penalties are a <b>slash, not a ban</b>. An agent can recover trust through sustained clean operation — "
        "no new flags, stable or rising score, no anomaly alerts. Recovery is linear within the window: a high-severity "
        "penalty at 45/90 days clean recovers from 0.1x to 0.55x. Critical penalties cap at 0.5x and require manual "
        "review by an oracle operator for full rehabilitation. The consecutive_good_days counter resets to zero "
        "if any new penalty event is recorded during recovery.",
        small_style,
    ))
    story.append(Paragraph(
        "<b>Penalty triggers:</b> confirmed exploits, OFAC-adjacent address associations, verified sybil ring participation, "
        "repeated validation fraud, demonstrated score manipulation. Evidence URI required for all entries.",
        small_style,
    ))

    # ===== SECTION 6.2: REVIEWER BOOTSTRAP =====
    story.append(Paragraph("6.2 Reviewer Bootstrap Path", subsection_style))
    story.append(Paragraph(
        "Reviewer trust weighting creates a bootstrap circularity: you need a high composite score to have review influence, "
        "but composite score comes from being reviewed. The bootstrap path breaks this cycle by letting new reviewers "
        "earn weight through demonstrated accuracy — alignment between their ratings and the eventual consensus score "
        "of the agents they review.",
        body_style,
    ))
    story.append(Paragraph(
        "<b>Base weight:</b> max(10.0, reviewer_composite_score) — existing floor ensures all feedback counts. "
        "<b>Accuracy bonus:</b> up to +20 weight for reviewers whose historical ratings align within 15 points of consensus. "
        "<b>Volume gate:</b> 5+ prior reviews required to activate the accuracy bonus. "
        "This means a net-new reviewer with zero composite score starts at weight 10, but after 5 accurate reviews "
        "can reach weight 30 — equivalent to a Bronze-tier agent's natural weight.",
        small_style,
    ))

    # ===== SECTION 7: DEPLOYED CONTRACTS =====
    story.append(Paragraph("7. Deployed Contracts", section_style))
    story.append(Paragraph(
        "Score pushing is live on 9 chains with TrustScoreOracle V2. Feedback submission auto-routes across "
        "21 EVM chains + Solana via ERC-8004 ReputationRegistry (deterministic CREATE2 addresses).",
        body_style,
    ))

    story.append(Paragraph("SCORE PUSHING - TRUSTSCOREORACLE V2 (9 CHAINS)", label_style))
    contract_data = [
        ["Chain", "Contract Address", "Status"],
        ["Base Mainnet", "0xE74e9C994b8F65db01725DdAE603EAE397aBa432", "Verified"],
        ["Avalanche Mainnet", "0xA9D7a613Ce349d15827CB8C54F08e24549219B4f", "Verified"],
        ["Ethereum Mainnet", "Deployed", "Live"],
        ["Linea", "Deployed", "Live"],
        ["BSC", "0xE6D5ad50e7bb5A13b8E2F674FCDEB48f98849371", "New - Mar 2026"],
        ["Polygon", "0x7471C0fD57658ABBf8065Ee816080D42F67DBB1c", "New - Mar 2026"],
        ["Celo", "0x7471C0fD57658ABBf8065Ee816080D42F67DBB1c", "New - Mar 2026"],
        ["Arbitrum", "0x7471C0fD57658ABBf8065Ee816080D42F67DBB1c", "New - Mar 2026"],
        ["Monad", "0xB5Be2426f3b930AdD6Bc4e4A277a76b9cE4855e1", "New - Mar 2026"],
    ]
    t3 = Table(contract_data, colWidths=[80, 250, 80])
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GRAY_800),
        ("TEXTCOLOR", (0, 0), (-1, 0), EMERALD),
        ("TEXTCOLOR", (0, 1), (-1, -1), GRAY_300),
        ("TEXTCOLOR", (2, 5), (2, -1), EMERALD),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("FONTNAME", (1, 1), (1, -1), "Courier"),
        ("FONTNAME", (0, 0), (-1, 0), "Courier"),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_800),
    ]))
    story.append(t3)
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph("REPUTATIONGATEV2 - BASE MAINNET", label_style))
    story.append(Paragraph(
        "<font face='Courier' color='#9ca3af'>0x882e22FBB913b53Ab062f3f5f42C3E8838373d23</font> &mdash; "
        "Protocol integration contract. Any protocol can gate operations by agent trust with requireTrust(agentId).",
        small_style,
    ))
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph("FEEDBACK SUBMISSION - 21 EVM CHAINS + SOLANA", label_style))
    story.append(Paragraph(
        "Avalanche, Ethereum, Base, Linea, Polygon, Arbitrum, Optimism, BNB, Scroll, Gnosis, Mantle, Celo, "
        "Monad, Abstract, Taiko, MegaETH, SKALE, X Layer, Soneium, Metis, Solana. "
        "Auto-routes to any chain with an RPC URL via deterministic CREATE2 addresses.",
        small_style,
    ))
    story.append(Paragraph(
        "All contracts verified with full source code. Scores pushed autonomously every 5 minutes. "
        "2 oracle operators with on-chain consensus. 5 new oracle deployments added March 2026.",
        ParagraphStyle("Note", parent=small_style, textColor=GRAY_600, fontStyle="italic"),
    ))

    # ===== SECTION 8: ARCHITECTURE =====
    story.append(Paragraph("8. Architecture & Endpoints", section_style))

    story.append(Paragraph("THREE-LAYER ARCHITECTURE", label_style))
    for layer, desc in [
        ("Layer 1: Indexing", "21-chain event indexer. AgentRegistered, FeedbackSubmitted, ValidationRequested events."),
        ("Layer 2: Evaluation", "11-signal composite scoring. 14 risk flags. In-memory cache (300s TTL)."),
        ("Layer 3: Feedback Loop", "Oracle writes evaluations back to ERC-8004 ReputationRegistry as on-chain feedback."),
    ]:
        story.append(Paragraph(f"<b>{layer}</b> &mdash; {desc}", small_style))

    story.append(Paragraph("PROTOCOL ENDPOINTS", label_style))
    for name, desc in [
        ("REST API", "GET /api/v1/trust/{id} - full evaluation with score breakdown, risk flags, delegation stats"),
        ("Batch Evaluation", "POST /api/v1/trust/batch - evaluate up to 500 agents in a single request"),
        ("A2A (Agent-to-Agent)", "POST /a2a - Google A2A protocol. Agent card at /.well-known/agent.json"),
        ("MCP Server", "POST /mcp - Model Context Protocol for Claude, GPT, and other LLM agents"),
        ("Webhooks", "Real-time score change notifications with SSRF protection"),
        ("SDK", "@agentproof/sdk v1.1.0 - TypeScript SDK with full oracle API support"),
    ]:
        story.append(Paragraph(f"<b>{name}</b> &mdash; {desc}", small_style))

    story.append(Paragraph("AUTONOMOUS ORACLE JOBS", label_style))
    job_data = [
        ["Job", "Interval", "Description"],
        ["Agent Screening", "60s", "Compute evaluations for new agents, submit on-chain"],
        ["Anomaly Monitor", "900s", "Category-aware volatility detection (DeFi: 25/45pt thresholds)"],
        ["Liveness Probing", "300s", "HTTP health checks to agent endpoints"],
        ["Failure Metrics", "300s", "MTTR, active failures, recovery tracking"],
        ["Network Report", "600s", "Publish ecosystem stats via event feed"],
        ["Delegation Sync", "600s", "Track delegation success/failure rates"],
        ["Job Outcomes", "600s", "Sync ERC-ACP job completion rates"],
        ["GitHub Sync", "3600s", "Coding reputation from PR metrics"],
    ]
    t4 = Table(job_data, colWidths=[90, 50, 270])
    t4.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GRAY_800),
        ("TEXTCOLOR", (0, 0), (-1, 0), EMERALD),
        ("TEXTCOLOR", (0, 1), (-1, -1), GRAY_300),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 0), (-1, 0), "Courier"),
        ("FONTNAME", (1, 1), (1, -1), "Courier"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_800),
    ]))
    story.append(t4)

    # ===== SECTION 9: MONETIZATION =====
    story.append(Paragraph("9. Monetization", section_style))
    pricing_data = [
        ["Tier", "Price", "Limit"],
        ["Pay-as-you-go", "$0.05/call", "1,000/mo"],
        ["Starter", "$250/mo", "10,000/mo"],
        ["Growth", "$500/mo", "50,000/mo"],
        ["Scale", "$1,000/mo", "200,000/mo"],
        ["Enterprise", "$2,000/mo", "Unlimited"],
    ]
    t5 = Table(pricing_data, colWidths=[100, 80, 80])
    t5.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GRAY_800),
        ("TEXTCOLOR", (0, 0), (-1, 0), EMERALD),
        ("TEXTCOLOR", (0, 1), (-1, -1), GRAY_300),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Courier"),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_800),
    ]))
    story.append(t5)
    story.append(Paragraph(
        "On-chain queries pay a per-call fee to the TrustScoreOracle contract (0.001 native token). "
        "Off-chain API queries use API key authentication with monthly quotas.",
        small_style,
    ))

    # ===== SECTION 10: DEPLOYER REPUTATION =====
    story.append(Paragraph("10. Deployer Reputation", section_style))
    story.append(Paragraph(
        "Tracking who built the agent, not just the agent. Serial deployers who spawn and abandon agents are "
        "flagged across all future registrations. Deployer score components: 40% abandonment ratio, 30% quality, "
        "20% longevity, 10% volume. Applied across 150,900+ agents.",
        body_style,
    ))

    # ===== SECTION 11: ROADMAP =====
    story.append(Paragraph("11. Roadmap", section_style))
    story.append(Paragraph("Q1 2026 (Current)", subsection_style))
    story.append(Paragraph(
        "150,900+ agents indexed across 21 chains. 9 oracle deployments live. 2 oracle operators with on-chain consensus. "
        "221,300+ evaluations computed. 307,200+ screenings. ERC-ACP hook integration. ReputationGateV2 on Base. "
        "TypeScript SDK v1.1.0. A2A + MCP protocol support.",
        small_style,
    ))
    story.append(Paragraph("Q2 2026", subsection_style))
    story.append(Paragraph(
        "TEE validation for score computation. Context-aware per-skill scores. Insurance marketplace integration. "
        "Cross-protocol reputation portability. Additional oracle operators.",
        small_style,
    ))
    story.append(Paragraph("Q3-Q4 2026", subsection_style))
    story.append(Paragraph(
        "Decentralized oracle network. Per-skill scoring (e.g., 'coding' vs 'trading' vs 'customer service'). "
        "Insurance underwriting marketplace. Governance token for oracle operator staking.",
        small_style,
    ))

    # ===== SECTION 12: CONCLUSION =====
    story.append(Paragraph("12. Conclusion", section_style))
    story.append(Paragraph(
        "The agent economy is live. 150,900+ agents are registered on-chain. Commerce protocols are assigning jobs, "
        "moving capital, and delegating authority to autonomous agents at machine speed. The registries exist. "
        "The integrity layer doesn't &mdash; or didn't.",
        body_style,
    ))
    story.append(Paragraph(
        "AgentProof is not a scoring model. It is the infrastructure that makes trust queryable. The on-chain oracle "
        "that protocols call. The hook that blocks untrusted agents. The API that agents query. The data pipeline "
        "that underwriters use to price coverage.",
        body_style,
    ))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph(
        "21 Chains &nbsp;|&nbsp; 9 Oracle Deployments &nbsp;|&nbsp; 2 Oracle Operators &nbsp;|&nbsp; 150.9K+ Agents",
        stats_line_style,
    ))
    story.append(Spacer(1, 10*mm))
    story.append(Paragraph(
        f"AgentProof Technical Whitepaper {VERSION} &bull; {DATE} &bull; agentproof.sh",
        ParagraphStyle("Final", parent=footer_style, fontSize=8),
    ))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"PDF generated: {OUTPUT}")


if __name__ == "__main__":
    build()
