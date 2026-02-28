"""
Authentication dependencies for the AgentProof backend API.

Admin endpoints require an X-Admin-Key header matching the ADMIN_API_KEY env var.
This blocks unauthenticated swarm attacks on write/admin endpoints.
"""

import os
import re
import secrets

from fastapi import Depends, Header, HTTPException, Query

# Load admin key from env. If not set, generate a random one and log it on startup.
_ADMIN_KEY = os.environ.get("ADMIN_API_KEY", "")


def get_admin_key() -> str:
    """Return the configured admin key (generates one on first call if unset)."""
    global _ADMIN_KEY
    if not _ADMIN_KEY:
        _ADMIN_KEY = secrets.token_urlsafe(32)
        import logging
        logging.getLogger(__name__).warning(
            "ADMIN_API_KEY not set — generated ephemeral key: %s", _ADMIN_KEY
        )
    return _ADMIN_KEY


async def require_admin(x_admin_key: str = Header(..., alias="X-Admin-Key")):
    """FastAPI dependency: reject requests without a valid admin key."""
    if not secrets.compare_digest(x_admin_key, get_admin_key()):
        raise HTTPException(status_code=403, detail="Invalid admin key")


def sanitize_search(raw: str | None, max_length: int = 200) -> str | None:
    """Strip PostgREST filter-injection characters from user search input.

    Removes: , . ( ) [ ] which have special meaning in PostgREST filter expressions.
    Also truncates to max_length to prevent oversized queries.
    """
    if raw is None:
        return None
    # Truncate first
    raw = raw[:max_length]
    # Remove PostgREST filter metacharacters
    return re.sub(r'[,.()\[\]]', '', raw)


def sanitize_ilike(raw: str | None, max_length: int = 200) -> str | None:
    """Escape SQL LIKE wildcards in user input for .ilike() queries.

    Escapes % and _ which are wildcards in LIKE/ILIKE patterns.
    """
    if raw is None:
        return None
    raw = raw[:max_length]
    raw = raw.replace('%', '\\%').replace('_', '\\_')
    return raw
