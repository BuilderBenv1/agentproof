from fastapi import APIRouter, Query, HTTPException
from app.database import get_supabase
from app.models.payment import PaymentResponse, PaymentStatsResponse

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.get("/agent/{agent_id}")
async def get_agent_payments(
    agent_id: int,
    direction: str = Query("all", pattern="^(all|sent|received)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Get payment history for an agent."""
    db = get_supabase()

    if direction == "sent":
        query = db.table("payments").select("*", count="exact").eq("from_agent_id", agent_id)
    elif direction == "received":
        query = db.table("payments").select("*", count="exact").eq("to_agent_id", agent_id)
    else:
        query = (
            db.table("payments")
            .select("*", count="exact")
            .or_(f"from_agent_id.eq.{agent_id},to_agent_id.eq.{agent_id}")
        )

    query = query.order("created_at", desc=True)

    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)
    result = query.execute()

    # Calculate earnings
    all_payments = (
        db.table("payments")
        .select("from_agent_id,to_agent_id,amount,status")
        .or_(f"from_agent_id.eq.{agent_id},to_agent_id.eq.{agent_id}")
        .eq("status", "released")
        .execute()
    )

    total_earned = sum(
        float(p["amount"]) for p in all_payments.data if p["to_agent_id"] == agent_id
    )
    total_paid = sum(
        float(p["amount"]) for p in all_payments.data if p["from_agent_id"] == agent_id
    )

    return {
        "agent_id": agent_id,
        "payments": [PaymentResponse(**p) for p in result.data],
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
        "total_earned": round(total_earned, 8),
        "total_paid": round(total_paid, 8),
    }


@router.get("/{payment_id}")
async def get_payment(payment_id: int):
    """Get payment details by ID."""
    db = get_supabase()

    result = (
        db.table("payments")
        .select("*")
        .eq("payment_id", payment_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Payment not found")

    return PaymentResponse(**result.data[0])


@router.get("/stats/overview", response_model=PaymentStatsResponse)
async def get_payment_stats():
    """Get aggregate payment statistics."""
    db = get_supabase()

    payments_result = db.table("payments").select("amount,status,to_agent_id").execute()

    total_payments = len(payments_result.data)
    total_volume = sum(float(p["amount"]) for p in payments_result.data)
    average_payment = round(total_volume / total_payments, 8) if total_payments > 0 else 0

    status_counts = {"escrowed": 0, "released": 0, "refunded": 0, "cancelled": 0}
    for p in payments_result.data:
        s = p.get("status", "escrowed")
        if s in status_counts:
            status_counts[s] += 1

    # Top earners (from released payments)
    earner_totals: dict[int, float] = {}
    for p in payments_result.data:
        if p.get("status") == "released":
            aid = p["to_agent_id"]
            earner_totals[aid] = earner_totals.get(aid, 0) + float(p["amount"])

    sorted_earners = sorted(earner_totals.items(), key=lambda x: x[1], reverse=True)[:10]
    top_earners = [{"agent_id": aid, "total_earned": round(amt, 8)} for aid, amt in sorted_earners]

    return PaymentStatsResponse(
        total_payments=total_payments,
        total_volume=round(total_volume, 8),
        average_payment=average_payment,
        escrowed_count=status_counts["escrowed"],
        released_count=status_counts["released"],
        refunded_count=status_counts["refunded"],
        cancelled_count=status_counts["cancelled"],
        top_earners=top_earners,
    )
