#!/usr/bin/env python3
"""
AgentProof Event Indexer — Standalone Service

Connects to Avalanche C-Chain (Fuji testnet) via RPC, listens for events from
all 3 registry contracts, and syncs data to Supabase. Runs on a configurable
polling interval with block confirmation safety.
"""

import json
import logging
import time
import sys
from datetime import datetime, timezone

from web3 import Web3
from supabase import create_client

from config import (
    AVALANCHE_RPC_URL,
    IDENTITY_REGISTRY_ADDRESS,
    REPUTATION_REGISTRY_ADDRESS,
    VALIDATION_REGISTRY_ADDRESS,
    SUPABASE_URL,
    SUPABASE_KEY,
    POLL_INTERVAL,
    CONFIRMATION_BLOCKS,
)
from scoring import (
    calculate_composite_score,
    calculate_std_dev,
    calculate_account_age_days,
    determine_tier,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("indexer")

# ABI fragments
IDENTITY_ABI = json.loads("""[
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":true,"name":"owner","type":"address"},{"name":"agentURI","type":"string"}],"name":"AgentRegistered","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"name":"newURI","type":"string"}],"name":"AgentURIUpdated","type":"event"}
]""")

REPUTATION_ABI = json.loads("""[
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":true,"name":"reviewer","type":"address"},{"name":"rating","type":"uint8"},{"name":"taskHash","type":"bytes32"}],"name":"FeedbackSubmitted","type":"event"}
]""")

VALIDATION_ABI = json.loads("""[
    {"anonymous":false,"inputs":[{"indexed":true,"name":"validationId","type":"uint256"},{"indexed":true,"name":"agentId","type":"uint256"},{"name":"taskHash","type":"bytes32"}],"name":"ValidationRequested","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"validationId","type":"uint256"},{"indexed":true,"name":"validator","type":"address"},{"name":"isValid","type":"bool"}],"name":"ValidationSubmitted","type":"event"}
]""")


class AgentProofIndexer:
    def __init__(self):
        logger.info(f"Connecting to {AVALANCHE_RPC_URL}")
        self.w3 = Web3(Web3.HTTPProvider(AVALANCHE_RPC_URL))

        if not self.w3.is_connected():
            logger.error("Failed to connect to Avalanche RPC")
            sys.exit(1)
        logger.info(f"Connected to chain ID: {self.w3.eth.chain_id}")

        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.error("Supabase URL and key must be configured")
            sys.exit(1)
        self.db = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Connected to Supabase")

        self.identity_contract = None
        self.reputation_contract = None
        self.validation_contract = None

        if IDENTITY_REGISTRY_ADDRESS:
            self.identity_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(IDENTITY_REGISTRY_ADDRESS),
                abi=IDENTITY_ABI,
            )
            logger.info(f"Identity Registry: {IDENTITY_REGISTRY_ADDRESS}")

        if REPUTATION_REGISTRY_ADDRESS:
            self.reputation_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(REPUTATION_REGISTRY_ADDRESS),
                abi=REPUTATION_ABI,
            )
            logger.info(f"Reputation Registry: {REPUTATION_REGISTRY_ADDRESS}")

        if VALIDATION_REGISTRY_ADDRESS:
            self.validation_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(VALIDATION_REGISTRY_ADDRESS),
                abi=VALIDATION_ABI,
            )
            logger.info(f"Validation Registry: {VALIDATION_REGISTRY_ADDRESS}")

    def get_last_block(self, contract_name: str) -> int:
        try:
            result = (
                self.db.table("indexer_state")
                .select("last_block")
                .eq("contract_name", contract_name)
                .execute()
            )
            if result.data:
                return result.data[0]["last_block"]
            self.db.table("indexer_state").insert(
                {"contract_name": contract_name, "last_block": 0}
            ).execute()
            return 0
        except Exception as e:
            logger.error(f"Error getting last block for {contract_name}: {e}")
            return 0

    def set_last_block(self, contract_name: str, block: int):
        try:
            self.db.table("indexer_state").upsert(
                {
                    "contract_name": contract_name,
                    "last_block": block,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="contract_name",
            ).execute()
        except Exception as e:
            logger.error(f"Error setting last block for {contract_name}: {e}")

    def get_block_timestamp(self, block_number: int) -> datetime:
        block = self.w3.eth.get_block(block_number)
        return datetime.fromtimestamp(block.timestamp, tz=timezone.utc)

    def process_identity_events(self, from_block: int, to_block: int) -> int:
        if not self.identity_contract:
            return 0

        count = 0

        # AgentRegistered events
        try:
            events = self.identity_contract.events.AgentRegistered().get_logs(
                fromBlock=from_block, toBlock=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                owner = event.args.owner
                uri = event.args.agentURI
                ts = self.get_block_timestamp(event.blockNumber)

                self.db.table("agents").upsert(
                    {
                        "agent_id": agent_id,
                        "owner_address": owner,
                        "agent_uri": uri,
                        "registered_at": ts.isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    },
                    on_conflict="agent_id",
                ).execute()
                logger.info(f"[IDENTITY] Agent #{agent_id} registered by {owner}")
                count += 1
        except Exception as e:
            logger.error(f"Error processing AgentRegistered events: {e}")

        # AgentURIUpdated events
        try:
            events = self.identity_contract.events.AgentURIUpdated().get_logs(
                fromBlock=from_block, toBlock=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                new_uri = event.args.newURI

                self.db.table("agents").update(
                    {
                        "agent_uri": new_uri,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).eq("agent_id", agent_id).execute()
                logger.info(f"[IDENTITY] Agent #{agent_id} URI updated")
                count += 1
        except Exception as e:
            logger.error(f"Error processing AgentURIUpdated events: {e}")

        return count

    def process_reputation_events(self, from_block: int, to_block: int) -> int:
        if not self.reputation_contract:
            return 0

        count = 0
        try:
            events = self.reputation_contract.events.FeedbackSubmitted().get_logs(
                fromBlock=from_block, toBlock=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                reviewer = event.args.reviewer
                rating = event.args.rating
                task_hash = event.args.taskHash.hex()
                tx_hash = event.transactionHash.hex()
                block = event.blockNumber
                ts = self.get_block_timestamp(block)

                self.db.table("reputation_events").upsert(
                    {
                        "agent_id": agent_id,
                        "reviewer_address": reviewer,
                        "rating": rating,
                        "task_hash": task_hash,
                        "tx_hash": tx_hash,
                        "block_number": block,
                        "created_at": ts.isoformat(),
                    },
                    on_conflict="tx_hash",
                ).execute()
                logger.info(f"[REPUTATION] Agent #{agent_id} rated {rating} by {reviewer[:10]}...")
                count += 1
        except Exception as e:
            logger.error(f"Error processing FeedbackSubmitted events: {e}")

        return count

    def process_validation_events(self, from_block: int, to_block: int) -> int:
        if not self.validation_contract:
            return 0

        count = 0

        # ValidationRequested
        try:
            events = self.validation_contract.events.ValidationRequested().get_logs(
                fromBlock=from_block, toBlock=to_block
            )
            for event in events:
                vid = event.args.validationId
                agent_id = event.args.agentId
                task_hash = event.args.taskHash.hex()
                tx_hash = event.transactionHash.hex()
                block = event.blockNumber
                ts = self.get_block_timestamp(block)

                self.db.table("validation_records").upsert(
                    {
                        "validation_id": vid,
                        "agent_id": agent_id,
                        "task_hash": task_hash,
                        "requester_address": "",
                        "requested_at": ts.isoformat(),
                        "tx_hash": tx_hash,
                        "block_number": block,
                    },
                    on_conflict="validation_id",
                ).execute()
                logger.info(f"[VALIDATION] Request #{vid} for agent #{agent_id}")
                count += 1
        except Exception as e:
            logger.error(f"Error processing ValidationRequested events: {e}")

        # ValidationSubmitted
        try:
            events = self.validation_contract.events.ValidationSubmitted().get_logs(
                fromBlock=from_block, toBlock=to_block
            )
            for event in events:
                vid = event.args.validationId
                validator = event.args.validator
                is_valid = event.args.isValid
                ts = self.get_block_timestamp(event.blockNumber)

                self.db.table("validation_records").update(
                    {
                        "validator_address": validator,
                        "is_valid": is_valid,
                        "validated_at": ts.isoformat(),
                    }
                ).eq("validation_id", vid).execute()
                logger.info(f"[VALIDATION] Response #{vid}: valid={is_valid}")
                count += 1
        except Exception as e:
            logger.error(f"Error processing ValidationSubmitted events: {e}")

        return count

    def recalculate_scores(self):
        """Recalculate composite scores and tiers for all agents."""
        try:
            agents = self.db.table("agents").select("*").execute()
        except Exception as e:
            logger.error(f"Error fetching agents: {e}")
            return

        for agent in agents.data:
            agent_id = agent["agent_id"]

            try:
                ratings_result = (
                    self.db.table("reputation_events")
                    .select("rating")
                    .eq("agent_id", agent_id)
                    .execute()
                )
                ratings = [r["rating"] for r in ratings_result.data]
            except Exception:
                ratings = []

            feedback_count = len(ratings)
            avg_rating = sum(ratings) / len(ratings) if ratings else 0
            std_dev = calculate_std_dev(ratings)

            try:
                validations = (
                    self.db.table("validation_records")
                    .select("is_valid")
                    .eq("agent_id", agent_id)
                    .not_.is_("is_valid", "null")
                    .execute()
                )
                completed = len(validations.data)
                successful = sum(1 for v in validations.data if v["is_valid"])
                success_rate = (successful / completed * 100) if completed > 0 else 0
            except Exception:
                success_rate = 0

            registered_at = datetime.fromisoformat(
                agent["registered_at"].replace("Z", "+00:00")
            )
            age_days = calculate_account_age_days(registered_at)

            composite = calculate_composite_score(
                average_rating=avg_rating,
                feedback_count=feedback_count,
                rating_std_dev=std_dev,
                validation_success_rate=success_rate,
                account_age_days=age_days,
            )
            tier = determine_tier(composite, feedback_count)

            try:
                self.db.table("agents").update(
                    {
                        "total_feedback": feedback_count,
                        "average_rating": round(avg_rating, 2),
                        "composite_score": composite,
                        "validation_success_rate": round(success_rate, 2),
                        "tier": tier,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).eq("agent_id", agent_id).execute()
            except Exception as e:
                logger.error(f"Error updating scores for agent #{agent_id}: {e}")

    def update_leaderboard(self):
        """Refresh leaderboard cache and agent ranks."""
        try:
            agents = (
                self.db.table("agents")
                .select("agent_id, category, composite_score")
                .order("composite_score", desc=True)
                .execute()
            )
        except Exception as e:
            logger.error(f"Error fetching agents for leaderboard: {e}")
            return

        # Clear old cache
        try:
            self.db.table("leaderboard_cache").delete().neq("id", 0).execute()
        except Exception:
            pass

        now = datetime.now(timezone.utc).isoformat()
        categories: dict[str, list] = {}

        for rank, agent in enumerate(agents.data, 1):
            # Update global rank
            try:
                self.db.table("agents").update({"rank": rank}).eq(
                    "agent_id", agent["agent_id"]
                ).execute()
            except Exception:
                pass

            cat = agent.get("category", "general") or "general"
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(agent)

        for category, cat_agents in categories.items():
            for cat_rank, agent in enumerate(cat_agents, 1):
                try:
                    self.db.table("leaderboard_cache").insert(
                        {
                            "category": category,
                            "agent_id": agent["agent_id"],
                            "rank": cat_rank,
                            "composite_score": agent["composite_score"],
                            "trend": "stable",
                            "updated_at": now,
                        }
                    ).execute()
                except Exception:
                    pass

    def take_daily_snapshot(self):
        """Take a daily score snapshot for historical tracking."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        try:
            agents = self.db.table("agents").select(
                "agent_id, composite_score, average_rating, total_feedback, validation_success_rate"
            ).execute()
        except Exception as e:
            logger.error(f"Error fetching agents for snapshot: {e}")
            return

        for agent in agents.data:
            try:
                self.db.table("score_history").upsert(
                    {
                        "agent_id": agent["agent_id"],
                        "composite_score": agent["composite_score"],
                        "average_rating": agent["average_rating"],
                        "total_feedback": agent["total_feedback"],
                        "validation_success_rate": agent["validation_success_rate"],
                        "snapshot_date": today,
                    },
                    on_conflict="agent_id,snapshot_date",
                ).execute()
            except Exception:
                pass

    def run_cycle(self):
        """Execute one full indexer cycle."""
        try:
            current_block = self.w3.eth.block_number
        except Exception as e:
            logger.error(f"Error getting block number: {e}")
            return

        safe_block = current_block - CONFIRMATION_BLOCKS
        if safe_block < 0:
            return

        total_events = 0

        # Identity events
        last = self.get_last_block("identity")
        if last < safe_block:
            count = self.process_identity_events(last + 1, safe_block)
            total_events += count
            self.set_last_block("identity", safe_block)

        # Reputation events
        last = self.get_last_block("reputation")
        if last < safe_block:
            count = self.process_reputation_events(last + 1, safe_block)
            total_events += count
            self.set_last_block("reputation", safe_block)

        # Validation events
        last = self.get_last_block("validation")
        if last < safe_block:
            count = self.process_validation_events(last + 1, safe_block)
            total_events += count
            self.set_last_block("validation", safe_block)

        if total_events > 0:
            logger.info(f"Processed {total_events} events up to block {safe_block}")
            self.recalculate_scores()
            self.update_leaderboard()
            self.take_daily_snapshot()

    def run(self):
        """Main loop — polls every POLL_INTERVAL seconds."""
        logger.info(f"Starting indexer (poll interval: {POLL_INTERVAL}s, confirmations: {CONFIRMATION_BLOCKS})")

        while True:
            try:
                self.run_cycle()
            except KeyboardInterrupt:
                logger.info("Shutting down indexer...")
                break
            except Exception as e:
                logger.error(f"Indexer cycle error: {e}", exc_info=True)

            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    if not IDENTITY_REGISTRY_ADDRESS:
        logger.error("No contract addresses configured. Set IDENTITY_REGISTRY_ADDRESS in .env")
        logger.info("Indexer will run in standby mode, checking every 30s for configuration...")

        while not IDENTITY_REGISTRY_ADDRESS:
            time.sleep(30)
            # Re-read config in case env vars were updated
            from importlib import reload
            import config as cfg
            reload(cfg)

    indexer = AgentProofIndexer()
    indexer.run()
