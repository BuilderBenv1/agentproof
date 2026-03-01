"""
ERC-8004 Standardised Tag Taxonomy — Reference Implementation

Defines the canonical tag values for the ERC-8004 agent ecosystem.
See ERC-8004-TAG-PROPOSAL.md for the full specification.
"""

# ─── Feedback Tags (tag1 / tag2 in giveFeedback) ─────────────────────

VALID_TAG1 = frozenset({
    "trust",           # General trust/quality assessment
    "liveness",        # Endpoint availability check
    "performance",     # Speed/efficiency of task execution
    "accuracy",        # Correctness of output/results
    "reliability",     # Consistency across repeated tasks
    "security",        # Security posture assessment
    "compliance",      # Regulatory compliance check
    "cost",            # Value for money / cost efficiency
    "communication",   # Quality of A2A/MCP interactions
    "safety",          # Adherence to safety constraints
})

VALID_TAG2 = frozenset({
    "oracle-screening",    # Automated oracle evaluation
    "liveness-check",      # Automated uptime probe
    "user-review",         # Human user feedback
    "agent-review",        # Peer agent feedback
    "protocol-review",     # DeFi protocol integration review
    "audit-report",        # Formal audit finding
    "incident-report",     # Post-incident assessment
    "marketplace-review",  # Marketplace transaction review
    "validator",           # Third-party validation result
    "self-report",         # Agent's own operational metrics
})

# ─── Agent Categories ────────────────────────────────────────────────

VALID_CATEGORIES = frozenset({
    "defi",             # Trading, yield, financial automation
    "gaming",           # In-game economy, NPCs, gaming infrastructure
    "rwa",              # Real-world asset tokenization and management
    "payments",         # Settlement, remittance, payment processing
    "data",             # Analytics, indexing, data pipelines, oracles
    "security",         # Scanning, monitoring, threat detection
    "infrastructure",   # DevOps, deployment, orchestration
    "social",           # Communication, content, community management
    "governance",       # DAO operations, voting, proposal management
    "general",          # Multi-purpose or uncategorised
})

# ─── Agent Identity Tag Enums ────────────────────────────────────────

AUTONOMY_LEVELS = frozenset({"supervised", "semi_autonomous", "autonomous"})

FINANCIAL_ACCESS_LEVELS = frozenset({"none", "read", "write", "unlimited"})

DATA_ACCESS_LEVELS = frozenset({"none", "public", "private", "sensitive"})

OWNER_TYPES = frozenset({"eoa", "multisig", "dao", "protocol"})

UPGRADE_PATTERNS = frozenset({"immutable", "proxy", "uri_mutable"})

SUPPORTED_PROTOCOLS = frozenset({"a2a", "mcp", "rest", "custom"})

# ─── Insurance / Coverage ────────────────────────────────────────────

COVERAGE_TIER_THRESHOLDS = [
    (100_000, "$1M"),
    (10_000, "$100K"),
    (1_000, "$10K"),
    (0.01, "$1K"),
]

# ─── Identity Tag Field Names ────────────────────────────────────────
# Used by the metadata parser to know which fields to extract

IDENTITY_TAG_FIELDS = [
    "autonomy_level",
    "financial_access",
    "data_access_level",
    "can_delegate",
    "can_be_delegated",
    "supported_protocols",
    "open_source",
    "source_url",
    "audited_by",
    "owner_type",
    "upgrade_pattern",
    "human_in_loop",
    "jurisdiction",
    "compliance_tags",
]
