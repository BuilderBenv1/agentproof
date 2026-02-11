#!/usr/bin/env python3
"""
Insurance & Payments Seeding Script
====================================
Populates insurance stakes, claims, and payment records using existing agents.

Usage:
    cd oracle
    SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python scripts/seed_insurance_payments.py
"""

import hashlib
import logging
import os
import sys
from datetime import datetime, timedelta, timezone

from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Token addresses
NATIVE_AVAX = "0x0000000000000000000000000000000000000000"
USDC = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"  # Avalanche USDC
USDT = "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7"  # Avalanche USDT
TOKENS = [NATIVE_AVAX, USDC, USDT]
TOKEN_NAMES = {NATIVE_AVAX: "AVAX", USDC: "USDC", USDT: "USDT"}

# Staker / claimant addresses
ADDRESSES = [
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
    "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
    "0xCA8Fa8f0b631EcdB18Cda619C4Fc9d197c8aFfCa",
    "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503",
]

EVIDENCE_URIS = [
    "ipfs://QmV8cfu6n4NT5xRr2AHdKxFMT8YS",
    "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgP",
    "ipfs://QmSsw6EcnwEiTT9c4rnAGeSENvsJ",
    "ipfs://QmNLei78zWmzUdbeRB39TY1Ae1kY",
    "ipfs://QmPZ9gcCEpqKTo6aq61g2nXGUhM4iC",
]

TIER_STAKES = {
    "diamond": 0.05,
    "platinum": 0.1,
    "gold": 0.2,
    "silver": 0.3,
    "bronze": 0.5,
    "unranked": 1.0,
}


def _hash_int(seed: str) -> int:
    return int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16)


def fetch_agents(db, limit: int = 300) -> list[dict]:
    """Fetch agents with scores for seeding."""
    agents = []
    offset = 0
    while len(agents) < limit:
        batch = (
            db.table("agents")
            .select("agent_id, name, category, composite_score, tier, owner_address")
            .gt("composite_score", 20)
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


def seed_insurance(db, agents: list[dict]):
    """Create insurance stakes and claims."""
    now = datetime.now(timezone.utc)
    stakes = []
    claims = []
    claim_id = 1

    # ~40% of agents get insured (staked)
    for agent in agents:
        aid = agent["agent_id"]
        h = _hash_int(f"insure-{aid}")
        if h % 10 > 3:
            continue

        tier = agent.get("tier", "unranked") or "unranked"
        min_stake = TIER_STAKES.get(tier, 1.0)
        # Stake 1x-3x the minimum
        multiplier = 1.0 + (h % 20) / 10
        stake_amount = round(min_stake * multiplier, 4)

        days_ago = (h % 25) + 1
        staked_at = (now - timedelta(days=days_ago)).isoformat()
        tx_hash = f"0x{hashlib.sha256(f'stake-{aid}'.encode()).hexdigest()}"

        staker = agent.get("owner_address") or ADDRESSES[h % len(ADDRESSES)]

        stakes.append({
            "agent_id": aid,
            "staker_address": staker,
            "stake_amount": stake_amount,
            "tier": tier,
            "is_active": True,
            "staked_at": staked_at,
            "tx_hash": tx_hash,
            "block_number": 50000000 + (h % 500000),
        })

        # ~30% of staked agents have a claim filed against them
        h2 = _hash_int(f"claim-{aid}")
        if h2 % 10 < 3:
            claim_days_ago = max(1, days_ago - 3)
            filed_at = (now - timedelta(days=claim_days_ago)).isoformat()

            # Claim status distribution: 40% approved, 25% rejected, 20% pending, 15% disputed
            status_bucket = h2 % 20
            if status_bucket < 8:
                status = "approved"
                resolved_at = (now - timedelta(days=max(0, claim_days_ago - 2))).isoformat()
                in_favor = True
            elif status_bucket < 13:
                status = "rejected"
                resolved_at = (now - timedelta(days=max(0, claim_days_ago - 2))).isoformat()
                in_favor = False
            elif status_bucket < 17:
                status = "pending"
                resolved_at = None
                in_favor = None
            else:
                status = "disputed"
                resolved_at = None
                in_favor = None

            claim_amount = round(stake_amount * (0.3 + (h2 % 50) / 100), 4)
            evidence = EVIDENCE_URIS[h2 % len(EVIDENCE_URIS)] if h2 % 3 != 0 else None
            dispute = EVIDENCE_URIS[(h2 + 1) % len(EVIDENCE_URIS)] if status == "disputed" else None

            claims.append({
                "claim_id": claim_id,
                "agent_id": aid,
                "claimant_address": ADDRESSES[h2 % len(ADDRESSES)],
                "amount": claim_amount,
                "evidence_uri": evidence,
                "dispute_uri": dispute,
                "status": status,
                "filed_at": filed_at,
                "resolved_at": resolved_at,
                "in_favor_of_claimant": in_favor,
                "tx_hash": f"0x{hashlib.sha256(f'claim-{claim_id}'.encode()).hexdigest()}",
                "block_number": 50000000 + (h2 % 500000),
            })
            claim_id += 1

    # Insert stakes
    inserted_stakes = 0
    for i in range(0, len(stakes), 100):
        batch = stakes[i:i + 100]
        try:
            result = db.table("insurance_stakes").upsert(batch, on_conflict="tx_hash").execute()
            inserted_stakes += len(result.data) if result.data else len(batch)
        except Exception as e:
            logger.error(f"Stakes batch {i} failed: {e}")

    logger.info(f"Insurance stakes: {inserted_stakes}")

    # Insert claims
    inserted_claims = 0
    for i in range(0, len(claims), 100):
        batch = claims[i:i + 100]
        try:
            result = db.table("insurance_claims").upsert(batch, on_conflict="claim_id").execute()
            inserted_claims += len(result.data) if result.data else len(batch)
        except Exception as e:
            logger.error(f"Claims batch {i} failed: {e}")

    logger.info(f"Insurance claims: {inserted_claims}")
    return inserted_stakes, inserted_claims


def seed_payments(db, agents: list[dict]):
    """Create payment records between agents."""
    now = datetime.now(timezone.utc)
    payments = []
    payment_id = 1

    agent_ids = [a["agent_id"] for a in agents]

    for i, agent in enumerate(agents):
        aid = agent["agent_id"]
        h = _hash_int(f"pay-{aid}")

        # ~50% of agents have payment activity
        if h % 10 > 4:
            continue

        # 1-4 payments per active agent
        num_payments = (h % 4) + 1
        for p in range(num_payments):
            h2 = _hash_int(f"pay-{aid}-{p}")

            # Pick a counterparty
            counterparty_idx = h2 % len(agent_ids)
            counterparty = agent_ids[counterparty_idx]
            if counterparty == aid:
                counterparty = agent_ids[(counterparty_idx + 1) % len(agent_ids)]

            # Direction: this agent sends or receives
            if h2 % 2 == 0:
                from_id, to_id = aid, counterparty
            else:
                from_id, to_id = counterparty, aid

            # Token selection: 60% AVAX, 25% USDC, 15% USDT
            token_bucket = h2 % 20
            if token_bucket < 12:
                token = NATIVE_AVAX
                # AVAX amounts: 0.1 to 15
                amount = round(0.1 + (h2 % 1490) / 100, 4)
            elif token_bucket < 17:
                token = USDC
                # USDC amounts: 5 to 500
                amount = round(5 + (h2 % 495), 2)
            else:
                token = USDT
                # USDT amounts: 5 to 500
                amount = round(5 + (h2 % 495), 2)

            # Status: 55% released, 20% escrowed, 15% refunded, 10% cancelled
            status_bucket = h2 % 20
            if status_bucket < 11:
                status = "released"
            elif status_bucket < 15:
                status = "escrowed"
            elif status_bucket < 18:
                status = "refunded"
            else:
                status = "cancelled"

            days_ago = (h2 % 28) + 1
            created_at = (now - timedelta(days=days_ago)).isoformat()
            resolved_at = (now - timedelta(days=max(0, days_ago - 1))).isoformat() if status != "escrowed" else None

            task_hash = f"0x{hashlib.sha256(f'task-{payment_id}'.encode()).hexdigest()}"
            tx_hash = f"0x{hashlib.sha256(f'payment-{payment_id}'.encode()).hexdigest()}"

            payments.append({
                "payment_id": payment_id,
                "from_agent_id": from_id,
                "to_agent_id": to_id,
                "amount": amount,
                "token_address": token,
                "task_hash": task_hash,
                "requires_validation": h2 % 3 == 0,
                "status": status,
                "created_at": created_at,
                "resolved_at": resolved_at,
                "tx_hash": tx_hash,
                "block_number": 50000000 + (h2 % 500000),
            })
            payment_id += 1

    # Insert payments
    inserted = 0
    for i in range(0, len(payments), 100):
        batch = payments[i:i + 100]
        try:
            result = db.table("payments").upsert(batch, on_conflict="payment_id").execute()
            inserted += len(result.data) if result.data else len(batch)
        except Exception as e:
            logger.error(f"Payments batch {i} failed: {e}")

    logger.info(f"Payments: {inserted}")
    return inserted


def main():
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY", "")

    if not supabase_url or not supabase_key:
        logger.error("SUPABASE_URL and SUPABASE_KEY must be set")
        sys.exit(1)

    db = create_client(supabase_url, supabase_key)

    logger.info("Fetching agents...")
    agents = fetch_agents(db, limit=300)
    logger.info(f"Found {len(agents)} eligible agents")

    if not agents:
        logger.error("No agents with score > 20. Run bulk_evaluate.py + scoring cycle first.")
        sys.exit(1)

    logger.info("=== Seeding Insurance ===")
    stakes, claims = seed_insurance(db, agents)

    logger.info("=== Seeding Payments ===")
    payment_count = seed_payments(db, agents)

    logger.info("")
    logger.info("=== Seeding Complete ===")
    logger.info(f"  Insurance stakes: {stakes}")
    logger.info(f"  Insurance claims: {claims}")
    logger.info(f"  Payments:         {payment_count}")
    logger.info("")
    logger.info("Check at:")
    logger.info("  https://agentproof.sh/insurance")
    logger.info("  https://agentproof.sh/payments")


if __name__ == "__main__":
    main()
