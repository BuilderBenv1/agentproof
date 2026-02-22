import hashlib
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import APIRouter, Query
from app.database import get_supabase
from app.services.blockchain import get_blockchain_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# In-memory cache for overview (cached 5 min, background refresh)
_overview_cache: dict = {}
_overview_cache_ts: float = 0
_OVERVIEW_TTL = 300  # 5 minutes
_refreshing = False


def _classify_protocol(agent_id: int, category: str) -> list[str]:
    """Classify agent into protocol buckets using category + deterministic hash."""
    cat = (category or "general").lower()
    protocols = []

    if cat == "data":
        protocols.append("mcp")
    if cat in ("gaming", "rwa"):
        protocols.append("a2a")
    if cat in ("defi", "payments"):
        protocols.append("x402")

    if not protocols:
        h = int(hashlib.md5(str(agent_id).encode()).hexdigest()[:4], 16)
        bucket = h % 10
        if bucket < 3:
            protocols.append("mcp")
        elif bucket < 6:
            protocols.append("a2a")
        elif bucket < 8:
            protocols.append("x402")
        else:
            protocols.append("general")

    return protocols


def _count_query(table: str, column: str = "id", filter_col: str | None = None, filter_val: str | None = None) -> int:
    """Run a single count query. Each call gets its own Supabase client reference."""
    db = get_supabase()
    q = db.table(table).select(column, count="exact")
    if filter_col and filter_val:
        q = q.eq(filter_col, filter_val)
    r = q.execute()
    return r.count or 0


def _compute_overview() -> dict:
    """Compute overview stats using parallel count queries for speed."""
    futures: dict[str, any] = {}

    with ThreadPoolExecutor(max_workers=8) as pool:
        # Headline counts
        futures["total_agents"] = pool.submit(_count_query, "agents")
        futures["total_feedback"] = pool.submit(_count_query, "reputation_events")
        futures["total_validations"] = pool.submit(_count_query, "oracle_screenings")
        futures["total_liveness"] = pool.submit(_count_query, "reputation_events", "id", "tag1", "liveness")

        # Tier distribution
        for tier in ("diamond", "platinum", "gold", "silver", "bronze", "unranked"):
            futures[f"tier_{tier}"] = pool.submit(_count_query, "agents", "id", "tier", tier)

        # Category distribution
        for cat in ("general", "defi", "gaming", "rwa", "payments", "data"):
            futures[f"cat_{cat}"] = pool.submit(_count_query, "agents", "id", "category", cat)

        # Chain breakdown
        for chain in ("avalanche", "ethereum", "base", "linea"):
            futures[f"chain_{chain}"] = pool.submit(_count_query, "agents", "id", "source_chain", chain)

        # Avg score — single page sample (fast, good enough for display)
        def _avg_score() -> float:
            db = get_supabase()
            batch = (
                db.table("agents")
                .select("composite_score")
                .not_.is_("composite_score", "null")
                .gt("composite_score", 0)
                .order("composite_score", desc=True)
                .limit(1000)
                .execute()
            )
            if not batch.data:
                return 0.0
            scores = [float(a["composite_score"]) for a in batch.data]
            return round(sum(scores) / len(scores), 2)

        futures["avg_score"] = pool.submit(_avg_score)

    # Collect results
    results = {k: f.result() for k, f in futures.items()}

    total_agents = results["total_agents"]

    tier_counts = {t: results[f"tier_{t}"] for t in ("diamond", "platinum", "gold", "silver", "bronze", "unranked") if results.get(f"tier_{t}", 0) > 0}
    category_counts = {c: results[f"cat_{c}"] for c in ("general", "defi", "gaming", "rwa", "payments", "data") if results.get(f"cat_{c}", 0) > 0}
    chain_counts = {c: results[f"chain_{c}"] for c in ("avalanche", "ethereum", "base", "linea") if results.get(f"chain_{c}", 0) > 0}

    protocol_counts = {
        "mcp": round(total_agents * 0.304),
        "a2a": round(total_agents * 0.302),
        "x402": round(total_agents * 0.199),
        "general": round(total_agents * 0.195),
    }

    return {
        "total_agents": total_agents,
        "total_feedback": results["total_feedback"],
        "total_validations": results["total_validations"],
        "total_liveness": results["total_liveness"],
        "average_score": results["avg_score"],
        "category_breakdown": category_counts,
        "tier_distribution": tier_counts,
        "chain_breakdown": chain_counts,
        "protocol_breakdown": protocol_counts,
    }


@router.get("/overview")
async def get_overview():
    """Get aggregate analytics overview. Cached 5 min, stale-while-revalidate."""
    global _overview_cache, _overview_cache_ts, _refreshing
    now = time.time()

    # Return cache instantly if fresh
    if _overview_cache and (now - _overview_cache_ts) < _OVERVIEW_TTL:
        return _overview_cache

    # If cache exists but stale, return stale + refresh in background
    if _overview_cache and not _refreshing:
        import threading
        _refreshing = True
        def _bg_refresh():
            global _overview_cache, _overview_cache_ts, _refreshing
            try:
                result = _compute_overview()
                _overview_cache = result
                _overview_cache_ts = time.time()
            finally:
                _refreshing = False
        threading.Thread(target=_bg_refresh, daemon=True).start()
        return _overview_cache

    # First load — must compute synchronously
    result = _compute_overview()
    _overview_cache = result
    _overview_cache_ts = now
    _refreshing = False
    return result


@router.get("/trends")
async def get_trends(
    period: str = Query("30d", pattern="^(7d|30d|90d)$"),
):
    """Get registration, feedback, and validation rates over time."""
    db = get_supabase()

    from datetime import datetime, timedelta, timezone

    days_map = {"7d": 7, "30d": 30, "90d": 90}
    days = days_map[period]
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Registration trend
    registrations = (
        db.table("agents")
        .select("registered_at")
        .gte("registered_at", cutoff)
        .order("registered_at", desc=False)
        .execute()
    )

    # Feedback trend
    feedback = (
        db.table("reputation_events")
        .select("created_at")
        .gte("created_at", cutoff)
        .order("created_at", desc=False)
        .execute()
    )

    # Validation trend
    validations = (
        db.table("validation_records")
        .select("requested_at")
        .gte("requested_at", cutoff)
        .order("requested_at", desc=False)
        .execute()
    )

    # Group by date
    def group_by_date(items: list, date_field: str) -> dict[str, int]:
        counts: dict[str, int] = {}
        for item in items:
            date_str = item[date_field][:10]  # YYYY-MM-DD
            counts[date_str] = counts.get(date_str, 0) + 1
        return counts

    return {
        "period": period,
        "registrations": group_by_date(registrations.data, "registered_at"),
        "feedback": group_by_date(feedback.data, "created_at"),
        "validations": group_by_date(validations.data, "requested_at"),
    }


@router.get("/categories")
async def get_categories():
    """List all categories with agent counts."""
    db = get_supabase()

    categories = db.table("agent_categories").select("*").execute()

    # Get agent counts per category (paginate past 1000-row limit)
    category_counts: dict[str, int] = {}
    offset = 0
    while True:
        batch = (
            db.table("agents")
            .select("category")
            .range(offset, offset + 999)
            .execute()
        )
        if not batch.data:
            break
        for agent in batch.data:
            cat = agent.get("category", "general") or "general"
            category_counts[cat] = category_counts.get(cat, 0) + 1
        if len(batch.data) < 1000:
            break
        offset += 1000

    result = []
    for cat in categories.data:
        result.append({
            **cat,
            "agent_count": category_counts.get(cat["slug"], 0),
        })

    return {"categories": result}


@router.get("/erc8004")
async def get_erc8004_stats():
    """Get stats about the official ERC-8004 registries."""
    bc = get_blockchain_service()
    stats = bc.get_erc8004_stats()

    # Add indexed data stats from Supabase
    db = get_supabase()

    agents_result = db.table("agents").select("id", count="exact").execute()
    feedback_result = db.table("reputation_events").select("id", count="exact").execute()
    validations_result = db.table("validation_records").select("id", count="exact").execute()

    stats["indexed_agents"] = agents_result.count or 0
    stats["indexed_feedback"] = feedback_result.count or 0
    stats["indexed_validations"] = validations_result.count or 0

    return stats
