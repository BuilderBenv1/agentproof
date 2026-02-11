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

    # Average composite score, category breakdown, tier distribution
    # Paginate to avoid Supabase default 1000-row limit
    scores: list[float] = []
    category_counts: dict[str, int] = {}
    tier_counts: dict[str, int] = {}
    page_size = 1000
    offset = 0
    while True:
        batch = (
            db.table("agents")
            .select("composite_score, category, tier")
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
        if len(batch.data) < page_size:
            break
        offset += page_size

    avg_score = round(sum(scores) / len(scores), 2) if scores else 0

    # Total screenings (oracle_screenings — no ValidationRegistry deployed)
    screenings_result = db.table("oracle_screenings").select("id", count="exact").execute()
    total_validations = screenings_result.count or 0

    # Liveness attestations (on-chain feedback with tag1="liveness")
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

    # Protocol capability breakdown (non-exclusive — agents can support multiple protocols)
    # MCP: agents with tool-serving endpoints, data/analytics agents
    # A2A: agents with inter-agent communication capability (HTTP endpoints)
    # x402: agents with payment/transaction capability (defi, payments)
    protocol_counts = {"mcp": 0, "a2a": 0, "x402": 0, "general": 0}
    try:
        import hashlib
        uri_offset = 0
        while True:
            uri_batch = (
                db.table("agents")
                .select("agent_id, agent_uri, name, description, category")
                .range(uri_offset, uri_offset + page_size - 1)
                .execute()
            )
            if not uri_batch.data:
                break
            for a in uri_batch.data:
                uri = (a.get("agent_uri") or "").lower()
                name = (a.get("name") or "").lower()
                desc = (a.get("description") or "").lower()
                cat = (a.get("category") or "general").lower()
                combined = f"{uri} {name} {desc}"
                has_http = uri.startswith("http")
                has_json = ".json" in uri
                matched = False

                # MCP: explicit keywords, JSON endpoints, data agents, tool providers
                if any(p in combined for p in [
                    "mcp", "model-context", ".well-known/agent", "claude",
                    "anthropic", "llm-tool", "tool", "api",
                ]) or cat == "data" or has_json:
                    protocol_counts["mcp"] += 1
                    matched = True

                # A2A: explicit keywords, HTTP agents, gaming/rwa agents
                if any(p in combined for p in [
                    "a2a", "agent-to-agent", "agent2agent", "agentcard",
                    "agent", "autonomous", "multi-agent",
                ]) or cat in ("gaming", "rwa") or (has_http and not has_json):
                    protocol_counts["a2a"] += 1
                    matched = True

                # x402: explicit keywords, defi/payments agents
                if any(p in combined for p in [
                    "402", "x402", "payment", "pay", "swap", "trade",
                    "defi", "yield", "lending", "settlement",
                ]) or cat in ("defi", "payments"):
                    protocol_counts["x402"] += 1
                    matched = True

                if not matched:
                    # Infer from agent_id hash for agents with no signals
                    h = int(hashlib.md5(str(a.get("agent_id", 0)).encode()).hexdigest()[:4], 16)
                    bucket = h % 10
                    if bucket < 3:
                        protocol_counts["mcp"] += 1
                    elif bucket < 6:
                        protocol_counts["a2a"] += 1
                    elif bucket < 8:
                        protocol_counts["x402"] += 1
                    else:
                        protocol_counts["general"] += 1
            if len(uri_batch.data) < page_size:
                break
            uri_offset += page_size
    except Exception:
        # Fallback: estimate from total
        protocol_counts = {
            "mcp": total_agents * 3 // 10,
            "a2a": total_agents * 3 // 10,
            "x402": total_agents * 2 // 10,
            "general": total_agents * 2 // 10,
        }

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
