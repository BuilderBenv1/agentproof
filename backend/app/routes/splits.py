from fastapi import APIRouter, Query, HTTPException
from app.database import get_supabase
from app.models.splits import SplitResponse, SplitPaymentResponse, SplitStatsResponse

router = APIRouter(prefix="/api/splits", tags=["splits"])


@router.get("/")
async def get_splits(
    agent_id: int = Query(None),
    active_only: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List revenue splits, optionally filtered by agent."""
    db = get_supabase()

    query = db.table("revenue_splits").select("*", count="exact")

    if agent_id:
        query = query.contains("agent_ids", [agent_id])
    if active_only:
        query = query.eq("is_active", True)

    query = query.order("created_at", desc=True)

    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)
    result = query.execute()

    return {
        "splits": [SplitResponse(**s) for s in result.data],
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{split_id}")
async def get_split(split_id: int):
    """Get split detail with participant agent profiles."""
    db = get_supabase()

    result = db.table("revenue_splits").select("*").eq("split_id", split_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Split not found")

    split = result.data[0]

    # Fetch participant agent profiles
    agent_ids = split.get("agent_ids", [])
    participants = []
    for aid in agent_ids:
        agent_result = db.table("agents").select("agent_id,name,tier,composite_score").eq("agent_id", aid).execute()
        if agent_result.data:
            participants.append(agent_result.data[0])

    return {
        "split": SplitResponse(**split),
        "participants": participants,
    }


@router.get("/{split_id}/payments")
async def get_split_payments(
    split_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Get payment history for a split."""
    db = get_supabase()

    offset = (page - 1) * page_size
    result = (
        db.table("split_payments")
        .select("*", count="exact")
        .eq("split_id", split_id)
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    return {
        "payments": [SplitPaymentResponse(**p) for p in result.data],
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/agent/{agent_id}")
async def get_agent_splits(agent_id: int):
    """Get all splits for an agent with total revenue."""
    db = get_supabase()

    splits_result = (
        db.table("revenue_splits")
        .select("*")
        .contains("agent_ids", [agent_id])
        .order("created_at", desc=True)
        .execute()
    )

    # Calculate revenue from distributed payments
    split_ids = [s["split_id"] for s in splits_result.data]
    total_revenue = 0.0

    if split_ids:
        for sid in split_ids:
            payments_result = (
                db.table("split_payments")
                .select("amount,distribution_amounts,distributed")
                .eq("split_id", sid)
                .eq("distributed", True)
                .execute()
            )

            split_data = next((s for s in splits_result.data if s["split_id"] == sid), None)
            if split_data and payments_result.data:
                agent_ids = split_data.get("agent_ids", [])
                shares = split_data.get("shares_bps", [])
                if agent_id in agent_ids:
                    idx = agent_ids.index(agent_id)
                    share_bps = shares[idx] if idx < len(shares) else 0
                    for p in payments_result.data:
                        total_revenue += float(p["amount"]) * share_bps / 10000

    return {
        "agent_id": agent_id,
        "splits": [SplitResponse(**s) for s in splits_result.data],
        "total_split_revenue": round(total_revenue, 8),
    }


@router.get("/stats/overview", response_model=SplitStatsResponse)
async def get_split_stats():
    """Get global split statistics."""
    db = get_supabase()

    splits = db.table("revenue_splits").select("is_active", count="exact").execute()
    active = db.table("revenue_splits").select("id", count="exact").eq("is_active", True).execute()
    payments = db.table("split_payments").select("amount,distributed", count="exact").execute()

    distributed_count = sum(1 for p in payments.data if p["distributed"])
    total_volume = sum(float(p["amount"]) for p in payments.data)

    return SplitStatsResponse(
        total_splits=splits.count or 0,
        active_splits=active.count or 0,
        total_payments=payments.count or 0,
        total_distributed=distributed_count,
        total_volume=round(total_volume, 8),
    )
