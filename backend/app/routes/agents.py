from fastapi import APIRouter, Query, HTTPException
from app.database import get_supabase
from app.models.agent import AgentResponse, AgentListResponse, AgentProfileResponse

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", response_model=AgentListResponse)
async def list_agents(
    category: str | None = None,
    chain: str | None = None,
    search: str | None = None,
    tier: str | None = None,
    sort_by: str = Query("composite_score", pattern="^(composite_score|registered_at|total_feedback)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
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
    if search:
        query = query.or_(f"name.ilike.%{search}%,description.ilike.%{search}%,owner_address.ilike.%{search}%")

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
async def get_agent(agent_id: int):
    """Get full agent profile with reputation details."""
    db = get_supabase()

    result = db.table("agents").select("*").eq("agent_id", agent_id).execute()
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
    )


@router.get("/{agent_id}/feedback")
async def get_agent_feedback(
    agent_id: int,
    page: int = Query(1, ge=1),
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
async def get_agent_validations(
    agent_id: int,
    page: int = Query(1, ge=1),
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
async def get_agent_score_history(agent_id: int):
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
