"""
A2A Protocol routes — Google Agent-to-Agent communication.
- GET /.well-known/agent.json  — agent card discovery
- POST /a2a                    — task execution (JSON-RPC 2.0)
"""

import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from config import get_settings
from models import (
    A2AAgentCard,
    A2ASkill,
    A2AProvider,
    A2ACapabilities,
    A2ARequest,
    A2AResponse,
    A2ATaskResult,
    A2ATaskStatus,
    A2AArtifact,
    A2AMessage,
)
from services.trust import get_trust_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["A2A Protocol"])


def _build_agent_card() -> dict:
    settings = get_settings()
    card = A2AAgentCard(
        name=settings.oracle_agent_name,
        description=settings.oracle_agent_description,
        url=settings.oracle_base_url,
        version=settings.oracle_version,
        capabilities=A2ACapabilities(streaming=False, pushNotifications=False),
        skills=[
            A2ASkill(
                id="evaluate_agent",
                name="Evaluate Agent Trust",
                description="Get a comprehensive trust evaluation for an ERC-8004 agent including composite score, tier, risk flags, and recommendation.",
                tags=["trust", "reputation", "evaluation"],
                examples=["Evaluate agent 42", "What is the trust score for agent 100?"],
            ),
            A2ASkill(
                id="find_trusted_agents",
                name="Find Trusted Agents",
                description="Search for trusted agents by category, minimum score, tier, or feedback count.",
                tags=["search", "discovery", "agents"],
                examples=["Find top DeFi agents", "List gold-tier agents"],
            ),
            A2ASkill(
                id="risk_check",
                name="Risk Assessment",
                description="Perform a risk assessment on an agent, checking for concentrated feedback, score volatility, and other risk indicators.",
                tags=["risk", "safety", "assessment"],
                examples=["Is agent 42 safe to work with?", "Risk check agent 100"],
            ),
            A2ASkill(
                id="network_stats",
                name="Network Statistics",
                description="Get aggregate statistics about the agent network including total agents, average scores, and tier distribution.",
                tags=["stats", "analytics", "network"],
                examples=["How many agents are registered?", "Network overview"],
            ),
        ],
        provider=A2AProvider(
            organization="AgentProof",
            url="https://agentproof.sh",
        ),
    )
    return card.model_dump()


@router.get("/.well-known/agent.json")
async def agent_card():
    """A2A agent card discovery endpoint."""
    return JSONResponse(content=_build_agent_card())


def _parse_skill_request(message: dict) -> tuple[str, dict]:
    """Extract skill_id and parameters from an A2A message."""
    parts = message.get("parts", [])
    text = ""
    for part in parts:
        if "text" in part:
            text = part["text"]
            break
        if "data" in part:
            data = part["data"]
            skill_id = data.get("skill_id", "")
            params = {k: v for k, v in data.items() if k != "skill_id"}
            return skill_id, params

    # Try to parse skill_id from text
    text_lower = text.lower().strip()
    if "evaluate" in text_lower or "trust score" in text_lower:
        # Extract agent_id from text
        agent_id = _extract_agent_id(text)
        return "evaluate_agent", {"agent_id": agent_id} if agent_id else {}
    elif "find" in text_lower or "search" in text_lower or "list" in text_lower:
        return "find_trusted_agents", {}
    elif "risk" in text_lower:
        agent_id = _extract_agent_id(text)
        return "risk_check", {"agent_id": agent_id} if agent_id else {}
    elif "stats" in text_lower or "network" in text_lower or "overview" in text_lower:
        return "network_stats", {}

    return "", {}


def _extract_agent_id(text: str) -> int | None:
    import re

    match = re.search(r"(?:agent\s*#?\s*|id\s*:?\s*)(\d+)", text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    # Try bare number
    numbers = re.findall(r"\d+", text)
    if numbers:
        return int(numbers[0])
    return None


def _execute_skill(skill_id: str, params: dict) -> Any:
    svc = get_trust_service()

    if skill_id == "evaluate_agent":
        agent_id = params.get("agent_id")
        if not agent_id:
            return {"error": "agent_id is required"}
        return svc.evaluate_agent(int(agent_id)).model_dump(mode="json")

    elif skill_id == "find_trusted_agents":
        return [
            a.model_dump(mode="json")
            for a in svc.find_trusted_agents(
                category=params.get("category"),
                min_score=float(params.get("min_score", 0)),
                min_feedback=int(params.get("min_feedback", 0)),
                tier=params.get("tier"),
                limit=int(params.get("limit", 20)),
            )
        ]

    elif skill_id == "risk_check":
        agent_id = params.get("agent_id")
        if not agent_id:
            return {"error": "agent_id is required"}
        return svc.risk_check(int(agent_id)).model_dump(mode="json")

    elif skill_id == "network_stats":
        return svc.network_stats().model_dump(mode="json")

    else:
        return {"error": f"Unknown skill: {skill_id}"}


@router.post("/a2a")
async def a2a_handler(request: Request):
    """A2A JSON-RPC 2.0 task handler."""
    body = await request.json()

    jsonrpc = body.get("jsonrpc", "2.0")
    method = body.get("method", "")
    params = body.get("params", {})
    req_id = body.get("id")

    if method != "tasks/send":
        return JSONResponse(
            content={
                "jsonrpc": jsonrpc,
                "error": {"code": -32601, "message": f"Method not found: {method}"},
                "id": req_id,
            }
        )

    # Extract message and skill
    message = params.get("message", {})
    skill_id = params.get("skill_id", "")

    if not skill_id:
        skill_id, skill_params = _parse_skill_request(message)
    else:
        skill_params = {k: v for k, v in params.items() if k not in ("message", "skill_id", "id")}

    if not skill_id:
        return JSONResponse(
            content={
                "jsonrpc": jsonrpc,
                "error": {"code": -32602, "message": "Could not determine skill from request"},
                "id": req_id,
            }
        )

    try:
        result_data = _execute_skill(skill_id, skill_params)
    except ValueError as e:
        return JSONResponse(
            content={
                "jsonrpc": jsonrpc,
                "error": {"code": -32602, "message": str(e)},
                "id": req_id,
            }
        )
    except Exception as e:
        logger.error(f"A2A skill execution error: {e}")
        return JSONResponse(
            content={
                "jsonrpc": jsonrpc,
                "error": {"code": -32603, "message": "Internal error"},
                "id": req_id,
            }
        )

    task_id = params.get("id", str(uuid.uuid4()))
    task_result = A2ATaskResult(
        id=task_id,
        status=A2ATaskStatus(
            state="completed",
            message=A2AMessage(
                role="agent",
                parts=[{"text": f"Completed {skill_id} successfully"}],
            ),
        ),
        artifacts=[
            A2AArtifact(
                name="result",
                parts=[{"data": result_data}],
            )
        ],
    )

    return JSONResponse(
        content={
            "jsonrpc": jsonrpc,
            "result": task_result.model_dump(mode="json"),
            "id": req_id,
        }
    )
