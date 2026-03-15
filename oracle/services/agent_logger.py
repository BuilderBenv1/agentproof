"""
Structured execution logger for hackathon compliance.

Writes agent_log.json entries documenting autonomous decisions, tool calls,
retries, failures, and outputs. Required by the "Agents With Receipts" track.
"""

import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

LOG_FILE = os.environ.get("AGENT_LOG_PATH", "/app/agent_log.json")
MAX_ENTRIES = 10_000


class AgentLogger:
    """Thread-safe structured execution logger."""

    def __init__(self, log_path: str = LOG_FILE):
        self._path = Path(log_path)
        self._lock = threading.Lock()
        self._entries: list[dict] = []
        self._load()

    def _load(self):
        """Load existing log entries from disk."""
        try:
            if self._path.exists():
                data = json.loads(self._path.read_text())
                self._entries = data.get("entries", [])
        except Exception:
            self._entries = []

    def log(
        self,
        action: str,
        description: str,
        outcome: str = "success",
        tool_calls: list[str] | None = None,
        details: dict | None = None,
        retry_count: int = 0,
    ):
        """Log a structured execution entry."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "description": description,
            "outcome": outcome,
            "tool_calls": tool_calls or [],
            "retry_count": retry_count,
        }
        if details:
            entry["details"] = details

        with self._lock:
            self._entries.append(entry)
            # Trim old entries
            if len(self._entries) > MAX_ENTRIES:
                self._entries = self._entries[-MAX_ENTRIES:]
            self._flush()

    def _flush(self):
        """Write log to disk."""
        try:
            doc = {
                "agent_id": "agentproof-trust-oracle",
                "version": "1.0.0",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_entries": len(self._entries),
                "summary": self._compute_summary(),
                "entries": self._entries,
            }
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text(json.dumps(doc, indent=2, default=str))
        except Exception as e:
            logger.warning(f"Failed to write agent_log.json: {e}")

    def _compute_summary(self) -> dict:
        """Compute summary stats from entries."""
        if not self._entries:
            return {"total_actions": 0}

        outcomes = {}
        actions = {}
        for e in self._entries:
            o = e.get("outcome", "unknown")
            outcomes[o] = outcomes.get(o, 0) + 1
            a = e.get("action", "unknown")
            actions[a] = actions.get(a, 0) + 1

        retries = sum(e.get("retry_count", 0) for e in self._entries)
        tool_calls = sum(len(e.get("tool_calls", [])) for e in self._entries)

        return {
            "total_actions": len(self._entries),
            "outcomes": outcomes,
            "action_types": actions,
            "total_retries": retries,
            "total_tool_calls": tool_calls,
            "first_entry": self._entries[0]["timestamp"],
            "last_entry": self._entries[-1]["timestamp"],
        }

    def get_log(self) -> dict:
        """Return the full log document."""
        with self._lock:
            return {
                "agent_id": "agentproof-trust-oracle",
                "version": "1.0.0",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_entries": len(self._entries),
                "summary": self._compute_summary(),
                "entries": self._entries[-500:],  # Last 500 for API response
            }


# Singleton
_agent_logger: AgentLogger | None = None


def get_agent_logger() -> AgentLogger:
    global _agent_logger
    if _agent_logger is None:
        _agent_logger = AgentLogger()
    return _agent_logger
