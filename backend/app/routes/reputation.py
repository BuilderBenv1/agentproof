from datetime import datetime, timezone
from fastapi import APIRouter, Query, HTTPException, Request
from app.database import get_supabase
from app.services.scoring import calculate_max_exposure

from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/reputation", tags=["reputation"])


@router.get("/{agent_id}/summary")
@limiter.limit("60/minute")
async def get_reputation_summary(request: Request, agent_id: int):
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
@limiter.limit("30/minute")
async def get_reputation_history(
    request: Request,
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
@limiter.limit("30/minute")
async def get_deployer_reputation(request: Request, address: str):
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

    # Get their agents (top 20 by score) with chain info for cross-chain linking
    agents_result = (
        db.table("agents")
        .select("agent_id, name, composite_score, tier, category, total_feedback, source_chain")
        .eq("owner_address", address)
        .order("composite_score", desc=True)
        .limit(50)
        .execute()
    )

    # Cross-chain identity analysis
    chains_active = list(set(a.get("source_chain", "avalanche") for a in agents_result.data))
    chain_breakdown = {}
    for a in agents_result.data:
        c = a.get("source_chain", "avalanche")
        if c not in chain_breakdown:
            chain_breakdown[c] = {"count": 0, "avg_score": 0, "scores": []}
        chain_breakdown[c]["count"] += 1
        chain_breakdown[c]["scores"].append(float(a.get("composite_score", 0)))

    for c, data in chain_breakdown.items():
        scores = data.pop("scores")
        data["avg_score"] = round(sum(scores) / len(scores), 2) if scores else 0

    # Detect reputation laundering: same deployer, new chain, low-score history
    reputation_laundering_risk = False
    if len(chains_active) > 1:
        # If deployer has low-scored agents on one chain and new agents on another
        for c, data in chain_breakdown.items():
            if data["avg_score"] < 30 and data["count"] > 2:
                for other_c, other_data in chain_breakdown.items():
                    if other_c != c and other_data["count"] <= 3:
                        reputation_laundering_risk = True
                        break

    return {
        **deployer,
        "label": label,
        "agents": agents_result.data[:20],
        "cross_chain": {
            "chains_active": chains_active,
            "chain_count": len(chains_active),
            "chain_breakdown": chain_breakdown,
            "reputation_laundering_risk": reputation_laundering_risk,
        },
    }


@router.get("/{agent_id}/recent-feedback")
@limiter.limit("60/minute")
async def get_recent_feedback(
    request: Request,
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


@router.get("/{agent_id}/max-exposure")
@limiter.limit("60/minute")
async def get_max_exposure(request: Request, agent_id: int):
    """Get max exposure (dollar-denominated trust ceiling) for an agent.

    Returns how much you should trust this agent with, as a USD figure.
    Based on composite score, feedback volume, age, insurance, and validations.
    """
    db = get_supabase()

    agent_result = db.table("agents").select(
        "composite_score, total_feedback, registered_at, validation_success_rate"
    ).eq("agent_id", agent_id).execute()

    if not agent_result.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = agent_result.data[0]

    # Check insurance
    insurance_stake_usd = 0.0
    try:
        ins = (
            db.table("insurance_stakes")
            .select("stake_amount")
            .eq("agent_id", agent_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if ins.data:
            insurance_stake_usd = float(ins.data[0]["stake_amount"]) * 25.0
    except Exception:
        pass

    reg_at = agent.get("registered_at", "")
    age_days = 0
    if reg_at:
        reg_dt = datetime.fromisoformat(str(reg_at).replace("Z", "+00:00"))
        age_days = max(0, (datetime.now(timezone.utc) - reg_dt).days)

    exposure = calculate_max_exposure(
        composite_score=float(agent.get("composite_score", 0)),
        feedback_count=int(agent.get("total_feedback", 0)),
        account_age_days=age_days,
        insurance_stake_usd=insurance_stake_usd,
        validation_success_rate=float(agent.get("validation_success_rate", 0)),
    )

    # Breakdown for transparency
    return {
        "agent_id": agent_id,
        "max_exposure_usd": exposure,
        "factors": {
            "composite_score": float(agent.get("composite_score", 0)),
            "feedback_count": int(agent.get("total_feedback", 0)),
            "account_age_days": age_days,
            "insurance_stake_usd": round(insurance_stake_usd, 2),
            "validation_success_rate": float(agent.get("validation_success_rate", 0)),
        },
        "note": "Max exposure is a recommendation, not a guarantee. Based on reputation signals, feedback volume, account age, insurance stake, and validation history.",
    }
