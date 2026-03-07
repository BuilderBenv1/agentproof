"""Webhook management routes — /api/v1/webhooks/*"""

import secrets
import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, HttpUrl

from database import get_supabase
from services.webhooks import deliver_event

WEBHOOK_TIER_LIMITS = {"partner": 25, "paygo": 3, "starter": 5, "growth": 10, "scale": 25, "enterprise": 999}

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks", tags=["Webhooks"])


class WebhookCreate(BaseModel):
    subscriber_name: str
    webhook_url: HttpUrl
    events: list[str] = ["score_change", "risk_change", "uri_change", "unreachable", "tier_change"]
    agent_ids: list[int] | None = None
    min_score_delta: float = 5.0


class WebhookResponse(BaseModel):
    id: str
    subscriber_name: str
    webhook_url: str
    secret_token: str
    events: list[str]
    agent_ids: list[int] | None
    min_score_delta: float
    active: bool


@router.get("")
async def list_webhooks():
    """List all active webhook subscriptions (secrets masked)."""
    db = get_supabase()
    result = db.table("webhook_subscriptions").select("*").eq("active", True).execute()
    subs = result.data or []
    for sub in subs:
        sub["secret_token"] = sub["secret_token"][:8] + "..."
    return {"subscriptions": subs, "total": len(subs)}


@router.post("", response_model=WebhookResponse)
async def register_webhook(request: Request, body: WebhookCreate):
    """Register a new webhook subscription. Returns the secret token (show once).

    If authenticated with an API key, the webhook is linked to that key and
    subject to per-tier limits (free: 1, growth: 10, enterprise: unlimited).
    """
    db = get_supabase()

    # Enforce per-tier webhook limits when API key is present
    api_key_id = getattr(request.state, "api_key_id", None)
    tier = getattr(request.state, "tier", None)
    if api_key_id and tier:
        limit = WEBHOOK_TIER_LIMITS.get(tier, 1)
        existing = (
            db.table("webhook_subscriptions")
            .select("id", count="exact")
            .eq("api_key_id", api_key_id)
            .eq("active", True)
            .execute()
        )
        if (existing.count or 0) >= limit:
            raise HTTPException(
                status_code=403,
                detail=f"Webhook limit reached for {tier} tier ({limit}). Upgrade to add more.",
            )

    secret = secrets.token_hex(32)

    row = {
        "subscriber_name": body.subscriber_name,
        "webhook_url": str(body.webhook_url),
        "secret_token": secret,
        "events": body.events,
        "agent_ids": body.agent_ids,
        "min_score_delta": body.min_score_delta,
        "active": True,
    }
    if api_key_id:
        row["api_key_id"] = api_key_id

    try:
        result = db.table("webhook_subscriptions").insert(row).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create subscription")
        created = result.data[0]
        return WebhookResponse(
            id=created["id"],
            subscriber_name=created["subscriber_name"],
            webhook_url=created["webhook_url"],
            secret_token=secret,
            events=created["events"],
            agent_ids=created.get("agent_ids"),
            min_score_delta=float(created.get("min_score_delta", 5.0)),
            active=created["active"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook registration failed: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")


@router.get("/{webhook_id}")
async def get_webhook(webhook_id: str):
    """Get webhook subscription details (secret token masked)."""
    db = get_supabase()
    result = db.table("webhook_subscriptions").select("*").eq("id", webhook_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Webhook not found")

    sub = result.data[0]
    sub["secret_token"] = sub["secret_token"][:8] + "..."  # mask
    return sub


@router.delete("/{webhook_id}")
async def delete_webhook(webhook_id: str):
    """Deactivate a webhook subscription."""
    db = get_supabase()
    result = (
        db.table("webhook_subscriptions")
        .update({"active": False})
        .eq("id", webhook_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"status": "deactivated", "id": webhook_id}


@router.post("/test")
async def test_webhook(webhook_id: str):
    """Send a test event to a webhook subscription."""
    db = get_supabase()
    result = db.table("webhook_subscriptions").select("*").eq("id", webhook_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Webhook not found")

    sub = result.data[0]
    from services.webhooks import _deliver_to_subscriber
    _deliver_to_subscriber(
        db, sub, "test", None,
        {"message": "This is a test webhook from AgentProof Oracle"}
    )
    return {"status": "test_sent", "webhook_url": sub["webhook_url"]}
