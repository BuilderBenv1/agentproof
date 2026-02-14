import time
from fastapi import APIRouter, Query
from app.database import get_supabase

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])

# In-memory cache for leaderboard (avoids hammering Supabase on every page load)
_cache: dict[str, dict] = {}
_CACHE_TTL = 60  # seconds


def _cache_key(category, chain, tier, time_range, page, page_size):
    return f"{category}:{chain}:{tier}:{time_range}:{page}:{page_size}"


@router.get("")
async def get_leaderboard(
    category: str | None = None,
    chain: str | None = None,
    tier: str | None = None,
    time_range: str = Query("all", pattern="^(all|30d|7d)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """Get the global leaderboard, filterable by category, chain, tier, and time range."""
    # Check cache first
    key = _cache_key(category, chain, tier, time_range, page, page_size)
    cached = _cache.get(key)
    if cached and time.time() - cached["ts"] < _CACHE_TTL:
        return cached["data"]

    db = get_supabase()

    # Use rank column (pre-computed by scoring cycle) for ordering — faster than
    # sorting by composite_score on every request across 25K+ rows.
    # Fall back to composite_score if rank is null (shouldn't happen after first cycle).
    query = db.table("agents").select(
        "agent_id, name, category, composite_score, average_rating, total_feedback, "
        "validation_success_rate, tier, rank, image_url, registered_at, source_chain",
        count="planned",
    )

    if category:
        query = query.eq("category", category)

    if chain:
        query = query.eq("source_chain", chain)

    if tier:
        query = query.eq("tier", tier)

    # For time range, filter by registration date (agents registered within range)
    if time_range == "7d":
        from datetime import datetime, timedelta, timezone
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query = query.gte("registered_at", cutoff)
    elif time_range == "30d":
        from datetime import datetime, timedelta, timezone
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        query = query.gte("registered_at", cutoff)

    query = query.order("composite_score", desc=True)

    offset = (page - 1) * page_size
    result = query.range(offset, offset + page_size - 1).execute()

    # Add rank to results
    entries = []
    for idx, agent in enumerate(result.data, start=offset + 1):
        entries.append({**agent, "leaderboard_rank": agent.get("rank") or idx})

    response = {
        "entries": entries,
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }

    # Cache the response
    _cache[key] = {"data": response, "ts": time.time()}

    # Evict stale cache entries (keep cache from growing unbounded)
    if len(_cache) > 200:
        cutoff_ts = time.time() - _CACHE_TTL * 2
        stale = [k for k, v in _cache.items() if v["ts"] < cutoff_ts]
        for k in stale:
            del _cache[k]

    return response


@router.get("/movers")
async def get_movers(
    period: str = Query("7d", pattern="^(7d|30d)$"),
    limit: int = Query(10, ge=1, le=50),
):
    """Get agents with the biggest score changes (movers and shakers)."""
    # Check cache
    key = f"movers:{period}:{limit}"
    cached = _cache.get(key)
    if cached and time.time() - cached["ts"] < _CACHE_TTL * 5:
        return cached["data"]

    db = get_supabase()

    from datetime import datetime, timedelta, timezone

    days = 7 if period == "7d" else 30
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")

    # Only fetch agents that have score history (avoids loading 25K agents with no change)
    historical = (
        db.table("score_history")
        .select("agent_id, composite_score, snapshot_date")
        .gte("snapshot_date", cutoff_date)
        .order("snapshot_date", desc=False)
        .execute()
    )

    if not historical.data:
        return {"period": period, "risers": [], "fallers": []}

    # Build earliest score per agent in the period
    earliest_scores: dict[int, float] = {}
    for entry in historical.data:
        aid = entry["agent_id"]
        if aid not in earliest_scores:
            earliest_scores[aid] = float(entry["composite_score"])

    # Only fetch current scores for agents that have history
    agent_ids = list(earliest_scores.keys())
    if not agent_ids:
        return {"period": period, "risers": [], "fallers": []}

    # Fetch in batches of 100 (Supabase IN filter limit)
    current_agents = []
    for i in range(0, len(agent_ids), 100):
        batch_ids = agent_ids[i:i + 100]
        batch = (
            db.table("agents")
            .select("agent_id, name, composite_score, category, tier")
            .in_("agent_id", batch_ids)
            .execute()
        )
        current_agents.extend(batch.data)

    # Calculate changes
    movers = []
    for agent in current_agents:
        aid = agent["agent_id"]
        current_score = float(agent["composite_score"])
        old_score = earliest_scores.get(aid, current_score)
        change = current_score - old_score

        if abs(change) < 0.01:
            continue

        movers.append({
            "agent_id": aid,
            "name": agent.get("name"),
            "category": agent.get("category"),
            "tier": agent.get("tier"),
            "current_score": current_score,
            "previous_score": old_score,
            "change": round(change, 2),
            "direction": "up" if change > 0 else "down",
        })

    # Sort by absolute change
    movers.sort(key=lambda x: abs(x["change"]), reverse=True)

    response = {
        "period": period,
        "risers": [m for m in movers if m["change"] > 0][:limit],
        "fallers": [m for m in movers if m["change"] < 0][:limit],
    }

    _cache[key] = {"data": response, "ts": time.time()}
    return response
