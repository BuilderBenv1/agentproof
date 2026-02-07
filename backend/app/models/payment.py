from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PaymentResponse(BaseModel):
    payment_id: int
    from_agent_id: int
    to_agent_id: int
    amount: float
    token_address: str
    task_hash: str
    requires_validation: bool = False
    status: str = "escrowed"
    created_at: datetime
    resolved_at: Optional[datetime] = None
    tx_hash: str

    model_config = {"from_attributes": True}


class PaymentStatsResponse(BaseModel):
    total_payments: int
    total_volume: float
    average_payment: float
    escrowed_count: int
    released_count: int
    refunded_count: int
    cancelled_count: int
    top_earners: list[dict]
