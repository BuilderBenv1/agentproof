"""
Sync agent data from AgentProof's Supabase into Agent402's Supabase.

Copies agents, reputation_events, score_history, validation_records,
uptime_daily_summary, and oracle_screenings.

Usage:
    python sync_from_agentproof.py

Env vars required:
    SOURCE_SUPABASE_URL    — AgentProof Supabase URL
    SOURCE_SUPABASE_KEY    — AgentProof service_role key
    SUPABASE_URL           — Agent402 Supabase URL
    SUPABASE_KEY           — Agent402 service_role key
"""

import os
import sys
import logging
from datetime import datetime, timezone

from supabase import create_client, Client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("sync")

# Batch size for reads and writes
PAGE = 1000
UPSERT_BATCH = 500


def get_source() -> Client:
    url = os.environ.get("SOURCE_SUPABASE_URL")
    key = os.environ.get("SOURCE_SUPABASE_KEY")
    if not url or not key:
        logger.error("SOURCE_SUPABASE_URL and SOURCE_SUPABASE_KEY required")
        sys.exit(1)
    return create_client(url, key)


def get_dest() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL and SUPABASE_KEY required")
        sys.exit(1)
    return create_client(url, key)


def fetch_all(client: Client, table: str, columns: str = "*", order_col: str = "id") -> list[dict]:
    """Fetch all rows from a table, paginated."""
    rows: list[dict] = []
    offset = 0
    while True:
        batch = (
            client.table(table)
            .select(columns)
            .order(order_col)
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        if not batch.data:
            break
        rows.extend(batch.data)
        if len(batch.data) < PAGE:
            break
        offset += PAGE
    return rows


def upsert_batch(client: Client, table: str, rows: list[dict], conflict_col: str) -> int:
    """Upsert rows in batches. Returns count inserted."""
    total = 0
    for i in range(0, len(rows), UPSERT_BATCH):
        batch = rows[i : i + UPSERT_BATCH]
        client.table(table).upsert(batch, on_conflict=conflict_col).execute()
        total += len(batch)
    return total


def sync_agents(src: Client, dst: Client) -> int:
    logger.info("Syncing agents...")
    columns = (
        "agent_id, owner_address, agent_uri, name, description, category, "
        "image_url, endpoints, registered_at, updated_at, total_feedback, "
        "average_rating, composite_score, validation_success_rate, rank, tier"
    )
    rows = fetch_all(src, "agents", columns, "agent_id")
    if not rows:
        logger.warning("No agents found in source")
        return 0

    # Strip any columns Agent402 doesn't have
    clean = []
    for r in rows:
        clean.append({
            "agent_id": r["agent_id"],
            "owner_address": r["owner_address"],
            "agent_uri": r.get("agent_uri", ""),
            "name": r.get("name"),
            "description": r.get("description"),
            "category": r.get("category", "general"),
            "image_url": r.get("image_url"),
            "endpoints": r.get("endpoints", []),
            "registered_at": r["registered_at"],
            "updated_at": r.get("updated_at", datetime.now(timezone.utc).isoformat()),
            "total_feedback": r.get("total_feedback", 0),
            "average_rating": float(r.get("average_rating") or 0),
            "composite_score": float(r.get("composite_score") or 0),
            "validation_success_rate": float(r.get("validation_success_rate") or 0),
            "rank": r.get("rank"),
            "tier": r.get("tier", "unranked"),
        })

    count = upsert_batch(dst, "agents", clean, "agent_id")
    logger.info(f"Synced {count} agents")
    return count


def sync_reputation_events(src: Client, dst: Client) -> int:
    logger.info("Syncing reputation_events...")
    columns = (
        "agent_id, reviewer_address, rating, feedback_uri, task_hash, "
        "tx_hash, block_number, created_at"
    )
    rows = fetch_all(src, "reputation_events", columns)
    if not rows:
        logger.warning("No reputation events found")
        return 0

    # Remove 'id' so Agent402 auto-generates, use tx_hash for dedup
    clean = []
    seen_tx = set()
    for r in rows:
        tx = r.get("tx_hash", "")
        if tx in seen_tx:
            continue
        seen_tx.add(tx)
        clean.append({
            "agent_id": r["agent_id"],
            "reviewer_address": r["reviewer_address"],
            "rating": r["rating"],
            "feedback_uri": r.get("feedback_uri"),
            "task_hash": r.get("task_hash"),
            "tx_hash": tx,
            "block_number": r.get("block_number", 0),
            "created_at": r["created_at"],
        })

    # Insert in batches (no upsert — no unique constraint on tx_hash in Agent402)
    total = 0
    for i in range(0, len(clean), UPSERT_BATCH):
        batch = clean[i : i + UPSERT_BATCH]
        try:
            dst.table("reputation_events").upsert(batch, on_conflict="id").execute()
            total += len(batch)
        except Exception as e:
            # Fall back to individual inserts on conflict
            for row in batch:
                try:
                    dst.table("reputation_events").insert(row).execute()
                    total += 1
                except Exception:
                    pass  # Skip duplicates
    logger.info(f"Synced {total} reputation events")
    return total


def sync_score_history(src: Client, dst: Client) -> int:
    logger.info("Syncing score_history...")
    columns = (
        "agent_id, composite_score, average_rating, total_feedback, "
        "validation_success_rate, snapshot_date"
    )
    rows = fetch_all(src, "score_history", columns)
    if not rows:
        logger.warning("No score history found")
        return 0

    count = upsert_batch(dst, "score_history", rows, "agent_id,snapshot_date")
    logger.info(f"Synced {count} score history rows")
    return count


def sync_validation_records(src: Client, dst: Client) -> int:
    logger.info("Syncing validation_records...")
    columns = (
        "validation_id, agent_id, task_hash, task_uri, requester_address, "
        "validator_address, is_valid, proof_uri, requested_at, validated_at, "
        "tx_hash, block_number"
    )
    rows = fetch_all(src, "validation_records", columns)
    if not rows:
        logger.warning("No validation records found")
        return 0

    count = upsert_batch(dst, "validation_records", rows, "validation_id")
    logger.info(f"Synced {count} validation records")
    return count


def sync_uptime(src: Client, dst: Client) -> int:
    logger.info("Syncing uptime_daily_summary...")
    columns = (
        "agent_id, summary_date, total_checks, successful_checks, "
        "uptime_pct, avg_latency_ms"
    )
    rows = fetch_all(src, "uptime_daily_summary", columns)
    if not rows:
        logger.warning("No uptime data found")
        return 0

    count = upsert_batch(dst, "uptime_daily_summary", rows, "agent_id,summary_date")
    logger.info(f"Synced {count} uptime rows")
    return count


def sync_screenings(src: Client, dst: Client) -> int:
    logger.info("Syncing oracle_screenings...")
    columns = "agent_id, risk_level, flags, screened_at"
    rows = fetch_all(src, "oracle_screenings", columns)
    if not rows:
        logger.warning("No screenings found")
        return 0

    # Insert without id (UUID auto-generated)
    total = 0
    for i in range(0, len(rows), UPSERT_BATCH):
        batch = rows[i : i + UPSERT_BATCH]
        try:
            dst.table("oracle_screenings").insert(batch).execute()
            total += len(batch)
        except Exception as e:
            logger.error(f"Screening insert batch failed: {e}")
    logger.info(f"Synced {total} screenings")
    return total


def main():
    logger.info("=" * 60)
    logger.info("Agent402 Data Sync — AgentProof → Agent402")
    logger.info("=" * 60)

    src = get_source()
    dst = get_dest()

    # Verify connections
    try:
        src_count = src.table("agents").select("agent_id", count="exact").limit(0).execute()
        logger.info(f"Source (AgentProof): {src_count.count or 0} agents")
    except Exception as e:
        logger.error(f"Cannot connect to source: {e}")
        sys.exit(1)

    try:
        dst_count = dst.table("agents").select("agent_id", count="exact").limit(0).execute()
        logger.info(f"Destination (Agent402): {dst_count.count or 0} agents")
    except Exception as e:
        logger.error(f"Cannot connect to destination: {e}")
        sys.exit(1)

    # Sync tables in order
    totals = {}
    totals["agents"] = sync_agents(src, dst)
    totals["reputation_events"] = sync_reputation_events(src, dst)
    totals["score_history"] = sync_score_history(src, dst)
    totals["validation_records"] = sync_validation_records(src, dst)
    totals["uptime"] = sync_uptime(src, dst)
    totals["screenings"] = sync_screenings(src, dst)

    # Summary
    logger.info("=" * 60)
    logger.info("Sync complete:")
    for table, count in totals.items():
        logger.info(f"  {table}: {count}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
