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


# ─── Stats (defined first to avoid any path-parameter shadowing) ─────

@router.get("/stats")
async def get_marketplace_stats():
    """Get marketplace overview statistics."""
    db = get_supabase()

    try:
        listings = db.table("marketplace_listings").select("is_active", count="exact").execute()
        active = db.table("marketplace_listings").select("id", count="exact").eq("is_active", True).execute()
        tasks = db.table("marketplace_tasks").select("status,price_avax", count="exact").execute()

        completed = [t for t in tasks.data if t["status"] == "completed"]
        total_volume = sum(float(t.get("price_avax") or 0) for t in completed)
        avg_price = round(total_volume / len(completed), 8) if completed else 0

        return MarketplaceStatsResponse(
            total_listings=listings.count or 0,
            active_listings=active.count or 0,
            total_tasks=tasks.count or 0,
            completed_tasks=len(completed),
            total_volume_avax=round(total_volume, 8),
            average_task_price=avg_price,
        )
    except Exception:
        return MarketplaceStatsResponse()


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


# ─── Admin: Replace seed data with real agents ─────────────

REAL_AGENT_LISTINGS = [
    {
        "title": "Grid Trading Bot",
        "description": "Automated range-bound grid trading on Trader Joe DEX. Sets buy/sell orders across a price range and profits from oscillation. Verified on-chain execution with real AVAX↔USDC swaps.",
        "skills": ["trading", "defi", "grid", "automated", "trader-joe"],
        "price_avax": 0.5,
        "price_type": "subscription",
        "avg_completion_time_hours": 0,
        "max_concurrent_tasks": 10,
    },
    {
        "title": "Yield Oracle",
        "description": "Scans 64+ DeFi pools across Benqi, Aave, and YieldYak on Avalanche. Ranks opportunities by risk-adjusted APY with Sharpe ratio analysis. Best picks updated every 30 minutes.",
        "skills": ["defi", "yield", "farming", "analytics", "risk-analysis"],
        "price_avax": 0.02,
        "price_type": "per_query",
        "avg_completion_time_hours": 1,
        "max_concurrent_tasks": 50,
    },
    {
        "title": "Rug Auditor",
        "description": "Scans smart contracts for honeypots, ownership risks, unlimited mint functions, and rug patterns. On-chain verified accuracy tracked by AgentProof Oracle.",
        "skills": ["security", "audit", "smart-contracts", "rug-detection"],
        "price_avax": 0.01,
        "price_type": "per_query",
        "avg_completion_time_hours": 1,
        "max_concurrent_tasks": 20,
    },
    {
        "title": "Whale Tracker",
        "description": "Monitors 20 top Avalanche wallets (Binance, Aave, GMX, Trader Joe) for significant moves. AI-powered analysis of market impact and trading patterns.",
        "skills": ["analytics", "whale-tracking", "market-intelligence", "alerts"],
        "price_avax": 0.05,
        "price_type": "subscription",
        "avg_completion_time_hours": 0,
        "max_concurrent_tasks": 100,
    },
    {
        "title": "Narrative Tracker",
        "description": "Tracks 57+ crypto narratives across 11 data sources. Detects emerging trends, sentiment shifts, and viral tokens before they pump. Updated every 10 minutes.",
        "skills": ["analytics", "sentiment", "social", "trend-detection"],
        "price_avax": 0.03,
        "price_type": "subscription",
        "avg_completion_time_hours": 0,
        "max_concurrent_tasks": 100,
    },
    {
        "title": "Liquidation Sentinel",
        "description": "Monitors lending positions on Benqi and Aave for liquidation risk. Predicts at-risk positions using health factor analysis and price volatility models.",
        "skills": ["defi", "lending", "risk", "liquidation", "monitoring"],
        "price_avax": 0.05,
        "price_type": "subscription",
        "avg_completion_time_hours": 0,
        "max_concurrent_tasks": 50,
    },
    {
        "title": "Convergence Detector",
        "description": "Cross-references signals from all intelligence agents to detect multi-agent convergence on tokens. When whale + narrative + tipster agree, confidence is highest.",
        "skills": ["analytics", "convergence", "multi-agent", "signal-fusion"],
        "price_avax": 0.1,
        "price_type": "per_query",
        "avg_completion_time_hours": 1,
        "max_concurrent_tasks": 20,
    },
    {
        "title": "Tipster Signal Tracker",
        "description": "Monitors Telegram trading channels for buy/sell signals. Tracks signal accuracy over time and ranks channels by historical performance.",
        "skills": ["trading", "signals", "telegram", "accuracy-tracking"],
        "price_avax": 0.02,
        "price_type": "subscription",
        "avg_completion_time_hours": 0,
        "max_concurrent_tasks": 50,
    },
    {
        "title": "DCA Bot",
        "description": "Dollar-cost averaging into any Avalanche token via Trader Joe. Supports daily/weekly schedules, dip detection for 2x buys, and automatic take-profit.",
        "skills": ["trading", "dca", "automated", "accumulation"],
        "price_avax": 0.3,
        "price_type": "subscription",
        "avg_completion_time_hours": 0,
        "max_concurrent_tasks": 10,
    },
    {
        "title": "SOS Emergency Bot",
        "description": "Monitors your portfolio for crash conditions. Auto-exits to USDC if AVAX drops >15% in 1 hour, protocol TVL collapses, or health factor hits critical.",
        "skills": ["security", "emergency", "portfolio-protection", "crash-detection"],
        "price_avax": 0.2,
        "price_type": "subscription",
        "avg_completion_time_hours": 0,
        "max_concurrent_tasks": 20,
    },
    {
        "title": "Sniper Bot",
        "description": "Monitors Trader Joe Factory for new token launches. Checks contract safety via Rug Auditor, validates liquidity, and executes fast buys with configurable take-profit and stop-loss.",
        "skills": ["trading", "sniper", "new-launches", "automated"],
        "price_avax": 0.5,
        "price_type": "subscription",
        "avg_completion_time_hours": 0,
        "max_concurrent_tasks": 5,
    },
]


@router.post("/admin/reseed")
async def reseed_with_real_agents():
    """Replace seed marketplace data with real AgentProof agent listings."""
    db = get_supabase()

    # Deactivate all existing listings
    db.table("marketplace_listings").update({"is_active": False}).eq("is_active", True).execute()

    # Pick 11 top-ranked agents from the Oracle registry
    agents_result = (
        db.table("agents")
        .select("agent_id, name, tier, composite_score")
        .order("composite_score", desc=True)
        .limit(11)
        .execute()
    )

    if len(agents_result.data) < 11:
        raise HTTPException(status_code=500, detail=f"Only found {len(agents_result.data)} agents")

    created = []
    for i, listing_data in enumerate(REAL_AGENT_LISTINGS):
        agent = agents_result.data[i]

        row = {
            "agent_id": agent["agent_id"],
            "title": listing_data["title"],
            "description": listing_data["description"],
            "skills": listing_data["skills"],
            "price_avax": listing_data["price_avax"],
            "price_type": listing_data["price_type"],
            "min_tier": "unranked",
            "is_active": True,
            "max_concurrent_tasks": listing_data["max_concurrent_tasks"],
            "avg_completion_time_hours": listing_data["avg_completion_time_hours"],
        }

        result = db.table("marketplace_listings").insert(row).execute()
        if result.data:
            created.append({
                "listing_id": result.data[0]["id"],
                "title": listing_data["title"],
                "agent_id": agent["agent_id"],
                "agent_name": agent["name"],
            })

    return {
        "status": "reseeded",
        "deactivated_seed_data": True,
        "created_listings": len(created),
        "listings": created,
    }


