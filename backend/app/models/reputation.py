from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class FeedbackCreate(BaseModel):
    agent_id: int
    reviewer_address: str
    rating: int = Field(ge=1, le=100)
    feedback_uri: Optional[str] = None
    task_hash: Optional[str] = None
    tx_hash: str
    block_number: int
    created_at: datetime


class FeedbackResponse(BaseModel):
    id: int
    agent_id: int
    reviewer_address: str
    rating: int
    feedback_uri: Optional[str] = None
    task_hash: Optional[str] = None
    tx_hash: str
    block_number: int
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedbackListResponse(BaseModel):
    feedback: list[FeedbackResponse]
    total: int
    page: int
    page_size: int


class ScoreHistoryEntry(BaseModel):
    snapshot_date: str
    composite_score: float
    average_rating: float
    total_feedback: int
    validation_success_rate: float


class ScoreHistoryResponse(BaseModel):
    agent_id: int
    history: list[ScoreHistoryEntry]
