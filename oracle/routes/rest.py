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


def _add_ratelimit_headers(response, request: Request):
    """Attach X-RateLimit-* headers so integrators can track their usage."""
    tier = getattr(request.state, "tier", None)
    api_key_id = getattr(request.state, "api_key_id", None)
    if not api_key_id:
        return response
    from middleware.api_key import TIER_MONTHLY_LIMITS
    from services.usage import get_usage_tracker
    tracker = get_usage_tracker()
    limit = TIER_MONTHLY_LIMITS.get(tier, 10_000)
    used = tracker.get_monthly_count(api_key_id)
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(max(0, limit - used))
    response.headers["X-RateLimit-Tier"] = tier or "unknown"
    response.headers["X-Disclaimer"] = (
        "Scores are informational only. Not financial advice. "
        "See https://agentproof.sh/terms"
    )
    return response


@router.get("/trust/{agent_id}", response_model=TrustEvaluation)
async def evaluate_agent(
    request: Request,
    agent_id: int,
    chain: str | None = Query(None, description="Source chain to scope evaluation (e.g. base, avalanche)"),
):
    """Get a full trust evaluation for an agent."""
    cache = get_trust_cache()
    cache_key = f"eval:{agent_id}:{chain}" if chain else f"eval:{agent_id}"
    was_cached = cache.get(cache_key) is not None

    try:
        svc = get_trust_service()
        result = svc.evaluate_agent(agent_id, chain=chain)
        response = JSONResponse(content=result.model_dump(mode="json"))
        response.headers["X-Cache"] = "HIT" if was_cached else "MISS"
        return _add_ratelimit_headers(response, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error evaluating agent #{agent_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/trust/{agent_id}/risk", response_model=RiskAssessment)
async def risk_check(request: Request, agent_id: int):
    """Get a risk assessment for an agent."""
    try:
        svc = get_trust_service()
        result = svc.risk_check(agent_id)
        response = JSONResponse(content=result.model_dump(mode="json"))
        return _add_ratelimit_headers(response, request)
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


@router.get("/agents/{agent_id}/delegations")
async def get_agent_delegations(
    agent_id: int,
    role: str | None = Query(None, description="Filter: 'delegator' or 'delegate'"),
    limit: int = Query(50, ge=1, le=200),
):
    """Delegation history for an agent — as delegator and as delegate."""
    from database import get_supabase

    try:
        db = get_supabase()

        as_delegator = {"total": 0, "success_rate": None, "recent": []}
        as_delegate = {"total": 0, "success_rate": None, "recent": []}

        if role != "delegate":
            result = (
                db.table("delegation_events")
                .select("*")
                .eq("delegator_agent_id", agent_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            rows = result.data or []
            completed = [r for r in rows if r.get("outcome") != "pending"]
            successes = sum(1 for r in completed if r.get("outcome") == "success")
            as_delegator = {
                "total": len(rows),
                "success_rate": round(successes / len(completed) * 100, 2) if completed else None,
                "recent": rows[:10],
            }

        if role != "delegator":
            result = (
                db.table("delegation_events")
                .select("*")
                .eq("delegate_agent_id", agent_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            rows = result.data or []
            completed = [r for r in rows if r.get("outcome") != "pending"]
            successes = sum(1 for r in completed if r.get("outcome") == "success")
            as_delegate = {
                "total": len(rows),
                "success_rate": round(successes / len(completed) * 100, 2) if completed else None,
                "recent": rows[:10],
            }

        return {
            "agent_id": agent_id,
            "as_delegator": as_delegator,
            "as_delegate": as_delegate,
        }
    except Exception as e:
        logger.error(f"Error fetching delegations for agent #{agent_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/agents/{agent_id}/failures")
async def get_agent_failures(
    agent_id: int,
    limit: int = Query(50, ge=1, le=200),
):
    """Failure event history for an agent."""
    from database import get_supabase

    try:
        db = get_supabase()

        result = (
            db.table("failure_events")
            .select("*")
            .eq("agent_id", agent_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        events = result.data or []

        active = sum(1 for e in events if e.get("resolved_at") is None)
        resolved = [e for e in events if e.get("resolution_time_seconds") is not None]
        mttr = None
        if resolved:
            mttr = int(sum(e["resolution_time_seconds"] for e in resolved) / len(resolved))

        return {
            "agent_id": agent_id,
            "failure_count": len(events),
            "active_failures": active,
            "mttr_seconds": mttr,
            "events": events,
        }
    except Exception as e:
        logger.error(f"Error fetching failures for agent #{agent_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/trust/{agent_id}/dimensions")
async def get_dimensional_scores(
    agent_id: int,
    chain: str | None = Query(None, description="Source chain filter"),
):
    """Per-tag1 dimensional trust scores for an agent."""
    from database import get_supabase
    from services.trust import calculate_scoped_scores

    try:
        db = get_supabase()
        scores = calculate_scoped_scores(db, agent_id, chain)
        return {
            "agent_id": agent_id,
            "dimensions": scores,
        }
    except Exception as e:
        logger.error(f"Error fetching dimensional scores for agent #{agent_id}: {e}")
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
