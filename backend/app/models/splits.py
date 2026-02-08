from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class SplitResponse(BaseModel):
    id: int
    split_id: int
    creator_agent_id: int
    agent_ids: list = []
    shares_bps: list = []
    is_active: bool = True
    created_at: datetime
    tx_hash: str
    block_number: int


class SplitPaymentResponse(BaseModel):
    id: int
    split_payment_id: int
    split_id: int
    amount: float
    token_address: str
    task_hash: Optional[str] = None
    payer_address: str
    distributed: bool = False
    distribution_amounts: Optional[list] = None
    created_at: datetime
    distributed_at: Optional[datetime] = None
    tx_hash: str
    block_number: int


class SplitStatsResponse(BaseModel):
    total_splits: int = 0
    active_splits: int = 0
    total_payments: int = 0
    total_distributed: int = 0
    total_volume: float = 0
