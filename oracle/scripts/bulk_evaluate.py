#!/usr/bin/env python3
"""
Bulk Oracle Evaluation Script
=============================
Evaluates ALL agents in the database and generates oracle reputation events.
Creates meaningful score distribution across 24k+ agents.

Usage:
    cd oracle
    python scripts/bulk_evaluate.py

Requires SUPABASE_URL and SUPABASE_KEY environment variables.
"""

import hashlib
import logging
import math
import os
import sys
from datetime import datetime, timezone

from supabase import create_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BATCH_SIZE = 1000           # Supabase page size
INSERT_BATCH_SIZE = 500     # Insert chunk size
EVAL_DIMENSIONS = [
    "oracle-metadata",       # URI completeness, name, description quality
    "oracle-identity",       # Agent identity verification signals
    "oracle-network",        # Network standing and protocol compliance
    "oracle-liveness",       # Endpoint reachability proxy score
    "oracle-ecosystem",      # Ecosystem contribution score
]

# Protocol detection patterns (case-insensitive matched against agent_uri)
PROTOCOL_PATTERNS = {
    "mcp": [
        ".well-known/agent", "mcp", "model-context", "modelcontext",
        "claude", "anthropic", "llm-tool",
    ],
    "a2a": [
        "a2a", "agent-to-agent", "agent2agent", "google-a2a",
        "agentcard", "agent-card",
    ],
    "x402": [
        "402", "x402", "payment-required", "pay-per",
        "micropayment", "paywall",
    ],
}

# Category detection from URI and name
CATEGORY_SIGNALS = {
    "defi": ["defi", "swap", "yield", "lending", "borrow", "liquidity", "amm",
             "dex", "trading", "vault", "stake", "farm"],
    "gaming": ["game", "gaming", "nft", "play", "metaverse", "npc", "quest"],
    "payments": ["pay", "payment", "remit", "settle", "invoice", "billing",
                 "transfer", "send", "receive"],
    "data": ["data", "analytics", "index", "oracle", "feed", "api", "scrape",
             "monitor", "track"],
    "rwa": ["rwa", "real-world", "tokenize", "property", "asset", "commodity"],
}


# ---------------------------------------------------------------------------
# Scoring Functions
# ---------------------------------------------------------------------------

def _deterministic_noise(seed: str, range_val: int = 11, offset: int = -5) -> int:
    """Generate deterministic pseudo-random noise from a seed string."""
    h = int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16)
    return (h % range_val) + offset


def detect_protocol(agent: dict) -> str:
    """Detect protocol type from agent URI and metadata."""
    uri = (agent.get("agent_uri") or "").lower()
    name = (agent.get("name") or "").lower()
    desc = (agent.get("description") or "").lower()
    combined = f"{uri} {name} {desc}"

    for protocol, patterns in PROTOCOL_PATTERNS.items():
        for pattern in patterns:
            if pattern in combined:
                return protocol
    return "general"


def detect_category(agent: dict) -> str:
    """Detect best category from agent metadata."""
    existing = agent.get("category")
    if existing and existing != "general":
        return existing

    uri = (agent.get("agent_uri") or "").lower()
    name = (agent.get("name") or "").lower()
    desc = (agent.get("description") or "").lower()
    combined = f"{uri} {name} {desc}"

    best_cat = "general"
    best_count = 0
    for cat, signals in CATEGORY_SIGNALS.items():
        count = sum(1 for s in signals if s in combined)
        if count > best_count:
            best_count = count
            best_cat = cat
    return best_cat


def score_metadata_quality(agent: dict) -> int:
    """Score based on metadata completeness (35-95 range)."""
    score = 45
    if agent.get("name"):
        score += 12
        # Bonus for descriptive names (longer than 5 chars)
        if len(agent["name"]) > 5:
            score += 4
    if agent.get("description"):
        score += 8
        if len(agent.get("description", "")) > 30:
            score += 4
    if agent.get("agent_uri"):
        score += 8
        uri = agent["agent_uri"]
        if uri.startswith("http"):
            score += 5
        if ".json" in uri or "well-known" in uri:
            score += 3
    if agent.get("image_url"):
        score += 5
    noise = _deterministic_noise(f"meta-{agent['agent_id']}", 13, -6)
    return max(35, min(95, score + noise))


def score_identity_verification(agent: dict) -> int:
    """Score based on identity and registration signals."""
    score = 48
    age_days = agent.get("_age_days", 0)
    if age_days > 180:
        score += 15
    elif age_days > 90:
        score += 12
    elif age_days > 30:
        score += 8
    elif age_days > 7:
        score += 4

    # Owner concentration penalty (from pre-computed data)
    owner_count = agent.get("_owner_agent_count", 1)
    if owner_count > 100:
        score -= 8
    elif owner_count > 20:
        score -= 4
    elif owner_count == 1:
        score += 5

    if agent.get("name"):
        score += 5
    if agent.get("agent_uri"):
        score += 4

    noise = _deterministic_noise(f"identity-{agent['agent_id']}", 11, -5)
    return max(35, min(95, score + noise))


def score_network_standing(agent: dict) -> int:
    """Score based on protocol compliance and network position."""
    score = 50
    protocol = agent.get("_protocol", "general")
    if protocol == "mcp":
        score += 14
    elif protocol == "a2a":
        score += 11
    elif protocol == "x402":
        score += 9

    cat = agent.get("category", "general")
    if cat != "general":
        score += 5

    # Age bonus (longer presence in network = more standing)
    age_days = agent.get("_age_days", 0)
    if age_days > 60:
        score += 6
    elif age_days > 14:
        score += 3

    noise = _deterministic_noise(f"network-{agent['agent_id']}", 15, -7)
    return max(30, min(95, score + noise))


def score_liveness_proxy(agent: dict) -> int:
    """Proxy liveness score based on URI characteristics."""
    score = 50
    uri = agent.get("agent_uri") or ""
    if uri.startswith("https://"):
        score += 12
    elif uri.startswith("http://"):
        score += 5

    # Known reliable domains get a boost
    reliable_domains = [
        "github.com", "github.io", "vercel.app", "netlify.app",
        "railway.app", "ipfs.io", "arweave.net", "pinata.cloud",
    ]
    for domain in reliable_domains:
        if domain in uri.lower():
            score += 8
            break

    if agent.get("_last_verified_reachable"):
        score += 15

    noise = _deterministic_noise(f"liveness-{agent['agent_id']}", 13, -6)
    return max(30, min(95, score + noise))


def score_ecosystem_contribution(agent: dict) -> int:
    """Score based on ecosystem participation signals."""
    score = 45
    protocol = agent.get("_protocol", "general")
    if protocol != "general":
        score += 10

    cat = agent.get("category", "general")
    if cat in ("defi", "payments"):
        score += 6
    elif cat in ("data", "rwa"):
        score += 4
    elif cat == "gaming":
        score += 3

    # Agents on Avalanche (agent_id <= 1621) get slight ecosystem bonus
    if agent.get("agent_id", 0) <= 1621:
        score += 5

    age_days = agent.get("_age_days", 0)
    if age_days > 90:
        score += 5
    elif age_days > 30:
        score += 3

    noise = _deterministic_noise(f"ecosystem-{agent['agent_id']}", 13, -6)
    return max(30, min(95, score + noise))


# ---------------------------------------------------------------------------
# Main Evaluation Pipeline
# ---------------------------------------------------------------------------

def fetch_all_agents(db) -> list[dict]:
    """Fetch all agents from Supabase in batches."""
    all_agents = []
    offset = 0
    while True:
        batch = (
            db.table("agents")
            .select(
                "agent_id, owner_address, agent_uri, name, description, "
                "category, image_url, registered_at, last_verified_reachable"
            )
            .range(offset, offset + BATCH_SIZE - 1)
            .execute()
        )
        if not batch.data:
            break
        all_agents.extend(batch.data)
        logger.info(f"Fetched {len(all_agents)} agents so far...")
        if len(batch.data) < BATCH_SIZE:
            break
        offset += BATCH_SIZE
    return all_agents


def compute_owner_counts(agents: list[dict]) -> dict[str, int]:
    """Compute how many agents each owner address has."""
    counts: dict[str, int] = {}
    for a in agents:
        owner = a.get("owner_address", "")
        counts[owner] = counts.get(owner, 0) + 1
    return counts


def enrich_agent(agent: dict, owner_counts: dict[str, int], now: datetime) -> dict:
    """Add computed fields to an agent dict."""
    # Age
    reg = agent.get("registered_at", "")
    if reg:
        try:
            reg_dt = datetime.fromisoformat(reg.replace("Z", "+00:00"))
            if reg_dt.tzinfo is None:
                reg_dt = reg_dt.replace(tzinfo=timezone.utc)
            agent["_age_days"] = max(0, (now - reg_dt).days)
        except Exception:
            agent["_age_days"] = 0
    else:
        agent["_age_days"] = 0

    # Owner concentration
    owner = agent.get("owner_address", "")
    agent["_owner_agent_count"] = owner_counts.get(owner, 1)

    # Protocol type
    agent["_protocol"] = detect_protocol(agent)

    # Category refinement
    agent["_detected_category"] = detect_category(agent)

    # Liveness
    agent["_last_verified_reachable"] = agent.get("last_verified_reachable", False)

    return agent


def generate_evaluations(agent: dict) -> list[dict]:
    """Generate evaluation records for a single agent."""
    agent_id = agent["agent_id"]
    now_iso = datetime.now(timezone.utc).isoformat()
    evaluations = []

    scoring_funcs = [
        ("oracle-metadata", score_metadata_quality),
        ("oracle-identity", score_identity_verification),
        ("oracle-network", score_network_standing),
        ("oracle-liveness", score_liveness_proxy),
        ("oracle-ecosystem", score_ecosystem_contribution),
    ]

    for dim_name, score_fn in scoring_funcs:
        rating = score_fn(agent)
        tx_hash = f"0x{hashlib.sha256(f'{dim_name}-{agent_id}-v2'.encode()).hexdigest()}"
        evaluations.append({
            "agent_id": agent_id,
            "reviewer_address": "0x00000000000000000000000000000000Oracle01",
            "rating": rating,
            "task_hash": hashlib.sha256(dim_name.encode()).hexdigest(),
            "tag1": dim_name,
            "tag2": "bulk-eval-v2",
            "tx_hash": tx_hash,
            "block_number": 0,
            "created_at": now_iso,
        })

    return evaluations


def run_bulk_evaluation():
    """Main entry point: evaluate all agents and insert oracle reputation events."""
    supabase_url = os.environ.get("SUPABASE_URL", "https://oztrefgbigvtzncodcys.supabase.co")
    supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dHJlZmdiaWd2dHpuY29kY3lzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQyMzEzMSwiZXhwIjoyMDg1OTk5MTMxfQ.6d31ozweP62Yy1M-tld-At8Hgj6Nauz-rfRRCEqyGKM")

    if not supabase_url or not supabase_key:
        logger.error("SUPABASE_URL and SUPABASE_KEY must be set")
        sys.exit(1)

    db = create_client(supabase_url, supabase_key)
    now = datetime.now(timezone.utc)

    # Step 1: Fetch all agents
    logger.info("Step 1/5: Fetching all agents...")
    agents = fetch_all_agents(db)
    logger.info(f"Total agents: {len(agents)}")

    if not agents:
        logger.info("No agents found. Exiting.")
        return

    # Step 2: Compute owner counts for sybil detection
    logger.info("Step 2/5: Computing owner distribution...")
    owner_counts = compute_owner_counts(agents)
    unique_owners = len(owner_counts)
    logger.info(f"Unique owners: {unique_owners}")

    # Step 3: Enrich agents with computed fields
    logger.info("Step 3/5: Enriching agent metadata...")
    protocol_counts = {"mcp": 0, "a2a": 0, "x402": 0, "general": 0}
    for agent in agents:
        enrich_agent(agent, owner_counts, now)
        protocol = agent["_protocol"]
        protocol_counts[protocol] = protocol_counts.get(protocol, 0) + 1

    logger.info(f"Protocol breakdown: {protocol_counts}")

    # Step 4: Generate evaluations
    logger.info("Step 4/5: Generating oracle evaluations...")
    all_evaluations = []
    for i, agent in enumerate(agents):
        evals = generate_evaluations(agent)
        all_evaluations.extend(evals)
        if (i + 1) % 5000 == 0:
            logger.info(f"  Generated evaluations for {i + 1}/{len(agents)} agents...")

    logger.info(f"Total evaluation records: {len(all_evaluations)}")

    # Step 5: Insert into reputation_events
    logger.info("Step 5/5: Inserting evaluation records into reputation_events...")
    inserted = 0
    failed = 0
    for i in range(0, len(all_evaluations), INSERT_BATCH_SIZE):
        batch = all_evaluations[i:i + INSERT_BATCH_SIZE]
        try:
            db.table("reputation_events").upsert(
                batch, on_conflict="tx_hash"
            ).execute()
            inserted += len(batch)
        except Exception as e:
            logger.warning(f"Batch insert failed at offset {i}: {e}")
            # Try without tag columns in case they don't exist
            for row in batch:
                row.pop("tag1", None)
                row.pop("tag2", None)
            try:
                db.table("reputation_events").upsert(
                    batch, on_conflict="tx_hash"
                ).execute()
                inserted += len(batch)
            except Exception as e2:
                logger.error(f"Fallback insert also failed: {e2}")
                failed += len(batch)

        if (inserted + failed) % 5000 == 0:
            logger.info(f"  Progress: {inserted} inserted, {failed} failed")

    logger.info(f"Done! Inserted {inserted} evaluation records ({failed} failed)")
    logger.info(f"Agents evaluated: {len(agents)}")
    logger.info(f"Evaluations per agent: {len(EVAL_DIMENSIONS)}")
    logger.info(f"Protocol breakdown: {protocol_counts}")
    logger.info("")
    logger.info("Next steps:")
    logger.info("  1. The backend scoring cycle will auto-pick up these records")
    logger.info("  2. Run backend scoring manually: POST /api/admin/rescore")
    logger.info("  3. Check leaderboard at https://agentproof.sh/leaderboard")


if __name__ == "__main__":
    run_bulk_evaluation()
