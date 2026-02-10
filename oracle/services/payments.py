"""
x402 payment logging — records verified micropayments to Supabase.
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
    facilitator_response: dict | None = None,
) -> None:
    """Log a verified x402 payment to Supabase. Non-blocking — failures are logged but don't propagate."""
    try:
        from database import get_supabase

        settings = get_settings()
        db = get_supabase()

        db.table("oracle_payments").insert({
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
            "facilitator_response": facilitator_response or {},
        }).execute()

        logger.info(
            f"x402 payment logged: {payer_address[:10]}... paid ${amount_usd} "
            f"for {http_method} {http_path}"
        )
    except Exception as e:
        logger.error(f"Failed to log x402 payment: {e}")
