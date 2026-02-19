"""
TrustFeedBus — in-memory pub/sub for Server-Sent Events.

The screener publishes TrustEvents after each cycle.
SSE clients subscribe and receive events in real-time.
"""

import asyncio
import json
import logging
import time
from collections import deque
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

MAX_SUBSCRIBERS = 500
BUFFER_SIZE = 100  # circular buffer for late joiners


@dataclass
class TrustEvent:
    event_id: int
    agent_id: int
    agent_name: str | None
    score: float
    tier: str
    risk_level: str
    delta: float  # score change since last screening
    alert_type: str | None  # score_change, risk_change, liveness, etc.
    timestamp: float

    def to_sse(self) -> str:
        data = json.dumps(asdict(self), default=str)
        return f"id: {self.event_id}\nevent: trust_update\ndata: {data}\n\n"


class TrustFeedBus:
    """In-memory pub/sub bus connecting the screener to SSE clients."""

    def __init__(self):
        self._subscribers: dict[int, asyncio.Queue] = {}
        self._next_sub_id = 0
        self._next_event_id = 0
        self._buffer: deque[TrustEvent] = deque(maxlen=BUFFER_SIZE)
        self._lock = asyncio.Lock()

    async def publish(self, event: TrustEvent):
        """Publish an event to all subscribers."""
        async with self._lock:
            self._next_event_id += 1
            event.event_id = self._next_event_id
            event.timestamp = time.time()
            self._buffer.append(event)

        # Fan out to all subscriber queues (non-blocking)
        dead = []
        for sub_id, queue in list(self._subscribers.items()):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                dead.append(sub_id)

        for sub_id in dead:
            self._subscribers.pop(sub_id, None)

    async def subscribe(self, last_event_id: int | None = None):
        """Subscribe and yield events. Replays from buffer if last_event_id given."""
        async with self._lock:
            if len(self._subscribers) >= MAX_SUBSCRIBERS:
                raise RuntimeError("Max subscriber limit reached")
            self._next_sub_id += 1
            sub_id = self._next_sub_id
            queue: asyncio.Queue = asyncio.Queue(maxsize=256)
            self._subscribers[sub_id] = queue

        try:
            # Replay buffered events if reconnecting
            if last_event_id is not None:
                for event in self._buffer:
                    if event.event_id > last_event_id:
                        yield event

            # Stream new events
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield event
                except asyncio.TimeoutError:
                    yield None  # keepalive signal
        finally:
            self._subscribers.pop(sub_id, None)

    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def buffer_size(self) -> int:
        return len(self._buffer)


# Singleton
_feed_bus: TrustFeedBus | None = None


def get_feed_bus() -> TrustFeedBus:
    global _feed_bus
    if _feed_bus is None:
        _feed_bus = TrustFeedBus()
    return _feed_bus
