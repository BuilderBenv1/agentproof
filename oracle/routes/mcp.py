"""
MCP Protocol route — Anthropic Model Context Protocol.
POST /mcp — JSON-RPC 2.0 handler for initialize, tools/list, tools/call.
"""

import logging
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from config import get_settings
from models import MCPToolDefinition, MCPToolInputSchema
from services.trust import get_trust_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["MCP Protocol"])

# ─── Tool definitions ─────────────────────────────────────────────────

MCP_TOOLS = [
    MCPToolDefinition(
        name="evaluate_agent",
        description="Get a comprehensive trust evaluation for an ERC-8004 agent. Returns composite score (0-100), tier (diamond/platinum/gold/silver/bronze/unranked), recommendation (TRUSTED/CAUTION/HIGH_RISK/UNVERIFIED), risk flags, and detailed score breakdown.",
        inputSchema=MCPToolInputSchema(
            type="object",
            properties={
                "agent_id": {
                    "type": "integer",
                    "description": "The ERC-8004 agent ID (token ID) to evaluate",
                }
            },
            required=["agent_id"],
        ),
    ),
    MCPToolDefinition(
        name="find_trusted_agents",
        description="Search for trusted agents in the ERC-8004 ecosystem. Filter by category, minimum score, tier, or feedback count. Returns a ranked list of agents.",
        inputSchema=MCPToolInputSchema(
            type="object",
            properties={
                "category": {
                    "type": "string",
                    "description": "Filter by category (defi, gaming, rwa, payments, data, general)",
                },
                "min_score": {
                    "type": "number",
                    "description": "Minimum composite score (0-100)",
                },
                "tier": {
                    "type": "string",
                    "description": "Filter by tier (diamond, platinum, gold, silver, bronze)",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results (default 20, max 100)",
                },
            },
            required=[],
        ),
    ),
    MCPToolDefinition(
        name="risk_check",
        description="Perform a risk assessment on an ERC-8004 agent. Checks for concentrated feedback, score volatility, low uptime, and other risk indicators. Returns risk level (low/medium/high/critical) and actionable recommendation.",
        inputSchema=MCPToolInputSchema(
            type="object",
            properties={
                "agent_id": {
                    "type": "integer",
                    "description": "The ERC-8004 agent ID to assess",
                }
            },
            required=["agent_id"],
        ),
    ),
    MCPToolDefinition(
        name="network_stats",
        description="Get aggregate statistics about the ERC-8004 agent network. Returns total registered agents, average trust score, tier distribution, total feedback count, and total validation count.",
        inputSchema=MCPToolInputSchema(
            type="object",
            properties={},
            required=[],
        ),
    ),
    MCPToolDefinition(
        name="hook_gate_check",
        description="Pre-check whether an agent would pass the AgentProofHook (ERC-8183) reputation gate. Simulates on-chain _gateProvider() logic: score threshold, tier minimum, score freshness. Returns allowed/rejected with reason.",
        inputSchema=MCPToolInputSchema(
            type="object",
            properties={
                "agent_id": {
                    "type": "integer",
                    "description": "The ERC-8004 agent ID to check",
                },
                "min_score": {
                    "type": "number",
                    "description": "Minimum score threshold (0-100, default 30)",
                },
                "min_tier": {
                    "type": "integer",
                    "description": "Minimum tier (0=unranked, 1=bronze, ..., 5=diamond, default 1)",
                },
                "max_score_age": {
                    "type": "integer",
                    "description": "Max score age in seconds (0=no expiry, default 3600)",
                },
            },
            required=["agent_id"],
        ),
    ),
    MCPToolDefinition(
        name="resolve_address",
        description="Resolve a wallet address to its ERC-8004 agent ID and trust score. Mirrors the on-chain AddressResolver contract.",
        inputSchema=MCPToolInputSchema(
            type="object",
            properties={
                "address": {
                    "type": "string",
                    "description": "The wallet address to resolve (0x...)",
                },
            },
            required=["address"],
        ),
    ),
    MCPToolDefinition(
        name="resolve_ens",
        description="Resolve an ENS name (e.g. vitalik.eth) to ERC-8004 agent ID(s) and trust scores. Chains ENS name → Ethereum address → agent lookup. Returns all agents owned by the resolved address.",
        inputSchema=MCPToolInputSchema(
            type="object",
            properties={
                "ens_name": {
                    "type": "string",
                    "description": "The ENS name to resolve (e.g. vitalik.eth, myagent.eth)",
                },
            },
            required=["ens_name"],
        ),
    ),
]


def _execute_tool(name: str, arguments: dict) -> Any:
    svc = get_trust_service()

    if name == "evaluate_agent":
        agent_id = arguments.get("agent_id")
        if agent_id is None:
            raise ValueError("agent_id is required")
        return svc.evaluate_agent(int(agent_id)).model_dump(mode="json")

    elif name == "find_trusted_agents":
        return [
            a.model_dump(mode="json")
            for a in svc.find_trusted_agents(
                category=arguments.get("category"),
                min_score=float(arguments.get("min_score", 0)),
                min_feedback=int(arguments.get("min_feedback", 0)),
                tier=arguments.get("tier"),
                limit=int(arguments.get("limit", 20)),
            )
        ]

    elif name == "risk_check":
        agent_id = arguments.get("agent_id")
        if agent_id is None:
            raise ValueError("agent_id is required")
        return svc.risk_check(int(agent_id)).model_dump(mode="json")

    elif name == "network_stats":
        return svc.network_stats().model_dump(mode="json")

    elif name == "hook_gate_check":
        agent_id = arguments.get("agent_id")
        if agent_id is None:
            raise ValueError("agent_id is required")
        from routes.hook import _check_agent_gate
        return _check_agent_gate(
            agent_id=int(agent_id),
            min_score=float(arguments.get("min_score", 30)),
            min_tier=int(arguments.get("min_tier", 1)),
            max_score_age=int(arguments.get("max_score_age", 3600)),
        )

    elif name == "resolve_address":
        addr = arguments.get("address")
        if not addr:
            raise ValueError("address is required")
        from routes.hook import _resolve_address
        return _resolve_address(addr)

    elif name == "resolve_ens":
        ens_name = arguments.get("ens_name")
        if not ens_name:
            raise ValueError("ens_name is required (e.g. vitalik.eth)")
        from services.ens import get_ens_service
        ens = get_ens_service()
        if not ens["configured"]:
            raise ValueError("ENS resolution requires Ethereum RPC — not configured")
        result = ens["resolve_to_agent"](ens_name)
        if result is None:
            raise ValueError(f"Could not resolve ENS name: {ens_name}")
        return result

    else:
        raise ValueError(f"Unknown tool: {name}")


@router.post("/mcp")
async def mcp_handler(request: Request):
    """MCP JSON-RPC 2.0 endpoint."""
    body = await request.json()

    jsonrpc = body.get("jsonrpc", "2.0")
    method = body.get("method", "")
    params = body.get("params", {})
    req_id = body.get("id")

    # ── initialize ────────────────────────────────────────────────────
    if method == "initialize":
        settings = get_settings()
        return JSONResponse(
            content={
                "jsonrpc": jsonrpc,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "serverInfo": {
                        "name": settings.oracle_agent_name,
                        "version": settings.oracle_version,
                    },
                    "capabilities": {
                        "tools": {"listChanged": False},
                    },
                },
                "id": req_id,
            }
        )

    # ── tools/list ────────────────────────────────────────────────────
    if method == "tools/list":
        return JSONResponse(
            content={
                "jsonrpc": jsonrpc,
                "result": {
                    "tools": [t.model_dump() for t in MCP_TOOLS],
                },
                "id": req_id,
            }
        )

    # ── tools/call ────────────────────────────────────────────────────
    if method == "tools/call":
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})

        try:
            result = _execute_tool(tool_name, arguments)
            return JSONResponse(
                content={
                    "jsonrpc": jsonrpc,
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": __import__("json").dumps(result, default=str),
                            }
                        ],
                        "isError": False,
                    },
                    "id": req_id,
                }
            )
        except ValueError as e:
            return JSONResponse(
                content={
                    "jsonrpc": jsonrpc,
                    "result": {
                        "content": [{"type": "text", "text": str(e)}],
                        "isError": True,
                    },
                    "id": req_id,
                }
            )
        except Exception as e:
            logger.error(f"MCP tool execution error: {e}")
            return JSONResponse(
                content={
                    "jsonrpc": jsonrpc,
                    "result": {
                        "content": [{"type": "text", "text": "Internal error"}],
                        "isError": True,
                    },
                    "id": req_id,
                }
            )

    # ── Unknown method ────────────────────────────────────────────────
    return JSONResponse(
        content={
            "jsonrpc": jsonrpc,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
            "id": req_id,
        }
    )
