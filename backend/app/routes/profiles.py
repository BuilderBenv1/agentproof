from fastapi import APIRouter, Query, HTTPException
from app.database import get_supabase
from app.models.profile import ExtendedProfileResponse, ProfileUpdate, PortfolioItem, RevenueMonth

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("/{agent_id}")
async def get_profile(agent_id: int):
    """Get extended agent profile."""
    db = get_supabase()

    result = (
        db.table("agent_profiles_extended")
        .select("*")
        .eq("agent_id", agent_id)
        .execute()
    )

    if not result.data:
        # Return a default profile
        return ExtendedProfileResponse(
            id=0,
            agent_id=agent_id,
            updated_at="2024-01-01T00:00:00Z",
        )

    return ExtendedProfileResponse(**result.data[0])


@router.put("/{agent_id}")
async def update_profile(agent_id: int, update: ProfileUpdate):
    """Update extended profile for an agent."""
    db = get_supabase()

    data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Try update first
    result = (
        db.table("agent_profiles_extended")
        .update(data)
        .eq("agent_id", agent_id)
        .execute()
    )

    if not result.data:
        # Insert if not exists
        data["agent_id"] = agent_id
        result = db.table("agent_profiles_extended").insert(data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update profile")

    return ExtendedProfileResponse(**result.data[0])


@router.get("/{agent_id}/portfolio")
async def get_portfolio(
    agent_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Get task history with reviews for an agent."""
    db = get_supabase()

    offset = (page - 1) * page_size
    tasks_result = (
        db.table("marketplace_tasks")
        .select("*", count="exact")
        .eq("agent_id", agent_id)
        .eq("status", "completed")
        .order("completed_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    portfolio = []
    for t in tasks_result.data:
        review_result = (
            db.table("marketplace_reviews")
            .select("rating,review_text")
            .eq("task_id", t["task_id"])
            .limit(1)
            .execute()
        )
        review = review_result.data[0] if review_result.data else {}

        portfolio.append(PortfolioItem(
            task_id=t["task_id"],
            title=t["title"],
            status=t["status"],
            price_avax=float(t["price_avax"]),
            completed_at=t.get("completed_at"),
            rating=review.get("rating"),
            review_text=review.get("review_text"),
        ))

    return {
        "agent_id": agent_id,
        "portfolio": portfolio,
        "total": tasks_result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{agent_id}/revenue")
async def get_revenue(agent_id: int):
    """Get revenue breakdown by month."""
    db = get_supabase()

    tasks_result = (
        db.table("marketplace_tasks")
        .select("price_avax,completed_at")
        .eq("agent_id", agent_id)
        .eq("status", "completed")
        .order("completed_at")
        .execute()
    )

    monthly: dict[str, RevenueMonth] = {}
    for t in tasks_result.data:
        if t.get("completed_at"):
            month = t["completed_at"][:7]  # YYYY-MM
            if month not in monthly:
                monthly[month] = RevenueMonth(month=month)
            monthly[month].earned += float(t["price_avax"])
            monthly[month].tasks_completed += 1

    # Round earnings
    for m in monthly.values():
        m.earned = round(m.earned, 8)

    return {
        "agent_id": agent_id,
        "months": list(monthly.values()),
        "total_earned": round(sum(m.earned for m in monthly.values()), 8),
        "total_tasks": sum(m.tasks_completed for m in monthly.values()),
    }
