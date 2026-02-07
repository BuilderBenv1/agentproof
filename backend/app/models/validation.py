from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ValidationCreate(BaseModel):
    validation_id: int
    agent_id: int
    task_hash: str
    task_uri: Optional[str] = None
    requester_address: str
    requested_at: datetime
    tx_hash: str
    block_number: int


class ValidationUpdateResponse(BaseModel):
    validation_id: int
    validator_address: str
    is_valid: bool
    proof_uri: Optional[str] = None
    validated_at: datetime


class ValidationResponse(BaseModel):
    id: int
    validation_id: int
    agent_id: int
    task_hash: str
    task_uri: Optional[str] = None
    requester_address: str
    validator_address: Optional[str] = None
    is_valid: Optional[bool] = None
    proof_uri: Optional[str] = None
    requested_at: datetime
    validated_at: Optional[datetime] = None
    tx_hash: str
    block_number: int

    model_config = {"from_attributes": True}


class ValidationListResponse(BaseModel):
    validations: list[ValidationResponse]
    total: int
    page: int
    page_size: int
