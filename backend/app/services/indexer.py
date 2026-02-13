"""
Indexer service that runs as part of the backend process.
Periodically polls for new blockchain events and syncs them to Supabase.
"""

import logging
import time
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
ERC8004_IDENTITY_START_BLOCK = 77_389_000  # Avalanche contract deployed at this block
ERC8004_ETH_IDENTITY_START_BLOCK = 24_339_900  # First Registered event at block 24,339,925
MAX_BLOCK_RANGE = 2000       # Avalanche RPCs support 2048
ETH_MAX_BLOCK_RANGE = 800    # Safe for all ETH RPCs (Alchemy PAYG=2000, publicnode=1000)


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
    if not events:
        return 0

    db = get_supabase()
    block_ts_cache: dict[int, datetime] = {}
    now = datetime.now(timezone.utc).isoformat()
    rows = []

    for event in events:
        block = event.blockNumber
        if block not in block_ts_cache:
            block_data = blockchain.w3.eth.get_block(block)
            block_ts_cache[block] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

        rows.append({
            "agent_id": event.args.agentId,
            "owner_address": event.args.owner,
            "agent_uri": event.args.agentURI,
            "source_chain": "avalanche",
            "registered_at": block_ts_cache[block].isoformat(),
            "updated_at": now,
        })

    # Batch upsert
    try:
        db.table("agents").upsert(rows, on_conflict="agent_id").execute()
        logger.info(f"Batch upserted {len(rows)} custom agents (avalanche)")
    except Exception as e:
        logger.error(f"Batch upsert failed ({len(rows)} custom agents): {e}")
        for i in range(0, len(rows), 50):
            batch = rows[i:i + 50]
            try:
                db.table("agents").upsert(batch, on_conflict="agent_id").execute()
            except Exception as e2:
                logger.error(f"Sub-batch upsert failed: {e2}")

    return len(events)


def process_erc8004_identity_events(from_block: int, to_block: int):
    """Process Registered events from the official ERC-8004 Identity Registry on Avalanche."""
    blockchain = get_blockchain_service()
    logger.info(f"[ERC-8004-AVAX] Scanning blocks {from_block}-{to_block} (range={to_block - from_block + 1})")
    events = blockchain.get_erc8004_registered_events(from_block, to_block)
    if not events:
        return 0
    logger.info(f"[ERC-8004-AVAX] Found {len(events)} Registered events in {from_block}-{to_block}")

    db = get_supabase()
    block_ts_cache: dict[int, datetime] = {}
    now = datetime.now(timezone.utc).isoformat()
    rows = []

    for event in events:
        block = event.blockNumber
        if block not in block_ts_cache:
            block_data = blockchain.w3.eth.get_block(block)
            block_ts_cache[block] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

        rows.append({
            "agent_id": event.args.agentId,
            "owner_address": event.args.owner,
            "agent_uri": event.args.agentURI,
            "source_chain": "avalanche",
            "registered_at": block_ts_cache[block].isoformat(),
            "updated_at": now,
        })

    # Batch upsert
    try:
        db.table("agents").upsert(rows, on_conflict="agent_id").execute()
        logger.info(f"[ERC-8004-AVAX] Batch upserted {len(rows)} agents")
    except Exception as e:
        logger.error(f"[ERC-8004-AVAX] Batch upsert failed ({len(rows)} rows): {e}")
        for i in range(0, len(rows), 50):
            batch = rows[i:i + 50]
            try:
                db.table("agents").upsert(batch, on_conflict="agent_id").execute()
            except Exception as e2:
                logger.error(f"[ERC-8004-AVAX] Sub-batch upsert failed: {e2}")

    return len(events)


def process_erc8004_eth_identity_events(from_block: int, to_block: int):
    """Process Registered events from the ERC-8004 Identity Registry on Ethereum."""
    blockchain = get_blockchain_service()
    logger.info(f"[ERC-8004-ETH] Scanning blocks {from_block}-{to_block} (range={to_block - from_block + 1})")
    events = blockchain.get_erc8004_eth_registered_events(from_block, to_block)
    if not events:
        return 0
    logger.info(f"[ERC-8004-ETH] Found {len(events)} Registered events in {from_block}-{to_block}")

    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Collect unique block numbers and fetch timestamps in one pass
    unique_blocks = set(e.blockNumber for e in events)
    block_ts_cache: dict[int, datetime] = {}
    for blk in sorted(unique_blocks):
        try:
            block_data = blockchain.w3_eth.eth.get_block(blk)
            block_ts_cache[blk] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)
        except Exception as e:
            logger.warning(f"[ERC-8004-ETH] Failed to get block {blk} timestamp: {e}")
            block_ts_cache[blk] = datetime.now(timezone.utc)
    logger.info(f"[ERC-8004-ETH] Fetched timestamps for {len(unique_blocks)} unique blocks")

    rows = []
    for event in events:
        rows.append({
            "agent_id": event.args.agentId,
            "owner_address": event.args.owner,
            "agent_uri": event.args.agentURI,
            "source_chain": "ethereum",
            "registered_at": block_ts_cache[event.blockNumber].isoformat(),
            "updated_at": now,
        })

    # Batch upsert in chunks of 500 (Supabase has payload size limits)
    saved = 0
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        try:
            db.table("agents").upsert(batch, on_conflict="agent_id").execute()
            saved += len(batch)
        except Exception as e:
            logger.error(f"[ERC-8004-ETH] Batch upsert failed ({len(batch)} rows at offset {i}): {e}")
            # Fallback: try smaller sub-batches of 50
            for j in range(0, len(batch), 50):
                sub = batch[j:j + 50]
                try:
                    db.table("agents").upsert(sub, on_conflict="agent_id").execute()
                    saved += len(sub)
                except Exception as e2:
                    logger.error(f"[ERC-8004-ETH] Sub-batch upsert also failed: {e2}")

    logger.info(f"[ERC-8004-ETH] Saved {saved}/{len(rows)} agents")
    if saved == 0 and len(rows) > 0:
        raise Exception(f"All upserts failed for {len(rows)} agents — not advancing block pointer")
    return len(events)


def process_feedback_events(from_block: int, to_block: int):
    """Process NewFeedback (ERC-8004) or FeedbackSubmitted (legacy) events."""
    blockchain = get_blockchain_service()
    events = blockchain.get_feedback_events(from_block, to_block)
    if not events:
        return 0

    db = get_supabase()
    block_ts_cache: dict[int, datetime] = {}
    rows = []

    for event in events:
        block = event.blockNumber
        if block not in block_ts_cache:
            block_data = blockchain.w3.eth.get_block(block)
            block_ts_cache[block] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

        if blockchain.use_official:
            # ERC-8004 NewFeedback (verified from on-chain implementation):
            # (uint256 indexed agentId, address indexed clientAddress,
            #  uint64 feedbackIndex, int128 value, uint8 valueDecimals,
            #  string indexed indexedTag1, string tag1, string tag2,
            #  string endpoint, string feedbackURI, bytes32 feedbackHash)
            raw_value = int(event.args.value)
            rating = max(1, min(100, raw_value))
            task_hash = event.args.feedbackHash.hex() if hasattr(event.args, 'feedbackHash') else ""
            reviewer = event.args.clientAddress
            tag1 = event.args.tag1 if hasattr(event.args, 'tag1') else ""
            tag2 = event.args.tag2 if hasattr(event.args, 'tag2') else ""
        else:
            # Legacy FeedbackSubmitted: agentId, reviewer, rating, taskHash
            rating = event.args.rating
            task_hash = event.args.taskHash.hex()
            reviewer = event.args.reviewer
            tag1 = ""
            tag2 = ""

        rows.append({
            "agent_id": event.args.agentId,
            "reviewer_address": reviewer,
            "rating": rating,
            "task_hash": task_hash,
            "tag1": tag1,
            "tag2": tag2,
            "tx_hash": event.transactionHash.hex(),
            "block_number": block,
            "created_at": block_ts_cache[block].isoformat(),
        })

    try:
        db.table("reputation_events").upsert(rows, on_conflict="tx_hash").execute()
        logger.info(f"Batch upserted {len(rows)} feedback events")
    except Exception as e:
        err_str = str(e)
        # If tag1/tag2 columns don't exist yet, retry without them
        if "tag1" in err_str or "tag2" in err_str or "column" in err_str.lower():
            logger.warning("tag1/tag2 columns may not exist — retrying without tags")
            for row in rows:
                row.pop("tag1", None)
                row.pop("tag2", None)
            try:
                db.table("reputation_events").upsert(rows, on_conflict="tx_hash").execute()
                logger.info(f"Batch upserted {len(rows)} feedback events (without tags)")
            except Exception as e2:
                logger.error(f"Batch upsert without tags also failed: {e2}")
        else:
            logger.error(f"Batch upsert failed ({len(rows)} feedback events): {e}")
            for i in range(0, len(rows), 50):
                batch = rows[i:i + 50]
                try:
                    db.table("reputation_events").upsert(batch, on_conflict="tx_hash").execute()
                except Exception as e2:
                    logger.error(f"Sub-batch upsert failed: {e2}")

    return len(events)


def process_validation_events(from_block: int, to_block: int):
    """Process ValidationRequested and ValidationSubmitted events."""
    blockchain = get_blockchain_service()
    db = get_supabase()
    block_ts_cache: dict[int, datetime] = {}

    # Process requests (batch)
    req_events = blockchain.get_validation_requested_events(from_block, to_block)
    if req_events:
        rows = []
        for event in req_events:
            block = event.blockNumber
            if block not in block_ts_cache:
                block_data = blockchain.w3.eth.get_block(block)
                block_ts_cache[block] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

            rows.append({
                "validation_id": event.args.validationId,
                "agent_id": event.args.agentId,
                "task_hash": event.args.taskHash.hex(),
                "requester_address": "",
                "requested_at": block_ts_cache[block].isoformat(),
                "tx_hash": event.transactionHash.hex(),
                "block_number": block,
            })

        try:
            db.table("validation_records").upsert(rows, on_conflict="validation_id").execute()
            logger.info(f"Batch upserted {len(rows)} validation requests")
        except Exception as e:
            logger.error(f"Batch upsert failed ({len(rows)} validation requests): {e}")

    # Process responses (individual — these are updates to existing rows by validation_id)
    sub_events = blockchain.get_validation_submitted_events(from_block, to_block)
    for event in sub_events:
        block = event.blockNumber
        if block not in block_ts_cache:
            block_data = blockchain.w3.eth.get_block(block)
            block_ts_cache[block] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

        try:
            db.table("validation_records").update(
                {
                    "validator_address": event.args.validator,
                    "is_valid": event.args.isValid,
                    "validated_at": block_ts_cache[block].isoformat(),
                }
            ).eq("validation_id", event.args.validationId).execute()
        except Exception as e:
            logger.error(f"Error indexing validation response #{event.args.validationId}: {e}")

    return len(req_events) + len(sub_events)


def recalculate_agent_scores():
    """Recalculate composite scores and tiers for all agents (batched)."""
    db = get_supabase()

    try:
        # Paginate to avoid Supabase default 1000-row limit
        all_agent_data: list[dict] = []
        offset = 0
        while True:
            batch = (
                db.table("agents")
                .select("agent_id, registered_at, owner_address, agent_uri")
                .range(offset, offset + 999)
                .execute()
            )
            if not batch.data:
                break
            all_agent_data.extend(batch.data)
            if len(batch.data) < 1000:
                break
            offset += 1000
    except Exception as e:
        logger.error(f"Error fetching agents for scoring: {e}")
        return

    if not all_agent_data:
        logger.info("No agents found for scoring")
        return

    logger.info(f"Scoring {len(all_agent_data)} agents")
    agent_ids = [a["agent_id"] for a in all_agent_data]

    # Bulk-fetch all ratings in one query (Supabase returns up to 1000 by default)
    all_ratings: dict[int, list[int]] = {}
    try:
        # Fetch in pages of 1000 to handle large datasets
        offset = 0
        page_size = 1000
        while True:
            result = (
                db.table("reputation_events")
                .select("agent_id, rating")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            for r in result.data:
                aid = r["agent_id"]
                if aid not in all_ratings:
                    all_ratings[aid] = []
                all_ratings[aid].append(r["rating"])
            if len(result.data) < page_size:
                break
            offset += page_size
    except Exception as e:
        logger.error(f"Error bulk-fetching ratings: {e}")

    total_ratings = sum(len(v) for v in all_ratings.values())
    agents_with_feedback = len(all_ratings)
    logger.info(f"Fetched {total_ratings} ratings across {agents_with_feedback} agents")

    # Bulk-fetch all completed validations
    all_validations: dict[int, dict] = {}  # agent_id -> {completed, successful}
    try:
        offset = 0
        while True:
            result = (
                db.table("validation_records")
                .select("agent_id, is_valid")
                .not_.is_("is_valid", "null")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            for v in result.data:
                aid = v["agent_id"]
                if aid not in all_validations:
                    all_validations[aid] = {"completed": 0, "successful": 0}
                all_validations[aid]["completed"] += 1
                if v["is_valid"]:
                    all_validations[aid]["successful"] += 1
            if len(result.data) < page_size:
                break
            offset += page_size
    except Exception as e:
        logger.error(f"Error bulk-fetching validations: {e}")

    # Calculate scores for all agents
    now = datetime.now(timezone.utc).isoformat()
    update_rows = []
    for agent in all_agent_data:
        agent_id = agent["agent_id"]
        ratings = all_ratings.get(agent_id, [])
        feedback_count = len(ratings)
        avg_rating = sum(ratings) / len(ratings) if ratings else 0
        std_dev = calculate_std_dev(ratings)

        val_data = all_validations.get(agent_id, {"completed": 0, "successful": 0})
        success_rate = (
            (val_data["successful"] / val_data["completed"] * 100)
            if val_data["completed"] > 0 else 0
        )

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

        update_rows.append({
            "agent_id": agent_id,
            "owner_address": agent.get("owner_address", ""),
            "agent_uri": agent.get("agent_uri", ""),
            "registered_at": agent["registered_at"],
            "total_feedback": feedback_count,
            "average_rating": round(avg_rating, 2),
            "composite_score": composite,
            "validation_success_rate": round(success_rate, 2),
            "tier": tier,
            "updated_at": now,
        })

    # Batch upsert scores (chunks of 500 to stay within Supabase payload limits)
    batch_size = 500
    for i in range(0, len(update_rows), batch_size):
        batch = update_rows[i:i + batch_size]
        try:
            db.table("agents").upsert(batch, on_conflict="agent_id").execute()
        except Exception as e:
            logger.error(f"Error batch-updating scores (batch {i // batch_size}): {e}")

    logger.info(f"Scored {len(update_rows)} agents")


def update_leaderboard():
    """Update the leaderboard_cache table with current rankings (batched)."""
    db = get_supabase()

    try:
        # Paginate to avoid Supabase default 1000-row limit
        all_agents: list[dict] = []
        offset = 0
        while True:
            batch = (
                db.table("agents")
                .select("agent_id, category, composite_score, owner_address, agent_uri, registered_at")
                .order("composite_score", desc=True)
                .range(offset, offset + 999)
                .execute()
            )
            if not batch.data:
                break
            all_agents.extend(batch.data)
            if len(batch.data) < 1000:
                break
            offset += 1000
    except Exception as e:
        logger.error(f"Error fetching agents for leaderboard: {e}")
        return

    # Clear existing cache
    try:
        db.table("leaderboard_cache").delete().neq("id", 0).execute()
    except Exception:
        pass

    # Build ranks and leaderboard rows
    categories: dict[str, list] = {}
    rank_updates = []
    global_rank = 0
    for agent in all_agents:
        global_rank += 1
        cat = agent.get("category", "general") or "general"
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(agent)
        rank_updates.append({
            "agent_id": agent["agent_id"],
            "owner_address": agent.get("owner_address", ""),
            "agent_uri": agent.get("agent_uri", ""),
            "registered_at": agent["registered_at"],
            "rank": global_rank,
        })

    # Batch update ranks (upsert with agent_id conflict)
    batch_size = 500
    for i in range(0, len(rank_updates), batch_size):
        batch = rank_updates[i:i + batch_size]
        try:
            db.table("agents").upsert(batch, on_conflict="agent_id").execute()
        except Exception as e:
            logger.error(f"Error batch-updating ranks: {e}")

    # Batch insert leaderboard cache
    now = datetime.now(timezone.utc).isoformat()
    cache_rows = []
    for category, category_agents in categories.items():
        for rank, agent in enumerate(category_agents, 1):
            cache_rows.append({
                "category": category,
                "agent_id": agent["agent_id"],
                "rank": rank,
                "composite_score": agent["composite_score"],
                "trend": "stable",
                "updated_at": now,
            })

    for i in range(0, len(cache_rows), batch_size):
        batch = cache_rows[i:i + batch_size]
        try:
            db.table("leaderboard_cache").insert(batch).execute()
        except Exception as e:
            logger.error(f"Error batch-inserting leaderboard cache: {e}")

    logger.info(f"Updated leaderboard: {len(rank_updates)} agents ranked, {len(cache_rows)} cache entries")


def _process_chunked(
    contract_name: str,
    processor,
    safe_block: int,
    start_block: int = DEFAULT_START_BLOCK,
    chunk_size: int = MAX_BLOCK_RANGE,
):
    """Process events for a contract in chunk_size chunks with retry on failure."""
    last_block = get_last_processed_block(contract_name, default_start=start_block)
    if last_block >= safe_block:
        return 0

    total_count = 0
    from_block = last_block + 1
    retries = 0
    max_retries = 3

    while from_block <= safe_block:
        to_block = min(from_block + chunk_size - 1, safe_block)
        try:
            count = processor(from_block, to_block)
            total_count += count
            retries = 0  # Reset on success
        except Exception as e:
            retries += 1
            logger.error(
                f"Error processing {contract_name} blocks {from_block}-{to_block} "
                f"(attempt {retries}/{max_retries}): {e}"
            )
            if retries >= max_retries:
                logger.error(f"Max retries reached for {contract_name}, stopping at block {from_block}")
                break
            # Backoff before retry
            time.sleep(2 ** retries)
            continue  # Retry same chunk, don't advance
        update_last_processed_block(contract_name, to_block)
        from_block = to_block + 1

    return total_count


def _eth_blocks_behind() -> int:
    """Return how many ETH blocks the indexer is behind, or 0 if caught up."""
    try:
        blockchain = get_blockchain_service()
        if not blockchain.w3_eth:
            return 0
        eth_current = blockchain.get_eth_current_block()
        last = get_last_processed_block(
            "erc8004_eth_identity",
            default_start=ERC8004_ETH_IDENTITY_START_BLOCK,
        )
        return max(0, eth_current - last)
    except Exception:
        return 0


def run_indexer_cycle():
    """Run one indexer cycle: scan blocks and index events. No scoring."""
    blockchain = get_blockchain_service()

    if not blockchain.is_connected():
        logger.warning("Blockchain not connected, skipping indexer cycle")
        return

    # --- Ethereum first (highest priority during catchup) ---
    if blockchain.w3_eth:
        try:
            eth_current = blockchain.get_eth_current_block()
            eth_safe = eth_current - CONFIRMATION_BLOCKS
            if eth_safe > 0:
                count = _process_chunked(
                    "erc8004_eth_identity",
                    process_erc8004_eth_identity_events,
                    eth_safe,
                    start_block=ERC8004_ETH_IDENTITY_START_BLOCK,
                    chunk_size=ETH_MAX_BLOCK_RANGE,
                )
                if count > 0:
                    logger.info(f"Processed {count} ERC-8004 Ethereum agent registration events")
        except Exception as e:
            logger.error(f"Error processing Ethereum ERC-8004 events: {e}")

    # --- Avalanche ---
    try:
        current_block = blockchain.get_current_block()
    except Exception as e:
        logger.error(f"Error getting current block: {e}")
        return

    safe_block = current_block - CONFIRMATION_BLOCKS
    if safe_block < 0:
        return

    # Process official ERC-8004 Identity Registry events on Avalanche
    count = _process_chunked("erc8004_identity", process_erc8004_identity_events, safe_block, start_block=ERC8004_IDENTITY_START_BLOCK)
    if count > 0:
        logger.info(f"Processed {count} ERC-8004 Avalanche agent registration events")

    # Process custom identity events (chunked)
    count = _process_chunked("identity", process_agent_registered_events, safe_block)
    if count > 0:
        logger.info(f"Processed {count} custom agent registration events")

    # Self-healing: if reputation_events is empty but the checkpoint has
    # already advanced, reset it so we rescan from the contract deployment
    # block.  This covers the case where the old buggy field-mapping code
    # silently advanced the checkpoint without writing any rows.
    try:
        rep_check = get_last_processed_block("reputation")
        if rep_check > ERC8004_IDENTITY_START_BLOCK:
            rep_count = (
                get_supabase().table("reputation_events")
                .select("id", count="exact")
                .execute()
            )
            if rep_count.count == 0:
                reset_to = ERC8004_IDENTITY_START_BLOCK
                logger.warning(
                    f"reputation_events is empty but checkpoint is at {rep_check} — "
                    f"resetting reputation checkpoint to {reset_to} to rescan"
                )
                update_last_processed_block("reputation", reset_to)
    except Exception as e:
        logger.error(f"Error in reputation checkpoint self-heal check: {e}")

    # Process reputation events (chunked)
    rep_checkpoint = get_last_processed_block("reputation")
    rep_behind = safe_block - rep_checkpoint
    if rep_behind > 10000:
        logger.info(f"Reputation indexer is {rep_behind} blocks behind (checkpoint={rep_checkpoint}, head={safe_block})")
    count = _process_chunked("reputation", process_feedback_events, safe_block)
    if count > 0:
        logger.info(f"Processed {count} feedback events")

    # Process validation events (chunked)
    count = _process_chunked("validation", process_validation_events, safe_block)
    if count > 0:
        logger.info(f"Processed {count} validation events")


def run_scoring_cycle():
    """Recalculate scores and leaderboard. Runs on a separate, slower schedule."""
    behind = _eth_blocks_behind()
    if behind > 5000:
        logger.info(
            f"Note: ETH indexer is {behind} blocks behind (identity only, "
            "does not affect reputation scoring)"
        )
    logger.info("Starting scoring cycle")
    try:
        recalculate_agent_scores()
        update_leaderboard()
        logger.info("Scoring cycle complete")
    except Exception as e:
        logger.error(f"Scoring cycle failed: {e}", exc_info=True)
