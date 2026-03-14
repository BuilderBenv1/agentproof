"""
Monad-specific indexer using batch eth_call instead of eth_getLogs.

Monad's eth_getLogs is limited to 100-block ranges and returns empty results
for historical data. This module indexes agents by iterating token IDs via
ownerOf() and tokenURI() batch calls.
"""

import logging
from datetime import datetime, timezone

import httpx
from eth_abi import decode as abi_decode

from app.services.blockchain import _RawEvent

logger = logging.getLogger(__name__)

IDENTITY_ADDR = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
TIMEOUT = 30
BATCH_SIZE = 100  # tokens per batch RPC call

# Function selectors
OWNER_OF = "0x6352211e"       # ownerOf(uint256)
TOKEN_URI = "0xc87b56dd"      # tokenURI(uint256)


def _make_call(to: str, data: str, call_id: int) -> dict:
    return {
        "jsonrpc": "2.0",
        "method": "eth_call",
        "params": [{"to": to, "data": data}, "latest"],
        "id": call_id,
    }


def _decode_address(hex_result: str) -> str:
    """Decode an ABI-encoded address from eth_call result."""
    if not hex_result or hex_result == "0x" or len(hex_result) < 42:
        return ""
    return "0x" + hex_result[-40:]


def _decode_string(hex_result: str) -> str:
    """Decode an ABI-encoded string from eth_call result."""
    if not hex_result or hex_result == "0x" or len(hex_result) <= 130:
        return ""
    try:
        data_bytes = bytes.fromhex(hex_result[2:])
        decoded = abi_decode(["string"], data_bytes)
        return decoded[0] if decoded else ""
    except Exception:
        return ""


def get_max_token_id(rpc_url: str) -> int:
    """Binary search for the highest existing token ID."""
    lo, hi = 1, 100_000
    # First find upper bound
    while True:
        token_hex = f"{hi:064x}"
        resp = httpx.post(
            rpc_url,
            json=_make_call(IDENTITY_ADDR, OWNER_OF + token_hex, 1),
            timeout=TIMEOUT,
        )
        data = resp.json()
        if "error" in data:
            break
        hi *= 2
        if hi > 10_000_000:
            return 0  # safety

    # Binary search between lo and hi
    while lo < hi:
        mid = (lo + hi + 1) // 2
        token_hex = f"{mid:064x}"
        resp = httpx.post(
            rpc_url,
            json=_make_call(IDENTITY_ADDR, OWNER_OF + token_hex, 1),
            timeout=TIMEOUT,
        )
        data = resp.json()
        if "error" in data:
            hi = mid - 1
        else:
            lo = mid

    return lo


def fetch_agents_batch(rpc_url: str, start_id: int, end_id: int) -> list:
    """Fetch agent data for token IDs [start_id, end_id] via batch RPC.

    Returns list of _RawEvent objects compatible with the existing indexer.
    """
    if start_id > end_id:
        return []

    # Build batch: ownerOf + tokenURI for each token
    batch = []
    call_id = 1
    for token_id in range(start_id, end_id + 1):
        token_hex = f"{token_id:064x}"
        batch.append(_make_call(IDENTITY_ADDR, OWNER_OF + token_hex, call_id))
        call_id += 1
        batch.append(_make_call(IDENTITY_ADDR, TOKEN_URI + token_hex, call_id))
        call_id += 1

    # Send batch (split into sub-batches if too large)
    results_map: dict[int, dict] = {}
    for i in range(0, len(batch), BATCH_SIZE * 2):
        sub = batch[i:i + BATCH_SIZE * 2]
        try:
            resp = httpx.post(rpc_url, json=sub, timeout=TIMEOUT)
            for r in resp.json():
                results_map[r["id"]] = r
        except Exception as e:
            logger.warning(f"Monad batch RPC failed (IDs {start_id}-{end_id}): {e}")
            continue

    # Parse results
    events = []
    call_id = 1
    for token_id in range(start_id, end_id + 1):
        owner_resp = results_map.get(call_id, {})
        uri_resp = results_map.get(call_id + 1, {})
        call_id += 2

        # Skip if ownerOf reverted (token doesn't exist)
        if "error" in owner_resp:
            continue

        owner = _decode_address(owner_resp.get("result", ""))
        if not owner or owner == "0x" + "0" * 40:
            continue

        uri = _decode_string(uri_resp.get("result", ""))

        events.append(
            _RawEvent(
                agentId=token_id,
                owner=owner,
                agentURI=uri,
                blockNumber=0,  # No block info from eth_call
                transactionHash=b"\x00" * 32,
            )
        )

    return events


def index_monad_agents(rpc_url: str, last_token_id: int = 0) -> tuple[list, int]:
    """Index Monad agents starting from last_token_id.

    Returns (events, new_last_token_id).
    The caller should persist new_last_token_id as the indexer checkpoint.
    """
    max_id = get_max_token_id(rpc_url)
    if max_id <= last_token_id:
        return [], last_token_id

    logger.info(f"[monad] Indexing tokens {last_token_id + 1} to {max_id} ({max_id - last_token_id} new)")

    all_events = []
    for start in range(last_token_id + 1, max_id + 1, BATCH_SIZE):
        end = min(start + BATCH_SIZE - 1, max_id)
        batch_events = fetch_agents_batch(rpc_url, start, end)
        all_events.extend(batch_events)
        if batch_events:
            logger.info(f"[monad] Batch {start}-{end}: {len(batch_events)} agents")

    return all_events, max_id
