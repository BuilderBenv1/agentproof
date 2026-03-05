"""REST API routes — /api/v1/*"""

import logging
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from models import TrustEvaluation, TrustedAgent, RiskAssessment, NetworkStats
from services.trust import get_trust_service, get_trust_cache
from services.feed import get_feed_bus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["REST API"])


@router.get("/trust/{agent_id}", response_model=TrustEvaluation)
async def evaluate_agent(agent_id: int):
    """Get a full trust evaluation for an agent."""
    cache = get_trust_cache()
    cache_key = f"eval:{agent_id}"
    was_cached = cache.get(cache_key) is not None

    try:
        svc = get_trust_service()
        result = svc.evaluate_agent(agent_id)
        response = JSONResponse(content=result.model_dump(mode="json"))
        response.headers["X-Cache"] = "HIT" if was_cached else "MISS"
        return response
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error evaluating agent #{agent_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/trust/{agent_id}/risk", response_model=RiskAssessment)
async def risk_check(agent_id: int):
    """Get a risk assessment for an agent."""
    try:
        svc = get_trust_service()
        return svc.risk_check(agent_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error risk-checking agent #{agent_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/agents/trusted", response_model=list[TrustedAgent])
async def find_trusted_agents(
    category: str | None = Query(None, description="Filter by category"),
    min_score: float = Query(0, ge=0, le=100, description="Minimum composite score"),
    min_feedback: int = Query(0, ge=0, description="Minimum feedback count"),
    tier: str | None = Query(None, description="Filter by tier"),
    chain: str | None = Query(None, description="Filter by source chain (e.g. base, ethereum, avalanche)"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
):
    """Find trusted agents matching the given criteria."""
    try:
        svc = get_trust_service()
        return svc.find_trusted_agents(
            category=category,
            min_score=min_score,
            min_feedback=min_feedback,
            tier=tier,
            chain=chain,
            limit=limit,
        )
    except Exception as e:
        logger.error(f"Error finding trusted agents: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/network/stats", response_model=NetworkStats)
async def network_stats():
    """Get network-wide trust statistics."""
    cache = get_trust_cache()
    was_cached = cache.get("network_stats") is not None

    try:
        svc = get_trust_service()
        result = svc.network_stats()
        response = JSONResponse(content=result.model_dump(mode="json"))
        response.headers["X-Cache"] = "HIT" if was_cached else "MISS"
        return response
    except Exception as e:
        logger.error(f"Error getting network stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/feed/stats")
async def feed_stats():
    """Cache and feed metrics."""
    bus = get_feed_bus()
    return {
        "cache": get_trust_cache().stats(),
        "feed": {
            "subscribers": bus.subscriber_count(),
            "buffer_size": bus.buffer_size(),
        },
    }


@router.get("/feed")
async def trust_feed(
    request: Request,
    agent_id: int | None = Query(None, description="Filter by agent ID"),
    last_event_id: int | None = Query(None, alias="Last-Event-ID"),
):
    """SSE trust feed — real-time trust updates, like a Chainlink price feed."""
    bus = get_feed_bus()

    # Also check Last-Event-ID header (SSE reconnect standard)
    if last_event_id is None:
        header_val = request.headers.get("Last-Event-ID")
        if header_val and header_val.isdigit():
            last_event_id = int(header_val)

    async def event_generator():
        async for event in bus.subscribe(last_event_id=last_event_id):
            if await request.is_disconnected():
                break
            if event is None:
                # Keepalive ping
                yield {"event": "ping", "data": ""}
                continue
            if agent_id is not None and event.agent_id != agent_id:
                continue
            yield {
                "id": str(event.event_id),
                "event": "trust_update",
                "data": event.to_sse().split("data: ")[1].split("\n")[0],
            }

    return EventSourceResponse(event_generator())


@router.get("/agents/{agent_id}/github")
async def get_agent_github_activity(agent_id: int):
    """Return GitHub coding metrics for an agent."""
    from database import get_supabase
    from services.github_poller import compute_coding_score

    try:
        db = get_supabase()
        result = (
            db.table("git_activity")
            .select("*")
            .eq("agent_id", agent_id)
            .order("updated_at", desc=True)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail=f"No GitHub activity for agent #{agent_id}")

        activities = []
        for row in result.data:
            score = compute_coding_score(row) if row.get("total_prs", 0) else 0.0
            total = row.get("total_prs", 0) or 0
            merged = row.get("merged_prs", 0) or 0
            activities.append({
                "github_repo": row.get("github_repo"),
                "total_prs": total,
                "merged_prs": merged,
                "rejected_prs": row.get("rejected_prs", 0),
                "reverted_prs": row.get("reverted_prs", 0),
                "merge_rate": round(merged / max(total, 1), 4),
                "avg_time_to_merge_hours": row.get("avg_time_to_merge_hours", 0),
                "avg_review_score": row.get("avg_review_score", 0),
                "last_commit_at": row.get("last_commit_at"),
                "last_polled_at": row.get("last_polled_at"),
                "coding_score": score,
            })

        return {
            "agent_id": agent_id,
            "repos": activities,
            "coding_score": activities[0]["coding_score"] if activities else 0.0,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching GitHub activity for agent #{agent_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/health")
async def health():
    """Oracle health check."""
    from config import get_settings

    settings = get_settings()
    return {
        "status": "healthy",
        "service": "agentproof-trust-oracle",
        "version": settings.oracle_version,
    }
