from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Query, HTTPException, Request
from app.database import get_supabase
from app.auth import sanitize_search
from app.models.agent import AgentResponse, AgentListResponse, AgentProfileResponse
from app.services.scoring import calculate_max_exposure, calculate_score_trajectory

from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", response_model=AgentListResponse)
@limiter.limit("60/minute")
async def list_agents(
    request: Request,
    category: str | None = Query(None, max_length=50),
    chain: str | None = Query(None, max_length=30),
    search: str | None = Query(None, max_length=200),
    tier: str | None = Query(None, max_length=20),
    address: str | None = Query(None, max_length=42, description="Filter by owner address (exact, case-insensitive)"),
    sort_by: str = Query("composite_score", pattern="^(composite_score|registered_at|total_feedback)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1, le=1000),
    page_size: int = Query(20, ge=1, le=100),
):
    """List all agents with filtering, search, and pagination."""
    db = get_supabase()

    query = db.table("agents").select("*", count="exact")

    if category:
        query = query.eq("category", category)
    if chain:
        query = query.eq("source_chain", chain)
    if tier:
        query = query.eq("tier", tier)
    if address:
        query = query.ilike("owner_address", address)
    safe_search = sanitize_search(search)
    if safe_search:
        query = query.or_(f"name.ilike.%{safe_search}%,description.ilike.%{safe_search}%,owner_address.ilike.%{safe_search}%")

    query = query.order(sort_by, desc=(order == "desc"))

    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)

    result = query.execute()

    return AgentListResponse(
        agents=[AgentResponse(**a) for a in result.data],
        total=result.count or 0,
        page=page,
        page_size=page_size,
    )


@router.get("/{agent_id}", response_model=AgentProfileResponse)
@limiter.limit("60/minute")
async def get_agent(request: Request, agent_id: int, chain: str | None = None):
    """Get full agent profile with reputation details.

    When agents share the same agent_id across chains (ERC-8004 CREATE2),
    pass ?chain=base to disambiguate. Without chain, returns the first match.
    """
    db = get_supabase()

    query = db.table("agents").select("*").eq("agent_id", agent_id)
    if chain:
        query = query.eq("source_chain", chain)
    result = query.execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = result.data[0]

    # Get feedback count
    feedback_result = (
        db.table("reputation_events")
        .select("id", count="exact")
        .eq("agent_id", agent_id)
        .execute()
    )

    # Get validation count
    validation_result = (
        db.table("validation_records")
        .select("id", count="exact")
        .eq("agent_id", agent_id)
        .execute()
    )

    # Deployer info
    deployer_info = None
    try:
        dep_result = (
            db.table("deployer_reputation")
            .select("*")
            .eq("owner_address", agent.get("owner_address", ""))
            .limit(1)
            .execute()
        )
        if dep_result.data:
            deployer_info = dep_result.data[0]
    except Exception:
        pass

    # URI changes (last 10)
    uri_changes = None
    try:
        uri_result = (
            db.table("agent_uri_changes")
            .select("*")
            .eq("agent_id", agent_id)
            .order("changed_at", desc=True)
            .limit(10)
            .execute()
        )
        if uri_result.data:
            uri_changes = uri_result.data
    except Exception:
        pass

    # Score trajectory (7d/30d deltas from score_history)
    score_trajectory = None
    try:
        cutoff_30d = (datetime.now(timezone.utc) - timedelta(days=31)).strftime("%Y-%m-%d")
        history = (
            db.table("score_history")
            .select("composite_score, snapshot_date")
            .eq("agent_id", agent_id)
            .gte("snapshot_date", cutoff_30d)
            .order("snapshot_date", desc=False)
            .execute()
        )
        if history.data:
            now = datetime.now(timezone.utc)
            target_7d = (now - timedelta(days=7)).strftime("%Y-%m-%d")
            target_30d = (now - timedelta(days=30)).strftime("%Y-%m-%d")
            # Find closest snapshot to 7d and 30d ago
            score_7d = None
            score_30d = None
            for h in history.data:
                if h["snapshot_date"] <= target_7d:
                    score_7d = float(h["composite_score"])
                if h["snapshot_date"] <= target_30d:
                    score_30d = float(h["composite_score"])
            current = float(agent.get("composite_score", 0))
            score_trajectory = calculate_score_trajectory(current, score_7d, score_30d)
    except Exception:
        pass

    # Max exposure calculation
    max_exposure_usd = None
    try:
        # Check insurance stake
        insurance_stake = 0.0
        ins_result = (
            db.table("insurance_stakes")
            .select("stake_amount")
            .eq("agent_id", agent_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if ins_result.data:
            # Rough AVAX→USD conversion (conservative estimate)
            insurance_stake = float(ins_result.data[0]["stake_amount"]) * 25.0

        reg_at = agent.get("registered_at", "")
        age_days = 0
        if reg_at:
            reg_dt = datetime.fromisoformat(str(reg_at).replace("Z", "+00:00"))
            age_days = max(0, (datetime.now(timezone.utc) - reg_dt).days)

        max_exposure_usd = calculate_max_exposure(
            composite_score=float(agent.get("composite_score", 0)),
            feedback_count=int(agent.get("total_feedback", 0)),
            account_age_days=age_days,
            insurance_stake_usd=insurance_stake,
            validation_success_rate=float(agent.get("validation_success_rate", 0)),
        )
    except Exception:
        pass

    # Cross-chain identity linking (same deployer on other chains)
    cross_chain_agents = None
    try:
        owner = agent.get("owner_address", "")
        agent_chain = agent.get("source_chain", "avalanche")
        if owner:
            linked = (
                db.table("agents")
                .select("agent_id, name, source_chain, composite_score, tier")
                .eq("owner_address", owner)
                .neq("source_chain", agent_chain)
                .order("composite_score", desc=True)
                .limit(20)
                .execute()
            )
            if linked.data:
                cross_chain_agents = linked.data
    except Exception:
        pass

    return AgentProfileResponse(
        **agent,
        feedback_count=feedback_result.count or 0,
        validation_count=validation_result.count or 0,
        score_breakdown={
            "average_rating": agent.get("average_rating", 0),
            "total_feedback": agent.get("total_feedback", 0),
            "composite_score": agent.get("composite_score", 0),
            "validation_success_rate": agent.get("validation_success_rate", 0),
            "tier": agent.get("tier", "unranked"),
        },
        deployer_info=deployer_info,
        uri_changes=uri_changes,
        score_trajectory=score_trajectory,
        max_exposure_usd=max_exposure_usd,
        cross_chain_agents=cross_chain_agents,
    )


@router.get("/{agent_id}/feedback")
@limiter.limit("60/minute")
async def get_agent_feedback(
    request: Request,
    agent_id: int,
    page: int = Query(1, ge=1, le=1000),
    page_size: int = Query(20, ge=1, le=100),
):
    """Get paginated feedback list for an agent."""
    db = get_supabase()

    # Verify agent exists
    agent_check = db.table("agents").select("agent_id").eq("agent_id", agent_id).execute()
    if not agent_check.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    offset = (page - 1) * page_size
    result = (
        db.table("reputation_events")
        .select("*", count="exact")
        .eq("agent_id", agent_id)
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    return {
        "feedback": result.data,
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{agent_id}/validations")
@limiter.limit("60/minute")
async def get_agent_validations(
    request: Request,
    agent_id: int,
    page: int = Query(1, ge=1, le=1000),
    page_size: int = Query(20, ge=1, le=100),
):
    """Get paginated validation list for an agent."""
    db = get_supabase()

    agent_check = db.table("agents").select("agent_id").eq("agent_id", agent_id).execute()
    if not agent_check.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    offset = (page - 1) * page_size
    result = (
        db.table("validation_records")
        .select("*", count="exact")
        .eq("agent_id", agent_id)
        .order("requested_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    return {
        "validations": result.data,
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{agent_id}/score-history")
@limiter.limit("30/minute")
async def get_agent_score_history(request: Request, agent_id: int):
    """Get score history (daily snapshots) for an agent."""
    db = get_supabase()

    result = (
        db.table("score_history")
        .select("*")
        .eq("agent_id", agent_id)
        .order("snapshot_date", desc=False)
        .execute()
    )

    return {
        "agent_id": agent_id,
        "history": result.data,
    }
