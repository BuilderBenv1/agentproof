"""
Webhook delivery service — HMAC-SHA256 signed HTTP POST to subscribers.

Events: score_change, risk_change, uri_change, unreachable, screening
"""

import hashlib
import hmac
import json
import logging
import time

import httpx

from database import get_supabase

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_DELAYS = [1, 5, 15]  # seconds
DELIVERY_TIMEOUT = 10


def _sign_payload(payload: bytes, secret: str) -> str:
    """HMAC-SHA256 signature for webhook payload."""
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def deliver_event(
    event_type: str,
    agent_id: int | None,
    payload: dict,
):
    """Find matching webhook subscriptions and deliver the event."""
    db = get_supabase()

    # Fetch active subscriptions matching this event type
    query = (
        db.table("webhook_subscriptions")
        .select("*")
        .eq("active", True)
        .contains("events", [event_type])
    )
    result = query.execute()
    if not result.data:
        return

    for sub in result.data:
        # Check agent filter
        sub_agent_ids = sub.get("agent_ids")
        if sub_agent_ids and agent_id not in sub_agent_ids:
            continue

        # Check min score delta for score_change events
        if event_type == "score_change":
            delta = abs(payload.get("delta", 0))
            min_delta = float(sub.get("min_score_delta", 5.0))
            if delta < min_delta:
                continue

        _deliver_to_subscriber(db, sub, event_type, agent_id, payload)


def _deliver_to_subscriber(
    db, sub: dict, event_type: str, agent_id: int | None, payload: dict
):
    """POST signed payload to a single subscriber with retries."""
    webhook_url = sub["webhook_url"]
    secret = sub["secret_token"]
    sub_id = sub["id"]

    envelope = {
        "event": event_type,
        "agent_id": agent_id,
        "timestamp": time.time(),
        "payload": payload,
    }
    body = json.dumps(envelope, default=str).encode()
    signature = _sign_payload(body, secret)

    headers = {
        "Content-Type": "application/json",
        "X-AgentProof-Signature": f"sha256={signature}",
        "X-AgentProof-Event": event_type,
        "User-Agent": "AgentProof-Oracle/1.0",
    }

    # Create delivery record
    delivery = {
        "subscription_id": sub_id,
        "event_type": event_type,
        "agent_id": agent_id,
        "payload": envelope,
        "status": "pending",
        "attempt_count": 0,
    }
    try:
        ins = db.table("webhook_deliveries").insert(delivery).execute()
        delivery_id = ins.data[0]["id"] if ins.data else None
    except Exception as e:
        logger.error(f"Failed to create delivery record: {e}")
        delivery_id = None

    # Attempt delivery with retries
    http_status = None
    success = False

    with httpx.Client(timeout=DELIVERY_TIMEOUT) as client:
        for attempt in range(MAX_RETRIES):
            try:
                resp = client.post(webhook_url, content=body, headers=headers)
                http_status = resp.status_code
                if 200 <= http_status < 300:
                    success = True
                    break
                logger.warning(
                    f"Webhook {sub_id} attempt {attempt + 1}: HTTP {http_status}"
                )
            except (httpx.RequestError, httpx.TimeoutException) as e:
                logger.warning(
                    f"Webhook {sub_id} attempt {attempt + 1}: {e}"
                )

            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAYS[attempt])

    # Update delivery record
    if delivery_id:
        try:
            db.table("webhook_deliveries").update({
                "status": "delivered" if success else "failed",
                "http_status": http_status,
                "attempt_count": attempt + 1,
            }).eq("id", delivery_id).execute()
        except Exception:
            pass

    # Update subscription stats
    try:
        update_data = {"last_fired_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        if success:
            db.table("webhook_subscriptions").update({
                **update_data,
                "total_deliveries": sub.get("total_deliveries", 0) + 1,
            }).eq("id", sub_id).execute()
        else:
            db.table("webhook_subscriptions").update({
                **update_data,
                "failed_deliveries": sub.get("failed_deliveries", 0) + 1,
            }).eq("id", sub_id).execute()
    except Exception:
        pass

    if success:
        logger.info(f"Webhook delivered to {sub.get('subscriber_name', sub_id)}")
    else:
        logger.error(f"Webhook delivery failed for {sub.get('subscriber_name', sub_id)} after {MAX_RETRIES} attempts")
