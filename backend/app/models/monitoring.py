from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional


class EndpointResponse(BaseModel):
    id: int
    agent_id: int
    endpoint_index: int
    url: str
    endpoint_type: str = "https"
    is_active: bool = True
    registered_at: datetime
    tx_hash: Optional[str] = None


class UptimeCheckResponse(BaseModel):
    id: int
    agent_id: int
    endpoint_index: int
    is_up: bool
    latency_ms: Optional[int] = None
    response_code: Optional[int] = None
    checked_at: datetime
    source: str = "monitor"


class UptimeDailySummary(BaseModel):
    id: int
    agent_id: int
    summary_date: date
    total_checks: int = 0
    successful_checks: int = 0
    uptime_pct: float = 0
    avg_latency_ms: int = 0


class MonitoringOverview(BaseModel):
    agent_id: int
    endpoints: list[EndpointResponse] = []
    uptime_pct: float = 0
    avg_latency_ms: int = 0
    total_checks: int = 0
    last_check: Optional[UptimeCheckResponse] = None


class MonitoringStatsResponse(BaseModel):
    total_monitored_agents: int = 0
    total_endpoints: int = 0
    total_checks: int = 0
    average_uptime_pct: float = 0
