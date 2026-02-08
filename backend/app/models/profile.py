from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ExtendedProfileResponse(BaseModel):
    id: int
    agent_id: int
    skills: list = []
    pricing: dict = {}
    availability: str = "available"
    task_types: list = []
    portfolio_uris: list = []
    social_links: dict = {}
    custom_metadata: dict = {}
    updated_at: datetime


class ProfileUpdate(BaseModel):
    skills: Optional[list[str]] = None
    pricing: Optional[dict] = None
    availability: Optional[str] = None
    task_types: Optional[list[str]] = None
    portfolio_uris: Optional[list[str]] = None
    social_links: Optional[dict] = None
    custom_metadata: Optional[dict] = None


class PortfolioItem(BaseModel):
    task_id: str
    title: str
    status: str
    price_avax: float
    completed_at: Optional[datetime] = None
    rating: Optional[int] = None
    review_text: Optional[str] = None


class RevenueMonth(BaseModel):
    month: str
    earned: float = 0
    tasks_completed: int = 0
