"""
Indexer service that runs as part of the backend process.
Periodically polls for new blockchain events and syncs them to Supabase.
"""

import json
import logging
import os
import time
from datetime import datetime, timezone

import httpx

from app.database import get_supabase
from app.services.blockchain import get_blockchain_service
from app.services import generic_chain
from app.services import solana_chain
from app.services.scoring import (
    calculate_composite_score,
    calculate_std_dev,
    calculate_account_age_days,
    calculate_freshness_multiplier,
    calculate_deployer_score,
    determine_tier,
)

logger = logging.getLogger(__name__)


def _sanitize_text(value: str | None) -> str | None:
    """Strip null bytes (\x00) that PostgreSQL text columns reject."""
    if value is None:
        return None
    return value.replace("\x00", "")


def _sanitize_row(row: dict) -> dict:
    """Strip null bytes from all string values in a row dict."""
    return {k: _sanitize_text(v) if isinstance(v, str) else v for k, v in row.items()}


def _resilient_upsert(db, table: str, rows: list[dict], on_conflict: str, label: str):
    """Batch upsert with automatic fallback to sub-batches, then individual rows."""
    if not rows:
        return
    rows = [_sanitize_row(r) for r in rows]
    try:
        db.table(table).upsert(rows, on_conflict=on_conflict).execute()
        logger.info(f"[{label}] Batch upserted {len(rows)} rows")
    except Exception as e:
        logger.warning(f"[{label}] Batch upsert failed ({len(rows)} rows), falling back to sub-batches: {e}")
        failed_rows = []
        for i in range(0, len(rows), 50):
            batch = rows[i:i + 50]
            try:
                db.table(table).upsert(batch, on_conflict=on_conflict).execute()
            except Exception:
                failed_rows.extend(batch)
        # Retry failed rows individually
        if failed_rows:
            logger.warning(f"[{label}] {len(failed_rows)} rows failed in sub-batches, retrying individually")
            dropped = 0
            for row in failed_rows:
                try:
                    db.table(table).upsert([row], on_conflict=on_conflict).execute()
                except Exception as e3:
                    dropped += 1
                    logger.error(f"[{label}] Dropped row agent_id={row.get('agent_id')}: {e3}")
            if dropped:
                logger.error(f"[{label}] PERMANENTLY DROPPED {dropped}/{len(rows)} rows")


CONFIRMATION_BLOCKS = 3
DEFAULT_START_BLOCK = 77_000_000
ERC8004_IDENTITY_START_BLOCK = 77_389_000  # Avalanche contract deployed at this block
ERC8004_ETH_IDENTITY_START_BLOCK = 24_339_900  # First Registered event at block 24,339,925
ERC8004_BASE_IDENTITY_START_BLOCK = 41_667_100  # CREATE2 deployed at block 41,667,111
ERC8004_LINEA_IDENTITY_START_BLOCK = 28_662_500  # CREATE2 deployed at block 28,662,553; first Registered at 28,682,146
MAX_BLOCK_RANGE = 2000       # Avalanche RPCs support 2048
ETH_MAX_BLOCK_RANGE = 800    # Safe for all ETH RPCs (Alchemy PAYG=2000, publicnode=1000)
BASE_MAX_BLOCK_RANGE = 10000  # CDP RPC supports large ranges; speeds up catchup
BASE_FEEDBACK_BLOCK_RANGE = 10000  # Now uses raw httpx (same as identity), supports 10K
LINEA_MAX_BLOCK_RANGE = 2000
# Maximum chunks to process per cycle (normal operation)
MAX_CHUNKS_PER_CYCLE = 50
# When far behind, allow more chunks to catch up faster
MAX_CHUNKS_CATCHUP = 500


def get_last_processed_block(contract_name: str, default_start: int = DEFAULT_START_BLOCK) -> int:
    """Get the last processed block for a contract from the indexer_state table."""
    try:
        db = get_supabase()
        result = (
            db.table("indexer_state")
            .select("last_block")
            .eq("contract_name", contract_name)
            .execute()
        )
        if result.data:
            stored = result.data[0]["last_block"]
            if stored < default_start:
                logger.info(f"Fast-forwarding {contract_name} from block {stored} to {default_start}")
                update_last_processed_block(contract_name, default_start)
                return default_start
            return stored
        # Initialize state
        db.table("indexer_state").insert(
            {"contract_name": contract_name, "last_block": default_start}
        ).execute()
        return default_start
    except Exception as e:
        logger.error(f"Error getting last block for {contract_name}: {e}")
        return default_start


def update_last_processed_block(contract_name: str, block_number: int):
    """Update the last processed block for a contract."""
    try:
        db = get_supabase()
        db.table("indexer_state").upsert(
            {
                "contract_name": contract_name,
                "last_block": block_number,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="contract_name",
        ).execute()
    except Exception as e:
        logger.error(f"Error updating last block for {contract_name}: {e}")


def process_agent_registered_events(from_block: int, to_block: int):
    """Process AgentRegistered events."""
    blockchain = get_blockchain_service()
    events = blockchain.get_identity_events(from_block, to_block)
    if not events:
        return 0

    db = get_supabase()
    block_ts_cache: dict[int, datetime] = {}
    now = datetime.now(timezone.utc).isoformat()
    rows = []

    for event in events:
        block = event.blockNumber
        if block not in block_ts_cache:
            block_data = blockchain.w3.eth.get_block(block)
            block_ts_cache[block] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

        rows.append(_sanitize_row({
            "agent_id": event.args.agentId,
            "owner_address": event.args.owner,
            "agent_uri": event.args.agentURI,
            "source_chain": "avalanche",
            "registered_at": block_ts_cache[block].isoformat(),
            "updated_at": now,
        }))

    _resilient_upsert(db, "agents", rows, "agent_id,source_chain", "avalanche-custom")

    return len(events)


def process_erc8004_identity_events(from_block: int, to_block: int):
    """Process Registered events from the official ERC-8004 Identity Registry on Avalanche."""
    blockchain = get_blockchain_service()
    logger.info(f"[ERC-8004-AVAX] Scanning blocks {from_block}-{to_block} (range={to_block - from_block + 1})")
    events = blockchain.get_erc8004_registered_events(from_block, to_block)
    if not events:
        return 0
    logger.info(f"[ERC-8004-AVAX] Found {len(events)} Registered events in {from_block}-{to_block}")

    db = get_supabase()
    block_ts_cache: dict[int, datetime] = {}
    now = datetime.now(timezone.utc).isoformat()
    rows = []

    for event in events:
        block = event.blockNumber
        if block not in block_ts_cache:
            block_data = blockchain.w3.eth.get_block(block)
            block_ts_cache[block] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

        rows.append(_sanitize_row({
            "agent_id": event.args.agentId,
            "owner_address": event.args.owner,
            "agent_uri": event.args.agentURI,
            "source_chain": "avalanche",
            "registered_at": block_ts_cache[block].isoformat(),
            "updated_at": now,
        }))

    _resilient_upsert(db, "agents", rows, "agent_id,source_chain", "ERC-8004-AVAX")

    return len(events)


def process_erc8004_eth_identity_events(from_block: int, to_block: int):
    """Process Registered events from the ERC-8004 Identity Registry on Ethereum."""
    blockchain = get_blockchain_service()
    logger.info(f"[ERC-8004-ETH] Scanning blocks {from_block}-{to_block} (range={to_block - from_block + 1})")
    events = blockchain.get_erc8004_eth_registered_events(from_block, to_block)
    if not events:
        return 0
    logger.info(f"[ERC-8004-ETH] Found {len(events)} Registered events in {from_block}-{to_block}")

    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Collect unique block numbers and fetch timestamps in one pass
    unique_blocks = set(e.blockNumber for e in events)
    block_ts_cache: dict[int, datetime] = {}
    for blk in sorted(unique_blocks):
        try:
            block_data = blockchain.w3_eth.eth.get_block(blk)
            block_ts_cache[blk] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)
        except Exception as e:
            logger.warning(f"[ERC-8004-ETH] Failed to get block {blk} timestamp: {e}")
            block_ts_cache[blk] = datetime.now(timezone.utc)
    logger.info(f"[ERC-8004-ETH] Fetched timestamps for {len(unique_blocks)} unique blocks")

    rows = []
    for event in events:
        rows.append(_sanitize_row({
            "agent_id": event.args.agentId,
            "owner_address": event.args.owner,
            "agent_uri": event.args.agentURI,
            "source_chain": "ethereum",
            "registered_at": block_ts_cache[event.blockNumber].isoformat(),
            "updated_at": now,
        }))

    # Batch upsert in chunks of 500 (Supabase has payload size limits)
    saved = 0
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        try:
            db.table("agents").upsert(batch, on_conflict="agent_id,source_chain").execute()
            saved += len(batch)
        except Exception as e:
            logger.error(f"[ERC-8004-ETH] Batch upsert failed ({len(batch)} rows at offset {i}): {e}")
            # Fallback: try smaller sub-batches of 50
            for j in range(0, len(batch), 50):
                sub = batch[j:j + 50]
                try:
                    db.table("agents").upsert(sub, on_conflict="agent_id,source_chain").execute()
                    saved += len(sub)
                except Exception as e2:
                    logger.error(f"[ERC-8004-ETH] Sub-batch upsert also failed: {e2}")

    logger.info(f"[ERC-8004-ETH] Saved {saved}/{len(rows)} agents")
    if saved == 0 and len(rows) > 0:
        raise Exception(f"All upserts failed for {len(rows)} agents — not advancing block pointer")
    return len(events)


def process_erc8004_base_identity_events(from_block: int, to_block: int):
    """Process Registered events from the ERC-8004 Identity Registry on Base."""
    blockchain = get_blockchain_service()
    logger.info(f"[ERC-8004-BASE] Scanning blocks {from_block}-{to_block} (range={to_block - from_block + 1})")
    events = blockchain.get_erc8004_base_registered_events(from_block, to_block)
    if not events:
        return 0
    logger.info(f"[ERC-8004-BASE] Found {len(events)} Registered events in {from_block}-{to_block}")

    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Collect unique block numbers and fetch timestamps in one pass
    unique_blocks = set(e.blockNumber for e in events)
    block_ts_cache: dict[int, datetime] = {}
    for blk in sorted(unique_blocks):
        try:
            block_data = blockchain.w3_base.eth.get_block(blk)
            block_ts_cache[blk] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)
        except Exception as e:
            logger.warning(f"[ERC-8004-BASE] Failed to get block {blk} timestamp: {e}")
            block_ts_cache[blk] = datetime.now(timezone.utc)
    logger.info(f"[ERC-8004-BASE] Fetched timestamps for {len(unique_blocks)} unique blocks")

    rows = []
    for event in events:
        rows.append(_sanitize_row({
            "agent_id": event.args.agentId,
            "owner_address": event.args.owner,
            "agent_uri": event.args.agentURI,
            "source_chain": "base",
            "registered_at": block_ts_cache[event.blockNumber].isoformat(),
            "updated_at": now,
        }))

    # Batch upsert in chunks of 500 (Supabase has payload size limits)
    saved = 0
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        try:
            db.table("agents").upsert(batch, on_conflict="agent_id,source_chain").execute()
            saved += len(batch)
        except Exception as e:
            logger.error(f"[ERC-8004-BASE] Batch upsert failed ({len(batch)} rows at offset {i}): {e}")
            # Fallback: try smaller sub-batches of 50
            for j in range(0, len(batch), 50):
                sub = batch[j:j + 50]
                try:
                    db.table("agents").upsert(sub, on_conflict="agent_id,source_chain").execute()
                    saved += len(sub)
                except Exception as e2:
                    logger.error(f"[ERC-8004-BASE] Sub-batch upsert also failed: {e2}")

    logger.info(f"[ERC-8004-BASE] Saved {saved}/{len(rows)} agents")
    if saved == 0 and len(rows) > 0:
        raise Exception(f"All upserts failed for {len(rows)} agents — not advancing block pointer")
    return len(events)


IPFS_GATEWAYS = [
    "https://ipfs.io/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
    "https://dweb.link/ipfs/",
    "https://w3s.link/ipfs/",
]


def _is_safe_url(url: str) -> bool:
    """Check that a URL doesn't point to internal/private networks (SSRF protection)."""
    import ipaddress
    from urllib.parse import urlparse
    import socket

    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return False

        # Block non-http(s) schemes
        if parsed.scheme not in ("http", "https"):
            return False

        # Block common internal hostnames
        blocked_hosts = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal", "169.254.169.254"}
        if hostname.lower() in blocked_hosts:
            return False

        # Resolve hostname and check if IP is private/reserved
        try:
            addrs = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
            for _, _, _, _, sockaddr in addrs:
                ip = ipaddress.ip_address(sockaddr[0])
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                    return False
        except socket.gaierror:
            return False

        return True
    except Exception:
        return False


_MAX_RESPONSE_SIZE = 1_048_576  # 1 MB max for metadata responses


def _resolve_uri(uri: str, client: httpx.Client) -> dict | None:
    """Resolve an agent URI to JSON metadata.

    Supports data: URIs (base64 JSON), https:// URLs, ipfs:// URIs,
    and raw IPFS CIDs.  Returns parsed JSON dict or None on failure.
    Includes SSRF protection: blocks private/internal IPs and limits response size.
    """
    if not uri:
        return None

    # Handle data: URIs (ERC-8004 standard inline metadata)
    if uri.startswith("data:"):
        import base64 as b64
        try:
            # Format: data:application/json;base64,<payload>
            if ";base64," in uri:
                payload = uri.split(";base64,", 1)[1]
                if len(payload) > _MAX_RESPONSE_SIZE:
                    return None
                decoded = b64.b64decode(payload).decode("utf-8")
                return json.loads(decoded)
            # Format: data:application/json,<json>
            elif "," in uri:
                payload = uri.split(",", 1)[1]
                if len(payload) > _MAX_RESPONSE_SIZE:
                    return None
                return json.loads(payload)
        except Exception:
            return None

    urls_to_try: list[str] = []

    if uri.startswith("https://") or uri.startswith("http://"):
        urls_to_try.append(uri)
    elif uri.startswith("ipfs://"):
        cid = uri[7:]  # strip "ipfs://"
        urls_to_try.extend(gw + cid for gw in IPFS_GATEWAYS)
    elif uri.startswith("Qm") or uri.startswith("bafy"):
        # Bare CID
        urls_to_try.extend(gw + uri for gw in IPFS_GATEWAYS)
    else:
        # Unknown scheme — reject (SSRF protection)
        return None

    for url in urls_to_try:
        try:
            # SSRF protection: validate URL doesn't target internal networks
            if not _is_safe_url(url):
                logger.warning("Blocked SSRF attempt: %s", url[:200])
                continue

            resp = client.get(url, timeout=10, follow_redirects=False)

            # Handle redirects manually with SSRF check (up to 2 hops)
            for _ in range(2):
                if resp.status_code not in (301, 302, 307, 308):
                    break
                redirect_url = resp.headers.get("location", "")
                if not redirect_url:
                    break
                # Allow same-domain subdomain redirects (e.g. dweb.link → *.dweb.link)
                if not _is_safe_url(redirect_url):
                    break
                resp = client.get(redirect_url, timeout=10, follow_redirects=False)

            if resp.status_code == 200:
                # Enforce response size limit
                if len(resp.content) > _MAX_RESPONSE_SIZE:
                    continue

                ct = resp.headers.get("content-type", "")
                if "json" in ct or resp.text.strip().startswith("{"):
                    return resp.json()
                # Some URIs return plain text with JSON content
                try:
                    return json.loads(resp.text)
                except (json.JSONDecodeError, ValueError):
                    pass
        except Exception:
            continue
    return None


def resolve_agent_metadata(chain: str = "base", batch_size: int = 100):
    """Fetch and parse agent_uri for agents that have no name yet.

    Runs after identity indexing to enrich agents with name, description,
    category, and image_url from their onchain metadata URI.
    """
    db = get_supabase()
    label = chain.upper()

    # Find agents on this chain with no name populated
    try:
        result = (
            db.table("agents")
            .select("agent_id, agent_uri, source_chain")
            .eq("source_chain", chain)
            .is_("name", "null")
            .neq("agent_uri", "")
            .limit(batch_size)
            .execute()
        )
    except Exception as e:
        logger.error(f"[URI-RESOLVE-{label}] Error fetching agents without names: {e}")
        return 0

    agents = result.data
    if not agents:
        return 0

    logger.info(f"[URI-RESOLVE-{label}] Resolving URIs for {len(agents)} unnamed agents")
    resolved = 0

    with httpx.Client(
        headers={"Accept": "application/json"},
        limits=httpx.Limits(max_connections=10),
    ) as client:
        for agent in agents:
            agent_id = agent["agent_id"]
            uri = agent.get("agent_uri", "")
            metadata = _resolve_uri(uri, client)
            if not metadata:
                continue

            # Extract standard ERC-8004 / ERC-721 metadata fields
            name = metadata.get("name") or metadata.get("agentName")
            description = metadata.get("description")
            image = (
                metadata.get("image")
                or metadata.get("image_url")
                or metadata.get("avatar")
            )
            category = metadata.get("category") or metadata.get("type")

            # Only update if we got at least a name
            if not name:
                continue

            update = {"name": name[:200]}  # cap at 200 chars
            if description:
                update["description"] = description[:2000]
            if image:
                update["image_url"] = image[:500]
            from app.tag_constants import (
                VALID_CATEGORIES, AUTONOMY_LEVELS, FINANCIAL_ACCESS_LEVELS,
                DATA_ACCESS_LEVELS, OWNER_TYPES, UPGRADE_PATTERNS,
            )
            if category and category.lower() in VALID_CATEGORIES:
                update["category"] = category.lower()

            # ERC-8004 identity tags (optional, extracted from metadata)
            _enum_fields = {
                "autonomy_level": AUTONOMY_LEVELS,
                "financial_access": FINANCIAL_ACCESS_LEVELS,
                "data_access_level": DATA_ACCESS_LEVELS,
                "owner_type": OWNER_TYPES,
                "upgrade_pattern": UPGRADE_PATTERNS,
            }
            for field, valid_set in _enum_fields.items():
                val = metadata.get(field)
                if val and str(val).lower() in valid_set:
                    update[field] = str(val).lower()

            _bool_fields = ["can_delegate", "can_be_delegated", "open_source", "human_in_loop"]
            for field in _bool_fields:
                val = metadata.get(field)
                if val is not None:
                    update[field] = bool(val)

            _str_fields = {"source_url": 500, "jurisdiction": 10}
            for field, max_len in _str_fields.items():
                val = metadata.get(field)
                if val and isinstance(val, str):
                    update[field] = val[:max_len]

            _list_fields = ["supported_protocols", "audited_by", "compliance_tags"]
            for field in _list_fields:
                val = metadata.get(field)
                if val and isinstance(val, list):
                    update[field] = [str(v)[:100] for v in val[:20]]

            try:
                db.table("agents").update(update).eq(
                    "agent_id", agent_id
                ).eq(
                    "source_chain", chain
                ).execute()
                resolved += 1
            except Exception as e:
                # If new columns don't exist yet, retry with only basic fields
                if "column" in str(e).lower():
                    basic_update = {k: v for k, v in update.items()
                                    if k in ("name", "description", "image_url", "category")}
                    try:
                        db.table("agents").update(basic_update).eq(
                            "agent_id", agent_id
                        ).eq("source_chain", chain).execute()
                        resolved += 1
                    except Exception as e2:
                        logger.warning(f"[URI-RESOLVE-{label}] Failed basic update agent #{agent_id}: {e2}")
                else:
                    logger.warning(f"[URI-RESOLVE-{label}] Failed to update agent #{agent_id}: {e}")

    logger.info(f"[URI-RESOLVE-{label}] Resolved {resolved}/{len(agents)} agent names")
    return resolved


def process_erc8004_linea_identity_events(from_block: int, to_block: int):
    """Process Registered events from the ERC-8004 Identity Registry on Linea."""
    blockchain = get_blockchain_service()
    logger.info(f"[ERC-8004-LINEA] Scanning blocks {from_block}-{to_block} (range={to_block - from_block + 1})")
    events = blockchain.get_erc8004_linea_registered_events(from_block, to_block)
    if not events:
        return 0
    logger.info(f"[ERC-8004-LINEA] Found {len(events)} Registered events in {from_block}-{to_block}")

    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Collect unique block numbers and fetch timestamps in one pass
    unique_blocks = set(e.blockNumber for e in events)
    block_ts_cache: dict[int, datetime] = {}
    for blk in sorted(unique_blocks):
        try:
            block_data = blockchain.w3_linea.eth.get_block(blk)
            block_ts_cache[blk] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)
        except Exception as e:
            logger.warning(f"[ERC-8004-LINEA] Failed to get block {blk} timestamp: {e}")
            block_ts_cache[blk] = datetime.now(timezone.utc)
    logger.info(f"[ERC-8004-LINEA] Fetched timestamps for {len(unique_blocks)} unique blocks")

    rows = []
    for event in events:
        rows.append({
            "agent_id": event.args.agentId,
            "owner_address": event.args.owner,
            "agent_uri": event.args.agentURI,
            "source_chain": "linea",
            "registered_at": block_ts_cache[event.blockNumber].isoformat(),
            "updated_at": now,
        })

    # Batch upsert in chunks of 500 (Supabase has payload size limits)
    saved = 0
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        try:
            db.table("agents").upsert(batch, on_conflict="agent_id,source_chain").execute()
            saved += len(batch)
        except Exception as e:
            logger.error(f"[ERC-8004-LINEA] Batch upsert failed ({len(batch)} rows at offset {i}): {e}")
            # Fallback: try smaller sub-batches of 50
            for j in range(0, len(batch), 50):
                sub = batch[j:j + 50]
                try:
                    db.table("agents").upsert(sub, on_conflict="agent_id,source_chain").execute()
                    saved += len(sub)
                except Exception as e2:
                    logger.error(f"[ERC-8004-LINEA] Sub-batch upsert also failed: {e2}")

    logger.info(f"[ERC-8004-LINEA] Saved {saved}/{len(rows)} agents")
    if saved == 0 and len(rows) > 0:
        raise Exception(f"All upserts failed for {len(rows)} agents — not advancing block pointer")
    return len(events)


def _process_cross_chain_feedback(chain_name: str, events, w3_instance) -> int:
    """Shared logic for indexing NewFeedback events from Base/Linea into Supabase."""
    if not events:
        return 0
    logger.info(f"[ERC-8004-{chain_name.upper()}] Found {len(events)} NewFeedback events")

    db = get_supabase()
    unique_blocks = set(e.blockNumber for e in events)
    block_ts_cache: dict[int, datetime] = {}
    for blk in sorted(unique_blocks):
        try:
            block_data = w3_instance.eth.get_block(blk)
            block_ts_cache[blk] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)
        except Exception as e:
            logger.warning(f"[{chain_name}] Failed to get block {blk} timestamp: {e}")
            block_ts_cache[blk] = datetime.now(timezone.utc)

    rows = []
    for event in events:
        raw_value = int(event.args.value)
        rating = max(1, min(100, raw_value))
        task_hash = event.args.feedbackHash.hex() if hasattr(event.args, 'feedbackHash') else ""
        reviewer = event.args.clientAddress
        tag1 = event.args.tag1 if hasattr(event.args, 'tag1') else ""
        tag2 = event.args.tag2 if hasattr(event.args, 'tag2') else ""

        rows.append({
            "agent_id": event.args.agentId,
            "reviewer_address": reviewer,
            "rating": rating,
            "task_hash": task_hash,
            "tag1": tag1,
            "tag2": tag2,
            "source_chain": chain_name,
            "tx_hash": event.transactionHash.hex(),
            "block_number": event.blockNumber,
            "created_at": block_ts_cache[event.blockNumber].isoformat(),
        })

    try:
        db.table("reputation_events").upsert(rows, on_conflict="tx_hash").execute()
        logger.info(f"[{chain_name}] Batch upserted {len(rows)} feedback events")
    except Exception as e:
        err_str = str(e)
        if "tag1" in err_str or "tag2" in err_str or "column" in err_str.lower():
            logger.warning(f"[{chain_name}] Column issue — retrying without tag columns")
            for row in rows:
                row.pop("tag1", None)
                row.pop("tag2", None)
            try:
                db.table("reputation_events").upsert(rows, on_conflict="tx_hash").execute()
                logger.info(f"[{chain_name}] Batch upserted {len(rows)} feedback events (without extra cols)")
            except Exception as e2:
                logger.error(f"[{chain_name}] Batch upsert also failed: {e2}")
        else:
            logger.error(f"[{chain_name}] Batch upsert failed ({len(rows)} feedback events): {e}")

    return len(events)


def process_base_feedback_events(from_block: int, to_block: int):
    """Process NewFeedback events from the ERC-8004 Reputation Registry on Base."""
    blockchain = get_blockchain_service()
    logger.info(f"[ERC-8004-BASE] Scanning feedback blocks {from_block}-{to_block}")
    events = blockchain.get_base_feedback_events(from_block, to_block)
    return _process_cross_chain_feedback("base", events, blockchain.w3_base)


# High-value agents to prioritize feedback sync for (Base agent_ids)
# These agents have significant on-chain review counts but the sequential
# catchup hasn't reached their feedback blocks yet.
PRIORITY_BASE_AGENTS = [1380]  # Captain Dackie


def sync_priority_agent_feedback(chain: str = "base"):
    """Fetch ALL feedback for priority agents in one shot, bypassing sequential catchup.

    Uses topic-filtered eth_getLogs (topics[1] = agentId) to retrieve every
    NewFeedback event for specific high-value agents across the entire block
    range.  This surfaces their reviews immediately while the sequential
    catchup continues in the background.

    Only runs once per agent — sets a flag in indexer_state to avoid re-querying.
    """
    if chain != "base":
        return 0

    blockchain = get_blockchain_service()
    if not blockchain.w3_base:
        return 0

    db = get_supabase()
    total = 0

    for agent_id in PRIORITY_BASE_AGENTS:
        state_key = f"priority_feedback_done_{chain}_{agent_id}"

        # Check if we already synced this agent
        try:
            check = (
                db.table("indexer_state")
                .select("last_block")
                .eq("contract_name", state_key)
                .execute()
            )
            if check.data and check.data[0].get("last_block", 0) > 0:
                continue  # Already done
        except Exception:
            pass

        logger.info(f"[PRIORITY-SYNC] Fetching ALL feedback for agent #{agent_id} on {chain}")

        try:
            base_current = blockchain.get_base_current_block()
            from_block = ERC8004_BASE_IDENTITY_START_BLOCK
            to_block = base_current - CONFIRMATION_BLOCKS

            # Process in large chunks (100K blocks) since topic filter is very selective
            chunk = 100_000
            from_b = from_block
            agent_total = 0

            while from_b <= to_block:
                to_b = min(from_b + chunk - 1, to_block)
                try:
                    events = blockchain.get_base_feedback_events_for_agent(
                        agent_id, from_b, to_b
                    )
                    if events:
                        count = _process_cross_chain_feedback("base", events, blockchain.w3_base)
                        agent_total += count
                except Exception as e:
                    err_str = str(e).lower()
                    if "range" in err_str and "too large" in err_str:
                        # Halve chunk and retry
                        chunk = max(10_000, chunk // 2)
                        logger.warning(f"[PRIORITY-SYNC] Range too large, halving to {chunk}")
                        continue
                    logger.error(f"[PRIORITY-SYNC] Error fetching agent #{agent_id} feedback ({from_b}-{to_b}): {e}")
                    break
                from_b = to_b + 1

            logger.info(f"[PRIORITY-SYNC] Agent #{agent_id}: synced {agent_total} feedback events")
            total += agent_total

            # Mark as done so we don't re-query
            try:
                db.table("indexer_state").upsert({
                    "contract_name": state_key,
                    "last_block": to_block,
                }, on_conflict="contract_name").execute()
            except Exception as e:
                logger.warning(f"[PRIORITY-SYNC] Failed to save state for {state_key}: {e}")

        except Exception as e:
            logger.error(f"[PRIORITY-SYNC] Failed to sync agent #{agent_id}: {e}")

    return total


def process_linea_feedback_events(from_block: int, to_block: int):
    """Process NewFeedback events from the ERC-8004 Reputation Registry on Linea."""
    blockchain = get_blockchain_service()
    logger.info(f"[ERC-8004-LINEA] Scanning feedback blocks {from_block}-{to_block}")
    events = blockchain.get_linea_feedback_events(from_block, to_block)
    return _process_cross_chain_feedback("linea", events, blockchain.w3_linea)


def process_feedback_events(from_block: int, to_block: int):
    """Process NewFeedback (ERC-8004) or FeedbackSubmitted (legacy) events."""
    blockchain = get_blockchain_service()
    events = blockchain.get_feedback_events(from_block, to_block)
    if not events:
        return 0

    db = get_supabase()
    block_ts_cache: dict[int, datetime] = {}
    rows = []

    for event in events:
        block = event.blockNumber
        if block not in block_ts_cache:
            block_data = blockchain.w3.eth.get_block(block)
            block_ts_cache[block] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

        if blockchain.use_official:
            # ERC-8004 NewFeedback (verified from on-chain implementation):
            # (uint256 indexed agentId, address indexed clientAddress,
            #  uint64 feedbackIndex, int128 value, uint8 valueDecimals,
            #  string indexed indexedTag1, string tag1, string tag2,
            #  string endpoint, string feedbackURI, bytes32 feedbackHash)
            raw_value = int(event.args.value)
            rating = max(1, min(100, raw_value))
            task_hash = event.args.feedbackHash.hex() if hasattr(event.args, 'feedbackHash') else ""
            reviewer = event.args.clientAddress
            tag1 = event.args.tag1 if hasattr(event.args, 'tag1') else ""
            tag2 = event.args.tag2 if hasattr(event.args, 'tag2') else ""
        else:
            # Legacy FeedbackSubmitted: agentId, reviewer, rating, taskHash
            rating = event.args.rating
            task_hash = event.args.taskHash.hex()
            reviewer = event.args.reviewer
            tag1 = ""
            tag2 = ""

        rows.append({
            "agent_id": event.args.agentId,
            "reviewer_address": reviewer,
            "rating": rating,
            "task_hash": task_hash,
            "tag1": tag1,
            "tag2": tag2,
            "source_chain": "avalanche",
            "tx_hash": event.transactionHash.hex(),
            "block_number": block,
            "created_at": block_ts_cache[block].isoformat(),
        })

    try:
        db.table("reputation_events").upsert(rows, on_conflict="tx_hash").execute()
        logger.info(f"Batch upserted {len(rows)} feedback events")
    except Exception as e:
        err_str = str(e)
        # If tag1/tag2 columns don't exist yet, retry without them
        if "tag1" in err_str or "tag2" in err_str or "column" in err_str.lower():
            logger.warning("tag1/tag2 columns may not exist — retrying without tags")
            for row in rows:
                row.pop("tag1", None)
                row.pop("tag2", None)
            try:
                db.table("reputation_events").upsert(rows, on_conflict="tx_hash").execute()
                logger.info(f"Batch upserted {len(rows)} feedback events (without tags)")
            except Exception as e2:
                logger.error(f"Batch upsert without tags also failed: {e2}")
        else:
            logger.error(f"Batch upsert failed ({len(rows)} feedback events): {e}")
            for i in range(0, len(rows), 50):
                batch = rows[i:i + 50]
                try:
                    db.table("reputation_events").upsert(batch, on_conflict="tx_hash").execute()
                except Exception as e2:
                    logger.error(f"Sub-batch upsert failed: {e2}")

    return len(events)


def process_validation_events(from_block: int, to_block: int):
    """Process ValidationRequested and ValidationSubmitted events."""
    blockchain = get_blockchain_service()
    db = get_supabase()
    block_ts_cache: dict[int, datetime] = {}

    # Process requests (batch)
    req_events = blockchain.get_validation_requested_events(from_block, to_block)
    if req_events:
        rows = []
        for event in req_events:
            block = event.blockNumber
            if block not in block_ts_cache:
                block_data = blockchain.w3.eth.get_block(block)
                block_ts_cache[block] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

            rows.append({
                "validation_id": event.args.validationId,
                "agent_id": event.args.agentId,
                "task_hash": event.args.taskHash.hex(),
                "requester_address": "",
                "requested_at": block_ts_cache[block].isoformat(),
                "tx_hash": event.transactionHash.hex(),
                "block_number": block,
            })

        try:
            db.table("validation_records").upsert(rows, on_conflict="validation_id").execute()
            logger.info(f"Batch upserted {len(rows)} validation requests")
        except Exception as e:
            logger.error(f"Batch upsert failed ({len(rows)} validation requests): {e}")

    # Process responses (individual — these are updates to existing rows by validation_id)
    sub_events = blockchain.get_validation_submitted_events(from_block, to_block)
    for event in sub_events:
        block = event.blockNumber
        if block not in block_ts_cache:
            block_data = blockchain.w3.eth.get_block(block)
            block_ts_cache[block] = datetime.fromtimestamp(block_data.timestamp, tz=timezone.utc)

        try:
            db.table("validation_records").update(
                {
                    "validator_address": event.args.validator,
                    "is_valid": event.args.isValid,
                    "validated_at": block_ts_cache[block].isoformat(),
                }
            ).eq("validation_id", event.args.validationId).execute()
        except Exception as e:
            logger.error(f"Error indexing validation response #{event.args.validationId}: {e}")

    return len(req_events) + len(sub_events)


def process_job_outcome_events(from_block: int, to_block: int):
    """Process JobOutcomeRecorded events from AgentProofHook (ERC-8183)."""
    blockchain = get_blockchain_service()
    db = get_supabase()

    hook_address = os.environ.get("AGENTPROOF_HOOK_ADDRESS")
    if not hook_address:
        return 0

    # JobOutcomeRecorded(uint256 indexed agentId, uint256 indexed jobId, bool completed)
    JOB_OUTCOME_TOPIC = blockchain.w3.keccak(
        text="JobOutcomeRecorded(uint256,uint256,bool)"
    ).hex()

    try:
        logs = blockchain.w3.eth.get_logs({
            "fromBlock": from_block,
            "toBlock": to_block,
            "address": blockchain.w3.to_checksum_address(hook_address),
            "topics": ["0x" + JOB_OUTCOME_TOPIC if not JOB_OUTCOME_TOPIC.startswith("0x") else JOB_OUTCOME_TOPIC],
        })
    except Exception as e:
        logger.error(f"Error fetching JobOutcomeRecorded events: {e}")
        return 0

    if not logs:
        return 0

    rows = []
    for log in logs:
        agent_id = int(log["topics"][1].hex(), 16)
        job_id = str(int(log["topics"][2].hex(), 16))
        # completed is the non-indexed bool parameter in data
        completed = int(log["data"].hex()[-1]) == 1 if log["data"] else True

        rows.append({
            "agent_id": agent_id,
            "job_id": job_id,
            "completed": completed,
            "source_chain": "avalanche",
            "tx_hash": log["transactionHash"].hex(),
            "block_number": log["blockNumber"],
        })

    if rows:
        _resilient_upsert(db, "job_outcomes", rows, "tx_hash", "job_outcomes")

    return len(rows)


def recalculate_deployer_scores():
    """Group agents by owner_address and compute deployer reputation scores."""
    db = get_supabase()

    # Fetch all agents with relevant fields (paginated)
    all_agents: list[dict] = []
    offset = 0
    while True:
        batch = (
            db.table("agents")
            .select("agent_id, owner_address, registered_at, composite_score, total_feedback")
            .range(offset, offset + 999)
            .execute()
        )
        if not batch.data:
            break
        all_agents.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    if not all_agents:
        return

    # Group by owner_address
    from collections import defaultdict
    deployers: dict[str, list[dict]] = defaultdict(list)
    for a in all_agents:
        owner = a.get("owner_address", "")
        if owner:
            deployers[owner].append(a)

    now_str = datetime.now(timezone.utc).isoformat()
    rows = []
    for owner, agents in deployers.items():
        total = len(agents)
        scores = [float(a.get("composite_score", 0) or 0) for a in agents]
        feedbacks = [int(a.get("total_feedback", 0) or 0) for a in agents]

        # Active = has any feedback; Abandoned = no feedback AND age > 30 days
        active = 0
        abandoned = 0
        oldest_days = 0
        for a in agents:
            fb = int(a.get("total_feedback", 0) or 0)
            try:
                reg = datetime.fromisoformat(a["registered_at"].replace("Z", "+00:00"))
                age = calculate_account_age_days(reg)
            except Exception:
                age = 0
            oldest_days = max(oldest_days, age)
            if fb > 0:
                active += 1
            elif age > 30:
                abandoned += 1

        avg_score = sum(scores) / len(scores) if scores else 0
        best_score = max(scores) if scores else 0

        dep_score = calculate_deployer_score(
            total_agents=total,
            active_agents=active,
            abandoned_agents=abandoned,
            avg_agent_score=avg_score,
            oldest_age_days=oldest_days,
        )

        rows.append({
            "owner_address": owner,
            "total_agents": total,
            "active_agents": active,
            "abandoned_agents": abandoned,
            "avg_agent_score": round(avg_score, 2),
            "best_agent_score": round(best_score, 2),
            "oldest_agent_age_days": oldest_days,
            "deployer_score": dep_score,
            "updated_at": now_str,
        })

    # Batch upsert deployer_reputation
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        try:
            db.table("deployer_reputation").upsert(batch, on_conflict="owner_address").execute()
        except Exception as e:
            logger.error(f"Error upserting deployer_reputation batch {i // batch_size}: {e}")

    logger.info(f"Scored {len(rows)} deployers")


def recalculate_agent_scores():
    """Recalculate composite scores and tiers for all agents (batched)."""
    db = get_supabase()

    try:
        # Paginate to avoid Supabase default 1000-row limit
        all_agent_data: list[dict] = []
        offset = 0
        while True:
            batch = (
                db.table("agents")
                .select("agent_id, registered_at, owner_address, agent_uri, uri_change_count, source_chain")
                .range(offset, offset + 999)
                .execute()
            )
            if not batch.data:
                break
            all_agent_data.extend(batch.data)
            if len(batch.data) < 1000:
                break
            offset += 1000
    except Exception as e:
        logger.error(f"Error fetching agents for scoring: {e}")
        return

    if not all_agent_data:
        logger.info("No agents found for scoring")
        return

    logger.info(f"Scoring {len(all_agent_data)} agents")
    agent_ids = [a["agent_id"] for a in all_agent_data]

    # Bulk-fetch all ratings keyed by (agent_id, source_chain) to prevent
    # cross-chain feedback bleed (same agent_id on different chains).
    all_ratings: dict[tuple[int, str], list[int]] = {}
    try:
        offset = 0
        page_size = 1000
        while True:
            result = (
                db.table("reputation_events")
                .select("agent_id, source_chain, rating")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            for r in result.data:
                key = (r["agent_id"], r.get("source_chain") or "avalanche")
                if key not in all_ratings:
                    all_ratings[key] = []
                all_ratings[key].append(r["rating"])
            if len(result.data) < page_size:
                break
            offset += page_size
    except Exception as e:
        logger.error(f"Error bulk-fetching ratings: {e}")

    total_ratings = sum(len(v) for v in all_ratings.values())
    agents_with_feedback = len(all_ratings)
    logger.info(f"Fetched {total_ratings} ratings across {agents_with_feedback} agents (chain-scoped)")

    # Bulk-fetch all completed validations
    all_validations: dict[int, dict] = {}  # agent_id -> {completed, successful}
    try:
        offset = 0
        while True:
            result = (
                db.table("validation_records")
                .select("agent_id, is_valid")
                .not_.is_("is_valid", "null")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            for v in result.data:
                aid = v["agent_id"]
                if aid not in all_validations:
                    all_validations[aid] = {"completed": 0, "successful": 0}
                all_validations[aid]["completed"] += 1
                if v["is_valid"]:
                    all_validations[aid]["successful"] += 1
            if len(result.data) < page_size:
                break
            offset += page_size
    except Exception as e:
        logger.error(f"Error bulk-fetching validations: {e}")

    # Bulk-fetch deployer scores
    deployer_scores: dict[str, float] = {}
    try:
        offset = 0
        while True:
            result = (
                db.table("deployer_reputation")
                .select("owner_address, deployer_score, total_agents")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            for d in result.data:
                deployer_scores[d["owner_address"]] = {
                    "score": float(d.get("deployer_score", 50) or 50),
                    "count": int(d.get("total_agents", 0) or 0),
                }
            if len(result.data) < page_size:
                break
            offset += page_size
    except Exception as e:
        logger.error(f"Error bulk-fetching deployer scores: {e}")

    # Calculate scores for all agents
    now = datetime.now(timezone.utc).isoformat()
    update_rows = []
    for agent in all_agent_data:
        agent_id = agent["agent_id"]
        chain = agent.get("source_chain", "avalanche")
        ratings = all_ratings.get((agent_id, chain), [])
        feedback_count = len(ratings)
        avg_rating = sum(ratings) / len(ratings) if ratings else 0
        std_dev = calculate_std_dev(ratings)

        val_data = all_validations.get(agent_id, {"completed": 0, "successful": 0})
        success_rate = (
            (val_data["successful"] / val_data["completed"] * 100)
            if val_data["completed"] > 0 else 0
        )

        registered_at = datetime.fromisoformat(
            agent["registered_at"].replace("Z", "+00:00")
        )
        age_days = calculate_account_age_days(registered_at)

        owner = agent.get("owner_address", "")
        dep_data = deployer_scores.get(owner, {"score": 50.0, "count": 0})
        dep_score = dep_data["score"]
        dep_count = dep_data["count"]
        uri_changes = int(agent.get("uri_change_count", 0) or 0)
        freshness = calculate_freshness_multiplier(age_days)

        composite = calculate_composite_score(
            average_rating=avg_rating,
            feedback_count=feedback_count,
            rating_std_dev=std_dev,
            validation_success_rate=success_rate,
            account_age_days=age_days,
            deployer_score=dep_score,
            uri_change_count=uri_changes,
        )
        tier = determine_tier(composite, feedback_count)

        update_rows.append({
            "agent_id": agent_id,
            "source_chain": agent.get("source_chain", "avalanche"),
            "owner_address": owner,
            "agent_uri": agent.get("agent_uri", ""),
            "registered_at": agent["registered_at"],
            "total_feedback": feedback_count,
            "average_rating": round(avg_rating, 2),
            "composite_score": composite,
            "validation_success_rate": round(success_rate, 2),
            "tier": tier,
            "deployer_score": dep_score,
            "deployer_agent_count": dep_count,
            "uri_change_count": uri_changes,
            "freshness_multiplier": freshness,
            "updated_at": now,
        })

    # Batch upsert scores (chunks of 500 to stay within Supabase payload limits)
    batch_size = 500
    for i in range(0, len(update_rows), batch_size):
        batch = update_rows[i:i + batch_size]
        try:
            db.table("agents").upsert(batch, on_conflict="agent_id,source_chain").execute()
        except Exception as e:
            logger.error(f"Error batch-updating scores (batch {i // batch_size}): {e}")

    logger.info(f"Scored {len(update_rows)} agents")

    # Snapshot scores to score_history (once per day)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        # Check if we already snapshotted today (sample first agent)
        if update_rows:
            existing = (
                db.table("score_history")
                .select("id")
                .eq("agent_id", update_rows[0]["agent_id"])
                .eq("snapshot_date", today)
                .limit(1)
                .execute()
            )
            if not existing.data:
                logger.info(f"Writing daily score snapshot for {len(update_rows)} agents")
                snapshot_rows = []
                for row in update_rows:
                    snapshot_rows.append({
                        "agent_id": row["agent_id"],
                        "source_chain": row.get("source_chain", "avalanche"),
                        "composite_score": row["composite_score"],
                        "average_rating": row["average_rating"],
                        "total_feedback": row["total_feedback"],
                        "validation_success_rate": row["validation_success_rate"],
                        "snapshot_date": today,
                    })
                # Batch upsert in chunks of 500
                for i in range(0, len(snapshot_rows), batch_size):
                    batch = snapshot_rows[i:i + batch_size]
                    try:
                        db.table("score_history").upsert(
                            batch, on_conflict="agent_id,source_chain,snapshot_date"
                        ).execute()
                    except Exception as e:
                        logger.error(f"Error writing score snapshot batch {i // batch_size}: {e}")
                logger.info("Daily score snapshot complete")
            else:
                logger.debug("Score snapshot already exists for today, skipping")
    except Exception as e:
        logger.error(f"Error in score history snapshot: {e}")


def update_leaderboard():
    """Update the leaderboard_cache table with current rankings (batched)."""
    db = get_supabase()

    try:
        # Paginate to avoid Supabase default 1000-row limit
        all_agents: list[dict] = []
        offset = 0
        while True:
            batch = (
                db.table("agents")
                .select("agent_id, category, composite_score, owner_address, agent_uri, registered_at, source_chain")
                .order("composite_score", desc=True)
                .range(offset, offset + 999)
                .execute()
            )
            if not batch.data:
                break
            all_agents.extend(batch.data)
            if len(batch.data) < 1000:
                break
            offset += 1000
    except Exception as e:
        logger.error(f"Error fetching agents for leaderboard: {e}")
        return

    # Clear existing cache
    try:
        db.table("leaderboard_cache").delete().neq("id", 0).execute()
    except Exception:
        pass

    # Build ranks and leaderboard rows
    categories: dict[str, list] = {}
    rank_updates = []
    global_rank = 0
    for agent in all_agents:
        global_rank += 1
        cat = agent.get("category", "general") or "general"
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(agent)
        rank_updates.append({
            "agent_id": agent["agent_id"],
            "source_chain": agent.get("source_chain", "avalanche"),
            "owner_address": agent.get("owner_address", ""),
            "agent_uri": agent.get("agent_uri", ""),
            "registered_at": agent["registered_at"],
            "rank": global_rank,
        })

    # Batch update ranks (upsert with agent_id conflict)
    batch_size = 500
    for i in range(0, len(rank_updates), batch_size):
        batch = rank_updates[i:i + batch_size]
        try:
            db.table("agents").upsert(batch, on_conflict="agent_id,source_chain").execute()
        except Exception as e:
            logger.error(f"Error batch-updating ranks: {e}")

    # Batch insert leaderboard cache (include source_chain to prevent ID collisions)
    now = datetime.now(timezone.utc).isoformat()
    cache_rows = []
    for category, category_agents in categories.items():
        for rank, agent in enumerate(category_agents, 1):
            cache_rows.append({
                "category": category,
                "agent_id": agent["agent_id"],
                "source_chain": agent.get("source_chain", "avalanche"),
                "rank": rank,
                "composite_score": agent["composite_score"],
                "trend": "stable",
                "updated_at": now,
            })

    for i in range(0, len(cache_rows), batch_size):
        batch = cache_rows[i:i + batch_size]
        try:
            db.table("leaderboard_cache").insert(batch).execute()
        except Exception as e:
            logger.error(f"Error batch-inserting leaderboard cache: {e}")

    logger.info(f"Updated leaderboard: {len(rank_updates)} agents ranked, {len(cache_rows)} cache entries")


def _process_chunked(
    contract_name: str,
    processor,
    safe_block: int,
    start_block: int = DEFAULT_START_BLOCK,
    chunk_size: int = MAX_BLOCK_RANGE,
    max_chunks: int = MAX_CHUNKS_PER_CYCLE,
):
    """Process events for a contract in chunk_size chunks with retry on failure.

    Processes up to max_chunks chunks per call to allow fast catchup while
    preventing one chain from starving others.  Auto-halves chunk_size on
    "range is too large" RPC errors.
    """
    last_block = get_last_processed_block(contract_name, default_start=start_block)
    if last_block >= safe_block:
        return 0

    behind = safe_block - last_block
    # When far behind, increase chunk limit for faster catchup
    if behind > chunk_size * 100:
        max_chunks = MAX_CHUNKS_CATCHUP
        logger.info(f"[{contract_name}] {behind:,} blocks behind — CATCHUP MODE: up to {max_chunks} chunks of {chunk_size}")
    elif behind > chunk_size * 10:
        logger.info(f"[{contract_name}] {behind:,} blocks behind — processing up to {max_chunks} chunks of {chunk_size}")

    total_count = 0
    from_block = last_block + 1
    retries = 0
    max_retries = 8  # More retries with exponential backoff (max ~4 min wait)
    current_chunk = chunk_size
    chunks_done = 0

    while from_block <= safe_block and chunks_done < max_chunks:
        to_block = min(from_block + current_chunk - 1, safe_block)
        try:
            count = processor(from_block, to_block)
            total_count += count
            retries = 0  # Reset on success
            chunks_done += 1
        except Exception as e:
            err_str = str(e).lower()
            # Auto-halve chunk size on range-too-large errors
            if ("range" in err_str and "too large" in err_str) or "max is" in err_str:
                if current_chunk > 100:
                    current_chunk = max(100, current_chunk // 2)
                    logger.warning(
                        f"[{contract_name}] Range too large — halving chunk to {current_chunk} blocks"
                    )
                    retries = 0  # Don't count range errors as retries
                    continue
            retries += 1
            logger.error(
                f"Error processing {contract_name} blocks {from_block}-{to_block} "
                f"(attempt {retries}/{max_retries}): {e}"
            )
            if retries >= max_retries:
                logger.error(
                    f"[{contract_name}] Max retries reached at block {from_block} — "
                    f"will resume from here next cycle"
                )
                break
            # Exponential backoff with cap at 30s
            backoff = min(30, 2 ** retries)
            time.sleep(backoff)
            continue  # Retry same chunk, don't advance
        update_last_processed_block(contract_name, to_block)
        from_block = to_block + 1

    return total_count


def _eth_blocks_behind() -> int:
    """Return how many ETH blocks the indexer is behind, or 0 if caught up."""
    try:
        blockchain = get_blockchain_service()
        if not blockchain.w3_eth:
            return 0
        eth_current = blockchain.get_eth_current_block()
        last = get_last_processed_block(
            "erc8004_eth_identity",
            default_start=ERC8004_ETH_IDENTITY_START_BLOCK,
        )
        return max(0, eth_current - last)
    except Exception:
        return 0


# ─── Generic multi-chain indexer ──────────────────────────────────────
# Add new ERC-8004 chains here. The generic indexer uses raw httpx
# JSON-RPC calls so no web3.py instance or per-chain boilerplate needed.
EXTRA_CHAINS = [
    {"name": "polygon",  "start_block": 82_458_000,  "block_range": 10000, "env": "POLYGON_RPC_URL"},
    {"name": "arbitrum", "start_block": 428_895_000, "block_range": 50000, "env": "ARBITRUM_RPC_URL"},
    {"name": "optimism", "start_block": 147_514_000, "block_range": 10000, "env": "OPTIMISM_RPC_URL"},
    {"name": "bsc",      "start_block": 79_500_000,  "block_range": 2000,  "env": "BSC_RPC_URL"},
    {"name": "scroll",   "start_block": 29_432_000,  "block_range": 10000, "env": "SCROLL_RPC_URL"},
    {"name": "gnosis",   "start_block": 44_505_000,  "block_range": 10000, "env": "GNOSIS_RPC_URL"},
    {"name": "mantle",   "start_block": 91_333_000,  "block_range": 10000, "env": "MANTLE_RPC_URL"},
    {"name": "celo",     "start_block": 58_396_000,  "block_range": 10000, "env": "CELO_RPC_URL"},
    {"name": "monad",    "start_block": 1,           "block_range": 100,   "env": "MONAD_RPC_URL"},
    {"name": "abstract", "start_block": 1,           "block_range": 10000, "env": "ABSTRACT_RPC_URL"},
    {"name": "taiko",    "start_block": 1,           "block_range": 10000, "env": "TAIKO_RPC_URL"},
    {"name": "megaeth",  "start_block": 1,           "block_range": 10000, "env": "MEGAETH_RPC_URL"},
    {"name": "skale",    "start_block": 1,           "block_range": 2000,  "env": "SKALE_RPC_URL"},
    {"name": "xlayer",   "start_block": 1,           "block_range": 100,   "env": "XLAYER_RPC_URL"},
    {"name": "soneium",  "start_block": 1,           "block_range": 10000, "env": "SONEIUM_RPC_URL"},
    {"name": "metis",    "start_block": 1,           "block_range": 10000, "env": "METIS_RPC_URL"},
    {"name": "shape",    "start_block": 1,           "block_range": 10000, "env": "SHAPE_RPC_URL"},
]

# Cache RPC URLs so we only read env vars once
_extra_chain_rpcs: dict[str, str] = {}


def _get_extra_chain_rpc(chain_cfg: dict) -> str:
    """Get RPC URL for an extra chain, cached."""
    name = chain_cfg["name"]
    if name not in _extra_chain_rpcs:
        _extra_chain_rpcs[name] = os.environ.get(chain_cfg["env"], "")
    return _extra_chain_rpcs[name]


def _process_generic_identity(chain_name: str, rpc_url: str, from_block: int, to_block: int) -> int:
    """Generic identity event processor for any EVM chain."""
    logger.info(f"[{chain_name}] Scanning identity blocks {from_block}-{to_block}")
    events = generic_chain.fetch_registered_events(rpc_url, from_block, to_block)
    if not events:
        return 0
    logger.info(f"[{chain_name}] Found {len(events)} Registered events")

    # Fetch block timestamps
    unique_blocks = set(e.blockNumber for e in events)
    block_ts_cache: dict[int, datetime] = {}
    for blk in sorted(unique_blocks):
        try:
            block_ts_cache[blk] = generic_chain.get_block_timestamp(rpc_url, blk)
        except Exception as e:
            logger.warning(f"[{chain_name}] Failed to get block {blk} timestamp: {e}")
            block_ts_cache[blk] = datetime.now(timezone.utc)

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for event in events:
        rows.append({
            "agent_id": event.args.agentId,
            "owner_address": event.args.owner,
            "agent_uri": event.args.agentURI,
            "source_chain": chain_name,
            "registered_at": block_ts_cache[event.blockNumber].isoformat(),
            "updated_at": now,
        })

    db = get_supabase()
    _resilient_upsert(db, "agents", rows, "agent_id,source_chain", chain_name)

    return len(events)


def _process_generic_feedback(chain_name: str, rpc_url: str, from_block: int, to_block: int) -> int:
    """Generic feedback event processor for any EVM chain."""
    logger.info(f"[{chain_name}] Scanning feedback blocks {from_block}-{to_block}")
    events = generic_chain.fetch_feedback_events(rpc_url, from_block, to_block)
    if not events:
        return 0

    # We need a web3 instance for _process_cross_chain_feedback's block timestamp fetching.
    # Use generic_chain's httpx-based timestamp fetcher instead by pre-populating timestamps.
    unique_blocks = set(e.blockNumber for e in events)
    # Monkey-patch a minimal object with eth.get_block() that returns timestamps
    class _MinimalW3:
        class eth:
            @staticmethod
            def get_block(blk):
                ts = generic_chain.get_block_timestamp(rpc_url, blk)
                class _B:
                    timestamp = int(ts.timestamp())
                return _B()

    return _process_cross_chain_feedback(chain_name, events, _MinimalW3())


def run_indexer_cycle():
    """Run one indexer cycle: scan blocks and index events. No scoring."""
    blockchain = get_blockchain_service()

    if not blockchain.is_connected():
        logger.warning("Blockchain not connected, skipping indexer cycle")
        return

    # --- Ethereum first (highest priority during catchup) ---
    if blockchain.w3_eth:
        try:
            eth_current = blockchain.get_eth_current_block()
            eth_safe = eth_current - CONFIRMATION_BLOCKS
            if eth_safe > 0:
                count = _process_chunked(
                    "erc8004_eth_identity",
                    process_erc8004_eth_identity_events,
                    eth_safe,
                    start_block=ERC8004_ETH_IDENTITY_START_BLOCK,
                    chunk_size=ETH_MAX_BLOCK_RANGE,
                )
                if count > 0:
                    logger.info(f"Processed {count} ERC-8004 Ethereum agent registration events")
            # Resolve metadata URIs for unnamed Ethereum agents
            try:
                resolved = resolve_agent_metadata(chain="ethereum", batch_size=200)
                if resolved > 0:
                    logger.info(f"Resolved {resolved} Ethereum agent metadata URIs")
            except Exception as e:
                logger.warning(f"Ethereum URI resolution failed (non-fatal): {e}")
        except Exception as e:
            logger.error(f"Error processing Ethereum ERC-8004 events: {e}")

    # --- Base ---
    if blockchain.w3_base:
        # Priority sync: fetch ALL feedback for high-value agents before sequential catchup
        try:
            sync_priority_agent_feedback(chain="base")
        except Exception as e:
            logger.warning(f"Priority feedback sync failed (non-fatal): {e}")

        try:
            base_current = blockchain.get_base_current_block()
            base_safe = base_current - CONFIRMATION_BLOCKS
            if base_safe > 0:
                count = _process_chunked(
                    "erc8004_base_identity",
                    process_erc8004_base_identity_events,
                    base_safe,
                    start_block=ERC8004_BASE_IDENTITY_START_BLOCK,
                    chunk_size=BASE_MAX_BLOCK_RANGE,
                )
                if count > 0:
                    logger.info(f"Processed {count} ERC-8004 Base agent registration events")
                # Base feedback events (1K block limit for web3.py get_logs)
                count = _process_chunked(
                    "erc8004_base_feedback",
                    process_base_feedback_events,
                    base_safe,
                    start_block=ERC8004_BASE_IDENTITY_START_BLOCK,
                    chunk_size=BASE_FEEDBACK_BLOCK_RANGE,
                )
                if count > 0:
                    logger.info(f"Processed {count} ERC-8004 Base feedback events")
            # Resolve metadata URIs for unnamed Base agents
            try:
                resolved = resolve_agent_metadata(chain="base", batch_size=200)
                if resolved > 0:
                    logger.info(f"Resolved {resolved} Base agent metadata URIs")
            except Exception as e:
                logger.warning(f"Base URI resolution failed (non-fatal): {e}")
        except Exception as e:
            logger.error(f"Error processing Base ERC-8004 events: {e}")

    # --- Linea ---
    if blockchain.w3_linea:
        try:
            linea_current = blockchain.get_linea_current_block()
            linea_safe = linea_current - CONFIRMATION_BLOCKS
            if linea_safe > 0:
                count = _process_chunked(
                    "erc8004_linea_identity",
                    process_erc8004_linea_identity_events,
                    linea_safe,
                    start_block=ERC8004_LINEA_IDENTITY_START_BLOCK,
                    chunk_size=LINEA_MAX_BLOCK_RANGE,
                )
                if count > 0:
                    logger.info(f"Processed {count} ERC-8004 Linea agent registration events")
                # Linea feedback events
                count = _process_chunked(
                    "erc8004_linea_feedback",
                    process_linea_feedback_events,
                    linea_safe,
                    start_block=ERC8004_LINEA_IDENTITY_START_BLOCK,
                    chunk_size=LINEA_MAX_BLOCK_RANGE,
                )
                if count > 0:
                    logger.info(f"Processed {count} ERC-8004 Linea feedback events")
            # Resolve metadata URIs for unnamed Linea agents
            try:
                resolved = resolve_agent_metadata(chain="linea", batch_size=200)
                if resolved > 0:
                    logger.info(f"Resolved {resolved} Linea agent metadata URIs")
            except Exception as e:
                logger.warning(f"Linea URI resolution failed (non-fatal): {e}")
        except Exception as e:
            logger.error(f"Error processing Linea ERC-8004 events: {e}")

    # --- Avalanche ---
    try:
        current_block = blockchain.get_current_block()
    except Exception as e:
        logger.error(f"Error getting current block: {e}")
        return

    safe_block = current_block - CONFIRMATION_BLOCKS
    if safe_block < 0:
        return

    # Process official ERC-8004 Identity Registry events on Avalanche
    count = _process_chunked("erc8004_identity", process_erc8004_identity_events, safe_block, start_block=ERC8004_IDENTITY_START_BLOCK)
    if count > 0:
        logger.info(f"Processed {count} ERC-8004 Avalanche agent registration events")

    # Process custom identity events (chunked)
    count = _process_chunked("identity", process_agent_registered_events, safe_block)
    if count > 0:
        logger.info(f"Processed {count} custom agent registration events")

    # Self-healing: if reputation_events is empty but the checkpoint has
    # already advanced, reset it so we rescan from the contract deployment
    # block.  This covers the case where the old buggy field-mapping code
    # silently advanced the checkpoint without writing any rows.
    try:
        rep_check = get_last_processed_block("reputation")
        if rep_check > ERC8004_IDENTITY_START_BLOCK:
            rep_count = (
                get_supabase().table("reputation_events")
                .select("id", count="exact")
                .execute()
            )
            if rep_count.count == 0:
                reset_to = ERC8004_IDENTITY_START_BLOCK
                logger.warning(
                    f"reputation_events is empty but checkpoint is at {rep_check} — "
                    f"resetting reputation checkpoint to {reset_to} to rescan"
                )
                update_last_processed_block("reputation", reset_to)
    except Exception as e:
        logger.error(f"Error in reputation checkpoint self-heal check: {e}")

    # Process reputation events (chunked)
    rep_checkpoint = get_last_processed_block("reputation")
    rep_behind = safe_block - rep_checkpoint
    if rep_behind > 10000:
        logger.info(f"Reputation indexer is {rep_behind} blocks behind (checkpoint={rep_checkpoint}, head={safe_block})")
    count = _process_chunked("reputation", process_feedback_events, safe_block)
    if count > 0:
        logger.info(f"Processed {count} feedback events")

    # Process validation events (chunked)
    count = _process_chunked("validation", process_validation_events, safe_block)
    if count > 0:
        logger.info(f"Processed {count} validation events")

    # Process ERC-8183 job outcome events (chunked)
    if os.environ.get("AGENTPROOF_HOOK_ADDRESS"):
        count = _process_chunked("job_outcomes", process_job_outcome_events, safe_block)
        if count > 0:
            logger.info(f"Processed {count} ERC-8183 job outcome events")

    # --- Extra chains (generic indexer) ---
    skipped_chains = []
    for chain_cfg in EXTRA_CHAINS:
        rpc_url = _get_extra_chain_rpc(chain_cfg)
        if not rpc_url:
            skipped_chains.append(chain_cfg["name"])
            continue
    if skipped_chains:
        logger.warning(f"Skipping {len(skipped_chains)} chains with no RPC URL: {', '.join(skipped_chains)}")

    for chain_cfg in EXTRA_CHAINS:
        rpc_url = _get_extra_chain_rpc(chain_cfg)
        if not rpc_url:
            continue
        chain_name = chain_cfg["name"]
        try:
            current = generic_chain.get_current_block(rpc_url)
            chain_safe = current - CONFIRMATION_BLOCKS
            if chain_safe <= 0:
                continue

            # Identity events
            count = _process_chunked(
                f"erc8004_{chain_name}_identity",
                lambda fb, tb, cn=chain_name, ru=rpc_url: _process_generic_identity(cn, ru, fb, tb),
                chain_safe,
                start_block=chain_cfg["start_block"],
                chunk_size=chain_cfg["block_range"],
            )
            if count > 0:
                logger.info(f"Processed {count} ERC-8004 {chain_name} agent registration events")

            # Feedback events
            count = _process_chunked(
                f"erc8004_{chain_name}_feedback",
                lambda fb, tb, cn=chain_name, ru=rpc_url: _process_generic_feedback(cn, ru, fb, tb),
                chain_safe,
                start_block=chain_cfg["start_block"],
                chunk_size=chain_cfg["block_range"],
            )
            if count > 0:
                logger.info(f"Processed {count} ERC-8004 {chain_name} feedback events")

            # Resolve metadata URIs
            try:
                resolved = resolve_agent_metadata(chain=chain_name, batch_size=200)
                if resolved > 0:
                    logger.info(f"Resolved {resolved} {chain_name} agent metadata URIs")
            except Exception as e:
                logger.warning(f"{chain_name} URI resolution failed (non-fatal): {e}")

        except Exception as e:
            logger.error(f"Error processing {chain_name} ERC-8004 events: {e}")

    # --- Solana (non-EVM) ---
    solana_rpc = os.environ.get("SOLANA_RPC_URL", "")
    if solana_rpc:
        try:
            count = _process_solana_agents(solana_rpc)
            if count > 0:
                logger.info(f"Processed {count} Solana agent registrations")

            count = _process_solana_feedback(solana_rpc)
            if count > 0:
                logger.info(f"Processed {count} Solana feedback events")

            try:
                resolved = resolve_agent_metadata(chain="solana", batch_size=200)
                if resolved > 0:
                    logger.info(f"Resolved {resolved} Solana agent metadata URIs")
            except Exception as e:
                logger.warning(f"Solana URI resolution failed (non-fatal): {e}")

        except Exception as e:
            logger.error(f"Error processing Solana events: {e}")


def _process_solana_agents(rpc_url: str) -> int:
    """Index new Solana agent registrations."""
    db = get_supabase()
    contract_name = "solana_agent_registry"
    last_slot = get_last_processed_block(contract_name, default_start=0)

    if last_slot == 0:
        # First run — backfill via getProgramAccounts snapshot
        logger.info("Solana: first run — performing full agent snapshot")
        agents = solana_chain.snapshot_all_agents(rpc_url)
        if not agents:
            # Store current slot so next run uses incremental mode
            current = solana_chain.get_current_slot(rpc_url)
            update_last_processed_block(contract_name, current)
            return 0
        current = solana_chain.get_current_slot(rpc_url)
        new_slot = current
    else:
        agents, new_slot = solana_chain.fetch_new_registrations(
            rpc_url, solana_chain.AGENT_REGISTRY_PROGRAM, last_slot
        )
        if not agents:
            return 0

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for agent in agents:
        # Try to get block time for the slot
        try:
            registered_at = solana_chain.get_block_time(rpc_url, agent.slot).isoformat() if agent.slot > 0 else now
        except Exception:
            registered_at = now

        rows.append({
            "agent_id": agent.agent_id,
            "owner_address": agent.owner,
            "agent_uri": agent.agent_uri,
            "name": agent.nft_name or None,
            "source_chain": "solana",
            "registered_at": registered_at,
            "updated_at": now,
        })

    _resilient_upsert(db, "agents", rows, "agent_id,source_chain", "solana")

    update_last_processed_block(contract_name, new_slot)
    return len(rows)


def _process_solana_feedback(rpc_url: str) -> int:
    """Index new Solana ATOM Engine feedback."""
    db = get_supabase()
    contract_name = "solana_atom_feedback"
    last_slot = get_last_processed_block(contract_name, default_start=0)

    if last_slot == 0:
        # First run — just set the current slot, don't backfill all feedback
        current = solana_chain.get_current_slot(rpc_url)
        update_last_processed_block(contract_name, current)
        logger.info(f"Solana feedback: initialized at slot {current}")
        return 0

    feedback_list, new_slot = solana_chain.fetch_new_feedback(
        rpc_url, solana_chain.ATOM_ENGINE_PROGRAM, last_slot
    )
    if not feedback_list:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for fb in feedback_list:
        if fb.is_revoked:
            continue

        agent_id = solana_chain.mint_to_agent_id(fb.agent_mint)
        rows.append({
            "agent_id": agent_id,
            "reviewer_address": fb.reviewer,
            "rating": fb.score,
            "feedback_uri": None,
            "task_hash": None,
            "tag1": None,
            "tag2": None,
            "tx_hash": fb.tx_signature,
            "block_number": fb.slot,
            "source_chain": "solana",
            "created_at": now,
        })

    if rows:
        try:
            db.table("reputation_events").upsert(rows, on_conflict="tx_hash").execute()
            logger.info(f"[solana] Upserted {len(rows)} feedback events")
        except Exception as e:
            logger.error(f"[solana] Feedback upsert failed: {e}")

    update_last_processed_block(contract_name, new_slot)
    return len(rows)


def run_scoring_cycle():
    """Recalculate scores and leaderboard. Runs on a separate, slower schedule."""
    behind = _eth_blocks_behind()
    if behind > 5000:
        logger.info(
            f"Note: ETH indexer is {behind} blocks behind (identity only, "
            "does not affect reputation scoring)"
        )
    logger.info("Starting scoring cycle")
    try:
        recalculate_deployer_scores()
        recalculate_agent_scores()
        update_leaderboard()
        logger.info("Scoring cycle complete")
    except Exception as e:
        logger.error(f"Scoring cycle failed: {e}", exc_info=True)
