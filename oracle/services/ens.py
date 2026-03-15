"""
ENS (Ethereum Name Service) resolution for AgentProof.

Resolves ENS names → Ethereum addresses → ERC-8004 agent IDs → trust scores.
Enables queries like: GET /api/v1/trust/ens/vitalik.eth
"""

import logging
import threading
import time

import httpx
from eth_abi import decode as abi_decode

logger = logging.getLogger(__name__)

# ENS registry + resolver constants (Ethereum mainnet)
ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
NAMEHASH_ZERO = "0x" + "00" * 32

# Function selectors
RESOLVER_SEL = "0x0178b8bf"   # resolver(bytes32 node)
ADDR_SEL = "0x3b3b57de"       # addr(bytes32 node)
NAME_SEL = "0x691f3431"       # name(bytes32 node) — reverse resolution
TEXT_SEL = "0x59d1d43c"       # text(bytes32 node, string key)

# Cache: ENS name → (address, expires_at)
_ens_cache: dict[str, tuple[str, float]] = {}
_cache_lock = threading.Lock()
_CACHE_TTL = 600  # 10 minutes


def _namehash(name: str) -> bytes:
    """Compute ENS namehash for a domain name (EIP-137).

    Uses keccak256 (Ethereum's hash), NOT NIST SHA3-256.
    """
    from web3 import Web3
    node = b"\x00" * 32
    if name:
        labels = name.split(".")
        for label in reversed(labels):
            label_hash = Web3.keccak(text=label)
            node = Web3.keccak(node + label_hash)
    return node


def _hex_namehash(name: str) -> str:
    """Return namehash as 0x-prefixed hex string."""
    return "0x" + _namehash(name).hex()


def _eth_call(rpc_url: str, to: str, data: str) -> str:
    """Execute eth_call and return hex result."""
    resp = httpx.post(
        rpc_url,
        json={
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [{"to": to, "data": data}, "latest"],
            "id": 1,
        },
        timeout=10,
    )
    result = resp.json()
    if "error" in result:
        raise ValueError(f"RPC error: {result['error'].get('message', result['error'])}")
    return result.get("result", "0x")


def resolve_ens_name(name: str, eth_rpc_url: str) -> str | None:
    """Resolve an ENS name to an Ethereum address.

    Returns checksummed address or None if unresolvable.
    """
    name = name.lower().strip()
    if not name.endswith(".eth") and "." not in name:
        name = name + ".eth"

    # Check cache
    with _cache_lock:
        cached = _ens_cache.get(name)
        if cached and time.monotonic() < cached[1]:
            return cached[0]

    if not eth_rpc_url:
        logger.warning("No Ethereum RPC URL configured for ENS resolution")
        return None

    try:
        node = _hex_namehash(name)

        # Step 1: Get resolver for this name
        resolver_data = RESOLVER_SEL + node[2:]
        resolver_hex = _eth_call(eth_rpc_url, ENS_REGISTRY, resolver_data)

        if not resolver_hex or resolver_hex == "0x" or len(resolver_hex) < 42:
            return None

        resolver_addr = "0x" + resolver_hex[-40:]
        if resolver_addr == "0x" + "0" * 40:
            return None

        # Step 2: Call addr(node) on resolver
        addr_data = ADDR_SEL + node[2:]
        addr_hex = _eth_call(eth_rpc_url, resolver_addr, addr_data)

        if not addr_hex or addr_hex == "0x" or len(addr_hex) < 42:
            return None

        address = "0x" + addr_hex[-40:]
        if address == "0x" + "0" * 40:
            return None

        # Checksum the address
        address = _checksum_address(address)

        # Cache result
        with _cache_lock:
            _ens_cache[name] = (address, time.monotonic() + _CACHE_TTL)

        logger.info(f"[ens] Resolved {name} → {address}")
        return address

    except Exception as e:
        logger.warning(f"[ens] Failed to resolve {name}: {e}")
        return None


def resolve_ens_to_agent(name: str, eth_rpc_url: str) -> dict | None:
    """Resolve ENS name → address → agent ID + trust score.

    Returns dict with address, agent_id, score, tier, or None.
    """
    address = resolve_ens_name(name, eth_rpc_url)
    if not address:
        return None

    # Look up agent by owner address
    from database import get_supabase

    db = get_supabase()
    result = (
        db.table("agents")
        .select("agent_id, composite_score, tier, name, category, total_feedback, source_chain, updated_at")
        .ilike("owner_address", address)
        .order("composite_score", desc=True)
        .limit(5)
        .execute()
    )

    if not result.data:
        return {
            "ens_name": name,
            "address": address,
            "agent_id": None,
            "agents": [],
            "message": f"Address {address} resolved but has no registered ERC-8004 agents",
        }

    agents = []
    for a in result.data:
        agents.append({
            "agent_id": a["agent_id"],
            "name": a.get("name"),
            "composite_score": round(float(a.get("composite_score") or 0), 2),
            "tier": a.get("tier", "unranked"),
            "category": a.get("category"),
            "total_feedback": a.get("total_feedback", 0),
            "source_chain": a.get("source_chain"),
        })

    primary = agents[0]
    return {
        "ens_name": name,
        "address": address,
        "agent_id": primary["agent_id"],
        "composite_score": primary["composite_score"],
        "tier": primary["tier"],
        "agents": agents,
    }


def resolve_ens_text(name: str, key: str, eth_rpc_url: str) -> str | None:
    """Resolve an ENS text record (e.g. 'com.agentproof.agent_id')."""
    name = name.lower().strip()
    if not name.endswith(".eth") and "." not in name:
        name = name + ".eth"

    if not eth_rpc_url:
        return None

    try:
        node = _hex_namehash(name)

        # Get resolver
        resolver_data = RESOLVER_SEL + node[2:]
        resolver_hex = _eth_call(eth_rpc_url, ENS_REGISTRY, resolver_data)
        if not resolver_hex or len(resolver_hex) < 42:
            return None
        resolver_addr = "0x" + resolver_hex[-40:]
        if resolver_addr == "0x" + "0" * 40:
            return None

        # Encode text(bytes32, string) call
        # ABI: bytes32 node, string key
        key_bytes = key.encode("utf-8")
        # Offset for string param = 64 bytes (after node)
        offset_hex = f"{64:064x}"
        len_hex = f"{len(key_bytes):064x}"
        key_hex = key_bytes.hex().ljust(64, "0")  # pad to 32 bytes
        call_data = TEXT_SEL + node[2:] + offset_hex + len_hex + key_hex

        result_hex = _eth_call(eth_rpc_url, resolver_addr, call_data)
        if not result_hex or result_hex == "0x" or len(result_hex) <= 130:
            return None

        data_bytes = bytes.fromhex(result_hex[2:])
        decoded = abi_decode(["string"], data_bytes)
        return decoded[0] if decoded else None

    except Exception as e:
        logger.debug(f"[ens] text({name}, {key}) failed: {e}")
        return None


def _checksum_address(address: str) -> str:
    """EIP-55 checksum for Ethereum address (uses keccak256, not SHA3)."""
    from web3 import Web3
    return Web3.to_checksum_address(address)


# Singleton accessor
_ens_service = None


def get_ens_service():
    """Returns a dict of ENS helper functions bound to the configured RPC."""
    from config import get_settings
    settings = get_settings()
    eth_rpc = settings.ethereum_rpc_url
    return {
        "resolve_name": lambda name: resolve_ens_name(name, eth_rpc),
        "resolve_to_agent": lambda name: resolve_ens_to_agent(name, eth_rpc),
        "resolve_text": lambda name, key: resolve_ens_text(name, key, eth_rpc),
        "configured": bool(eth_rpc),
    }
