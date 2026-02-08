import csv
import io
import json
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from app.database import get_supabase
from app.models.audit import AuditLogResponse, TaskEventResponse, AuditSummaryResponse

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/{agent_id}")
async def get_audit_log(
    agent_id: int,
    action: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """Get paginated audit log for an agent."""
    db = get_supabase()

    query = (
        db.table("audit_logs")
        .select("*", count="exact")
        .eq("agent_id", agent_id)
    )

    if action:
        query = query.eq("action", action)

    query = query.order("created_at", desc=True)

    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)
    result = query.execute()

    return {
        "agent_id": agent_id,
        "logs": [AuditLogResponse(**l) for l in result.data],
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{agent_id}/export")
async def export_audit_log(
    agent_id: int,
    format: str = Query("csv", pattern="^(csv|json)$"),
):
    """Export full audit log as CSV or JSON."""
    db = get_supabase()

    result = (
        db.table("audit_logs")
        .select("*")
        .eq("agent_id", agent_id)
        .order("created_at", desc=True)
        .execute()
    )

    if format == "json":
        content = json.dumps(result.data, indent=2, default=str)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=audit_agent_{agent_id}.json"},
        )

    # CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "agent_id", "action", "actor_address", "details", "tx_hash", "source", "created_at"])

    for row in result.data:
        writer.writerow([
            row.get("id"),
            row.get("agent_id"),
            row.get("action"),
            row.get("actor_address"),
            json.dumps(row.get("details", {})),
            row.get("tx_hash", ""),
            row.get("source", ""),
            row.get("created_at"),
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=audit_agent_{agent_id}.csv"},
    )


@router.get("/{agent_id}/summary", response_model=AuditSummaryResponse)
async def get_audit_summary(agent_id: int):
    """Get audit log summary for an agent."""
    db = get_supabase()

    result = (
        db.table("audit_logs")
        .select("action,actor_address,created_at")
        .eq("agent_id", agent_id)
        .order("created_at")
        .execute()
    )

    if not result.data:
        return AuditSummaryResponse(agent_id=agent_id)

    action_counts: dict[str, int] = {}
    actors: set[str] = set()

    for row in result.data:
        action = row.get("action", "unknown")
        action_counts[action] = action_counts.get(action, 0) + 1
        actors.add(row.get("actor_address", ""))

    return AuditSummaryResponse(
        agent_id=agent_id,
        total_events=len(result.data),
        action_counts=action_counts,
        unique_actors=len(actors),
        first_event=result.data[0]["created_at"],
        last_event=result.data[-1]["created_at"],
    )


@router.get("/task/{task_id}")
async def get_task_events(task_id: str):
    """Get event timeline for a task."""
    db = get_supabase()

    result = (
        db.table("task_events")
        .select("*")
        .eq("task_id", task_id)
        .order("created_at")
        .execute()
    )

    return {
        "task_id": task_id,
        "events": [TaskEventResponse(**e) for e in result.data],
    }
