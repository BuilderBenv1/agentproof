"""
Indexer service that runs as part of the backend process.
Periodically polls for new blockchain events and syncs them to Supabase.
"""

import logging
from datetime import datetime, timezone

from app.database import get_supabase
from app.services.blockchain import get_blockchain_service
from app.services.scoring import (
    calculate_composite_score,
    calculate_std_dev,
    calculate_account_age_days,
    determine_tier,
)

logger = logging.getLogger(__name__)

CONFIRMATION_BLOCKS = 3
DEFAULT_START_BLOCK = 77_000_000
ERC8004_IDENTITY_START_BLOCK = 77_389_000  # Contract deployed at this block
MAX_BLOCK_RANGE = 2000


def get_last_processed_block(contract_name: str, default_start: int = DEFAULT_START_BLOCK) -> int:
    """Get the last processed block for a contract from the indexer_state table."""
    try:
        db = get_supabase()
        result = (
            db.table("indexer_state")
            .select("last_block")
            .eq("contract_name", contract_name)
            .execute()
        )
        if result.data:
            stored = result.data[0]["last_block"]
            if stored < default_start:
                logger.info(f"Fast-forwarding {contract_name} from block {stored} to {default_start}")
                update_last_processed_block(contract_name, default_start)
                return default_start
            return stored
        # Initialize state
        db.table("indexer_state").insert(
            {"contract_name": contract_name, "last_block": default_start}
        ).execute()
        return default_start
    except Exception as e:
        logger.error(f"Error getting last block for {contract_name}: {e}")
        return default_start


def update_last_processed_block(contract_name: str, block_number: int):
    """Update the last processed block for a contract."""
    try:
        db = get_supabase()
        db.table("indexer_state").upsert(
            {
                "contract_name": contract_name,
                "last_block": block_number,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="contract_name",
        ).execute()
    except Exception as e:
        logger.error(f"Error updating last block for {contract_name}: {e}")


def process_agent_registered_events(from_block: int, to_block: int):
    """Process AgentRegistered events."""
    blockchain = get_blockchain_service()
    events = blockchain.get_identity_events(from_block, to_block)

    db = get_supabase()
    for event in events:
        agent_id = event.args.agentId
        owner = event.args.owner
        agent_uri = event.args.agentURI
        block = event.blockNumber
        tx_hash = event.transactionHash.hex()

        # Get block timestamp
        block_data = blockchain.w3.eth.get_block(block)
        timestamp = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

        try:
            db.table("agents").upsert(
                {
                    "agent_id": agent_id,
                    "owner_address": owner,
                    "agent_uri": agent_uri,
                    "registered_at": timestamp.isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="agent_id",
            ).execute()
            logger.info(f"Indexed agent #{agent_id} from block {block}")
        except Exception as e:
            logger.error(f"Error indexing agent #{agent_id}: {e}")

    return len(events)


def process_erc8004_identity_events(from_block: int, to_block: int):
    """Process Registered events from the official ERC-8004 Identity Registry."""
    blockchain = get_blockchain_service()
    logger.info(f"[ERC-8004] Scanning blocks {from_block}-{to_block} (range={to_block - from_block + 1})")
    try:
        events = blockchain.get_erc8004_registered_events(from_block, to_block)
    except Exception as e:
        logger.error(f"[ERC-8004] get_logs failed for {from_block}-{to_block}: {e}")
        return 0
    logger.info(f"[ERC-8004] Found {len(events)} Registered events in {from_block}-{to_block}")

    db = get_supabase()
    for event in events:
        agent_id = event.args.agentId
        owner = event.args.owner
        agent_uri = event.args.agentURI
        block = event.blockNumber
        tx_hash = event.transactionHash.hex()

        # Get block timestamp
        block_data = blockchain.w3.eth.get_block(block)
        timestamp = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

        try:
            db.table("agents").upsert(
                {
                    "agent_id": agent_id,
                    "owner_address": owner,
                    "agent_uri": agent_uri,
                    "registered_at": timestamp.isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="agent_id",
            ).execute()
            logger.info(f"Indexed ERC-8004 agent #{agent_id} from block {block}")
        except Exception as e:
            logger.error(f"Error indexing ERC-8004 agent #{agent_id}: {e}")

    return len(events)


def process_feedback_events(from_block: int, to_block: int):
    """Process FeedbackSubmitted events."""
    blockchain = get_blockchain_service()
    events = blockchain.get_feedback_events(from_block, to_block)

    db = get_supabase()
    for event in events:
        agent_id = event.args.agentId
        reviewer = event.args.reviewer
        rating = event.args.rating
        task_hash = event.args.taskHash.hex()
        block = event.blockNumber
        tx_hash = event.transactionHash.hex()

        block_data = blockchain.w3.eth.get_block(block)
        timestamp = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

        try:
            db.table("reputation_events").upsert(
                {
                    "agent_id": agent_id,
                    "reviewer_address": reviewer,
                    "rating": rating,
                    "task_hash": task_hash,
                    "tx_hash": tx_hash,
                    "block_number": block,
                    "created_at": timestamp.isoformat(),
                },
                on_conflict="tx_hash",
            ).execute()
            logger.info(f"Indexed feedback for agent #{agent_id} (rating={rating})")
        except Exception as e:
            logger.error(f"Error indexing feedback: {e}")

    return len(events)


def process_validation_events(from_block: int, to_block: int):
    """Process ValidationRequested and ValidationSubmitted events."""
    blockchain = get_blockchain_service()

    db = get_supabase()

    # Process requests
    req_events = blockchain.get_validation_requested_events(from_block, to_block)
    for event in req_events:
        validation_id = event.args.validationId
        agent_id = event.args.agentId
        task_hash = event.args.taskHash.hex()
        block = event.blockNumber
        tx_hash = event.transactionHash.hex()

        block_data = blockchain.w3.eth.get_block(block)
        timestamp = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

        try:
            db.table("validation_records").upsert(
                {
                    "validation_id": validation_id,
                    "agent_id": agent_id,
                    "task_hash": task_hash,
                    "requester_address": "",  # Event doesn't include requester
                    "requested_at": timestamp.isoformat(),
                    "tx_hash": tx_hash,
                    "block_number": block,
                },
                on_conflict="validation_id",
            ).execute()
            logger.info(f"Indexed validation request #{validation_id}")
        except Exception as e:
            logger.error(f"Error indexing validation request: {e}")

    # Process responses
    sub_events = blockchain.get_validation_submitted_events(from_block, to_block)
    for event in sub_events:
        validation_id = event.args.validationId
        validator = event.args.validator
        is_valid = event.args.isValid
        block = event.blockNumber

        block_data = blockchain.w3.eth.get_block(block)
        timestamp = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

        try:
            db.table("validation_records").update(
                {
                    "validator_address": validator,
                    "is_valid": is_valid,
                    "validated_at": timestamp.isoformat(),
                }
            ).eq("validation_id", validation_id).execute()
            logger.info(f"Indexed validation response #{validation_id}")
        except Exception as e:
            logger.error(f"Error indexing validation response: {e}")

    return len(req_events) + len(sub_events)


def recalculate_agent_scores():
    """Recalculate composite scores and tiers for all agents."""
    db = get_supabase()

    try:
        agents = db.table("agents").select("*").execute()
    except Exception as e:
        logger.error(f"Error fetching agents for scoring: {e}")
        return

    for agent in agents.data:
        agent_id = agent["agent_id"]

        # Get all ratings for this agent
        try:
            ratings_result = (
                db.table("reputation_events")
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

        # Get validation success rate
        try:
            validations = (
                db.table("validation_records")
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

        # Calculate account age
        registered_at = datetime.fromisoformat(
            agent["registered_at"].replace("Z", "+00:00")
        )
        age_days = calculate_account_age_days(registered_at)

        # Calculate composite score
        composite = calculate_composite_score(
            average_rating=avg_rating,
            feedback_count=feedback_count,
            rating_std_dev=std_dev,
            validation_success_rate=success_rate,
            account_age_days=age_days,
        )

        tier = determine_tier(composite, feedback_count)

        try:
            db.table("agents").update(
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
            logger.error(f"Error updating agent #{agent_id} scores: {e}")


def update_leaderboard():
    """Update the leaderboard_cache table with current rankings."""
    db = get_supabase()

    try:
        # Get all agents ordered by composite score
        agents = (
            db.table("agents")
            .select("agent_id, category, composite_score")
            .order("composite_score", desc=True)
            .execute()
        )
    except Exception as e:
        logger.error(f"Error fetching agents for leaderboard: {e}")
        return

    # Clear existing cache
    try:
        db.table("leaderboard_cache").delete().neq("id", 0).execute()
    except Exception:
        pass

    # Build leaderboard by category
    categories: dict[str, list] = {}
    global_rank = 0
    for agent in agents.data:
        global_rank += 1
        cat = agent.get("category", "general") or "general"

        if cat not in categories:
            categories[cat] = []
        categories[cat].append(agent)

        # Update agent rank
        try:
            db.table("agents").update({"rank": global_rank}).eq(
                "agent_id", agent["agent_id"]
            ).execute()
        except Exception:
            pass

    # Insert leaderboard cache entries
    now = datetime.now(timezone.utc).isoformat()
    for category, category_agents in categories.items():
        for rank, agent in enumerate(category_agents, 1):
            try:
                db.table("leaderboard_cache").insert(
                    {
                        "category": category,
                        "agent_id": agent["agent_id"],
                        "rank": rank,
                        "composite_score": agent["composite_score"],
                        "trend": "stable",
                        "updated_at": now,
                    }
                ).execute()
            except Exception as e:
                logger.error(f"Error inserting leaderboard entry: {e}")


def _process_chunked(contract_name: str, processor, safe_block: int, start_block: int = DEFAULT_START_BLOCK):
    """Process events for a contract in MAX_BLOCK_RANGE chunks."""
    last_block = get_last_processed_block(contract_name, default_start=start_block)
    if last_block >= safe_block:
        return 0

    total_count = 0
    from_block = last_block + 1

    while from_block <= safe_block:
        to_block = min(from_block + MAX_BLOCK_RANGE - 1, safe_block)
        try:
            count = processor(from_block, to_block)
            total_count += count
        except Exception as e:
            logger.error(f"Error processing {contract_name} blocks {from_block}-{to_block}: {e}")
            break
        update_last_processed_block(contract_name, to_block)
        from_block = to_block + 1

    return total_count


def run_indexer_cycle():
    """Run one full indexer cycle: fetch events, update scores, update leaderboard."""
    blockchain = get_blockchain_service()

    if not blockchain.is_connected():
        logger.warning("Blockchain not connected, skipping indexer cycle")
        return

    try:
        current_block = blockchain.get_current_block()
    except Exception as e:
        logger.error(f"Error getting current block: {e}")
        return

    safe_block = current_block - CONFIRMATION_BLOCKS
    if safe_block < 0:
        return

    # Process official ERC-8004 Identity Registry events (deployed ~block 72M)
    count = _process_chunked("erc8004_identity", process_erc8004_identity_events, safe_block, start_block=ERC8004_IDENTITY_START_BLOCK)
    if count > 0:
        logger.info(f"Processed {count} ERC-8004 agent registration events")

    # Process custom identity events (chunked)
    count = _process_chunked("identity", process_agent_registered_events, safe_block)
    if count > 0:
        logger.info(f"Processed {count} custom agent registration events")

    # Process reputation events (chunked)
    count = _process_chunked("reputation", process_feedback_events, safe_block)
    if count > 0:
        logger.info(f"Processed {count} feedback events")

    # Process validation events (chunked)
    count = _process_chunked("validation", process_validation_events, safe_block)
    if count > 0:
        logger.info(f"Processed {count} validation events")

    # Recalculate scores and leaderboard
    recalculate_agent_scores()
    update_leaderboard()
