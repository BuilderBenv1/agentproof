"""
A2A Protocol routes — Google Agent-to-Agent communication.
- GET /.well-known/agent.json  — agent card discovery (JSON for agents, HTML business card for browsers)
- POST /a2a                    — task execution (JSON-RPC 2.0)
"""

import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, HTMLResponse

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
            A2ASkill(
                id="hook_gate_check",
                name="Hook Gate Check",
                description="Pre-check whether an agent would pass the AgentProofHook (ERC-8183) reputation gate. Simulates on-chain gating: score threshold, tier minimum, score freshness.",
                tags=["hook", "gate", "erc8183", "check"],
                examples=["Would agent 42 pass the hook?", "Check if agent 100 meets bronze tier"],
            ),
            A2ASkill(
                id="resolve_address",
                name="Resolve Address",
                description="Resolve a wallet address to its ERC-8004 agent ID and trust score. Mirrors the on-chain AddressResolver contract.",
                tags=["address", "resolve", "identity"],
                examples=["Resolve 0x1234... to agent ID", "What agent owns this wallet?"],
            ),
            A2ASkill(
                id="resolve_ens",
                name="Resolve ENS Name",
                description="Resolve an ENS name (e.g. vitalik.eth) to its ERC-8004 agent ID(s) and trust scores. Chains ENS → address → agent lookup.",
                tags=["ens", "resolve", "identity", "ethereum"],
                examples=["Look up vitalik.eth", "What agent is behind myagent.eth?"],
            ),
        ],
        provider=A2AProvider(
            organization="AgentProof",
            url="https://agentproof.sh",
        ),
    )
    return card.model_dump()


def _render_agent_card_html(card: dict) -> str:
    """Render the A2A agent card as a self-contained HTML business card."""
    skills = card.get("skills", [])
    provider = card.get("provider", {})
    capabilities = card.get("capabilities", {})

    skill_tags_html = ""
    for skill in skills:
        tags = "".join(f'<span class="tag">{t}</span>' for t in skill.get("tags", []))
        examples = "".join(f"<li>{e}</li>" for e in skill.get("examples", []))
        skill_tags_html += f"""
        <div class="skill">
            <div class="skill-header">
                <span class="skill-name">{skill['name']}</span>
                <span class="skill-id">{skill['id']}</span>
            </div>
            <p class="skill-desc">{skill['description']}</p>
            <div class="tags">{tags}</div>
            {f'<ul class="examples">{examples}</ul>' if examples else ''}
        </div>"""

    caps = []
    if capabilities.get("streaming"):
        caps.append("Streaming")
    if capabilities.get("pushNotifications"):
        caps.append("Push Notifications")
    caps_html = ", ".join(caps) if caps else "Request/Response"

    json_blob = json.dumps(card, indent=2)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{card['name']} — A2A Agent Card</title>
<style>
  :root {{
    --bg: #0a0a0a;
    --surface: #111113;
    --border: #1e1e22;
    --border-hover: #2d5a3d;
    --text: #e4e4e7;
    --muted: #71717a;
    --accent: #34d399;
    --accent-dim: #065f46;
    --accent-glow: rgba(52, 211, 153, 0.08);
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1rem;
  }}
  .card {{
    max-width: 640px;
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 0 80px rgba(52, 211, 153, 0.04);
  }}
  .card-header {{
    padding: 2rem 2rem 1.5rem;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(135deg, var(--accent-glow), transparent 60%);
  }}
  .card-header .badge {{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    background: var(--accent-dim);
    padding: 4px 10px;
    border-radius: 6px;
    margin-bottom: 12px;
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
  }}
  .card-header .badge .dot {{
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse 2s infinite;
  }}
  @keyframes pulse {{
    0%, 100% {{ opacity: 1; }}
    50% {{ opacity: 0.4; }}
  }}
  .card-header h1 {{
    font-size: 1.5rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 6px;
  }}
  .card-header .version {{
    font-family: 'SF Mono', 'Cascadia Code', monospace;
    font-size: 12px;
    color: var(--muted);
  }}
  .card-header .description {{
    margin-top: 10px;
    font-size: 14px;
    color: var(--muted);
    line-height: 1.5;
  }}
  .meta {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--border);
    border-bottom: 1px solid var(--border);
  }}
  .meta-item {{
    background: var(--surface);
    padding: 14px 20px;
  }}
  .meta-item .label {{
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    font-family: 'SF Mono', 'Cascadia Code', monospace;
    margin-bottom: 4px;
  }}
  .meta-item .value {{
    font-size: 13px;
    color: var(--text);
    font-family: 'SF Mono', 'Cascadia Code', monospace;
  }}
  .meta-item .value a {{
    color: var(--accent);
    text-decoration: none;
  }}
  .meta-item .value a:hover {{ text-decoration: underline; }}
  .skills-section {{
    padding: 1.5rem 2rem;
  }}
  .skills-section h2 {{
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    font-family: 'SF Mono', 'Cascadia Code', monospace;
    margin-bottom: 16px;
  }}
  .skill {{
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 10px;
    transition: border-color 0.2s;
  }}
  .skill:hover {{ border-color: var(--border-hover); }}
  .skill-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }}
  .skill-name {{
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }}
  .skill-id {{
    font-size: 11px;
    font-family: 'SF Mono', 'Cascadia Code', monospace;
    color: var(--muted);
    background: var(--surface);
    padding: 2px 8px;
    border-radius: 4px;
  }}
  .skill-desc {{
    font-size: 13px;
    color: var(--muted);
    line-height: 1.45;
    margin-bottom: 8px;
  }}
  .tags {{
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }}
  .tag {{
    font-size: 10px;
    font-family: 'SF Mono', 'Cascadia Code', monospace;
    color: var(--accent);
    background: var(--accent-dim);
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
  }}
  .examples {{
    margin-top: 8px;
    padding-left: 16px;
    list-style: none;
  }}
  .examples li {{
    font-size: 12px;
    color: var(--muted);
    font-style: italic;
    padding: 2px 0;
  }}
  .examples li::before {{
    content: '"';
    color: var(--accent);
    font-weight: bold;
  }}
  .examples li::after {{
    content: '"';
    color: var(--accent);
    font-weight: bold;
  }}
  .json-toggle {{
    padding: 1rem 2rem 1.5rem;
    border-top: 1px solid var(--border);
  }}
  .json-toggle summary {{
    font-size: 12px;
    font-family: 'SF Mono', 'Cascadia Code', monospace;
    color: var(--muted);
    cursor: pointer;
    user-select: none;
    padding: 6px 0;
  }}
  .json-toggle summary:hover {{ color: var(--accent); }}
  .json-toggle pre {{
    margin-top: 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    overflow-x: auto;
    font-size: 11px;
    font-family: 'SF Mono', 'Cascadia Code', monospace;
    color: var(--muted);
    line-height: 1.5;
    max-height: 400px;
    overflow-y: auto;
  }}
  .footer {{
    padding: 1rem 2rem;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}
  .footer .org {{
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }}
  .footer .org a {{ color: var(--accent); text-decoration: none; }}
  .footer .org a:hover {{ text-decoration: underline; }}
  .footer .protocol {{
    font-size: 10px;
    font-family: 'SF Mono', 'Cascadia Code', monospace;
    color: var(--muted);
    letter-spacing: 0.05em;
  }}
  .hint {{
    margin-top: 1rem;
    font-size: 11px;
    font-family: 'SF Mono', 'Cascadia Code', monospace;
    color: var(--muted);
    text-align: center;
    opacity: 0.5;
  }}
</style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <div class="badge"><span class="dot"></span> A2A Agent</div>
      <h1>{card['name']}</h1>
      <span class="version">v{card['version']}</span>
      <p class="description">{card['description']}</p>
    </div>
    <div class="meta">
      <div class="meta-item">
        <div class="label">Endpoint</div>
        <div class="value"><a href="{card['url']}">{card['url']}</a></div>
      </div>
      <div class="meta-item">
        <div class="label">Protocol</div>
        <div class="value">{caps_html}</div>
      </div>
      <div class="meta-item">
        <div class="label">Provider</div>
        <div class="value">{provider.get('organization', 'Unknown')}</div>
      </div>
      <div class="meta-item">
        <div class="label">Skills</div>
        <div class="value">{len(skills)}</div>
      </div>
    </div>
    <div class="skills-section">
      <h2>Skills</h2>
      {skill_tags_html}
    </div>
    <div class="json-toggle">
      <details>
        <summary>View raw JSON (machine-readable)</summary>
        <pre><code>{json_blob}</code></pre>
      </details>
    </div>
    <div class="footer">
      <div class="org"><a href="{provider.get('url', '#')}">{provider.get('organization', '')}</a></div>
      <div class="protocol">Google A2A Protocol</div>
    </div>
  </div>
  <div class="hint">Agents: fetch this URL with Accept: application/json</div>
</body>
</html>"""


@router.get("/.well-known/agent.json")
async def agent_card(request: Request):
    """A2A agent card discovery endpoint. Serves HTML for browsers, JSON for agents."""
    card = _build_agent_card()
    accept = request.headers.get("accept", "")
    if "text/html" in accept and "application/json" not in accept:
        return HTMLResponse(content=_render_agent_card_html(card))
    return JSONResponse(content=card)


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
    elif "hook" in text_lower or "gate" in text_lower or "pass" in text_lower:
        agent_id = _extract_agent_id(text)
        return "hook_gate_check", {"agent_id": agent_id} if agent_id else {}
    elif "ens" in text_lower or ".eth" in text_lower:
        import re
        ens_match = re.search(r"([a-zA-Z0-9\-]+\.eth)", text)
        if ens_match:
            return "resolve_ens", {"ens_name": ens_match.group(1)}
        return "resolve_ens", {}
    elif "resolve" in text_lower or "address" in text_lower or "wallet" in text_lower:
        # Try to extract 0x address
        import re
        addr_match = re.search(r"(0x[a-fA-F0-9]{40})", text)
        if addr_match:
            return "resolve_address", {"address": addr_match.group(1)}
        return "resolve_address", {}

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

    elif skill_id == "hook_gate_check":
        agent_id = params.get("agent_id")
        if not agent_id:
            return {"error": "agent_id is required"}
        from routes.hook import _check_agent_gate
        return _check_agent_gate(
            agent_id=int(agent_id),
            min_score=float(params.get("min_score", 30)),
            min_tier=int(params.get("min_tier", 1)),
            max_score_age=int(params.get("max_score_age", 3600)),
        )

    elif skill_id == "resolve_address":
        address = params.get("address")
        if not address:
            return {"error": "address is required"}
        from routes.hook import _resolve_address
        try:
            return _resolve_address(address)
        except ValueError as e:
            return {"error": str(e)}

    elif skill_id == "resolve_ens":
        ens_name = params.get("ens_name")
        if not ens_name:
            return {"error": "ens_name is required (e.g. vitalik.eth)"}
        from services.ens import get_ens_service
        ens = get_ens_service()
        if not ens["configured"]:
            return {"error": "ENS resolution requires Ethereum RPC — not configured"}
        result = ens["resolve_to_agent"](ens_name)
        if result is None:
            return {"error": f"Could not resolve ENS name: {ens_name}"}
        return result

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
