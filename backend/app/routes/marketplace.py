from fastapi import APIRouter, Query, HTTPException
from app.database import get_supabase
from app.models.marketplace import (
    ListingResponse,
    ListingCreate,
    ListingUpdate,
    TaskResponse,
    TaskCreate,
    ReviewResponse,
    ReviewCreate,
    MarketplaceStatsResponse,
)
from app.services.audit import log_audit_event

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])


# ─── Listings ────────────────────────────────────────────

@router.get("/listings")
async def get_listings(
    skill: str = Query(None),
    min_tier: str = Query(None),
    max_price: float = Query(None),
    sort: str = Query("created_at", pattern="^(created_at|price_avax|title)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(None),
):
    """Search and filter marketplace listings."""
    db = get_supabase()

    query = db.table("marketplace_listings").select("*", count="exact").eq("is_active", True)

    if skill:
        query = query.contains("skills", [skill])
    if max_price is not None:
        query = query.lte("price_avax", max_price)
    if min_tier:
        query = query.eq("min_tier", min_tier)
    if search:
        query = query.ilike("title", f"%{search}%")

    query = query.order(sort, desc=(sort == "created_at"))

    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)
    result = query.execute()

    return {
        "listings": [ListingResponse(**l) for l in result.data],
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/listings/{listing_id}")
async def get_listing(listing_id: int):
    """Get full listing details with agent profile."""
    db = get_supabase()

    result = db.table("marketplace_listings").select("*").eq("id", listing_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Listing not found")

    listing = result.data[0]

    # Fetch agent profile
    agent_result = db.table("agents").select("*").eq("agent_id", listing["agent_id"]).execute()
    agent = agent_result.data[0] if agent_result.data else None

    return {
        "listing": ListingResponse(**listing),
        "agent": agent,
    }


@router.post("/listings")
async def create_listing(listing: ListingCreate):
    """Create a new marketplace listing."""
    db = get_supabase()

    data = listing.model_dump()
    data["skills"] = listing.skills
    result = db.table("marketplace_listings").insert(data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create listing")

    await log_audit_event(
        agent_id=listing.agent_id,
        action="listing_created",
        actor_address="api",
        details={"listing_id": result.data[0]["id"], "title": listing.title},
    )

    return ListingResponse(**result.data[0])


@router.put("/listings/{listing_id}")
async def update_listing(listing_id: int, update: ListingUpdate):
    """Update a listing."""
    db = get_supabase()

    data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        db.table("marketplace_listings")
        .update(data)
        .eq("id", listing_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Listing not found")

    return ListingResponse(**result.data[0])


@router.delete("/listings/{listing_id}")
async def deactivate_listing(listing_id: int):
    """Deactivate a listing."""
    db = get_supabase()

    result = (
        db.table("marketplace_listings")
        .update({"is_active": False})
        .eq("id", listing_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Listing not found")

    return {"status": "deactivated", "listing_id": listing_id}


# ─── Tasks ───────────────────────────────────────────────

@router.post("/tasks")
async def create_task(task: TaskCreate):
    """Create a marketplace task (hire agent)."""
    db = get_supabase()

    data = task.model_dump()
    if task.deadline:
        data["deadline"] = task.deadline.isoformat()

    result = db.table("marketplace_tasks").insert(data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create task")

    await log_audit_event(
        agent_id=task.agent_id,
        action="task_created",
        actor_address=task.client_address,
        details={"task_id": result.data[0]["task_id"], "title": task.title},
    )

    return TaskResponse(**result.data[0])


@router.get("/tasks")
async def get_tasks(
    agent_id: int = Query(None),
    client_address: str = Query(None),
    status: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List tasks with optional filters."""
    db = get_supabase()

    query = db.table("marketplace_tasks").select("*", count="exact")

    if agent_id:
        query = query.eq("agent_id", agent_id)
    if client_address:
        query = query.eq("client_address", client_address)
    if status:
        query = query.eq("status", status)

    query = query.order("created_at", desc=True)

    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)
    result = query.execute()

    return {
        "tasks": [TaskResponse(**t) for t in result.data],
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    """Get task details."""
    db = get_supabase()

    result = db.table("marketplace_tasks").select("*").eq("task_id", task_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")

    # Get reviews
    reviews_result = db.table("marketplace_reviews").select("*").eq("task_id", task_id).execute()

    # Get task events
    events_result = (
        db.table("task_events")
        .select("*")
        .eq("task_id", task_id)
        .order("created_at")
        .execute()
    )

    return {
        "task": TaskResponse(**result.data[0]),
        "reviews": [ReviewResponse(**r) for r in reviews_result.data],
        "events": events_result.data,
    }


@router.put("/tasks/{task_id}/accept")
async def accept_task(task_id: str):
    """Agent accepts a task."""
    db = get_supabase()

    result = (
        db.table("marketplace_tasks")
        .update({"status": "accepted", "accepted_at": "now()"})
        .eq("task_id", task_id)
        .eq("status", "pending")
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found or not pending")

    task = result.data[0]
    await log_audit_event(
        agent_id=task["agent_id"],
        action="task_accepted",
        actor_address="agent",
        details={"task_id": task_id},
    )

    return TaskResponse(**task)


@router.put("/tasks/{task_id}/complete")
async def complete_task(task_id: str, deliverables_uri: str = Query(None)):
    """Agent marks task as completed."""
    db = get_supabase()

    update_data = {"status": "completed", "completed_at": "now()"}
    if deliverables_uri:
        update_data["deliverables_uri"] = deliverables_uri

    result = (
        db.table("marketplace_tasks")
        .update(update_data)
        .eq("task_id", task_id)
        .in_("status", ["accepted", "in_progress"])
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found or invalid status")

    task = result.data[0]
    await log_audit_event(
        agent_id=task["agent_id"],
        action="task_completed",
        actor_address="agent",
        details={"task_id": task_id},
    )

    return TaskResponse(**task)


@router.put("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    """Cancel a task."""
    db = get_supabase()

    result = (
        db.table("marketplace_tasks")
        .update({"status": "cancelled"})
        .eq("task_id", task_id)
        .in_("status", ["pending", "accepted"])
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found or cannot cancel")

    return {"status": "cancelled", "task_id": task_id}


# ─── Reviews ─────────────────────────────────────────────

@router.post("/tasks/{task_id}/review")
async def submit_review(task_id: str, review: ReviewCreate):
    """Submit a review for a completed task."""
    db = get_supabase()

    # Verify task exists and is completed
    task_result = db.table("marketplace_tasks").select("*").eq("task_id", task_id).execute()
    if not task_result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    task = task_result.data[0]
    if task["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only review completed tasks")

    data = review.model_dump()
    data["task_id"] = task_id
    data["agent_id"] = task["agent_id"]

    result = db.table("marketplace_reviews").insert(data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to submit review")

    return ReviewResponse(**result.data[0])


# ─── Stats ───────────────────────────────────────────────

@router.get("/stats", response_model=MarketplaceStatsResponse)
async def get_marketplace_stats():
    """Get marketplace overview statistics."""
    db = get_supabase()

    listings = db.table("marketplace_listings").select("is_active", count="exact").execute()
    active = db.table("marketplace_listings").select("id", count="exact").eq("is_active", True).execute()
    tasks = db.table("marketplace_tasks").select("status,price_avax", count="exact").execute()

    completed = [t for t in tasks.data if t["status"] == "completed"]
    total_volume = sum(float(t["price_avax"]) for t in completed)
    avg_price = round(total_volume / len(completed), 8) if completed else 0

    return MarketplaceStatsResponse(
        total_listings=listings.count or 0,
        active_listings=active.count or 0,
        total_tasks=tasks.count or 0,
        completed_tasks=len(completed),
        total_volume_avax=round(total_volume, 8),
        average_task_price=avg_price,
    )
