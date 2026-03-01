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
    source_chain: str = "avalanche"
    registered_at: datetime
    updated_at: Optional[datetime] = None
    total_feedback: int = 0
    average_rating: float = 0
    composite_score: float = 0
    validation_success_rate: float = 0
    rank: Optional[int] = None
    tier: str = "unranked"
    deployer_score: Optional[float] = None
    deployer_agent_count: Optional[int] = None
    uri_change_count: Optional[int] = None
    freshness_multiplier: Optional[float] = None
    # ERC-8004 identity tags
    autonomy_level: Optional[str] = None
    financial_access: Optional[str] = None
    data_access_level: Optional[str] = None
    can_delegate: Optional[bool] = None
    can_be_delegated: Optional[bool] = None
    supported_protocols: Optional[list[str]] = None
    open_source: Optional[bool] = None
    source_url: Optional[str] = None
    audited_by: Optional[list[str]] = None
    owner_type: Optional[str] = None
    upgrade_pattern: Optional[str] = None
    human_in_loop: Optional[bool] = None
    jurisdiction: Optional[str] = None
    compliance_tags: Optional[list[str]] = None

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
    deployer_info: Optional[dict] = None
    uri_changes: Optional[list] = None
    score_trajectory: Optional[dict] = None  # {delta_7d, delta_30d, trend}
    max_exposure_usd: Optional[float] = None  # dollar-denominated trust ceiling
    cross_chain_agents: Optional[list] = None  # same deployer, other chains
    coverage_tier: Optional[str] = None  # $1K, $10K, $100K, $1M
    insurable: Optional[bool] = None  # meets minimum thresholds for coverage
