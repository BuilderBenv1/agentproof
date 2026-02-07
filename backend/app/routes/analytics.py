from fastapi import APIRouter, Query
from app.database import get_supabase
from app.services.blockchain import get_blockchain_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
async def get_overview():
    """Get aggregate analytics overview."""
    db = get_supabase()

    # Total agents
    agents_result = db.table("agents").select("id", count="exact").execute()
    total_agents = agents_result.count or 0

    # Total feedback
    feedback_result = db.table("reputation_events").select("id", count="exact").execute()
    total_feedback = feedback_result.count or 0

    # Average composite score
    agents_data = db.table("agents").select("composite_score, category").execute()

    scores = [float(a["composite_score"]) for a in agents_data.data if a["composite_score"]]
    avg_score = round(sum(scores) / len(scores), 2) if scores else 0

    # Category breakdown
    category_counts: dict[str, int] = {}
    for agent in agents_data.data:
        cat = agent.get("category", "general") or "general"
        category_counts[cat] = category_counts.get(cat, 0) + 1

    # Tier distribution
    tier_result = db.table("agents").select("tier").execute()
    tier_counts: dict[str, int] = {}
    for agent in tier_result.data:
        tier = agent.get("tier", "unranked")
        tier_counts[tier] = tier_counts.get(tier, 0) + 1

    # Total validations
    validations_result = db.table("validation_records").select("id", count="exact").execute()
    total_validations = validations_result.count or 0

    return {
        "total_agents": total_agents,
        "total_feedback": total_feedback,
        "total_validations": total_validations,
        "average_score": avg_score,
        "category_breakdown": category_counts,
        "tier_distribution": tier_counts,
    }


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

    # Get agent counts per category
    agents = db.table("agents").select("category").execute()
    category_counts: dict[str, int] = {}
    for agent in agents.data:
        cat = agent.get("category", "general") or "general"
        category_counts[cat] = category_counts.get(cat, 0) + 1

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
