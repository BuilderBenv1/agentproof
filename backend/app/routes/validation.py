from fastapi import APIRouter, Query, HTTPException
from app.database import get_supabase

router = APIRouter(prefix="/api/validation", tags=["validation"])


@router.get("/{agent_id}")
async def get_agent_validations(
    agent_id: int,
    status: str | None = Query(None, pattern="^(pending|completed|all)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Get validations for an agent with optional status filter."""
    db = get_supabase()

    query = (
        db.table("validation_records")
        .select("*", count="exact")
        .eq("agent_id", agent_id)
    )

    if status == "pending":
        query = query.is_("validator_address", "null")
    elif status == "completed":
        query = query.not_.is_("validator_address", "null")

    offset = (page - 1) * page_size
    result = (
        query.order("requested_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    return {
        "validations": result.data,
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{agent_id}/stats")
async def get_validation_stats(agent_id: int):
    """Get validation statistics for an agent."""
    db = get_supabase()

    # Total validations
    total_result = (
        db.table("validation_records")
        .select("id", count="exact")
        .eq("agent_id", agent_id)
        .execute()
    )

    # Completed validations
    completed_result = (
        db.table("validation_records")
        .select("is_valid", count="exact")
        .eq("agent_id", agent_id)
        .not_.is_("validator_address", "null")
        .execute()
    )

    successful = sum(1 for v in completed_result.data if v.get("is_valid"))
    failed = sum(1 for v in completed_result.data if v.get("is_valid") is False)
    total = total_result.count or 0
    completed = completed_result.count or 0

    return {
        "agent_id": agent_id,
        "total_requests": total,
        "completed": completed,
        "pending": total - completed,
        "successful": successful,
        "failed": failed,
        "success_rate": round((successful / completed * 100) if completed > 0 else 0, 2),
    }
