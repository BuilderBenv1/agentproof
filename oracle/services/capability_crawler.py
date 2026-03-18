"""Capability crawler — indexes what agents can actually do.

Fetches agent URIs and A2A cards to extract capabilities, skills,
tools, and endpoints. Stores in agent_capabilities and agent_endpoints tables.

Built during Synthesis hackathon (March 2026).
"""

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

CRAWL_TIMEOUT = 10.0
MAX_CONCURRENT = 10
CAPABILITY_KEYWORDS = [
    "swap", "trade", "trading", "dex", "defi", "lending", "borrow",
    "yield", "stake", "staking", "bridge", "transfer", "payment",
    "audit", "security", "monitor", "alert", "risk",
    "data", "analytics", "analysis", "research", "report",
    "nft", "mint", "marketplace",
    "governance", "vote", "dao", "proposal",
    "chat", "nlp", "language", "translate",
    "code", "deploy", "solidity", "smart contract",
    "social", "messaging", "notification",
    "oracle", "price feed", "indexer",
    "wallet", "account", "custody",
    "insurance", "claim",
]


class CapabilityCrawler:
    """Crawls agent URIs and A2A endpoints to index capabilities."""

    def __init__(self, db: Any) -> None:
        self._db = db
        self._http = httpx.AsyncClient(
            timeout=CRAWL_TIMEOUT,
            follow_redirects=True,
            headers={"Accept": "application/json"},
        )
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def crawl_all(self, limit: int = 500) -> dict[str, int]:
        """Crawl agents that haven't been indexed yet or are stale."""
        # Get agents with URIs that haven't been capability-indexed recently
        result = self._db.table("agents").select(
            "agent_id, agent_uri, endpoints, source_chain"
        ).order(
            "registered_at", desc=True
        ).limit(limit).execute()

        agents = result.data or []
        if not agents:
            return {"crawled": 0, "capabilities_found": 0, "endpoints_found": 0}

        stats = {"crawled": 0, "capabilities_found": 0, "endpoints_found": 0}

        tasks = [self._crawl_agent(agent, stats) for agent in agents]
        await asyncio.gather(*tasks, return_exceptions=True)

        logger.info(
            f"Capability crawl complete — crawled={stats['crawled']} "
            f"capabilities={stats['capabilities_found']} "
            f"endpoints={stats['endpoints_found']}"
        )
        return stats

    async def _crawl_agent(self, agent: dict, stats: dict) -> None:
        """Crawl a single agent's URI and endpoints."""
        async with self._semaphore:
            agent_id = agent["agent_id"]
            agent_uri = agent.get("agent_uri", "")
            capabilities: set[str] = set()
            endpoints: dict[str, dict] = {}

            # 1. Fetch agent URI metadata
            if agent_uri and agent_uri.startswith("http"):
                meta = await self._fetch_json(agent_uri)
                if meta:
                    caps = self._extract_capabilities_from_metadata(meta)
                    capabilities.update(caps)

            # 2. Try A2A agent card
            base_urls = self._guess_base_urls(agent_uri, agent.get("endpoints"))
            for base_url in base_urls:
                a2a_url = f"{base_url}/.well-known/agent.json"
                card = await self._fetch_json(a2a_url)
                if card:
                    caps, eps = self._extract_from_a2a_card(card)
                    capabilities.update(caps)
                    endpoints["a2a"] = {
                        "url": a2a_url,
                        "version": card.get("version", ""),
                    }
                    # Extract skills as capabilities
                    for skill in card.get("skills", []):
                        skill_name = skill.get("name", "").lower()
                        skill_id = skill.get("id", "").lower()
                        if skill_name:
                            capabilities.add(skill_name)
                        if skill_id:
                            capabilities.add(skill_id)
                        for tag in skill.get("tags", []):
                            capabilities.add(tag.lower())
                    break  # Found a working A2A endpoint

            # 3. Extract from description/name
            name = agent.get("name", "") or ""
            description = agent.get("description", "") or ""
            # Agent table might not have description directly, check URI metadata
            text_caps = self._extract_keywords(f"{name} {description}")
            capabilities.update(text_caps)

            # 4. Store capabilities
            if capabilities:
                await self._store_capabilities(agent_id, capabilities)
                stats["capabilities_found"] += len(capabilities)

            # 5. Store endpoints
            if endpoints:
                await self._store_endpoints(agent_id, endpoints)
                stats["endpoints_found"] += len(endpoints)

            stats["crawled"] += 1

    async def _fetch_json(self, url: str) -> dict | None:
        """Fetch a URL and parse as JSON."""
        try:
            resp = await self._http.get(url)
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass
        return None

    def _guess_base_urls(self, agent_uri: str, endpoints: Any) -> list[str]:
        """Guess base URLs to try for A2A card discovery."""
        urls = []

        # From agent URI
        if agent_uri and agent_uri.startswith("http"):
            # Strip path to get base
            from urllib.parse import urlparse
            parsed = urlparse(agent_uri)
            base = f"{parsed.scheme}://{parsed.netloc}"
            if base not in urls:
                urls.append(base)

        # From endpoints JSONB
        if endpoints and isinstance(endpoints, list):
            for ep in endpoints:
                if isinstance(ep, str) and ep.startswith("http"):
                    from urllib.parse import urlparse
                    parsed = urlparse(ep)
                    base = f"{parsed.scheme}://{parsed.netloc}"
                    if base not in urls:
                        urls.append(base)
                elif isinstance(ep, dict):
                    url = ep.get("url", "")
                    if url.startswith("http"):
                        from urllib.parse import urlparse
                        parsed = urlparse(url)
                        base = f"{parsed.scheme}://{parsed.netloc}"
                        if base not in urls:
                            urls.append(base)

        return urls

    def _extract_capabilities_from_metadata(self, meta: dict) -> set[str]:
        """Extract capabilities from agent URI metadata JSON."""
        caps: set[str] = set()

        # Standard fields
        for field in ["capabilities", "skills", "tools", "domains", "tags"]:
            val = meta.get(field, [])
            if isinstance(val, list):
                for item in val:
                    if isinstance(item, str):
                        caps.add(item.lower().strip())
                    elif isinstance(item, dict):
                        name = item.get("name", "") or item.get("id", "")
                        if name:
                            caps.add(name.lower().strip())

        # Extract from description
        desc = meta.get("description", "")
        if desc:
            caps.update(self._extract_keywords(desc))

        # Properties / attributes (NFT-style metadata)
        for attr in meta.get("attributes", []):
            if isinstance(attr, dict):
                trait = attr.get("trait_type", "").lower()
                value = str(attr.get("value", "")).lower()
                if trait in ("capability", "skill", "domain", "category"):
                    caps.add(value)

        return caps

    def _extract_from_a2a_card(self, card: dict) -> tuple[set[str], dict]:
        """Extract capabilities and endpoints from A2A agent card."""
        caps: set[str] = set()
        endpoints: dict[str, str] = {}

        # Skills
        for skill in card.get("skills", []):
            caps.add(skill.get("id", "").lower())
            caps.add(skill.get("name", "").lower())
            for tag in skill.get("tags", []):
                caps.add(tag.lower())

        # Task categories
        for cat in card.get("task_categories", []):
            caps.add(cat.lower())

        # Tech stacks
        for tech in card.get("tech_stacks", []):
            caps.add(tech.lower())

        # URL
        url = card.get("url", "")
        if url:
            endpoints["a2a"] = url

        caps.discard("")
        return caps, endpoints

    def _extract_keywords(self, text: str) -> set[str]:
        """Extract capability keywords from free text."""
        if not text:
            return set()
        text_lower = text.lower()
        found = set()
        for kw in CAPABILITY_KEYWORDS:
            if kw in text_lower:
                found.add(kw)
        return found

    async def _store_capabilities(self, agent_id: int, capabilities: set[str]) -> None:
        """Upsert capabilities into agent_capabilities table."""
        capabilities.discard("")
        for cap in capabilities:
            cap_clean = cap[:100]  # truncate
            try:
                self._db.table("agent_capabilities").upsert(
                    {"agent_id": agent_id, "capability": cap_clean},
                    on_conflict="agent_id,capability",
                ).execute()
            except Exception as e:
                logger.debug(f"Capability upsert failed for agent #{agent_id}: {e}")

    async def _store_endpoints(self, agent_id: int, endpoints: dict) -> None:
        """Upsert endpoints into agent_endpoints table."""
        for ep_type, ep_data in endpoints.items():
            url = ep_data.get("url", ep_data) if isinstance(ep_data, dict) else str(ep_data)
            version = ep_data.get("version", "") if isinstance(ep_data, dict) else ""
            try:
                self._db.table("agent_endpoints").upsert(
                    {
                        "agent_id": agent_id,
                        "endpoint_type": ep_type,
                        "endpoint_url": url,
                        "version": version,
                    },
                    on_conflict="agent_id,endpoint_type",
                ).execute()
            except Exception as e:
                logger.debug(f"Endpoint upsert failed for agent #{agent_id}: {e}")

    async def close(self) -> None:
        await self._http.aclose()


async def search_by_capability(
    db: Any,
    capability: str,
    min_score: float = 0,
    min_tier: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """Search agents by capability, ranked by trust score."""
    # Find agent IDs with matching capability (partial match)
    cap_result = db.table("agent_capabilities").select(
        "agent_id"
    ).ilike(
        "capability", f"%{capability}%"
    ).execute()

    if not cap_result.data:
        return []

    agent_ids = list({r["agent_id"] for r in cap_result.data})

    # Fetch agent details with trust scores
    query = db.table("agents").select(
        "agent_id, name, description, category, composite_score, tier, "
        "total_feedback, source_chain, agent_uri, endpoints"
    ).in_("agent_id", agent_ids)

    if min_score > 0:
        query = query.gte("composite_score", min_score)
    if min_tier:
        query = query.eq("tier", min_tier)

    query = query.order("composite_score", desc=True).limit(limit)
    agents_result = query.execute()

    agents = agents_result.data or []

    # Attach capabilities to each agent
    for agent in agents:
        caps_result = db.table("agent_capabilities").select(
            "capability"
        ).eq("agent_id", agent["agent_id"]).execute()
        agent["capabilities"] = [c["capability"] for c in (caps_result.data or [])]

        # Attach endpoints
        eps_result = db.table("agent_endpoints").select(
            "endpoint_type, endpoint_url, version"
        ).eq("agent_id", agent["agent_id"]).execute()
        agent["indexed_endpoints"] = eps_result.data or []

    return agents
