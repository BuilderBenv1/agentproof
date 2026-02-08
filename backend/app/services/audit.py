import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


async def log_audit_event(
    agent_id: int,
    action: str,
    actor_address: str,
    details: Optional[dict] = None,
    tx_hash: Optional[str] = None,
    block_number: Optional[int] = None,
    source: str = "api",
) -> None:
    """Append an audit log entry. Called from routes and indexer."""
    try:
        from app.database import get_supabase

        db = get_supabase()
        db.table("audit_logs").insert({
            "agent_id": agent_id,
            "action": action,
            "actor_address": actor_address,
            "details": details or {},
            "tx_hash": tx_hash,
            "block_number": block_number,
            "source": source,
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to log audit event: {e}")


async def log_task_event(
    task_id: str,
    event_type: str,
    actor_address: str,
    details: Optional[dict] = None,
) -> None:
    """Append a task event entry."""
    try:
        from app.database import get_supabase

        db = get_supabase()
        db.table("task_events").insert({
            "task_id": task_id,
            "event_type": event_type,
            "actor_address": actor_address,
            "details": details or {},
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to log task event: {e}")
