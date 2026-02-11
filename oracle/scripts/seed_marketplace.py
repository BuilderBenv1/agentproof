#!/usr/bin/env python3
"""
Marketplace Seeding Script
==========================
Populates the AgentProof marketplace with realistic listings, tasks, and reviews
using agents already in the database.

Usage:
    cd oracle
    python scripts/seed_marketplace.py

Requires SUPABASE_URL and SUPABASE_KEY environment variables.
"""

import hashlib
import logging
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

from supabase import create_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Listing Templates by Category
# ---------------------------------------------------------------------------

DEFI_LISTINGS = [
    {
        "title": "Automated Yield Farming Strategy",
        "description": "Continuously monitors and reallocates across Avalanche DEX pools to maximize APY. Supports Trader Joe, Pangolin, and Platypus protocols.",
        "skills": ["defi", "yield-farming", "avalanche", "automation", "liquidity"],
        "price_avax": 2.5,
        "price_type": "fixed",
        "avg_completion_time_hours": 1,
    },
    {
        "title": "DeFi Portfolio Rebalancing",
        "description": "Automated portfolio rebalancing based on configurable risk profiles. Monitors token ratios and executes swaps when thresholds are breached.",
        "skills": ["defi", "portfolio", "rebalancing", "risk-management"],
        "price_avax": 1.8,
        "price_type": "fixed",
        "avg_completion_time_hours": 2,
    },
    {
        "title": "Liquidity Pool Monitoring & Alerts",
        "description": "Real-time monitoring of LP positions with impermanent loss tracking, reward harvesting notifications, and emergency withdrawal triggers.",
        "skills": ["defi", "monitoring", "alerts", "liquidity-pools"],
        "price_avax": 0.5,
        "price_type": "hourly",
        "avg_completion_time_hours": 24,
    },
    {
        "title": "DEX Arbitrage Execution",
        "description": "Identifies and executes cross-DEX arbitrage opportunities on Avalanche C-Chain with configurable slippage tolerance and gas optimization.",
        "skills": ["defi", "arbitrage", "trading", "mev", "optimization"],
        "price_avax": 5.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 1,
    },
    {
        "title": "Token Launch Sniping Agent",
        "description": "Monitors new token launches on Avalanche DEXs and executes buys within the first block based on configurable criteria and safety checks.",
        "skills": ["defi", "trading", "automation", "token-launch"],
        "price_avax": 3.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 1,
    },
    {
        "title": "Lending Rate Optimizer",
        "description": "Automatically moves deposits between Aave, Benqi, and other lending protocols to chase the highest supply APY on stablecoins.",
        "skills": ["defi", "lending", "optimization", "stablecoins"],
        "price_avax": 1.5,
        "price_type": "fixed",
        "avg_completion_time_hours": 4,
    },
    {
        "title": "Perpetual Futures Hedging",
        "description": "Delta-neutral hedging strategy using perpetual futures markets. Automatically adjusts positions to maintain target exposure.",
        "skills": ["defi", "perpetuals", "hedging", "derivatives"],
        "price_avax": 8.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 1,
    },
]

DATA_LISTINGS = [
    {
        "title": "On-Chain Analytics Report",
        "description": "Comprehensive analytics report covering wallet activity, token flows, protocol TVL, and whale movements on Avalanche.",
        "skills": ["data", "analytics", "on-chain", "reporting"],
        "price_avax": 1.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 6,
    },
    {
        "title": "Smart Contract Audit Scanner",
        "description": "Automated smart contract scanning for common vulnerabilities including reentrancy, overflow, and access control issues.",
        "skills": ["data", "security", "audit", "smart-contracts"],
        "price_avax": 3.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 2,
    },
    {
        "title": "Token Sentiment Analysis",
        "description": "Aggregates and analyzes social sentiment across Twitter, Discord, and Telegram for specified tokens. Returns confidence-weighted signals.",
        "skills": ["data", "sentiment", "nlp", "social-media"],
        "price_avax": 0.8,
        "price_type": "fixed",
        "avg_completion_time_hours": 1,
    },
    {
        "title": "Price Feed Oracle",
        "description": "Reliable price feeds aggregated from multiple DEX sources with TWAP smoothing. Available via REST API or WebSocket.",
        "skills": ["data", "oracle", "price-feed", "api"],
        "price_avax": 0.3,
        "price_type": "hourly",
        "avg_completion_time_hours": 24,
    },
    {
        "title": "Blockchain Event Indexer",
        "description": "Custom event indexing service for any Avalanche smart contract. Indexes events into queryable database with webhook notifications.",
        "skills": ["data", "indexing", "events", "webhooks"],
        "price_avax": 2.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 12,
    },
    {
        "title": "Wallet Profiling & Risk Scoring",
        "description": "Deep analysis of wallet transaction history to generate risk profiles. Detects mixer usage, sanctioned addresses, and suspicious patterns.",
        "skills": ["data", "compliance", "risk-scoring", "aml"],
        "price_avax": 1.5,
        "price_type": "fixed",
        "avg_completion_time_hours": 3,
    },
]

PAYMENTS_LISTINGS = [
    {
        "title": "Cross-Chain Settlement Agent",
        "description": "Handles cross-chain payment settlement between Avalanche, Ethereum, and Arbitrum. Supports USDC, USDT, and AVAX with automatic bridging.",
        "skills": ["payments", "cross-chain", "settlement", "bridging"],
        "price_avax": 1.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 1,
    },
    {
        "title": "Recurring Payment Automation",
        "description": "Set up automated recurring payments for subscriptions, payroll, or vendor payments. Configurable schedules with failure retry logic.",
        "skills": ["payments", "automation", "recurring", "scheduling"],
        "price_avax": 0.5,
        "price_type": "fixed",
        "avg_completion_time_hours": 2,
    },
    {
        "title": "Invoice Processing & Payment",
        "description": "Automated invoice parsing, verification, and on-chain payment execution. Supports batch processing and multi-currency invoices.",
        "skills": ["payments", "invoicing", "automation", "batch-processing"],
        "price_avax": 1.2,
        "price_type": "fixed",
        "avg_completion_time_hours": 4,
    },
    {
        "title": "Payment Splitting & Revenue Share",
        "description": "Automates payment splitting between multiple recipients based on configurable share percentages. Real-time distribution on receive.",
        "skills": ["payments", "splitting", "revenue-share", "distribution"],
        "price_avax": 0.8,
        "price_type": "fixed",
        "avg_completion_time_hours": 1,
    },
    {
        "title": "Payroll Distribution Agent",
        "description": "Multi-recipient token distribution for DAO payroll. Supports vesting schedules, token streaming, and multi-token payments.",
        "skills": ["payments", "payroll", "dao", "token-distribution"],
        "price_avax": 2.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 6,
    },
]

GAMING_LISTINGS = [
    {
        "title": "In-Game Economy Balancer",
        "description": "Monitors and adjusts in-game token economies to maintain healthy inflation rates. Includes price floor/ceiling management.",
        "skills": ["gaming", "economy", "balancing", "tokenomics"],
        "price_avax": 3.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 12,
    },
    {
        "title": "NFT Marketplace Price Bot",
        "description": "Automated pricing agent for NFT marketplace listings. Analyzes floor prices, rarity traits, and market trends to set optimal prices.",
        "skills": ["gaming", "nft", "pricing", "marketplace"],
        "price_avax": 1.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 2,
    },
    {
        "title": "Quest & Achievement Validator",
        "description": "Validates on-chain quest completions and achievement claims for blockchain games. Issues reward tokens upon verification.",
        "skills": ["gaming", "validation", "quests", "rewards"],
        "price_avax": 0.5,
        "price_type": "fixed",
        "avg_completion_time_hours": 1,
    },
    {
        "title": "Game State Sync Oracle",
        "description": "Bridges game state between off-chain game servers and on-chain contracts. Handles score submissions, leaderboard updates, and asset transfers.",
        "skills": ["gaming", "oracle", "state-sync", "bridging"],
        "price_avax": 2.5,
        "price_type": "hourly",
        "avg_completion_time_hours": 24,
    },
]

GENERAL_LISTINGS = [
    {
        "title": "Smart Contract Deployment Agent",
        "description": "Compiles, deploys, and verifies Solidity smart contracts to Avalanche C-Chain. Supports constructor arguments, proxy patterns, and multi-contract deployments.",
        "skills": ["solidity", "deployment", "avalanche", "smart-contracts"],
        "price_avax": 2.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 1,
    },
    {
        "title": "DAO Governance Executor",
        "description": "Monitors governance proposals and automatically executes passed proposals after timelock periods expire. Multi-sig compatible.",
        "skills": ["governance", "dao", "automation", "multi-sig"],
        "price_avax": 1.5,
        "price_type": "fixed",
        "avg_completion_time_hours": 48,
    },
    {
        "title": "KYC/AML Compliance Check",
        "description": "Automated compliance verification agent. Checks wallet addresses against sanctions lists, analyzes transaction patterns, and generates compliance reports.",
        "skills": ["compliance", "kyc", "aml", "verification"],
        "price_avax": 2.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 1,
    },
    {
        "title": "Multi-Chain Address Monitor",
        "description": "Monitors specified addresses across Avalanche, Ethereum, and BSC for incoming transactions, token transfers, and contract interactions.",
        "skills": ["monitoring", "multi-chain", "alerts", "transactions"],
        "price_avax": 0.3,
        "price_type": "hourly",
        "avg_completion_time_hours": 24,
    },
    {
        "title": "Automated Report Generator",
        "description": "Generates formatted PDF/HTML reports from on-chain data. Supports DeFi position summaries, DAO treasury reports, and protocol analytics.",
        "skills": ["reporting", "automation", "analytics", "pdf"],
        "price_avax": 1.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 3,
    },
    {
        "title": "IPFS Pinning & Storage Agent",
        "description": "Manages IPFS pinning for NFT metadata, agent cards, and decentralized data. Automatic re-pinning and garbage collection.",
        "skills": ["ipfs", "storage", "pinning", "metadata"],
        "price_avax": 0.2,
        "price_type": "hourly",
        "avg_completion_time_hours": 24,
    },
    {
        "title": "AI Model Inference Service",
        "description": "On-demand AI inference using open-source LLMs. Supports text generation, classification, summarization, and embedding generation via API.",
        "skills": ["ai", "inference", "llm", "api", "ml"],
        "price_avax": 0.5,
        "price_type": "fixed",
        "avg_completion_time_hours": 1,
    },
    {
        "title": "Webhook Relay & Transformer",
        "description": "Receives webhooks from external services, transforms payloads, and triggers on-chain transactions or forwards to other endpoints.",
        "skills": ["webhooks", "integration", "automation", "api"],
        "price_avax": 0.4,
        "price_type": "hourly",
        "avg_completion_time_hours": 24,
    },
]

RWA_LISTINGS = [
    {
        "title": "Real Estate Token Compliance Agent",
        "description": "Automated compliance checks for real estate token transfers. Verifies accredited investor status and jurisdiction restrictions.",
        "skills": ["rwa", "compliance", "real-estate", "tokenization"],
        "price_avax": 3.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 12,
    },
    {
        "title": "Commodity Price Oracle",
        "description": "Provides verified commodity price feeds (gold, silver, oil) from multiple data sources with outlier detection and TWAP smoothing.",
        "skills": ["rwa", "oracle", "commodities", "price-feed"],
        "price_avax": 0.5,
        "price_type": "hourly",
        "avg_completion_time_hours": 24,
    },
    {
        "title": "Asset Tokenization Pipeline",
        "description": "End-to-end asset tokenization workflow: document verification, legal wrapper creation, token minting, and distribution management.",
        "skills": ["rwa", "tokenization", "legal", "minting"],
        "price_avax": 10.0,
        "price_type": "fixed",
        "avg_completion_time_hours": 72,
    },
]

ALL_TEMPLATES = {
    "defi": DEFI_LISTINGS,
    "data": DATA_LISTINGS,
    "payments": PAYMENTS_LISTINGS,
    "gaming": GAMING_LISTINGS,
    "general": GENERAL_LISTINGS,
    "rwa": RWA_LISTINGS,
}

# Sample review texts
REVIEW_TEXTS = [
    "Fast execution, exactly as described. Will use again.",
    "Great agent, reliable and consistent results.",
    "Completed the task perfectly. Highly recommended.",
    "Solid performance, good communication throughout.",
    "Task completed on time with quality results.",
    "Exceeded expectations. Very professional.",
    "Worked as advertised. Quick turnaround.",
    "Reliable service, fair pricing for the value delivered.",
    "Impressive accuracy and speed. Top-tier agent.",
    "Good results but took slightly longer than expected.",
    "Clean execution, no issues at all.",
    "Outstanding work. This agent is a must-hire.",
    "Decent results for the price. Would consider using again.",
    "Very responsive and handled edge cases well.",
    "Smooth process from start to finish.",
]

# Sample client addresses
CLIENT_ADDRESSES = [
    "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    "0x1aE0EA34a72D944a8C7603FfB3eC30a6669E454C",
    "0x53d284357ec70cE289D6D64134DfAc8E511c8a3D",
    "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
    "0xF977814e90dA44bFA03b6295A0616a897441aceC",
    "0x8103683202aa8DA10536036EDef04CDd865C225E",
    "0x28C6c06298d514Db089934071355E5743bf21d60",
    "0xDFd5293D8e347dFe59E90eFd55b2956a1343963d",
    "0x56Eddb7aa87536c09CCc2793473599fD21A8b17F",
    "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE",
    "0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0",
    "0xd24400ae8BfEBb18cA49Be86258a3C749cf46853",
]


# ---------------------------------------------------------------------------
# Seeding Functions
# ---------------------------------------------------------------------------

def fetch_top_agents(db, limit: int = 200) -> list[dict]:
    """Fetch top-scoring agents to use as marketplace providers."""
    agents = []
    offset = 0
    while len(agents) < limit:
        batch = (
            db.table("agents")
            .select("agent_id, name, category, composite_score, tier, owner_address")
            .gt("composite_score", 30)
            .order("composite_score", desc=True)
            .range(offset, offset + 999)
            .execute()
        )
        if not batch.data:
            break
        agents.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000
    return agents[:limit]


def create_listings(db, agents: list[dict]) -> list[dict]:
    """Create marketplace listings from agent templates."""
    now = datetime.now(timezone.utc)
    listings = []

    for agent in agents:
        cat = agent.get("category", "general") or "general"
        templates = ALL_TEMPLATES.get(cat, ALL_TEMPLATES["general"])

        # Pick a template deterministically based on agent_id
        idx = agent["agent_id"] % len(templates)
        template = templates[idx]

        # Vary the price slightly
        h = int(hashlib.md5(f"price-{agent['agent_id']}".encode()).hexdigest()[:4], 16)
        price_mult = 0.7 + (h % 60) / 100  # 0.7 to 1.3x
        price = round(template["price_avax"] * price_mult, 2)

        # Vary completion time
        h2 = int(hashlib.md5(f"time-{agent['agent_id']}".encode()).hexdigest()[:4], 16)
        time_mult = 0.8 + (h2 % 40) / 100
        completion_hours = max(1, int(template["avg_completion_time_hours"] * time_mult))

        # Determine min_tier based on agent's own tier
        tier = agent.get("tier", "unranked")
        min_tier = "unranked"
        if tier in ("gold", "platinum", "diamond"):
            min_tier = "bronze"
        elif tier == "silver":
            min_tier = "unranked"

        # Vary creation date (spread over last 30 days)
        h3 = int(hashlib.md5(f"date-{agent['agent_id']}".encode()).hexdigest()[:4], 16)
        days_ago = h3 % 30
        created_at = (now - timedelta(days=days_ago, hours=h3 % 24)).isoformat()

        agent_name = agent.get("name") or f"Agent #{agent['agent_id']}"
        title = template["title"]
        # Make some titles unique by appending agent context
        if h % 3 == 0:
            title = f"{title} by {agent_name}"

        listings.append({
            "agent_id": agent["agent_id"],
            "title": title[:200],
            "description": template["description"],
            "skills": template["skills"],
            "price_avax": price,
            "price_type": template["price_type"],
            "min_tier": min_tier,
            "is_active": True,
            "max_concurrent_tasks": random.choice([3, 5, 10, 15, 20]),
            "avg_completion_time_hours": completion_hours,
            "created_at": created_at,
            "updated_at": created_at,
        })

    # Insert in batches
    inserted = 0
    for i in range(0, len(listings), 100):
        batch = listings[i:i + 100]
        try:
            result = db.table("marketplace_listings").insert(batch).execute()
            inserted += len(result.data) if result.data else 0
        except Exception as e:
            logger.error(f"Failed to insert listings batch at {i}: {e}")

    logger.info(f"Created {inserted} listings")
    return listings


def create_tasks_and_reviews(db, listing_ids: list[int], agents: list[dict]):
    """Create completed tasks and reviews for a subset of listings."""
    now = datetime.now(timezone.utc)
    agent_map = {a["agent_id"]: a for a in agents}

    tasks_to_insert = []
    reviews_to_insert = []

    # Create tasks for ~60% of listings
    for listing_id_data in listing_ids:
        lid = listing_id_data["id"]
        agent_id = listing_id_data["agent_id"]
        price = listing_id_data.get("price_avax", 1.0)
        title = listing_id_data.get("title", "Task")

        h = int(hashlib.md5(f"task-{lid}".encode()).hexdigest()[:4], 16)
        if h % 10 > 5:  # ~60% chance of having tasks
            continue

        # Generate 1-5 tasks per listing
        num_tasks = (h % 5) + 1
        for t in range(num_tasks):
            task_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"task-{lid}-{t}"))
            client = CLIENT_ADDRESSES[h % len(CLIENT_ADDRESSES)]

            h2 = int(hashlib.md5(f"status-{lid}-{t}".encode()).hexdigest()[:4], 16)
            if h2 % 10 < 7:
                status = "completed"
            elif h2 % 10 < 9:
                status = "in_progress"
            else:
                status = "pending"

            days_ago = (h2 % 20) + 1
            created_at = (now - timedelta(days=days_ago)).isoformat()
            completed_at = (now - timedelta(days=max(0, days_ago - 1))).isoformat() if status == "completed" else None
            accepted_at = (now - timedelta(days=days_ago, hours=-2)).isoformat() if status != "pending" else None

            task_price = round(price * (0.9 + (h2 % 20) / 100), 4)

            tasks_to_insert.append({
                "task_id": task_uuid,
                "listing_id": lid,
                "agent_id": agent_id,
                "client_address": client,
                "title": f"{title}",
                "description": f"Task execution for listing #{lid}",
                "status": status,
                "price_avax": task_price,
                "created_at": created_at,
                "updated_at": completed_at or accepted_at or created_at,
                "accepted_at": accepted_at,
                "completed_at": completed_at,
            })

            # Add review for completed tasks (~80% get reviewed)
            if status == "completed" and h2 % 5 != 0:
                h3 = int(hashlib.md5(f"review-{lid}-{t}".encode()).hexdigest()[:4], 16)
                rating = 60 + (h3 % 40)  # 60-99 range
                review_text = REVIEW_TEXTS[h3 % len(REVIEW_TEXTS)]

                reviews_to_insert.append({
                    "task_id": task_uuid,
                    "reviewer_address": client,
                    "agent_id": agent_id,
                    "rating": rating,
                    "review_text": review_text,
                    "created_at": completed_at,
                })

    # Insert tasks
    inserted_tasks = 0
    for i in range(0, len(tasks_to_insert), 100):
        batch = tasks_to_insert[i:i + 100]
        try:
            result = db.table("marketplace_tasks").insert(batch).execute()
            inserted_tasks += len(result.data) if result.data else 0
        except Exception as e:
            logger.error(f"Failed to insert tasks batch at {i}: {e}")

    logger.info(f"Created {inserted_tasks} tasks")

    # Insert reviews
    inserted_reviews = 0
    for i in range(0, len(reviews_to_insert), 100):
        batch = reviews_to_insert[i:i + 100]
        try:
            result = db.table("marketplace_reviews").insert(batch).execute()
            inserted_reviews += len(result.data) if result.data else 0
        except Exception as e:
            logger.error(f"Failed to insert reviews batch at {i}: {e}")

    logger.info(f"Created {inserted_reviews} reviews")
    return inserted_tasks, inserted_reviews


def run_marketplace_seeding():
    """Main entry point."""
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY", "")

    if not supabase_url or not supabase_key:
        logger.error("SUPABASE_URL and SUPABASE_KEY must be set")
        sys.exit(1)

    db = create_client(supabase_url, supabase_key)

    # Step 1: Fetch top agents
    logger.info("Step 1/3: Fetching top-scoring agents for marketplace listings...")
    agents = fetch_top_agents(db, limit=200)
    logger.info(f"Found {len(agents)} eligible agents")

    if not agents:
        logger.error("No agents found with composite_score > 30. Run bulk_evaluate.py first.")
        sys.exit(1)

    # Step 2: Create listings
    logger.info("Step 2/3: Creating marketplace listings...")
    listings = create_listings(db, agents)

    # Step 3: Fetch created listing IDs and create tasks/reviews
    logger.info("Step 3/3: Creating tasks and reviews...")
    listing_result = (
        db.table("marketplace_listings")
        .select("id, agent_id, price_avax, title")
        .eq("is_active", True)
        .execute()
    )
    listing_data = listing_result.data or []
    tasks_count, reviews_count = create_tasks_and_reviews(db, listing_data, agents)

    # Summary
    total_volume = sum(
        float(l.get("price_avax", 0)) for l in listing_data
    )

    logger.info("")
    logger.info("=== Marketplace Seeding Complete ===")
    logger.info(f"  Listings created: {len(listings)}")
    logger.info(f"  Tasks created:    {tasks_count}")
    logger.info(f"  Reviews created:  {reviews_count}")
    logger.info(f"  Agents used:      {len(agents)}")
    logger.info("")
    logger.info("Check marketplace at https://agentproof.sh/marketplace")


if __name__ == "__main__":
    run_marketplace_seeding()
