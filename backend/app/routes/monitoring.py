from fastapi import APIRouter, Query, HTTPException
from app.database import get_supabase
from app.models.monitoring import (
    EndpointResponse,
    UptimeCheckResponse,
    UptimeDailySummary,
    MonitoringOverview,
    MonitoringStatsResponse,
)

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


@router.get("/agent/{agent_id}", response_model=MonitoringOverview)
async def get_agent_monitoring(agent_id: int):
    """Get monitoring overview for an agent."""
    db = get_supabase()

    # Endpoints
    ep_result = (
        db.table("agent_monitoring_endpoints")
        .select("*")
        .eq("agent_id", agent_id)
        .order("endpoint_index")
        .execute()
    )

    endpoints = [EndpointResponse(**e) for e in ep_result.data]

    # Latest check
    last_check_result = (
        db.table("uptime_checks")
        .select("*")
        .eq("agent_id", agent_id)
        .order("checked_at", desc=True)
        .limit(1)
        .execute()
    )
    last_check = UptimeCheckResponse(**last_check_result.data[0]) if last_check_result.data else None

    # Aggregate stats from daily summary (last 30 days)
    summary_result = (
        db.table("uptime_daily_summary")
        .select("*")
        .eq("agent_id", agent_id)
        .order("summary_date", desc=True)
        .limit(30)
        .execute()
    )

    total_checks = sum(s["total_checks"] for s in summary_result.data)
    successful = sum(s["successful_checks"] for s in summary_result.data)
    uptime_pct = round((successful / total_checks * 100), 2) if total_checks > 0 else 0
    avg_latency = (
        round(sum(s["avg_latency_ms"] for s in summary_result.data) / len(summary_result.data))
        if summary_result.data
        else 0
    )

    return MonitoringOverview(
        agent_id=agent_id,
        endpoints=endpoints,
        uptime_pct=uptime_pct,
        avg_latency_ms=avg_latency,
        total_checks=total_checks,
        last_check=last_check,
    )


@router.get("/agent/{agent_id}/history")
async def get_agent_uptime_history(
    agent_id: int,
    days: int = Query(30, ge=1, le=90),
):
    """Get daily uptime summaries for an agent."""
    db = get_supabase()

    result = (
        db.table("uptime_daily_summary")
        .select("*")
        .eq("agent_id", agent_id)
        .order("summary_date", desc=True)
        .limit(days)
        .execute()
    )

    return {
        "agent_id": agent_id,
        "days": days,
        "summaries": [UptimeDailySummary(**s) for s in result.data],
    }


@router.get("/agent/{agent_id}/checks")
async def get_agent_uptime_checks(
    agent_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """Get raw uptime check records for an agent."""
    db = get_supabase()

    offset = (page - 1) * page_size
    result = (
        db.table("uptime_checks")
        .select("*", count="exact")
        .eq("agent_id", agent_id)
        .order("checked_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    return {
        "agent_id": agent_id,
        "checks": [UptimeCheckResponse(**c) for c in result.data],
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/stats", response_model=MonitoringStatsResponse)
async def get_monitoring_stats():
    """Get global monitoring statistics."""
    db = get_supabase()

    endpoints_result = db.table("agent_monitoring_endpoints").select("agent_id", count="exact").eq("is_active", True).execute()
    checks_result = db.table("uptime_checks").select("id", count="exact").execute()

    # Count unique monitored agents
    unique_agents = set()
    for e in endpoints_result.data:
        unique_agents.add(e["agent_id"])

    # Average uptime from daily summaries (last 7 days)
    summary_result = (
        db.table("uptime_daily_summary")
        .select("uptime_pct")
        .order("summary_date", desc=True)
        .limit(500)
        .execute()
    )

    avg_uptime = (
        round(sum(s["uptime_pct"] for s in summary_result.data) / len(summary_result.data), 2)
        if summary_result.data
        else 0
    )

    return MonitoringStatsResponse(
        total_monitored_agents=len(unique_agents),
        total_endpoints=endpoints_result.count or 0,
        total_checks=checks_result.count or 0,
        average_uptime_pct=avg_uptime,
    )
