"""
ENS resolution for Agent402 oracle.
Thin wrapper — resolves ENS names via Ethereum RPC and looks up agents in Supabase.
"""

import hashlib
import logging
import threading
import time

import httpx

logger = logging.getLogger(__name__)

ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
RESOLVER_SEL = "0x0178b8bf"
ADDR_SEL = "0x3b3b57de"

_ens_cache: dict[str, tuple[str, float]] = {}
_cache_lock = threading.Lock()
_CACHE_TTL = 600


def _namehash(name: str) -> bytes:
    node = b"\x00" * 32
    if name:
        for label in reversed(name.split(".")):
            label_hash = hashlib.sha3_256(label.encode("utf-8")).digest()
            node = hashlib.sha3_256(node + label_hash).digest()
    return node


def _eth_call(rpc_url: str, to: str, data: str) -> str:
    resp = httpx.post(
        rpc_url,
        json={"jsonrpc": "2.0", "method": "eth_call", "params": [{"to": to, "data": data}, "latest"], "id": 1},
        timeout=10,
    )
    result = resp.json()
    if "error" in result:
        raise ValueError(result["error"].get("message", "RPC error"))
    return result.get("result", "0x")


def resolve_ens_name(name: str, eth_rpc_url: str) -> str | None:
    name = name.lower().strip()
    if not name.endswith(".eth") and "." not in name:
        name += ".eth"

    with _cache_lock:
        cached = _ens_cache.get(name)
        if cached and time.monotonic() < cached[1]:
            return cached[0]

    if not eth_rpc_url:
        return None

    try:
        node = "0x" + _namehash(name).hex()
        resolver_hex = _eth_call(eth_rpc_url, ENS_REGISTRY, RESOLVER_SEL + node[2:])
        if not resolver_hex or len(resolver_hex) < 42:
            return None
        resolver_addr = "0x" + resolver_hex[-40:]
        if resolver_addr == "0x" + "0" * 40:
            return None

        addr_hex = _eth_call(eth_rpc_url, resolver_addr, ADDR_SEL + node[2:])
        if not addr_hex or len(addr_hex) < 42:
            return None
        address = "0x" + addr_hex[-40:]
        if address == "0x" + "0" * 40:
            return None

        with _cache_lock:
            _ens_cache[name] = (address, time.monotonic() + _CACHE_TTL)
        return address
    except Exception as e:
        logger.warning(f"[ens] Failed to resolve {name}: {e}")
        return None


def resolve_ens_to_agent(name: str, eth_rpc_url: str) -> dict | None:
    address = resolve_ens_name(name, eth_rpc_url)
    if not address:
        return None

    from database import get_supabase
    db = get_supabase()
    result = (
        db.table("agents")
        .select("agent_id, composite_score, tier, name, category, total_feedback, source_chain")
        .ilike("owner_address", address)
        .order("composite_score", desc=True)
        .limit(5)
        .execute()
    )

    agents = [
        {
            "agent_id": a["agent_id"],
            "name": a.get("name"),
            "composite_score": round(float(a.get("composite_score") or 0), 2),
            "tier": a.get("tier", "unranked"),
            "category": a.get("category"),
            "total_feedback": a.get("total_feedback", 0),
            "source_chain": a.get("source_chain"),
        }
        for a in result.data
    ]

    if not agents:
        return {
            "ens_name": name,
            "address": address,
            "agent_id": None,
            "agents": [],
            "message": f"Address {address} has no registered ERC-8004 agents",
        }

    return {
        "ens_name": name,
        "address": address,
        "agent_id": agents[0]["agent_id"],
        "composite_score": agents[0]["composite_score"],
        "tier": agents[0]["tier"],
        "agents": agents,
    }
