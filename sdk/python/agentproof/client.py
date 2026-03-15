"""
AgentProof Python SDK — thin read-only API client.

All scoring, indexing, and oracle logic remains server-side.
This client only makes HTTP GET requests and returns typed dicts.
"""

from __future__ import annotations

from typing import Any, Optional

import httpx


class AgentProofError(Exception):
    """Raised when the AgentProof API returns a non-2xx response."""

    def __init__(self, status: int, body: str, path: str):
        self.status = status
        self.body = body
        self.path = path
        super().__init__(f"AgentProof API error {status} on {path}: {body}")


class AgentProof:
    """
    Official AgentProof API client.

    Usage::

        from agentproof import AgentProof

        client = AgentProof(api_key="your-key")
        agent = client.get_agent(42)
        print(agent["composite_score"], agent["tier"])
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.agentproof.xyz/api",
        timeout: float = 15.0,
    ):
        self._base = base_url.rstrip("/")
        self._client = httpx.Client(
            timeout=timeout,
            headers={"X-API-Key": api_key, "Accept": "application/json"},
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "AgentProof":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    # ── internal ────────────────────────────────────────────

    def _get(self, path: str, **params: Any) -> Any:
        clean = {k: v for k, v in params.items() if v is not None and v != ""}
        r = self._client.get(f"{self._base}{path}", params=clean)
        if r.status_code >= 400:
            raise AgentProofError(r.status_code, r.text, path)
        return r.json()

    # ── Trust Resolution ─────────────────────────────────────

    def get_score(self, address: str, chain: Optional[str] = None) -> dict:
        """
        Resolve an Ethereum address to its AgentProof trust score.

        Returns::

            {
                "address": "0x...",
                "agent_id": 42,
                "score": 72.5,
                "tier": "gold",
                "tier_num": 3,
                "updated_at": "2025-..."
            }

        Raises AgentProofError(404) if the address has no ERC-8004 identity.
        """
        params = {"chain": chain} if chain else {}
        clean = {k: v for k, v in params.items() if v is not None}
        r = self._client.get(
            f"{self._base.replace('/api', '')}/api/v1/hook/resolve/{address}",
            params=clean,
        )
        if r.status_code >= 400:
            raise AgentProofError(r.status_code, r.text, f"/hook/resolve/{address}")
        return r.json()

    def resolve_ens(self, ens_name: str) -> dict:
        """
        Resolve an ENS name to ERC-8004 agent(s) and trust scores.

        Returns::

            {
                "ens_name": "vitalik.eth",
                "address": "0xd8dA...",
                "agent_id": 42,
                "composite_score": 72.5,
                "tier": "gold",
                "agents": [...]
            }

        Raises AgentProofError(404) if the ENS name cannot be resolved
        or no agent is registered for the resolved address.
        """
        r = self._client.get(
            f"{self._base.replace('/api', '')}/api/v1/ens/{ens_name}",
        )
        if r.status_code >= 400:
            raise AgentProofError(r.status_code, r.text, f"/ens/{ens_name}")
        return r.json()

    def ens_trust(self, ens_name: str) -> dict:
        """
        Resolve ENS name and get full trust evaluation for the primary agent.
        Combines ENS resolution + trust evaluation in one call.
        """
        r = self._client.get(
            f"{self._base.replace('/api', '')}/api/v1/ens/{ens_name}/trust",
        )
        if r.status_code >= 400:
            raise AgentProofError(r.status_code, r.text, f"/ens/{ens_name}/trust")
        return r.json()

    # ── Agents ──────────────────────────────────────────────

    def list_agents(
        self,
        *,
        category: Optional[str] = None,
        chain: Optional[str] = None,
        search: Optional[str] = None,
        tier: Optional[str] = None,
        sort_by: Optional[str] = None,
        order: Optional[str] = None,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> dict:
        """List agents with optional filters. Returns {agents, total, page, page_size}."""
        return self._get(
            "/agents",
            category=category, chain=chain, search=search, tier=tier,
            sort_by=sort_by, order=order, page=page, page_size=page_size,
        )

    def get_agent(self, agent_id: int, chain: Optional[str] = None) -> dict:
        """Get full agent profile by ID."""
        return self._get(f"/agents/{agent_id}", chain=chain)

    def get_agent_feedback(
        self, agent_id: int, page: Optional[int] = None, page_size: Optional[int] = None
    ) -> dict:
        """Get paginated feedback for an agent."""
        return self._get(f"/agents/{agent_id}/feedback", page=page, page_size=page_size)

    def get_agent_validations(
        self, agent_id: int, page: Optional[int] = None, page_size: Optional[int] = None
    ) -> dict:
        """Get paginated validations for an agent."""
        return self._get(f"/agents/{agent_id}/validations", page=page, page_size=page_size)

    def get_score_history(self, agent_id: int) -> list[dict]:
        """Get score snapshots over time."""
        return self._get(f"/agents/{agent_id}/score-history").get("history", [])

    # ── Discover ────────────────────────────────────────────

    def search(
        self,
        *,
        q: Optional[str] = None,
        category: Optional[str] = None,
        tier: Optional[str] = None,
        chain: Optional[str] = None,
        min_score: Optional[int] = None,
        open_source: Optional[str] = None,
        audited: Optional[str] = None,
        autonomy_level: Optional[str] = None,
        financial_access: Optional[str] = None,
        sort: Optional[str] = None,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> dict:
        """Full-text search with filters. Returns {agents, total, page, page_size}."""
        return self._get(
            "/discover/search",
            q=q, category=category, tier=tier, chain=chain, min_score=min_score,
            open_source=open_source, audited=audited, autonomy_level=autonomy_level,
            financial_access=financial_access, sort=sort, page=page, page_size=page_size,
        )

    def trending(self, period: str = "7d", limit: int = 10) -> list[dict]:
        """Get trending agents by recent feedback volume."""
        return self._get("/discover/trending", period=period, limit=limit).get("trending", [])

    def newest(self, limit: int = 20) -> list[dict]:
        """Get most recently registered agents."""
        return self._get("/discover/new", limit=limit).get("agents", [])

    def similar(self, agent_id: int, limit: int = 5) -> list[dict]:
        """Find agents similar to a given agent."""
        return self._get(f"/discover/similar/{agent_id}", limit=limit).get("similar_agents", [])

    def compare(self, agent_ids: list[int]) -> list[dict]:
        """Compare 2-5 agents side by side."""
        return self._get("/discover/compare", agents=",".join(str(i) for i in agent_ids)).get("agents", [])

    def category_stats(self) -> list[dict]:
        """Get per-category statistics."""
        return self._get("/discover/categories/stats").get("categories", [])

    # ── Reputation ──────────────────────────────────────────

    def reputation_summary(self, agent_id: int) -> dict:
        """Get reputation summary: score, tier, rank, rating distribution."""
        return self._get(f"/reputation/{agent_id}/summary")

    def reputation_history(self, agent_id: int, limit: int = 30) -> list[dict]:
        """Get historical score snapshots."""
        return self._get(f"/reputation/{agent_id}/history", limit=limit).get("history", [])

    def deployer_profile(self, address: str) -> dict:
        """Get deployer reputation and their agent portfolio."""
        return self._get(f"/reputation/deployer/{address}")

    def max_exposure(self, agent_id: int) -> dict:
        """Get insurance exposure ceiling for an agent."""
        return self._get(f"/reputation/{agent_id}/max-exposure")

    # ── Leaderboard ─────────────────────────────────────────

    def leaderboard(
        self,
        *,
        category: Optional[str] = None,
        chain: Optional[str] = None,
        tier: Optional[str] = None,
        time_range: Optional[str] = None,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> dict:
        """Get ranked leaderboard with filters. Returns {entries, total, page, page_size}."""
        return self._get(
            "/leaderboard",
            category=category, chain=chain, tier=tier,
            time_range=time_range, page=page, page_size=page_size,
        )

    def movers(self, period: str = "7d", limit: int = 10) -> dict:
        """Get biggest score risers and fallers. Returns {risers, fallers}."""
        return self._get("/leaderboard/movers", period=period, limit=limit)

    # ── Analytics ───────────────────────────────────────────

    def overview(self) -> dict:
        """Get ecosystem overview: totals, category/tier/chain breakdowns."""
        return self._get("/analytics/overview")

    def trends(self, period: str = "30d") -> dict:
        """Get registration and feedback trends over time."""
        return self._get("/analytics/trends", period=period)

    # ── Monitoring ──────────────────────────────────────────

    def monitoring(self, agent_id: int) -> dict:
        """Get uptime monitoring overview for an agent."""
        return self._get(f"/monitoring/agent/{agent_id}")

    # ── Insurance ───────────────────────────────────────────

    def insurance(self, agent_id: int) -> dict:
        """Get insurance status for an agent."""
        return self._get(f"/insurance/agent/{agent_id}")
