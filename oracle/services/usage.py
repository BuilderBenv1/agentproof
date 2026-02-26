"""
In-memory usage counter with periodic Supabase flush.

Architecture:
- Thread-safe dict tracking per-key daily request counts and endpoint breakdown
- Background thread flushes to api_usage_daily every 60 seconds
- Daily limit checks read from in-memory counter (zero-latency enforcement)
- Same pattern as TrustCache in oracle/services/trust.py
"""

import logging
import threading
import time
from datetime import date, datetime, timezone

logger = logging.getLogger(__name__)

FLUSH_INTERVAL = 60  # seconds


class UsageTracker:
    """Thread-safe per-API-key usage counter with periodic DB flush."""

    def __init__(self):
        self._lock = threading.Lock()
        # { api_key_id: { "date": "2026-02-26", "count": 42, "endpoints": {"trust": 30, "batch": 12} } }
        self._counters: dict[str, dict] = {}
        self._running = False
        self._thread: threading.Thread | None = None

    def increment(self, api_key_id: str, endpoint: str = "other"):
        """Increment the daily counter for a key. Called from middleware on every request."""
        today = date.today().isoformat()
        with self._lock:
            entry = self._counters.get(api_key_id)
            if entry is None or entry["date"] != today:
                self._counters[api_key_id] = {
                    "date": today,
                    "count": 1,
                    "endpoints": {endpoint: 1},
                }
            else:
                entry["count"] += 1
                entry["endpoints"][endpoint] = entry["endpoints"].get(endpoint, 0) + 1

    def get_daily_count(self, api_key_id: str) -> int:
        """Get current day's request count for a key. Used for rate limit enforcement."""
        today = date.today().isoformat()
        with self._lock:
            entry = self._counters.get(api_key_id)
            if entry and entry["date"] == today:
                return entry["count"]
        return 0

    def start(self):
        """Start the background flush thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._flush_loop, daemon=True)
        self._thread.start()
        logger.info("Usage tracker started (flush interval=%ds)", FLUSH_INTERVAL)

    def stop(self):
        """Stop the background flush thread and do a final flush."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=10)
        self._flush()

    def _flush_loop(self):
        while self._running:
            time.sleep(FLUSH_INTERVAL)
            if self._running:
                self._flush()

    def _flush(self):
        """Flush in-memory counters to Supabase api_usage_daily table."""
        with self._lock:
            snapshot = dict(self._counters)

        if not snapshot:
            return

        try:
            from database import get_supabase
            db = get_supabase()
        except Exception as e:
            logger.warning("Usage flush: Supabase unavailable — %s", e)
            return

        now = datetime.now(timezone.utc).isoformat()
        flushed = 0

        for api_key_id, entry in snapshot.items():
            try:
                # Upsert with increment: if row exists, add to request_count
                # Supabase doesn't support atomic increment via REST, so we
                # read-then-write (acceptable for daily aggregates, not for
                # high-contention counters).
                existing = (
                    db.table("api_usage_daily")
                    .select("id, request_count, endpoints_hit")
                    .eq("api_key_id", api_key_id)
                    .eq("usage_date", entry["date"])
                    .limit(1)
                    .execute()
                )

                if existing.data:
                    row = existing.data[0]
                    new_count = (row.get("request_count") or 0) + entry["count"]
                    old_endpoints = row.get("endpoints_hit") or {}
                    for ep, cnt in entry["endpoints"].items():
                        old_endpoints[ep] = old_endpoints.get(ep, 0) + cnt
                    db.table("api_usage_daily").update({
                        "request_count": new_count,
                        "endpoints_hit": old_endpoints,
                    }).eq("id", row["id"]).execute()
                else:
                    db.table("api_usage_daily").insert({
                        "api_key_id": api_key_id,
                        "usage_date": entry["date"],
                        "request_count": entry["count"],
                        "endpoints_hit": entry["endpoints"],
                    }).execute()

                # Update last_used_at on the key
                db.table("api_keys").update({
                    "last_used_at": now,
                }).eq("id", api_key_id).execute()

                flushed += 1
            except Exception as e:
                logger.warning("Usage flush failed for key %s: %s", api_key_id[:8], e)

        # Reset flushed counters (keep today's running total in memory for rate limiting)
        # We DON'T clear the counters — the in-memory count is the source of truth for
        # rate limit checks during the current day. Counters auto-reset when the date changes.
        if flushed > 0:
            logger.debug("Usage flush: %d keys flushed to Supabase", flushed)


# Module-level singleton
_tracker = UsageTracker()


def get_usage_tracker() -> UsageTracker:
    return _tracker
