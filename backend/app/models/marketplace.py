from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ListingResponse(BaseModel):
    id: int
    agent_id: int
    title: str
    description: Optional[str] = None
    skills: list = []
    price_avax: Optional[float] = None
    price_type: str = "fixed"
    min_tier: str = "unranked"
    is_active: bool = True
    max_concurrent_tasks: int = 5
    avg_completion_time_hours: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class ListingCreate(BaseModel):
    agent_id: int
    title: str = Field(..., max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    skills: list[str] = []
    price_avax: Optional[float] = None
    price_type: str = "fixed"
    min_tier: str = "unranked"
    max_concurrent_tasks: int = Field(5, ge=1, le=50)
    avg_completion_time_hours: Optional[int] = None


class ListingUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    skills: Optional[list[str]] = None
    price_avax: Optional[float] = None
    price_type: Optional[str] = None
    min_tier: Optional[str] = None
    is_active: Optional[bool] = None
    max_concurrent_tasks: Optional[int] = None
    avg_completion_time_hours: Optional[int] = None


class TaskResponse(BaseModel):
    id: int
    task_id: str
    listing_id: Optional[int] = None
    agent_id: int
    client_agent_id: Optional[int] = None
    client_address: str
    payment_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    task_hash: Optional[str] = None
    status: str = "pending"
    price_avax: float
    deliverables_uri: Optional[str] = None
    deadline: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    listing_id: Optional[int] = None
    agent_id: int
    client_address: str
    title: str = Field(..., max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    price_avax: float = Field(..., gt=0)
    deadline: Optional[datetime] = None
    payment_id: Optional[int] = None
    task_hash: Optional[str] = None
    tx_hash: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    task_id: str
    reviewer_address: str
    agent_id: int
    rating: int
    review_text: Optional[str] = None
    created_at: datetime


class ReviewCreate(BaseModel):
    reviewer_address: str
    rating: int = Field(..., ge=1, le=100)
    review_text: Optional[str] = Field(None, max_length=2000)


class MarketplaceStatsResponse(BaseModel):
    total_listings: int = 0
    active_listings: int = 0
    total_tasks: int = 0
    completed_tasks: int = 0
    total_volume_avax: float = 0
    average_task_price: float = 0
