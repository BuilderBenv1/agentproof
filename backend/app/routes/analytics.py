import hashlib
import time

from fastapi import APIRouter, Query
from app.database import get_supabase
from app.services.blockchain import get_blockchain_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# In-memory cache for overview (recomputed every 5 minutes)
_overview_cache: dict = {}
_overview_cache_ts: float = 0
_OVERVIEW_TTL = 300  # 5 minutes


def _classify_protocol(agent_id: int, category: str) -> list[str]:
    """Classify agent into protocol buckets using category + deterministic hash."""
    cat = (category or "general").lower()
    protocols = []

    # Category-based protocol mapping (non-exclusive)
    if cat == "data":
        protocols.append("mcp")
    if cat in ("gaming", "rwa"):
        protocols.append("a2a")
    if cat in ("defi", "payments"):
        protocols.append("x402")

    if not protocols:
        # Deterministic assignment for general/uncategorized agents
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


def _compute_overview() -> dict:
    """Compute overview stats (single pass through agents)."""
    db = get_supabase()

    # Count queries (fast — use Supabase count)
    agents_result = db.table("agents").select("id", count="exact").execute()
    total_agents = agents_result.count or 0

    feedback_result = db.table("reputation_events").select("id", count="exact").execute()
    total_feedback = feedback_result.count or 0

    screenings_result = db.table("oracle_screenings").select("id", count="exact").execute()
    total_validations = screenings_result.count or 0

    try:
        liveness_result = (
            db.table("reputation_events")
            .select("id", count="exact")
            .eq("tag1", "liveness")
            .execute()
        )
        total_liveness = liveness_result.count or 0
    except Exception:
        total_liveness = 0

    # Single pass through agents for scores, categories, tiers, protocols
    scores: list[float] = []
    category_counts: dict[str, int] = {}
    tier_counts: dict[str, int] = {}
    protocol_counts = {"mcp": 0, "a2a": 0, "x402": 0, "general": 0}
    page_size = 1000
    offset = 0

    while True:
        batch = (
            db.table("agents")
            .select("agent_id, composite_score, category, tier")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not batch.data:
            break
        for a in batch.data:
            if a.get("composite_score"):
                scores.append(float(a["composite_score"]))
            cat = a.get("category", "general") or "general"
            category_counts[cat] = category_counts.get(cat, 0) + 1
            tier = a.get("tier", "unranked")
            tier_counts[tier] = tier_counts.get(tier, 0) + 1
            for proto in _classify_protocol(a.get("agent_id", 0), cat):
                protocol_counts[proto] = protocol_counts.get(proto, 0) + 1
        if len(batch.data) < page_size:
            break
        offset += page_size

    avg_score = round(sum(scores) / len(scores), 2) if scores else 0

    return {
        "total_agents": total_agents,
        "total_feedback": total_feedback,
        "total_validations": total_validations,
        "total_liveness": total_liveness,
        "average_score": avg_score,
        "category_breakdown": category_counts,
        "tier_distribution": tier_counts,
        "protocol_breakdown": protocol_counts,
    }


@router.get("/overview")
async def get_overview():
    """Get aggregate analytics overview. Cached for 5 minutes."""
    global _overview_cache, _overview_cache_ts
    now = time.time()
    if _overview_cache and (now - _overview_cache_ts) < _OVERVIEW_TTL:
        return _overview_cache
    result = _compute_overview()
    _overview_cache = result
    _overview_cache_ts = now
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
