from fastapi import APIRouter, Query, HTTPException
from app.database import get_supabase

router = APIRouter(prefix="/api/reputation", tags=["reputation"])


@router.get("/{agent_id}/summary")
async def get_reputation_summary(agent_id: int):
    """Get reputation summary for an agent."""
    db = get_supabase()

    agent_result = db.table("agents").select(
        "agent_id, average_rating, composite_score, total_feedback, validation_success_rate, tier, rank"
    ).eq("agent_id", agent_id).execute()

    if not agent_result.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = agent_result.data[0]

    # Get rating distribution
    ratings_result = (
        db.table("reputation_events")
        .select("rating")
        .eq("agent_id", agent_id)
        .execute()
    )

    ratings = [r["rating"] for r in ratings_result.data]

    # Build distribution buckets (1-20, 21-40, 41-60, 61-80, 81-100)
    distribution = {"1-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
    for r in ratings:
        if r <= 20:
            distribution["1-20"] += 1
        elif r <= 40:
            distribution["21-40"] += 1
        elif r <= 60:
            distribution["41-60"] += 1
        elif r <= 80:
            distribution["61-80"] += 1
        else:
            distribution["81-100"] += 1

    return {
        **agent,
        "rating_distribution": distribution,
        "total_ratings": len(ratings),
    }


@router.get("/{agent_id}/history")
async def get_reputation_history(
    agent_id: int,
    limit: int = Query(30, ge=1, le=365),
):
    """Get reputation score history (daily snapshots)."""
    db = get_supabase()

    result = (
        db.table("score_history")
        .select("*")
        .eq("agent_id", agent_id)
        .order("snapshot_date", desc=True)
        .limit(limit)
        .execute()
    )

    return {
        "agent_id": agent_id,
        "history": list(reversed(result.data)),
    }


@router.get("/deployer/{address}")
async def get_deployer_reputation(address: str):
    """Get deployer reputation and their agents."""
    db = get_supabase()

    dep_result = (
        db.table("deployer_reputation")
        .select("*")
        .eq("owner_address", address)
        .execute()
    )

    if not dep_result.data:
        raise HTTPException(status_code=404, detail="Deployer not found")

    deployer = dep_result.data[0]

    # Determine label
    score = float(deployer.get("deployer_score", 50) or 50)
    total = int(deployer.get("total_agents", 0) or 0)
    abandoned = int(deployer.get("abandoned_agents", 0) or 0)
    oldest_days = int(deployer.get("oldest_agent_age_days", 0) or 0)

    if total > 10 and abandoned / max(total, 1) > 0.5:
        label = "serial_deployer_warning"
    elif oldest_days < 7:
        label = "new_deployer"
    elif oldest_days < 30:
        label = "recent_deployer"
    else:
        label = "established"

    # Get their agents (top 20 by score)
    agents_result = (
        db.table("agents")
        .select("agent_id, name, composite_score, tier, category, total_feedback")
        .eq("owner_address", address)
        .order("composite_score", desc=True)
        .limit(20)
        .execute()
    )

    return {
        **deployer,
        "label": label,
        "agents": agents_result.data,
    }


@router.get("/{agent_id}/recent-feedback")
async def get_recent_feedback(
    agent_id: int,
    limit: int = Query(10, ge=1, le=50),
):
    """Get the most recent feedback entries for an agent."""
    db = get_supabase()

    result = (
        db.table("reputation_events")
        .select("*")
        .eq("agent_id", agent_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    return {
        "agent_id": agent_id,
        "feedback": result.data,
    }
