from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class InsuranceStakeResponse(BaseModel):
    agent_id: int
    staker_address: str
    stake_amount: float
    tier: str
    is_active: bool
    staked_at: datetime
    unstake_requested_at: Optional[datetime] = None
    tx_hash: str

    model_config = {"from_attributes": True}


class InsuranceClaimResponse(BaseModel):
    claim_id: int
    agent_id: int
    claimant_address: str
    amount: float
    validation_id: Optional[int] = None
    evidence_uri: Optional[str] = None
    dispute_uri: Optional[str] = None
    status: str = "pending"
    filed_at: datetime
    resolved_at: Optional[datetime] = None
    in_favor_of_claimant: Optional[bool] = None
    tx_hash: str

    model_config = {"from_attributes": True}


class InsuranceStatsResponse(BaseModel):
    total_staked_agents: int
    total_staked_amount: float
    total_claims: int
    pending_claims: int
    approved_claims: int
    rejected_claims: int
    resolution_rate: float
