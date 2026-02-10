"""
Payment logging — records x402 micropayments to Supabase.
"""

import logging
from datetime import datetime, timezone

from config import get_settings

logger = logging.getLogger(__name__)


def log_payment(
    payer_address: str,
    amount_usd: float,
    network: str,
    http_method: str,
    http_path: str,
    tx_hash: str | None = None,
    agent_id_queried: int | None = None,
) -> None:
    """Log a verified x402 payment. Non-blocking — failures don't propagate."""
    try:
        from database import get_supabase

        settings = get_settings()
        db = get_supabase()

        db.table("payments").insert({
            "tx_hash": tx_hash,
            "network": network,
            "payer_address": payer_address,
            "amount_usd": amount_usd,
            "endpoint": f"{http_method} {http_path}",
            "http_method": http_method,
            "http_path": http_path,
            "agent_id_queried": agent_id_queried,
            "oracle_address": settings.x402_pay_to,
            "paid_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

        logger.info(
            f"Payment: {payer_address[:10]}... ${amount_usd} for {http_method} {http_path}"
        )
    except Exception as e:
        logger.error(f"Payment logging failed: {e}")


def get_payment_stats() -> dict:
    """Get aggregate payment statistics."""
    try:
        from database import get_supabase
        db = get_supabase()

        total_result = db.table("payments").select("id", count="exact").execute()
        total = total_result.count or 0

        # Revenue (sum amount_usd) — fetch all and sum in Python
        # since Supabase REST doesn't support SUM
        revenue = 0.0
        offset = 0
        while True:
            batch = (
                db.table("payments")
                .select("amount_usd")
                .range(offset, offset + 999)
                .execute()
            )
            if not batch.data:
                break
            revenue += sum(float(r["amount_usd"]) for r in batch.data)
            if len(batch.data) < 1000:
                break
            offset += 1000

        # Unique payers
        payers: set[str] = set()
        offset = 0
        while True:
            batch = (
                db.table("payments")
                .select("payer_address")
                .range(offset, offset + 999)
                .execute()
            )
            if not batch.data:
                break
            payers.update(r["payer_address"] for r in batch.data)
            if len(batch.data) < 1000:
                break
            offset += 1000

        return {
            "total_payments": total,
            "total_revenue_usd": round(revenue, 4),
            "unique_payers": len(payers),
        }
    except Exception as e:
        logger.error(f"Payment stats failed: {e}")
        return {"total_payments": 0, "total_revenue_usd": 0.0, "unique_payers": 0}
