"""REST API routes — /api/v1/*"""

import logging
from fastapi import APIRouter, HTTPException, Query

from models import TrustEvaluation, TrustedAgent, RiskAssessment, NetworkStats
from services.trust import get_trust_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["REST API"])


@router.get("/trust/{agent_id}", response_model=TrustEvaluation)
async def evaluate_agent(agent_id: int):
    """Get a full trust evaluation for an agent."""
    try:
        svc = get_trust_service()
        return svc.evaluate_agent(agent_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error evaluating agent #{agent_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/trust/{agent_id}/risk", response_model=RiskAssessment)
async def risk_check(agent_id: int):
    """Get a risk assessment for an agent."""
    try:
        svc = get_trust_service()
        return svc.risk_check(agent_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error risk-checking agent #{agent_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/agents/trusted", response_model=list[TrustedAgent])
async def find_trusted_agents(
    category: str | None = Query(None, description="Filter by category"),
    min_score: float = Query(0, ge=0, le=100, description="Minimum composite score"),
    min_feedback: int = Query(0, ge=0, description="Minimum feedback count"),
    tier: str | None = Query(None, description="Filter by tier"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
):
    """Find trusted agents matching the given criteria."""
    try:
        svc = get_trust_service()
        return svc.find_trusted_agents(
            category=category,
            min_score=min_score,
            min_feedback=min_feedback,
            tier=tier,
            limit=limit,
        )
    except Exception as e:
        logger.error(f"Error finding trusted agents: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/network/stats", response_model=NetworkStats)
async def network_stats():
    """Get network-wide trust statistics."""
    try:
        svc = get_trust_service()
        return svc.network_stats()
    except Exception as e:
        logger.error(f"Error getting network stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/health")
async def health():
    """Oracle health check."""
    from config import get_settings

    settings = get_settings()
    return {
        "status": "healthy",
        "service": "agentproof-trust-oracle",
        "version": settings.oracle_version,
    }
