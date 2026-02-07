from fastapi import APIRouter, Query, HTTPException
from app.database import get_supabase
from app.models.insurance import InsuranceStakeResponse, InsuranceClaimResponse, InsuranceStatsResponse

router = APIRouter(prefix="/api/insurance", tags=["insurance"])


@router.get("/agent/{agent_id}")
async def get_agent_insurance(agent_id: int):
    """Get insurance stake status and claims history for an agent."""
    db = get_supabase()

    # Get stake
    stake_result = (
        db.table("insurance_stakes")
        .select("*")
        .eq("agent_id", agent_id)
        .eq("is_active", True)
        .execute()
    )

    stake = None
    if stake_result.data:
        stake = InsuranceStakeResponse(**stake_result.data[0])

    # Get claims
    claims_result = (
        db.table("insurance_claims")
        .select("*")
        .eq("agent_id", agent_id)
        .order("filed_at", desc=True)
        .execute()
    )

    claims = [InsuranceClaimResponse(**c) for c in claims_result.data]

    return {
        "agent_id": agent_id,
        "is_insured": stake is not None,
        "stake": stake,
        "claims": claims,
        "total_claims": len(claims),
    }


@router.get("/claims")
async def list_claims(
    status: str | None = None,
    agent_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List all insurance claims with optional filtering."""
    db = get_supabase()

    query = db.table("insurance_claims").select("*", count="exact")

    if status:
        query = query.eq("status", status)
    if agent_id:
        query = query.eq("agent_id", agent_id)

    query = query.order("filed_at", desc=True)

    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)

    result = query.execute()

    return {
        "claims": [InsuranceClaimResponse(**c) for c in result.data],
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/stats", response_model=InsuranceStatsResponse)
async def get_insurance_stats():
    """Get aggregate insurance statistics."""
    db = get_supabase()

    # Active stakes
    stakes_result = (
        db.table("insurance_stakes")
        .select("stake_amount")
        .eq("is_active", True)
        .execute()
    )
    total_staked_agents = len(stakes_result.data)
    total_staked_amount = sum(float(s["stake_amount"]) for s in stakes_result.data)

    # Claims breakdown
    claims_result = db.table("insurance_claims").select("status").execute()
    total_claims = len(claims_result.data)

    status_counts = {"pending": 0, "disputed": 0, "approved": 0, "rejected": 0}
    for claim in claims_result.data:
        s = claim.get("status", "pending")
        if s in status_counts:
            status_counts[s] += 1

    resolved = status_counts["approved"] + status_counts["rejected"]
    resolution_rate = round((resolved / total_claims) * 100, 2) if total_claims > 0 else 0

    return InsuranceStatsResponse(
        total_staked_agents=total_staked_agents,
        total_staked_amount=round(total_staked_amount, 8),
        total_claims=total_claims,
        pending_claims=status_counts["pending"] + status_counts["disputed"],
        approved_claims=status_counts["approved"],
        rejected_claims=status_counts["rejected"],
        resolution_rate=resolution_rate,
    )
