"""
Protocol integration management routes.

Self-serve API key registration, usage dashboard, tier upgrades.
"""

import hashlib
import secrets
import logging
import threading
import time

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])
logger = logging.getLogger(__name__)

# Simple in-memory rate limiter for registration endpoint
_register_attempts: dict[str, list[float]] = {}
_register_lock = threading.Lock()
_REGISTER_LIMIT = 5  # max registrations per IP per hour
_REGISTER_WINDOW = 3600  # 1 hour


def _check_register_rate_limit(client_ip: str) -> bool:
    """Returns True if the request should be allowed."""
    now = time.monotonic()
    with _register_lock:
        attempts = _register_attempts.get(client_ip, [])
        # Prune old attempts
        attempts = [t for t in attempts if now - t < _REGISTER_WINDOW]
        if len(attempts) >= _REGISTER_LIMIT:
            _register_attempts[client_ip] = attempts
            return False
        attempts.append(now)
        _register_attempts[client_ip] = attempts
        # Evict stale IPs periodically
        if len(_register_attempts) > 500:
            cutoff = now - _REGISTER_WINDOW
            stale = [ip for ip, times in _register_attempts.items()
                     if not any(t >= cutoff for t in times)]
            for ip in stale:
                del _register_attempts[ip]
        return True


class RegisterRequest(BaseModel):
    protocol_name: str
    contact_email: str


class RegisterResponse(BaseModel):
    api_key: str
    key_id: str
    tier: str
    monthly_limit: int
    price_per_call: str
    message: str


class UpgradeRequest(BaseModel):
    tier: str  # paygo, starter, growth, scale, enterprise
    billing_email: str | None = None


# Tier definitions: monthly_limit, price_cents_per_month, price_per_call
TIERS = {
    "paygo":      {"monthly_limit": 999_999_999, "price_cents": 0,       "per_call": "$0.05"},
    "starter":    {"monthly_limit": 10_000,      "price_cents": 25_000,  "per_call": "$0.025"},
    "growth":     {"monthly_limit": 25_000,      "price_cents": 50_000,  "per_call": "$0.02"},
    "scale":      {"monthly_limit": 75_000,      "price_cents": 100_000, "per_call": "$0.013"},
    "enterprise": {"monthly_limit": 200_000,     "price_cents": 200_000, "per_call": "$0.01"},
}


def _require_api_key(request: Request) -> str:
    """Extract and validate the api_key_id from request state."""
    api_key_id = getattr(request.state, "api_key_id", None)
    if not api_key_id:
        raise HTTPException(status_code=401, detail="API key required. Pass X-Api-Key header.")
    return api_key_id


@router.post("/register", response_model=RegisterResponse)
async def register_api_key(request: Request, body: RegisterRequest):
    """Register a new API key for protocol integration.

    Returns the API key ONCE. Store it securely — it cannot be retrieved later.
    """
    # Rate limit: 5 registrations per IP per hour
    client_ip = request.client.host if request.client else "unknown"
    if not _check_register_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many registration attempts. Try again later.",
        )

    from database import get_supabase
    db = get_supabase()

    # Generate key: ap_live_ + 32 hex chars
    raw_key = "ap_live_" + secrets.token_hex(16)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:16]

    try:
        result = db.table("api_keys").insert({
            "key_hash": key_hash,
            "key_prefix": key_prefix,
            "protocol_name": body.protocol_name[:200],
            "contact_email": body.contact_email[:200],
            "tier": "paygo",
            "monthly_limit": 999_999_999,
        }).execute()

        key_id = result.data[0]["id"] if result.data else "unknown"

        return RegisterResponse(
            api_key=raw_key,
            key_id=key_id,
            tier="paygo",
            monthly_limit=999_999_999,
            price_per_call="$0.05",
            message="Store this API key securely. It will not be shown again. You are on pay-per-call pricing ($0.05/call).",
        )
    except Exception as e:
        logger.error("Failed to register API key: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create API key")


@router.get("/usage")
async def get_usage(request: Request):
    """Get usage statistics for the authenticated API key."""
    api_key_id = _require_api_key(request)

    from database import get_supabase
    from services.usage import get_usage_tracker

    db = get_supabase()
    tracker = get_usage_tracker()

    today_count = tracker.get_daily_count(api_key_id)
    monthly_count = tracker.get_monthly_count(api_key_id)
    monthly_overage = tracker.get_monthly_overage(api_key_id)

    # Get key info
    key_result = db.table("api_keys").select(
        "protocol_name, tier, monthly_limit, created_at"
    ).eq("id", api_key_id).limit(1).execute()

    key_info = key_result.data[0] if key_result.data else {}
    tier = key_info.get("tier", "paygo")
    tier_info = TIERS.get(tier, TIERS["paygo"])

    # Last 30 days from DB
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    history_result = (
        db.table("api_usage_daily")
        .select("usage_date, request_count, endpoints_hit")
        .eq("api_key_id", api_key_id)
        .gte("usage_date", cutoff)
        .order("usage_date", desc=True)
        .execute()
    )

    return {
        "protocol_name": key_info.get("protocol_name"),
        "tier": tier,
        "pricing": {
            "per_call": tier_info["per_call"],
            "monthly_price_cents": tier_info["price_cents"],
            "monthly_limit": tier_info["monthly_limit"],
        },
        "usage": {
            "today": today_count,
            "this_month": monthly_count,
            "monthly_limit": tier_info["monthly_limit"],
            "overage_calls": monthly_overage,
            "overage_cost": f"${monthly_overage * 0.05:.2f}" if monthly_overage > 0 else "$0.00",
        },
        "last_30_days": history_result.data or [],
        "created_at": key_info.get("created_at"),
    }


@router.post("/upgrade")
async def upgrade_tier(request: Request, body: UpgradeRequest):
    """Upgrade API key to a subscription tier.

    For MVP: flips the tier in DB and creates a subscription record.
    Billing is handled manually (no Stripe integration yet).
    """
    api_key_id = _require_api_key(request)

    if body.tier not in TIERS:
        raise HTTPException(
            status_code=400,
            detail=f"Tier must be one of: {', '.join(TIERS.keys())}",
        )

    from database import get_supabase
    db = get_supabase()

    tier_info = TIERS[body.tier]

    try:
        # Update the key's tier and limit
        db.table("api_keys").update({
            "tier": body.tier,
            "monthly_limit": tier_info["monthly_limit"],
        }).eq("id", api_key_id).execute()

        # Create subscription record (for paid tiers)
        if tier_info["price_cents"] > 0:
            db.table("subscriptions").insert({
                "api_key_id": api_key_id,
                "tier": body.tier,
                "price_cents": tier_info["price_cents"],
                "billing_email": body.billing_email,
            }).execute()

        return {
            "tier": body.tier,
            "monthly_limit": tier_info["monthly_limit"],
            "per_call": tier_info["per_call"],
            "message": f"Upgraded to {body.tier} ({tier_info['per_call']}/call). Invoice will be sent to {body.billing_email or 'your contact email'}.",
        }
    except Exception as e:
        logger.error("Failed to upgrade tier: %s", e)
        raise HTTPException(status_code=500, detail="Failed to upgrade tier")


@router.post("/rotate")
async def rotate_api_key(request: Request):
    """Rotate the authenticated API key. Deactivates the old key and returns a new one."""
    api_key_id = _require_api_key(request)

    from database import get_supabase
    db = get_supabase()

    try:
        # Get current key info
        current = db.table("api_keys").select(
            "protocol_name, contact_email, tier, monthly_limit, metadata"
        ).eq("id", api_key_id).limit(1).execute()

        if not current.data:
            raise HTTPException(status_code=404, detail="API key not found")

        info = current.data[0]

        # Deactivate old key
        db.table("api_keys").update({"is_active": False}).eq("id", api_key_id).execute()

        # Generate new key
        raw_key = "ap_live_" + secrets.token_hex(16)
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        key_prefix = raw_key[:16]

        result = db.table("api_keys").insert({
            "key_hash": key_hash,
            "key_prefix": key_prefix,
            "protocol_name": info["protocol_name"],
            "contact_email": info.get("contact_email", ""),
            "tier": info["tier"],
            "monthly_limit": info["monthly_limit"],
            "is_active": True,
            "metadata": info.get("metadata") or {},
        }).execute()

        new_key_id = result.data[0]["id"] if result.data else "unknown"

        return {
            "api_key": raw_key,
            "key_id": new_key_id,
            "tier": info["tier"],
            "message": "API key rotated. The old key has been deactivated. Store this new key securely.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to rotate API key: %s", e)
        raise HTTPException(status_code=500, detail="Failed to rotate key")


@router.delete("/key")
async def delete_api_key(request: Request):
    """Deactivate the authenticated API key (soft delete)."""
    api_key_id = _require_api_key(request)

    from database import get_supabase
    db = get_supabase()

    try:
        db.table("api_keys").update({"is_active": False}).eq("id", api_key_id).execute()
        return {"message": "API key deactivated"}
    except Exception as e:
        logger.error("Failed to deactivate API key: %s", e)
        raise HTTPException(status_code=500, detail="Failed to deactivate key")
