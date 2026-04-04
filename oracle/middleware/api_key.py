"""
API key authentication and rate limiting middleware.

Flow:
1. Check X-Api-Key header (or ?api_key query param)
2. If no key: reject with 401 on billable endpoints, pass through on free paths
3. If key present: validate, check monthly limit, attach metadata to request.state
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

# Paths that are free (no API key required)
FREE_PATH_PREFIXES = (
    "/api/v1/trust/",          # single-agent trust scores are free
    "/api/v1/network/",
    "/api/v1/integrations/",
    "/api/v1/badge/",
    "/api/v1/feed",
    "/api/v1/ens/",
    "/api/v1/health",
    "/api/v1/agent-log",
    "/integrate",
    "/health",
    "/.well-known/",
    "/docs",
    "/openapi.json",
    "/a2a",
    "/mcp",
    "/agent.json",
    "/agent_log.json",
)

# Paths that are free for single lookups but paid for bulk/advanced
PAID_OVERRIDES = (
    "/api/v1/trust/batch",     # batch evaluation requires API key
)

# Monthly call limits per tier (tracked via rolling 30-day window)
TIER_MONTHLY_LIMITS = {
    "partner": 999_999_999,   # free — co-marketing / data exchange partners
    "paygo": 999_999_999,     # unlimited, billed per call at $0.05
    "starter": 10_000,        # $250/mo
    "growth": 25_000,         # $500/mo
    "scale": 75_000,          # $1,000/mo
    "enterprise": 200_000,    # $2,000/mo
}

# In-memory cache for validated keys (avoids DB lookup on every request)
_key_cache: dict[str, tuple[float, dict]] = {}  # hash → (expires_at, key_row)
_key_cache_lock = threading.Lock()
_KEY_CACHE_TTL = 60  # seconds

# Per-second rate limiting (token bucket per API key hash)
_rate_buckets: dict[str, tuple[float, float]] = {}  # key_hash → (tokens, last_refill)
_rate_lock = threading.Lock()
_RATE_LIMIT_PER_SECOND = 10  # max requests per second per key
_RATE_BUCKET_MAX = 20  # burst capacity


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


def _check_rate_limit(key_hash: str) -> bool:
    """Token bucket rate limiter. Returns True if request is allowed."""
    now = time.monotonic()
    with _rate_lock:
        if key_hash not in _rate_buckets:
            _rate_buckets[key_hash] = (_RATE_BUCKET_MAX - 1, now)
            return True
        tokens, last_refill = _rate_buckets[key_hash]
        elapsed = now - last_refill
        tokens = min(_RATE_BUCKET_MAX, tokens + elapsed * _RATE_LIMIT_PER_SECOND)
        if tokens < 1:
            _rate_buckets[key_hash] = (tokens, now)
            return False
        _rate_buckets[key_hash] = (tokens - 1, now)
        return True


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

        # No key: check if this is a free endpoint
        if not raw_key:
            path = request.url.path
            is_paid_override = any(path.startswith(p) for p in PAID_OVERRIDES)
            is_free = (
                not is_paid_override
                and (path == "/" or any(path.startswith(p) for p in FREE_PATH_PREFIXES))
            )
            if not is_free:
                return JSONResponse(
                    status_code=401,
                    content={
                        "detail": "API key required. Register at https://oracle.agentproof.sh/integrate",
                        "docs": "https://agentproof.sh/pricing",
                    },
                )
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
                    .select("id, protocol_name, tier, monthly_limit, is_active, expires_at, metadata")
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
                # Fail CLOSED: reject request when we can't validate
                return JSONResponse(
                    status_code=503,
                    content={"detail": "Authentication service temporarily unavailable"},
                )

        if not key_row.get("is_active", False):
            return JSONResponse(
                status_code=403,
                content={"detail": "API key has been deactivated"},
            )

        # Check key expiry (used for time-limited tiers like synthesis)
        expires_at = key_row.get("expires_at")
        if expires_at:
            from datetime import datetime, timezone
            try:
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) > expires_at:
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "API key has expired. Contact support to renew."},
                    )
            except (ValueError, TypeError):
                pass  # Malformed expiry — allow through, log elsewhere

        # Per-second rate limiting
        if not _check_rate_limit(key_hash):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Max 10 requests/second."},
                headers={"Retry-After": "1"},
            )

        # Check monthly usage and apply overage pricing
        from services.usage import get_usage_tracker
        tracker = get_usage_tracker()
        api_key_id = key_row["id"]
        tier = key_row["tier"]
        monthly_count = tracker.get_monthly_count(api_key_id)
        monthly_limit = key_row.get("monthly_limit") or TIER_MONTHLY_LIMITS.get(tier, 10_000)

        # Over limit on a subscription tier → spill to pay-per-call (never block)
        # Partner tier is never billed
        overage = tier not in ("paygo", "partner") and monthly_count >= monthly_limit

        # Attach metadata to request state
        request.state.api_key_id = api_key_id
        request.state.tier = tier
        request.state.protocol_name = key_row.get("protocol_name")
        request.state.overage = overage  # True = this call billed at $0.05 PPC

        # Increment counter
        endpoint = _classify_endpoint(request.url.path)
        tracker.increment(api_key_id, endpoint, overage=overage)

        return await call_next(request)
