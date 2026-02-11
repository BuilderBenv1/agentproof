"""REST API routes for Agent402 Trust Oracle."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException, Query

from models import TrustEvaluation, RiskAssessment, TrustedAgent, NetworkStats
from services.trust import get_trust_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["trust"])


@router.get("/trust/{agent_id}", response_model=TrustEvaluation)
async def evaluate_agent(agent_id: int):
    """Full trust evaluation — score, tier, risk flags, breakdown. [x402: $0.01]"""
    try:
        result = await asyncio.to_thread(get_trust_service().evaluate_agent, agent_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"evaluate_agent({agent_id}) failed: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


@router.get("/trust/{agent_id}/risk", response_model=RiskAssessment)
async def risk_check(agent_id: int):
    """Risk assessment with flags and recommendation. [x402: $0.01]"""
    try:
        result = await asyncio.to_thread(get_trust_service().risk_check, agent_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"risk_check({agent_id}) failed: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


@router.get("/agents/trusted", response_model=list[TrustedAgent])
async def find_trusted_agents(
    category: str | None = Query(None),
    min_score: float = Query(0, ge=0, le=100),
    min_feedback: int = Query(0, ge=0),
    tier: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """Search trusted agents by category, score, and tier. [x402: $0.01]"""
    try:
        result = await asyncio.to_thread(
            get_trust_service().find_trusted_agents,
            category=category,
            min_score=min_score,
            min_feedback=min_feedback,
            tier=tier,
            limit=limit,
        )
        return result
    except Exception as e:
        logger.error(f"find_trusted_agents failed: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


@router.get("/network/stats", response_model=NetworkStats)
async def network_stats():
    """Network-wide statistics (free)."""
    try:
        result = await asyncio.to_thread(get_trust_service().network_stats)
        return result
    except Exception as e:
        logger.error(f"network_stats failed: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


@router.get("/agents/top", response_model=list[TrustedAgent])
async def top_agents(
    category: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
):
    """Top agents by score — free, for website leaderboard."""
    try:
        result = await asyncio.to_thread(
            get_trust_service().find_trusted_agents,
            category=category,
            min_score=0,
            min_feedback=0,
            tier=None,
            limit=limit,
        )
        return result
    except Exception as e:
        logger.error(f"top_agents failed: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


@router.get("/health")
async def health():
    """Health check (free)."""
    return {"status": "healthy", "service": "agent402-oracle"}
