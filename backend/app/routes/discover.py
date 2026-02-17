from fastapi import APIRouter, Query, HTTPException
from app.database import get_supabase

router = APIRouter(prefix="/api/discover", tags=["discover"])


@router.get("/search")
async def search_agents(
    q: str | None = None,
    category: str | None = None,
    tier: str | None = None,
    min_score: float | None = None,
    chain: str | None = None,
    has_insurance: bool | None = None,
    sort: str = Query("score", pattern="^(score|newest|most_reviewed|most_earned|relevance)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Full-text search across agents with rich filtering."""
    db = get_supabase()

    query = db.table("agents").select("*", count="exact")

    if q:
        query = query.or_(
            f"name.ilike.%{q}%,description.ilike.%{q}%,owner_address.ilike.%{q}%,category.ilike.%{q}%"
        )
    if category:
        query = query.eq("category", category)
    if tier:
        query = query.eq("tier", tier)
    if min_score is not None:
        query = query.gte("composite_score", min_score)
    if chain:
        query = query.eq("source_chain", chain)

    # Sort mapping
    sort_map = {
        "score": ("composite_score", True),
        "newest": ("registered_at", True),
        "most_reviewed": ("total_feedback", True),
        "relevance": ("composite_score", True),
        "most_earned": ("composite_score", True),
    }
    sort_field, desc = sort_map.get(sort, ("composite_score", True))
    query = query.order(sort_field, desc=desc)

    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)

    result = query.execute()

    agents = result.data

    # If has_insurance filter is set, cross-reference with insurance_stakes
    if has_insurance is not None:
        agent_ids = [a["agent_id"] for a in agents]
        if agent_ids:
            stakes = (
                db.table("insurance_stakes")
                .select("agent_id")
                .eq("is_active", True)
                .in_("agent_id", agent_ids)
                .execute()
            )
            insured_ids = {s["agent_id"] for s in stakes.data}

            if has_insurance:
                agents = [a for a in agents if a["agent_id"] in insured_ids]
            else:
                agents = [a for a in agents if a["agent_id"] not in insured_ids]

    return {
        "agents": agents,
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
        "query": q,
    }


@router.get("/skills")
async def search_by_skill(
    skill: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Search agents by capability/skill."""
    db = get_supabase()

    # Search agent_capabilities table
    offset = (page - 1) * page_size
    caps = (
        db.table("agent_capabilities")
        .select("agent_id", count="exact")
        .ilike("capability", f"%{skill}%")
        .range(offset, offset + page_size - 1)
        .execute()
    )

    agent_ids = [c["agent_id"] for c in caps.data]

    if not agent_ids:
        return {"agents": [], "total": 0, "page": page, "page_size": page_size, "skill": skill}

    agents_result = (
        db.table("agents")
        .select("*")
        .in_("agent_id", agent_ids)
        .order("composite_score", desc=True)
        .execute()
    )

    return {
        "agents": agents_result.data,
        "total": caps.count or 0,
        "page": page,
        "page_size": page_size,
        "skill": skill,
    }


@router.get("/endpoints")
async def search_by_endpoint(
    type: str = Query(..., min_length=1),
    version: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Search agents by endpoint type (A2A, MCP, REST, etc.)."""
    db = get_supabase()

    offset = (page - 1) * page_size
    query = (
        db.table("agent_endpoints")
        .select("agent_id", count="exact")
        .ilike("endpoint_type", f"%{type}%")
    )

    if version:
        query = query.eq("version", version)

    query = query.range(offset, offset + page_size - 1)
    endpoints = query.execute()

    agent_ids = [e["agent_id"] for e in endpoints.data]

    if not agent_ids:
        return {"agents": [], "total": 0, "page": page, "page_size": page_size, "type": type}

    agents_result = (
        db.table("agents")
        .select("*")
        .in_("agent_id", agent_ids)
        .order("composite_score", desc=True)
        .execute()
    )

    return {
        "agents": agents_result.data,
        "total": endpoints.count or 0,
        "page": page,
        "page_size": page_size,
        "type": type,
    }


@router.get("/similar/{agent_id}")
async def get_similar_agents(agent_id: int, limit: int = Query(5, ge=1, le=20)):
    """Find similar agents based on category, skills, and score range."""
    db = get_supabase()

    # Get the reference agent
    agent_result = db.table("agents").select("*").eq("agent_id", agent_id).execute()
    if not agent_result.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = agent_result.data[0]
    score = float(agent.get("composite_score", 0))
    category = agent.get("category", "general")

    # Find agents in same category, similar score range
    similar = (
        db.table("agents")
        .select("*")
        .eq("category", category)
        .neq("agent_id", agent_id)
        .gte("composite_score", max(0, score - 15))
        .lte("composite_score", min(100, score + 15))
        .order("composite_score", desc=True)
        .limit(limit)
        .execute()
    )

    # If not enough, also fetch top agents from same category
    if len(similar.data) < limit:
        fallback = (
            db.table("agents")
            .select("*")
            .eq("category", category)
            .neq("agent_id", agent_id)
            .order("composite_score", desc=True)
            .limit(limit)
            .execute()
        )
        seen = {a["agent_id"] for a in similar.data}
        for a in fallback.data:
            if a["agent_id"] not in seen and len(similar.data) < limit:
                similar.data.append(a)
                seen.add(a["agent_id"])

    return {
        "agent_id": agent_id,
        "similar_agents": similar.data[:limit],
    }


@router.get("/trending")
async def get_trending(
    period: str = Query("7d", pattern="^(7d|30d)$"),
    limit: int = Query(10, ge=1, le=50),
):
    """Get trending agents (biggest score changes)."""
    db = get_supabase()

    from datetime import datetime, timedelta, timezone

    days = 7 if period == "7d" else 30
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Get agents with recent feedback activity
    recent_feedback = (
        db.table("reputation_events")
        .select("agent_id")
        .gte("created_at", cutoff)
        .execute()
    )

    # Count feedback per agent
    feedback_counts: dict[int, int] = {}
    for f in recent_feedback.data:
        aid = f["agent_id"]
        feedback_counts[aid] = feedback_counts.get(aid, 0) + 1

    if not feedback_counts:
        return {"trending": [], "period": period}

    # Get the agent details
    active_ids = list(feedback_counts.keys())[:50]
    agents_result = (
        db.table("agents")
        .select("*")
        .in_("agent_id", active_ids)
        .order("composite_score", desc=True)
        .execute()
    )

    trending = []
    for a in agents_result.data:
        trending.append({
            **a,
            "recent_feedback_count": feedback_counts.get(a["agent_id"], 0),
        })

    trending.sort(key=lambda x: x["recent_feedback_count"], reverse=True)

    return {
        "trending": trending[:limit],
        "period": period,
    }


@router.get("/new")
async def get_new_agents(limit: int = Query(20, ge=1, le=50)):
    """Get recently registered agents."""
    db = get_supabase()

    result = (
        db.table("agents")
        .select("*")
        .order("registered_at", desc=True)
        .limit(limit)
        .execute()
    )

    return {"agents": result.data, "total": len(result.data)}


@router.get("/compare")
async def compare_agents(agents: str = Query(..., description="Comma-separated agent IDs")):
    """Side-by-side comparison of 2-5 agents."""
    try:
        agent_ids = [int(x.strip()) for x in agents.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent IDs format")

    if len(agent_ids) < 2 or len(agent_ids) > 5:
        raise HTTPException(status_code=400, detail="Provide 2-5 agent IDs")

    db = get_supabase()

    result = (
        db.table("agents")
        .select("*")
        .in_("agent_id", agent_ids)
        .execute()
    )

    if len(result.data) != len(agent_ids):
        found = {a["agent_id"] for a in result.data}
        missing = [aid for aid in agent_ids if aid not in found]
        raise HTTPException(status_code=404, detail=f"Agents not found: {missing}")

    # Get additional stats for each agent
    comparison = []
    for agent in result.data:
        aid = agent["agent_id"]

        feedback_count = (
            db.table("reputation_events")
            .select("id", count="exact")
            .eq("agent_id", aid)
            .execute()
        )

        validation_count = (
            db.table("validation_records")
            .select("id", count="exact")
            .eq("agent_id", aid)
            .execute()
        )

        # Check insurance
        insurance = (
            db.table("insurance_stakes")
            .select("stake_amount,tier")
            .eq("agent_id", aid)
            .eq("is_active", True)
            .execute()
        )

        comparison.append({
            **agent,
            "feedback_count": feedback_count.count or 0,
            "validation_count": validation_count.count or 0,
            "is_insured": len(insurance.data) > 0,
            "insurance_stake": float(insurance.data[0]["stake_amount"]) if insurance.data else 0,
        })

    return {"agents": comparison}


@router.get("/categories/stats")
async def get_category_stats():
    """Get agent statistics grouped by category."""
    db = get_supabase()

    # Paginate to avoid Supabase default 1000-row limit
    all_agents: list[dict] = []
    offset = 0
    while True:
        batch = (
            db.table("agents")
            .select("category,composite_score,total_feedback,tier")
            .range(offset, offset + 999)
            .execute()
        )
        if not batch.data:
            break
        all_agents.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    categories: dict[str, dict] = {}
    for a in all_agents:
        cat = a.get("category", "general") or "general"
        if cat not in categories:
            categories[cat] = {
                "category": cat,
                "agent_count": 0,
                "avg_score": 0,
                "total_feedback": 0,
                "tier_distribution": {},
                "scores": [],
            }
        categories[cat]["agent_count"] += 1
        categories[cat]["total_feedback"] += a.get("total_feedback", 0)
        score = float(a.get("composite_score", 0))
        categories[cat]["scores"].append(score)

        tier = a.get("tier", "unranked")
        categories[cat]["tier_distribution"][tier] = categories[cat]["tier_distribution"].get(tier, 0) + 1

    result = []
    for cat_data in categories.values():
        scores = cat_data.pop("scores")
        cat_data["avg_score"] = round(sum(scores) / len(scores), 2) if scores else 0
        result.append(cat_data)

    result.sort(key=lambda x: x["agent_count"], reverse=True)

    return {"categories": result}


@router.get("/export")
async def export_agents(
    format: str = Query("json", pattern="^(json|csv)$"),
    category: str | None = None,
    tier: str | None = None,
):
    """Export agent data in JSON or CSV format."""
    db = get_supabase()

    query = db.table("agents").select("*")
    if category:
        query = query.eq("category", category)
    if tier:
        query = query.eq("tier", tier)

    query = query.order("composite_score", desc=True)
    result = query.execute()

    if format == "csv":
        import io
        import csv

        output = io.StringIO()
        if result.data:
            writer = csv.DictWriter(output, fieldnames=result.data[0].keys())
            writer.writeheader()
            writer.writerows(result.data)

        from fastapi.responses import Response
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=agents.csv"},
        )

    return {"agents": result.data, "total": len(result.data), "format": format}
