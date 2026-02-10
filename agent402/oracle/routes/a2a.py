"""Google A2A (Agent-to-Agent) protocol endpoint for Agent402."""

import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from config import get_settings
from models import (
    A2AAgentCard, A2ASkill, A2AProvider, A2ACapabilities,
    A2ARequest, A2AResponse, A2ATaskResult, A2ATaskStatus,
    A2AMessage, A2AArtifact,
)
from services.trust import get_trust_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["a2a"])


def _build_agent_card() -> A2AAgentCard:
    settings = get_settings()
    return A2AAgentCard(
        name=settings.oracle_name,
        description=settings.oracle_description,
        url=settings.base_url,
        version=settings.oracle_version,
        capabilities=A2ACapabilities(streaming=False, pushNotifications=False),
        skills=[
            A2ASkill(
                id="evaluate_agent",
                name="Evaluate Agent Trust",
                description="Full trust evaluation with composite score, tier, risk flags, and score breakdown. Costs $0.01 USDC via x402.",
                tags=["trust", "reputation", "score", "x402"],
                examples=["Evaluate agent 42", "What is the trust score for agent 100?"],
            ),
            A2ASkill(
                id="risk_check",
                name="Risk Assessment",
                description="Detailed risk assessment with flags and recommendation. Costs $0.01 USDC via x402.",
                tags=["risk", "safety", "x402"],
                examples=["Check risk for agent 42", "Is agent 100 safe to interact with?"],
            ),
            A2ASkill(
                id="find_trusted_agents",
                name="Find Trusted Agents",
                description="Search for agents by category, minimum score, tier, and feedback count. Costs $0.01 USDC via x402.",
                tags=["search", "discovery", "x402"],
                examples=["Find top DeFi agents", "List gold-tier agents with score above 80"],
            ),
            A2ASkill(
                id="network_stats",
                name="Network Statistics",
                description="Network-wide trust statistics. Costs $0.005 USDC via x402.",
                tags=["analytics", "stats", "x402"],
                examples=["Show network stats", "How many agents are registered?"],
            ),
        ],
        provider=A2AProvider(organization="Agent402", url=settings.base_url),
    )


@router.get("/.well-known/agent.json")
async def agent_card():
    """A2A agent card for discovery (free)."""
    return _build_agent_card().model_dump()


@router.post("/a2a")
async def a2a_rpc(request: Request):
    """A2A JSON-RPC 2.0 endpoint."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            status_code=400,
            content=A2AResponse(error={"code": -32700, "message": "Parse error"}).model_dump(),
        )

    req = A2ARequest(**body)

    if req.method == "tasks/send":
        return await _handle_task(req)

    return A2AResponse(
        id=req.id,
        error={"code": -32601, "message": f"Method not found: {req.method}"},
    ).model_dump()


async def _handle_task(req: A2ARequest):
    params = req.params or {}
    message = params.get("message", {})
    parts = message.get("parts", [])
    skill_id = params.get("skill_id")

    text = ""
    for part in parts:
        if "text" in part:
            text = part["text"]
            break

    task_id = params.get("id") or str(uuid.uuid4())

    try:
        result_data = await asyncio.to_thread(_dispatch_skill, skill_id, text)
        result_json = json.dumps(result_data, default=str)

        return A2AResponse(
            id=req.id,
            result=A2ATaskResult(
                id=task_id,
                status=A2ATaskStatus(
                    state="completed",
                    message=A2AMessage(role="agent", parts=[{"text": result_json}]),
                ),
                artifacts=[A2AArtifact(parts=[{"text": result_json}])],
            ).model_dump(),
        ).model_dump()
    except Exception as e:
        logger.error(f"A2A task failed: {e}")
        return A2AResponse(
            id=req.id,
            error={"code": -32000, "message": str(e)},
        ).model_dump()


def _dispatch_skill(skill_id: str | None, text: str) -> dict:
    trust = get_trust_service()

    if skill_id == "evaluate_agent":
        agent_id = _extract_agent_id(text)
        return trust.evaluate_agent(agent_id).model_dump()
    elif skill_id == "risk_check":
        agent_id = _extract_agent_id(text)
        return trust.risk_check(agent_id).model_dump()
    elif skill_id == "find_trusted_agents":
        return [a.model_dump() for a in trust.find_trusted_agents()]
    elif skill_id == "network_stats":
        return trust.network_stats().model_dump()
    else:
        # Try to infer from text
        try:
            agent_id = _extract_agent_id(text)
            return trust.evaluate_agent(agent_id).model_dump()
        except Exception:
            return trust.network_stats().model_dump()


def _extract_agent_id(text: str) -> int:
    import re
    match = re.search(r"\b(\d+)\b", text)
    if match:
        return int(match.group(1))
    raise ValueError("No agent ID found in request")
