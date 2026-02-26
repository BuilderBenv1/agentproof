"""
Batch trust evaluation endpoint.

Allows growth/enterprise tier protocols to evaluate multiple agents in a
single request, reducing HTTP overhead for high-volume integrations.
"""

import logging

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/trust", tags=["trust"])
logger = logging.getLogger(__name__)

MAX_BATCH_FREE = 0
MAX_BATCH_GROWTH = 100
MAX_BATCH_ENTERPRISE = 500


class BatchRequest(BaseModel):
    agent_ids: list[int]
    chain: str | None = None


@router.post("/batch")
async def batch_evaluate(request: Request, body: BatchRequest):
    """Evaluate multiple agents in a single request.

    Requires an API key with growth or enterprise tier.
    Each agent counts as 1 query against the daily limit.
    """
    tier = getattr(request.state, "tier", None)
    api_key_id = getattr(request.state, "api_key_id", None)

    if not api_key_id:
        raise HTTPException(
            status_code=401,
            detail="API key required for batch evaluation. Register at /integrate",
        )

    if tier == "free":
        raise HTTPException(
            status_code=403,
            detail="Batch evaluation requires growth or enterprise tier. Upgrade at /api/v1/integrations/upgrade",
        )

    max_batch = MAX_BATCH_ENTERPRISE if tier == "enterprise" else MAX_BATCH_GROWTH
    if len(body.agent_ids) > max_batch:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {max_batch} agents per batch request on {tier} tier",
        )

    if not body.agent_ids:
        return {"evaluations": [], "count": 0}

    # Deduplicate
    agent_ids = list(dict.fromkeys(body.agent_ids))

    from services.trust import get_trust_service
    from services.usage import get_usage_tracker

    trust = get_trust_service()
    tracker = get_usage_tracker()

    evaluations = []
    errors = []

    for agent_id in agent_ids:
        try:
            evaluation = trust.evaluate_agent(agent_id)
            evaluations.append(evaluation.model_dump())
        except ValueError:
            errors.append({"agent_id": agent_id, "error": "Agent not found"})
        except Exception as e:
            logger.warning("Batch eval failed for agent #%d: %s", agent_id, e)
            errors.append({"agent_id": agent_id, "error": str(e)})

    # Increment usage counter for each successful evaluation
    # (already incremented once by middleware for the request itself,
    #  so add the additional count beyond 1)
    additional = len(evaluations) - 1
    if additional > 0:
        for _ in range(additional):
            tracker.increment(api_key_id, "batch")

    return {
        "evaluations": evaluations,
        "errors": errors if errors else None,
        "count": len(evaluations),
    }
