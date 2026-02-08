from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class AuditLogResponse(BaseModel):
    id: int
    agent_id: int
    action: str
    actor_address: str
    details: dict = {}
    tx_hash: Optional[str] = None
    block_number: Optional[int] = None
    source: str = "indexer"
    created_at: datetime


class TaskEventResponse(BaseModel):
    id: int
    task_id: str
    event_type: str
    actor_address: str
    details: dict = {}
    created_at: datetime


class AuditSummaryResponse(BaseModel):
    agent_id: int
    total_events: int = 0
    action_counts: dict = {}
    unique_actors: int = 0
    first_event: Optional[datetime] = None
    last_event: Optional[datetime] = None
