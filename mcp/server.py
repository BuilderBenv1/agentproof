"""
AgentProof MCP Server — Unified Model Context Protocol server for the
ERC-8004 agent ecosystem on Avalanche.

Exposes 15 tools spanning trust evaluation, DeFi intelligence, rug auditing,
whale tracking, liquidation monitoring, narrative analysis, and trading bots.

Transports:
  - stdio  (default) — for Claude Desktop / local AI clients
  - sse               — for Railway deployment / remote access
"""

import json
import os
from typing import Optional

import httpx
from fastmcp import FastMCP

# ── Configuration ────────────────────────────────────────────────────────────

BACKEND_URL = os.getenv(
    "BACKEND_URL",
    "https://agent-eco-system-production.up.railway.app",
)
ORACLE_URL = os.getenv(
    "ORACLE_URL",
    "https://oracle.agentproof.sh",
)
API_KEY = os.getenv("API_KEY", "")

# ── MCP Server ───────────────────────────────────────────────────────────────

mcp = FastMCP(
    "AgentProof",
    instructions=(
        "Trust oracle and AI agent intelligence for the Avalanche ecosystem. "
        "Query agent reputation scores, DeFi yield opportunities with risk metrics, "
        "rug-pull audits, whale movement alerts, liquidation risks, market narratives, "
        "multi-agent convergence signals, and trading bot performance. "
        "Powered by 11 autonomous agents and the ERC-8004 on-chain identity standard."
    ),
)


# ── HTTP helpers ─────────────────────────────────────────────────────────────

async def _backend_get(path: str, params: dict | None = None) -> dict | list:
    """GET request to the Avax Agents backend (11-agent gateway)."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{BACKEND_URL}{path}",
            params={k: v for k, v in (params or {}).items() if v is not None},
            headers={"x-api-key": API_KEY},
        )
        resp.raise_for_status()
        return resp.json()


async def _backend_post(path: str, json_body: dict | None = None) -> dict:
    """POST request to the Avax Agents backend."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{BACKEND_URL}{path}",
            json=json_body,
            headers={"x-api-key": API_KEY},
        )
        resp.raise_for_status()
        return resp.json()


async def _oracle_get(path: str, params: dict | None = None) -> dict | list:
    """GET request to the AgentProof Trust Oracle."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{ORACLE_URL}{path}",
            params={k: v for k, v in (params or {}).items() if v is not None},
        )
        resp.raise_for_status()
        return resp.json()


def _fmt(data) -> str:
    """Format data as indented JSON string for MCP tool output."""
    return json.dumps(data, indent=2, default=str)


# ═══════════════════════════════════════════════════════════════════════════════
# TRUST TOOLS (from AgentProof Oracle — ERC-8004 reputation)
# ═══════════════════════════════════════════════════════════════════════════════


@mcp.tool()
async def evaluate_agent(agent_id: int) -> str:
    """Get a comprehensive trust evaluation for an ERC-8004 registered AI agent.

    Returns composite score (0-100), tier (diamond/platinum/gold/silver/bronze/unranked),
    recommendation (TRUSTED/CAUTION/HIGH_RISK/UNVERIFIED), risk flags, validation rate,
    feedback count, account age, and detailed score breakdown.

    Args:
        agent_id: The ERC-8004 agent ID (on-chain token ID) to evaluate.
    """
    data = await _oracle_get(f"/api/v1/trust/{agent_id}")
    return _fmt(data)


@mcp.tool()
async def find_trusted_agents(
    category: Optional[str] = None,
    min_score: float = 0,
    tier: Optional[str] = None,
    limit: int = 20,
) -> str:
    """Search for trusted AI agents in the ERC-8004 ecosystem.

    Filter by category, minimum trust score, or tier. Returns a ranked list
    of agents with their scores and metadata.

    Args:
        category: Filter by category — defi, gaming, rwa, payments, data, general.
        min_score: Minimum composite trust score (0-100).
        tier: Filter by tier — diamond, platinum, gold, silver, bronze.
        limit: Maximum results to return (default 20, max 100).
    """
    params: dict = {"min_score": min_score, "limit": limit}
    if category:
        params["category"] = category
    if tier:
        params["tier"] = tier
    data = await _oracle_get("/api/v1/agents/trusted", params)
    return _fmt(data)


@mcp.tool()
async def risk_check(agent_id: int) -> str:
    """Perform a risk assessment on an ERC-8004 AI agent.

    Checks for concentrated feedback, score volatility, low uptime, and other
    risk indicators. Returns risk level (low/medium/high/critical), specific
    risk flags, and an actionable recommendation.

    Args:
        agent_id: The ERC-8004 agent ID to assess.
    """
    data = await _oracle_get(f"/api/v1/trust/{agent_id}/risk")
    return _fmt(data)


@mcp.tool()
async def deployer_reputation(owner_address: str) -> str:
    """Get reputation data for a deployer (wallet that registered agents).

    Returns deployer score (0-100), total/active/abandoned agent counts,
    average agent score, label (established/new_deployer/serial_deployer_warning),
    and top 20 agents by score.

    Args:
        owner_address: The deployer wallet address (0x...).
    """
    data = await _oracle_get(f"/api/reputation/deployer/{owner_address}")
    return _fmt(data)


@mcp.tool()
async def network_stats() -> str:
    """Get aggregate statistics about the ERC-8004 agent network on Avalanche.

    Returns total registered agents, average trust score, tier distribution,
    total feedback count, and total validation count.
    """
    data = await _oracle_get("/api/v1/network/stats")
    return _fmt(data)


# ═══════════════════════════════════════════════════════════════════════════════
# INTELLIGENCE TOOLS (from 11-agent backend)
# ═══════════════════════════════════════════════════════════════════════════════


@mcp.tool()
async def get_yield_opportunities(
    protocol: Optional[str] = None,
    min_apy: float = 0,
    max_risk: int = 100,
    sort_by: str = "risk_adjusted_apy",
    limit: int = 10,
) -> str:
    """Find DeFi yield opportunities on Avalanche with advanced risk metrics.

    Each opportunity includes APY, TVL, risk score, Sharpe ratio, Sortino ratio,
    max drawdown, 30-day volatility, Value-at-Risk (95%), and a recommendation
    (strong_buy/buy/hold/avoid).

    Args:
        protocol: Filter by protocol — aave, benqi, trader_joe, gmx, pangolin.
        min_apy: Minimum APY percentage (default 0).
        max_risk: Maximum risk score 0-100 (default 100 = no filter).
        sort_by: Sort field — apy, risk_adjusted_apy, tvl_usd, risk_score, sharpe_ratio.
        limit: Number of results (default 10, max 100).
    """
    params: dict = {
        "limit": limit,
        "min_apy": min_apy,
        "max_risk": max_risk,
        "sort_by": sort_by,
    }
    if protocol:
        params["protocol"] = protocol
    data = await _backend_get("/api/v1/yield/opportunities", params)
    return _fmt(data)


@mcp.tool()
async def get_top_yields() -> str:
    """Get the top 10 risk-adjusted DeFi yield opportunities on Avalanche.

    Returns the best opportunities ranked by risk-adjusted APY, each with
    protocol, pool, APY, TVL, risk score, and Sharpe ratio.
    """
    data = await _backend_get("/api/v1/yield/opportunities/top")
    return _fmt(data)


@mcp.tool()
async def audit_contract(contract_address: str) -> str:
    """Scan a smart contract on Avalanche for rug-pull and scam indicators.

    Analyzes honeypot risk, ownership concentration, liquidity lock status,
    code similarity to known rugs, and tax manipulation. Returns an overall
    risk score (0-100), risk label (safe/caution/danger/rug), and red flags.

    This triggers a live scan — may take a few seconds.

    Args:
        contract_address: The contract address to audit (0x...).
    """
    data = await _backend_post(
        "/api/v1/auditor/scan",
        {"contract_address": contract_address},
    )
    return _fmt(data)


@mcp.tool()
async def get_contract_scan(contract_address: str) -> str:
    """Look up existing rug-audit results for a contract on Avalanche.

    Returns the cached scan if available — risk score, risk label, honeypot score,
    ownership concentration, liquidity lock status, red flags, and actual outcome
    (if tracked).

    Args:
        contract_address: The contract address to look up (0x...).
    """
    data = await _backend_get(f"/api/v1/auditor/scans/{contract_address}")
    return _fmt(data)


@mcp.tool()
async def get_whale_transactions(
    tx_type: Optional[str] = None,
    min_usd: float = 0,
    since: Optional[str] = None,
    limit: int = 20,
) -> str:
    """Get recent whale transactions on Avalanche.

    Tracks large transactions (>$10K) from known whale wallets including
    VCs, market makers, and protocol treasuries.

    Args:
        tx_type: Filter by type — buy, sell, transfer.
        min_usd: Minimum transaction value in USD (default 0).
        since: Time filter — 1d, 7d, 30d, 90d, 365d.
        limit: Number of results (default 20, max 100).
    """
    params: dict = {"limit": limit}
    if tx_type:
        params["tx_type"] = tx_type
    if min_usd > 0:
        params["min_usd"] = min_usd
    if since:
        params["since"] = since
    data = await _backend_get("/api/v1/whale/transactions", params)
    return _fmt(data)


@mcp.tool()
async def get_liquidation_risks(
    risk_level: Optional[str] = None,
    protocol: Optional[str] = None,
) -> str:
    """Get lending positions at risk of liquidation on Avalanche DeFi protocols.

    Monitors positions on Aave, Benqi, and other lending protocols. Returns
    health factor, collateral, debt, risk level (low/medium/high/critical),
    and predicted liquidation price.

    Args:
        risk_level: Filter by risk — low, medium, high, critical.
        protocol: Filter by protocol — aave, benqi.
    """
    params: dict = {}
    if risk_level:
        params["risk_level"] = risk_level
    if protocol:
        params["protocol"] = protocol
    data = await _backend_get("/api/v1/liquidation/positions", params)
    return _fmt(data)


@mcp.tool()
async def get_narrative_trends(
    category: Optional[str] = None,
    momentum: Optional[str] = None,
    limit: int = 20,
) -> str:
    """Get current market narrative trends and sentiment on Avalanche.

    Analyzes news, social media, and on-chain data to identify trending
    narratives, their strength, momentum (rising/stable/falling), and
    related tokens.

    Args:
        category: Filter by narrative category.
        momentum: Filter by momentum — rising, stable, falling.
        limit: Number of trends to return (default 20).
    """
    params: dict = {"limit": limit}
    if category:
        params["category"] = category
    if momentum:
        params["momentum"] = momentum
    data = await _backend_get("/api/v1/narrative/trends", params)
    return _fmt(data)


@mcp.tool()
async def get_convergence_signals(limit: int = 20) -> str:
    """Get multi-agent convergence signals — when multiple intelligence agents
    independently flag the same token or event.

    High convergence scores indicate strong consensus across whale tracking,
    narrative analysis, rug auditing, and other agents.

    Args:
        limit: Number of signals to return (default 20).
    """
    data = await _backend_get("/api/v1/convergence/signals", {"limit": limit})
    return _fmt(data)


@mcp.tool()
async def get_agent_accuracy() -> str:
    """Get prediction accuracy metrics across all intelligence agents.

    Returns accuracy stats for the Rug Auditor (flagged vs confirmed rugs),
    Liquidation Sentinel (predicted vs actual liquidations), and Yield Oracle
    (Sharpe ratios, strong buy counts).
    """
    data = await _backend_get("/api/v1/analytics/accuracy")
    return _fmt(data)


# ═══════════════════════════════════════════════════════════════════════════════
# TRADING BOT TOOLS
# ═══════════════════════════════════════════════════════════════════════════════


@mcp.tool()
async def get_sniper_launches(limit: int = 20) -> str:
    """Get recently detected token launches on Avalanche DEXes.

    The Sniper Bot monitors Trader Joe Factory for PairCreated events and runs
    safety filters (liquidity check, contract audit, LP lock). Returns token
    address, symbol, initial liquidity, whether it passed filters, and rejection
    reason if applicable.

    Args:
        limit: Number of launches to return (default 20, max 200).
    """
    data = await _backend_get("/api/v1/sniper/launches", {"limit": limit})
    return _fmt(data)


@mcp.tool()
async def get_dca_stats() -> str:
    """Get Dollar-Cost Averaging bot performance statistics.

    Returns total DCA configs, active configs, total USD invested, total
    purchases executed, and number of dip buys triggered.
    """
    data = await _backend_get("/api/v1/dca/stats")
    return _fmt(data)


# ═══════════════════════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "stdio")
    if transport == "sse":
        mcp.run(
            transport="sse",
            host="0.0.0.0",
            port=int(os.getenv("PORT", "8002")),
        )
    else:
        mcp.run()  # stdio for Claude Desktop
