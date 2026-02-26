"""
API key authentication and rate limiting middleware.

Flow:
1. Check X-Api-Key header (or ?api_key query param)
2. If no key: pass through as anonymous (backwards compatible)
3. If key present: validate, check daily limit, attach metadata to request.state
4. Increment in-memory usage counter

Key format: "ap_live_" + 32 hex chars
Stored as SHA-256 hash in api_keys table.
"""

import hashlib
import logging
import threading
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Monthly call limits per tier (tracked via rolling 30-day window)
TIER_MONTHLY_LIMITS = {
    "paygo": 999_999_999,   # unlimited, billed per call at $0.05
    "starter": 10_000,      # $250/mo
    "growth": 25_000,       # $500/mo
    "scale": 75_000,        # $1,000/mo
    "enterprise": 200_000,  # $2,000/mo
}

# In-memory cache for validated keys (avoids DB lookup on every request)
_key_cache: dict[str, tuple[float, dict]] = {}  # hash → (expires_at, key_row)
_key_cache_lock = threading.Lock()
_KEY_CACHE_TTL = 60  # seconds


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _get_cached_key(key_hash: str) -> dict | None:
    with _key_cache_lock:
        entry = _key_cache.get(key_hash)
        if entry is None:
            return None
        expires_at, row = entry
        if time.monotonic() > expires_at:
            del _key_cache[key_hash]
            return None
        return row


def _cache_key(key_hash: str, row: dict):
    with _key_cache_lock:
        _key_cache[key_hash] = (time.monotonic() + _KEY_CACHE_TTL, row)


def _classify_endpoint(path: str) -> str:
    """Map request path to a usage category for tracking."""
    if "/trust/batch" in path:
        return "batch"
    if "/trust/" in path and "/risk" in path:
        return "risk"
    if "/trust/" in path:
        return "trust"
    if "/agents/" in path:
        return "agents"
    if "/network/" in path:
        return "network"
    if "/integrations/" in path:
        return "integrations"
    return "other"


class ApiKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Extract API key from header or query param
        raw_key = request.headers.get("x-api-key") or request.query_params.get("api_key")

        # No key: pass through as anonymous
        if not raw_key:
            request.state.api_key_id = None
            request.state.tier = None
            request.state.protocol_name = None
            return await call_next(request)

        # Validate key format
        if not raw_key.startswith("ap_live_") or len(raw_key) != 40:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid API key format. Expected: ap_live_<32 hex chars>"},
            )

        key_hash = _hash_key(raw_key)

        # Check cache first
        key_row = _get_cached_key(key_hash)
        if key_row is None:
            # DB lookup
            try:
                from database import get_supabase
                db = get_supabase()
                result = (
                    db.table("api_keys")
                    .select("id, protocol_name, tier, daily_limit, is_active, metadata")
                    .eq("key_hash", key_hash)
                    .limit(1)
                    .execute()
                )
                if not result.data:
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Invalid API key"},
                    )
                key_row = result.data[0]
                _cache_key(key_hash, key_row)
            except Exception as e:
                logger.error("API key validation failed: %s", e)
                # Fail open: allow request but don't track
                request.state.api_key_id = None
                request.state.tier = None
                request.state.protocol_name = None
                return await call_next(request)

        if not key_row.get("is_active", False):
            return JSONResponse(
                status_code=403,
                content={"detail": "API key has been deactivated"},
            )

        # Check monthly usage and apply overage pricing
        from services.usage import get_usage_tracker
        tracker = get_usage_tracker()
        api_key_id = key_row["id"]
        tier = key_row["tier"]
        monthly_count = tracker.get_monthly_count(api_key_id)
        monthly_limit = key_row.get("monthly_limit") or TIER_MONTHLY_LIMITS.get(tier, 10_000)

        # Over limit on a subscription tier → spill to pay-per-call (never block)
        overage = tier != "paygo" and monthly_count >= monthly_limit

        # Attach metadata to request state
        request.state.api_key_id = api_key_id
        request.state.tier = tier
        request.state.protocol_name = key_row.get("protocol_name")
        request.state.overage = overage  # True = this call billed at $0.05 PPC

        # Increment counter
        endpoint = _classify_endpoint(request.url.path)
        tracker.increment(api_key_id, endpoint, overage=overage)

        return await call_next(request)
