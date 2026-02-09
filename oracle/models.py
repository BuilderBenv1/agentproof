from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ─── Enums ────────────────────────────────────────────────────────────


class Recommendation(str, Enum):
    TRUSTED = "TRUSTED"
    CAUTION = "CAUTION"
    HIGH_RISK = "HIGH_RISK"
    UNVERIFIED = "UNVERIFIED"


class RiskFlag(str, Enum):
    HIGH_RISK_SCORE = "HIGH_RISK_SCORE"
    SUSPICIOUS_VOLATILITY = "SUSPICIOUS_VOLATILITY"
    UNVERIFIED = "UNVERIFIED"
    LOW_FEEDBACK = "LOW_FEEDBACK"
    CONCENTRATED_FEEDBACK = "CONCENTRATED_FEEDBACK"
    LOW_UPTIME = "LOW_UPTIME"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ─── Core Response Models ─────────────────────────────────────────────


class ScoreBreakdown(BaseModel):
    rating_score: float = 0.0
    volume_score: float = 0.0
    consistency_score: float = 0.0
    validation_score: float = 0.0
    age_score: float = 0.0
    uptime_score: float = 0.0


class TrustEvaluation(BaseModel):
    agent_id: int
    name: str | None = None
    composite_score: float
    tier: str
    recommendation: Recommendation
    risk_flags: list[RiskFlag] = []
    score_breakdown: ScoreBreakdown
    feedback_count: int = 0
    average_rating: float = 0.0
    validation_success_rate: float = 0.0
    account_age_days: int = 0
    uptime_pct: float = -1.0
    evaluated_at: datetime


class TrustedAgent(BaseModel):
    agent_id: int
    name: str | None = None
    composite_score: float
    tier: str
    category: str | None = None
    feedback_count: int = 0


class RiskAssessment(BaseModel):
    agent_id: int
    recommendation: Recommendation
    risk_flags: list[RiskFlag] = []
    risk_level: RiskLevel
    details: str = ""


class NetworkStats(BaseModel):
    total_agents: int = 0
    avg_score: float = 0.0
    tier_distribution: dict[str, int] = {}
    total_feedback: int = 0
    total_validations: int = 0


# ─── A2A Protocol Models ──────────────────────────────────────────────


class A2ASkill(BaseModel):
    id: str
    name: str
    description: str
    tags: list[str] = []
    examples: list[str] = []


class A2AProvider(BaseModel):
    organization: str
    url: str


class A2ACapabilities(BaseModel):
    streaming: bool = False
    pushNotifications: bool = False


class A2AAgentCard(BaseModel):
    name: str
    description: str
    url: str
    version: str
    capabilities: A2ACapabilities = A2ACapabilities()
    skills: list[A2ASkill] = []
    provider: A2AProvider


class A2AMessage(BaseModel):
    role: str
    parts: list[dict[str, Any]]


class A2ATaskSendParams(BaseModel):
    id: str | None = None
    message: A2AMessage
    skill_id: str | None = None


class A2ARequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: dict[str, Any] | None = None
    id: int | str | None = None


class A2AArtifact(BaseModel):
    name: str = "result"
    parts: list[dict[str, Any]]


class A2ATaskStatus(BaseModel):
    state: str = "completed"
    message: A2AMessage | None = None


class A2ATaskResult(BaseModel):
    id: str
    status: A2ATaskStatus
    artifacts: list[A2AArtifact] = []


class A2AResponse(BaseModel):
    jsonrpc: str = "2.0"
    result: Any = None
    error: dict[str, Any] | None = None
    id: int | str | None = None


# ─── MCP Protocol Models ──────────────────────────────────────────────


class MCPRequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: dict[str, Any] | None = None
    id: int | str | None = None


class MCPToolInputSchema(BaseModel):
    type: str = "object"
    properties: dict[str, Any] = {}
    required: list[str] = []


class MCPToolDefinition(BaseModel):
    name: str
    description: str
    inputSchema: MCPToolInputSchema


class MCPResponse(BaseModel):
    jsonrpc: str = "2.0"
    result: Any = None
    error: dict[str, Any] | None = None
    id: int | str | None = None
