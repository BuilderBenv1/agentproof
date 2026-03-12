"""
ERC-8183 Hook routes — /api/v1/hook/*
Exposes AgentProofHook gate logic as API endpoints so agents can
pre-check whether they (or a provider) would pass the hook before
submitting an on-chain transaction.

Also used by MCP and A2A protocols via _check_agent_gate / _resolve_address.
"""

import logging
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from services.trust import get_trust_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/hook", tags=["ERC-8183 Hook"])

# Default hook configuration (matches deploy-hook.js defaults)
HOOK_DEFAULTS = {
    "min_score": 30.0,   # 3000 / 100
    "min_tier": 1,       # bronze
    "max_score_age": 3600,  # 1 hour
}

TIER_NAMES = ["unranked", "bronze", "silver", "gold", "platinum", "diamond"]
TIER_MAP = {name: i for i, name in enumerate(TIER_NAMES)}


def _tier_to_num(tier: str) -> int:
    return TIER_MAP.get(tier.lower(), 0)


# ─── Sync helpers (called by REST routes, MCP, and A2A) ──────────


def _check_agent_gate(
    agent_id: int,
    min_score: float = 30.0,
    min_tier: int = 1,
    max_score_age: int = 3600,
) -> dict:
    """
    Simulate the on-chain _gateProvider() logic.
    Returns a dict with allowed/rejected + reason.
    """
    svc = get_trust_service()
    try:
        evaluation = svc.evaluate_agent(agent_id)
    except ValueError:
        return {
            "agent_id": agent_id,
            "address": None,
            "allowed": False,
            "score": 0,
            "tier": "unranked",
            "tier_num": 0,
            "score_age_seconds": None,
            "checks": {
                "registered": False,
                "scored": False,
                "score_meets_minimum": False,
                "tier_meets_minimum": False,
                "score_fresh": False,
            },
            "hook_config": {
                "min_score": min_score,
                "min_tier": min_tier,
                "max_score_age": max_score_age,
            },
            "rejection_reason": "AgentNotRegistered",
        }

    score = evaluation.composite_score
    tier = evaluation.tier
    tier_num = _tier_to_num(tier)

    # Calculate score age
    score_age = None
    if evaluation.evaluated_at:
        try:
            from datetime import datetime, timezone
            # evaluated_at is already a datetime object (set with datetime.now(timezone.utc))
            eval_dt = evaluation.evaluated_at
            if isinstance(eval_dt, str):
                eval_dt = datetime.fromisoformat(eval_dt.replace("Z", "+00:00"))
            if eval_dt.tzinfo is None:
                eval_dt = eval_dt.replace(tzinfo=timezone.utc)
            score_age = int((datetime.now(timezone.utc) - eval_dt).total_seconds())
        except Exception:
            score_age = 0

    scored = score > 0 or evaluation.feedback_count > 0
    score_ok = score >= min_score
    tier_ok = tier_num >= min_tier
    fresh = max_score_age == 0 or (score_age is not None and score_age <= max_score_age)
    allowed = scored and score_ok and tier_ok and fresh

    reason = None
    if not scored:
        reason = "AgentNotScored"
    elif not fresh:
        reason = "ScoreExpired"
    elif not score_ok:
        reason = "ScoreTooLow"
    elif not tier_ok:
        reason = "TierTooLow"

    return {
        "agent_id": agent_id,
        "address": None,
        "allowed": allowed,
        "score": round(score, 2),
        "tier": tier,
        "tier_num": tier_num,
        "score_age_seconds": score_age,
        "checks": {
            "registered": True,
            "scored": scored,
            "score_meets_minimum": score_ok,
            "tier_meets_minimum": tier_ok,
            "score_fresh": fresh,
        },
        "hook_config": {
            "min_score": min_score,
            "min_tier": min_tier,
            "max_score_age": max_score_age,
        },
        "rejection_reason": reason,
    }


def _resolve_address(address: str) -> dict:
    """Resolve a wallet address to agent ID + trust score."""
    from database import get_supabase

    db = get_supabase()
    result = (
        db.table("agents")
        .select("agent_id, composite_score, tier, updated_at, owner_address")
        .ilike("owner_address", address)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise ValueError(f"No agent registered for address {address}")

    agent = result.data[0]
    tier = agent.get("tier", "unranked")

    return {
        "address": address,
        "agent_id": agent["agent_id"],
        "score": round(float(agent.get("composite_score", 0)), 2),
        "tier": tier,
        "tier_num": _tier_to_num(tier),
        "updated_at": agent.get("updated_at"),
    }


# ─── REST Routes ──────────────────────────────────────────────────


@router.get("/check/{agent_id}")
async def hook_gate_check(
    request: Request,
    agent_id: int,
    min_score: float = Query(HOOK_DEFAULTS["min_score"], ge=0, le=100, description="Minimum score (0-100)"),
    min_tier: int = Query(HOOK_DEFAULTS["min_tier"], ge=0, le=5, description="Minimum tier (0=unranked, 1=bronze, ..., 5=diamond)"),
    max_score_age: int = Query(HOOK_DEFAULTS["max_score_age"], ge=0, description="Max score age in seconds (0=no expiry)"),
):
    """Pre-check whether an agent would pass the AgentProofHook gate."""
    return _check_agent_gate(agent_id, min_score, min_tier, max_score_age)


@router.get("/check/batch")
async def hook_gate_check_batch(
    request: Request,
    agent_ids: str = Query(..., description="Comma-separated agent IDs"),
    min_score: float = Query(HOOK_DEFAULTS["min_score"], ge=0, le=100),
    min_tier: int = Query(HOOK_DEFAULTS["min_tier"], ge=0, le=5),
    max_score_age: int = Query(HOOK_DEFAULTS["max_score_age"], ge=0),
):
    """Batch hook gate check — returns pass/fail for multiple agents."""
    ids = [int(x.strip()) for x in agent_ids.split(",") if x.strip().isdigit()]
    if len(ids) > 100:
        raise HTTPException(status_code=400, detail="Max 100 agent IDs per batch")

    results = []
    svc = get_trust_service()

    for aid in ids:
        try:
            evaluation = svc.evaluate_agent(aid)
            score = evaluation.composite_score
            tier_num = _tier_to_num(evaluation.tier)
            scored = score > 0 or evaluation.feedback_count > 0
            score_ok = score >= min_score
            tier_ok = tier_num >= min_tier

            results.append({
                "agent_id": aid,
                "allowed": scored and score_ok and tier_ok,
                "score": round(score, 2),
                "tier": evaluation.tier,
                "tier_num": tier_num,
            })
        except ValueError:
            results.append({
                "agent_id": aid,
                "allowed": False,
                "score": 0,
                "tier": "unranked",
                "tier_num": 0,
            })

    allowed_count = sum(1 for r in results if r["allowed"])
    return {
        "results": results,
        "total": len(results),
        "allowed": allowed_count,
        "rejected": len(results) - allowed_count,
        "hook_config": {
            "min_score": min_score,
            "min_tier": min_tier,
            "max_score_age": max_score_age,
        },
    }


@router.get("/resolve/{address}")
async def resolve_address(address: str):
    """Resolve a wallet address to its ERC-8004 agent ID and trust score."""
    try:
        return _resolve_address(address)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error resolving address {address}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/config")
async def hook_config():
    """Return the default hook configuration and supported parameters."""
    return {
        "defaults": HOOK_DEFAULTS,
        "tiers": {name: i for i, name in enumerate(TIER_NAMES)},
        "score_range": {"min": 0, "max": 100, "decimals": 2},
        "on_chain_score_range": {"min": 0, "max": 10000, "note": "Divide by 100 for display"},
        "contracts": {
            "AgentProofHook": "ERC-8183 IACPHook — gates setProvider by trust score + tier + staleness + attestation",
            "AddressResolver": "Address → agentId → trust score bridge for address-keyed consumers",
            "IAttestationProvider": "verify(address, bytes32) — pluggable credential verification",
        },
    }
