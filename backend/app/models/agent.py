from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class AgentBase(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: str = "general"
    image_url: Optional[str] = None
    endpoints: list[str] = []


class AgentCreate(AgentBase):
    agent_id: int
    owner_address: str
    agent_uri: str
    registered_at: datetime


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    endpoints: Optional[list[str]] = None


class AgentResponse(AgentBase):
    id: int
    agent_id: int
    owner_address: str
    agent_uri: str
    registered_at: datetime
    updated_at: Optional[datetime] = None
    total_feedback: int = 0
    average_rating: float = 0
    composite_score: float = 0
    validation_success_rate: float = 0
    rank: Optional[int] = None
    tier: str = "unranked"

    model_config = {"from_attributes": True}


class AgentListResponse(BaseModel):
    agents: list[AgentResponse]
    total: int
    page: int
    page_size: int


class AgentProfileResponse(AgentResponse):
    feedback_count: int = 0
    validation_count: int = 0
    score_breakdown: Optional[dict] = None
