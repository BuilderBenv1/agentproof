"""
Solana chain indexer for 8004-Solana Agent Registry and ATOM Engine.

Uses raw httpx JSON-RPC calls — no heavy SDK dependencies.
Follows the same pattern as generic_chain.py but for Solana's
account-based model instead of EVM event logs.

Program addresses (mainnet-beta):
  Agent Registry: 8oo4dC4JvBLwy5tGgiH3WwK4B9PWxL9Z4XjA2jzkQMbQ
  ATOM Engine:    AToMw53aiPQ8j7iHVb4fGt6nzUNxUhcPc3tbPBZuzVVb
"""

import base64
import hashlib
import logging
import struct
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import base58
import httpx

logger = logging.getLogger(__name__)

# ─── Program IDs ────────────────────────────────────────────────

AGENT_REGISTRY_PROGRAM = "8oo4dC4JvBLwy5tGgiH3WwK4B9PWxL9Z4XjA2jzkQMbQ"
ATOM_ENGINE_PROGRAM = "AToMw53aiPQ8j7iHVb4fGt6nzUNxUhcPc3tbPBZuzVVb"

# ─── Account discriminators (first 8 bytes of account data) ─────
# From 8004-solana-ts instruction-discriminators.ts

AGENT_ACCOUNT_DISC = bytes([241, 119, 69, 140, 233, 9, 112, 50])
FEEDBACK_ACCOUNT_DISC = bytes([152, 72, 187, 86, 92, 83, 63, 83])
ATOM_STATS_DISC = bytes([190, 187, 50, 59, 203, 39, 136, 244])

# Instruction discriminators for log parsing
REGISTER_DISC = bytes([211, 124, 67, 15, 211, 194, 178, 240])
GIVE_FEEDBACK_DISC = bytes([145, 136, 123, 3, 215, 165, 98, 41])

TIMEOUT = 30
RPC_DELAY = 0.1  # 100ms between RPC calls to respect rate limits


# ─── Data classes ───────────────────────────────────────────────

@dataclass
class SolanaAgent:
    """Parsed agent registration from on-chain account data."""
    mint_address: str       # base58 NFT mint / asset pubkey
    owner: str              # base58 creator/owner
    agent_uri: str          # metadata URI (IPFS/HTTPS)
    nft_name: str           # on-chain name
    collection: str         # collection name
    slot: int               # slot when discovered/updated
    agent_id: int           # deterministic integer ID for DB


@dataclass
class SolanaFeedback:
    """Parsed feedback from on-chain account data."""
    agent_mint: str         # base58 asset pubkey
    reviewer: str           # base58 client address
    score: int              # 0-100 rating
    feedback_index: int     # sequence number
    is_revoked: bool
    slot: int
    tx_signature: str


# ─── Borsh helpers ──────────────────────────────────────────────

def _read_pubkey(data: bytes, offset: int) -> tuple[str, int]:
    """Read a 32-byte Solana pubkey and return (base58_str, new_offset)."""
    raw = data[offset:offset + 32]
    return base58.b58encode(raw).decode("ascii"), offset + 32


def _read_u8(data: bytes, offset: int) -> tuple[int, int]:
    return data[offset], offset + 1


def _read_u64(data: bytes, offset: int) -> tuple[int, int]:
    val = struct.unpack_from("<Q", data, offset)[0]
    return val, offset + 8


def _read_string(data: bytes, offset: int) -> tuple[str, int]:
    """Read a Borsh string (4-byte LE length prefix + UTF-8 bytes)."""
    length = struct.unpack_from("<I", data, offset)[0]
    offset += 4
    s = data[offset:offset + length].decode("utf-8", errors="replace")
    return s, offset + length


def _read_option_pubkey(data: bytes, offset: int) -> tuple[Optional[str], int]:
    """Read Option<Pubkey>: 1 byte tag (0=None, 1=Some) + 32 bytes if Some."""
    tag = data[offset]
    offset += 1
    if tag == 0:
        return None, offset
    pk, offset = _read_pubkey(data, offset)
    return pk, offset


# ─── Agent ID mapping ──────────────────────────────────────────

def mint_to_agent_id(mint_address: str) -> int:
    """
    Deterministic mapping from base58 mint address to integer agent_id.
    Uses first 4 bytes of SHA-256 hash, masked to positive 31-bit int.
    Collision risk negligible at <100K agents (~0.002%).
    """
    raw = base58.b58decode(mint_address)
    h = hashlib.sha256(raw).digest()
    return int.from_bytes(h[:4], "big") & 0x7FFFFFFF


# ─── Account data decoders ──────────────────────────────────────

def decode_agent_account(data: bytes, slot: int = 0) -> Optional[SolanaAgent]:
    """
    Decode an AgentAccount from raw Borsh-encoded account data.

    Schema (from 8004-solana-ts borsh-schemas.ts):
      collection:       [32]  Pubkey
      creator:          [32]  Pubkey
      owner:            [32]  Pubkey
      asset:            [32]  Pubkey
      bump:             u8
      atom_enabled:     u8
      agent_wallet:     Option<[32]>  Pubkey
      feedback_digest:  [32]
      feedback_count:   u64
      response_digest:  [32]
      response_count:   u64
      revoke_digest:    [32]
      revoke_count:     u64
      parent_asset:     Option<[32]>
      parent_locked:    u8
      col_locked:       u8
      agent_uri:        string
      nft_name:         string
      col:              string
    """
    try:
        # Verify discriminator
        if data[:8] != AGENT_ACCOUNT_DISC:
            return None

        offset = 8  # skip discriminator
        collection_pk, offset = _read_pubkey(data, offset)
        creator, offset = _read_pubkey(data, offset)
        owner, offset = _read_pubkey(data, offset)
        asset, offset = _read_pubkey(data, offset)
        _bump, offset = _read_u8(data, offset)
        _atom_enabled, offset = _read_u8(data, offset)
        _agent_wallet, offset = _read_option_pubkey(data, offset)
        # Skip feedback_digest (32) + feedback_count (8)
        offset += 32 + 8
        # Skip response_digest (32) + response_count (8)
        offset += 32 + 8
        # Skip revoke_digest (32) + revoke_count (8)
        offset += 32 + 8
        # Skip parent_asset Option<[32]>
        _parent_asset, offset = _read_option_pubkey(data, offset)
        _parent_locked, offset = _read_u8(data, offset)
        _col_locked, offset = _read_u8(data, offset)
        agent_uri, offset = _read_string(data, offset)
        nft_name, offset = _read_string(data, offset)
        col, offset = _read_string(data, offset)

        return SolanaAgent(
            mint_address=asset,
            owner=creator,
            agent_uri=agent_uri,
            nft_name=nft_name,
            collection=col,
            slot=slot,
            agent_id=mint_to_agent_id(asset),
        )
    except Exception as e:
        logger.warning(f"Failed to decode AgentAccount: {e}")
        return None


def decode_feedback_account(data: bytes, slot: int = 0, tx_sig: str = "") -> Optional[SolanaFeedback]:
    """
    Decode a FeedbackAccount from raw Borsh-encoded account data.

    Schema:
      asset:            [32]  Pubkey
      client_address:   [32]  Pubkey
      feedback_index:   u64
      score:            u8
      is_revoked:       u8
      bump:             u8
    """
    try:
        if data[:8] != FEEDBACK_ACCOUNT_DISC:
            return None

        offset = 8
        asset, offset = _read_pubkey(data, offset)
        client, offset = _read_pubkey(data, offset)
        fb_index, offset = _read_u64(data, offset)
        score, offset = _read_u8(data, offset)
        is_revoked, offset = _read_u8(data, offset)

        return SolanaFeedback(
            agent_mint=asset,
            reviewer=client,
            score=score,
            feedback_index=fb_index,
            is_revoked=bool(is_revoked),
            slot=slot,
            tx_signature=tx_sig,
        )
    except Exception as e:
        logger.warning(f"Failed to decode FeedbackAccount: {e}")
        return None


# ─── RPC helpers ────────────────────────────────────────────────

def _rpc_call(rpc_url: str, method: str, params: list) -> dict:
    """Make a Solana JSON-RPC call."""
    resp = httpx.post(
        rpc_url,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=TIMEOUT,
    )
    data = resp.json()
    if "error" in data:
        raise Exception(f"Solana RPC {method} error: {data['error']}")
    return data.get("result")


def get_current_slot(rpc_url: str) -> int:
    """Get the current finalized slot."""
    return _rpc_call(rpc_url, "getSlot", [{"commitment": "finalized"}])


def get_block_time(rpc_url: str, slot: int) -> datetime:
    """Get block timestamp for a slot. Walks backwards on null (skipped slots)."""
    for offset in range(5):
        try:
            ts = _rpc_call(rpc_url, "getBlockTime", [slot - offset])
            if ts is not None:
                return datetime.fromtimestamp(ts, tz=timezone.utc)
        except Exception:
            continue
    return datetime.now(timezone.utc)


def get_signatures_for_address(
    rpc_url: str,
    address: str,
    before: Optional[str] = None,
    limit: int = 1000,
) -> list[dict]:
    """
    Get transaction signatures for a program address.
    Returns in reverse chronological order.
    Each entry: {signature, slot, blockTime, err, memo}
    """
    opts: dict = {"limit": limit, "commitment": "finalized"}
    if before:
        opts["before"] = before
    result = _rpc_call(rpc_url, "getSignaturesForAddress", [address, opts])
    return result or []


def get_transaction(rpc_url: str, signature: str) -> Optional[dict]:
    """Get a parsed transaction by signature."""
    try:
        return _rpc_call(rpc_url, "getTransaction", [
            signature,
            {"encoding": "jsonParsed", "commitment": "finalized", "maxSupportedTransactionVersion": 0},
        ])
    except Exception as e:
        logger.warning(f"Failed to get transaction {signature[:16]}...: {e}")
        return None


def get_program_accounts(
    rpc_url: str,
    program_id: str,
    discriminator: Optional[bytes] = None,
) -> list[dict]:
    """
    Get all accounts owned by a program.
    Optionally filter by account discriminator (first 8 bytes).
    Returns list of {pubkey, account: {data: [base64, "base64"], ...}}.
    """
    opts: dict = {"encoding": "base64", "commitment": "finalized"}
    if discriminator:
        opts["filters"] = [
            {"memcmp": {"offset": 0, "bytes": base58.b58encode(discriminator).decode()}}
        ]
    return _rpc_call(rpc_url, "getProgramAccounts", [program_id, opts]) or []


# ─── High-level fetchers ───────────────────────────────────────

def snapshot_all_agents(rpc_url: str, program_id: str = AGENT_REGISTRY_PROGRAM) -> list[SolanaAgent]:
    """
    Backfill: fetch all AgentAccount PDAs via getProgramAccounts.
    Used on first run or reset.
    """
    logger.info("Solana: snapshotting all agent accounts via getProgramAccounts...")
    raw_accounts = get_program_accounts(rpc_url, program_id, AGENT_ACCOUNT_DISC)
    logger.info(f"Solana: found {len(raw_accounts)} agent accounts")

    agents = []
    for acc in raw_accounts:
        try:
            data_b64 = acc["account"]["data"][0]
            data = base64.b64decode(data_b64)
            agent = decode_agent_account(data)
            if agent:
                agents.append(agent)
        except Exception as e:
            logger.warning(f"Failed to decode agent account {acc.get('pubkey', '?')}: {e}")

    logger.info(f"Solana: decoded {len(agents)} agents from snapshot")
    return agents


def fetch_new_registrations(
    rpc_url: str,
    program_id: str,
    last_slot: int,
    max_batches: int = 20,
) -> tuple[list[SolanaAgent], int]:
    """
    Incremental: fetch new agent registrations since last_slot.
    Uses getSignaturesForAddress + getTransaction to find register instructions.
    Returns (agents, new_highest_slot).
    """
    agents = []
    highest_slot = last_slot
    before_sig = None
    batches = 0

    while batches < max_batches:
        sigs = get_signatures_for_address(rpc_url, program_id, before=before_sig, limit=100)
        if not sigs:
            break
        batches += 1

        # Filter to signatures newer than last_slot
        new_sigs = [s for s in sigs if s["slot"] > last_slot and s.get("err") is None]
        if not new_sigs:
            # All remaining sigs are older than last_slot
            break

        for sig_info in new_sigs:
            slot = sig_info["slot"]
            highest_slot = max(highest_slot, slot)

            time.sleep(RPC_DELAY)
            tx = get_transaction(rpc_url, sig_info["signature"])
            if not tx:
                continue

            # Look for AgentAccount creation in post-transaction accounts
            agent = _extract_agent_from_tx(tx, slot)
            if agent:
                agents.append(agent)

        # Pagination: set before to oldest signature in this batch
        before_sig = sigs[-1]["signature"]

        # If we got fewer than limit, we've reached the end
        if len(sigs) < 100:
            break

    return agents, highest_slot


def fetch_new_feedback(
    rpc_url: str,
    program_id: str,
    last_slot: int,
    max_batches: int = 20,
) -> tuple[list[SolanaFeedback], int]:
    """
    Incremental: fetch new feedback since last_slot from ATOM engine.
    """
    feedback_list = []
    highest_slot = last_slot
    before_sig = None
    batches = 0

    while batches < max_batches:
        sigs = get_signatures_for_address(rpc_url, program_id, before=before_sig, limit=100)
        if not sigs:
            break
        batches += 1

        new_sigs = [s for s in sigs if s["slot"] > last_slot and s.get("err") is None]
        if not new_sigs:
            break

        for sig_info in new_sigs:
            slot = sig_info["slot"]
            highest_slot = max(highest_slot, slot)

            time.sleep(RPC_DELAY)
            tx = get_transaction(rpc_url, sig_info["signature"])
            if not tx:
                continue

            fb = _extract_feedback_from_tx(tx, slot, sig_info["signature"])
            if fb:
                feedback_list.append(fb)

        before_sig = sigs[-1]["signature"]
        if len(sigs) < 100:
            break

    return feedback_list, highest_slot


# ─── Transaction parsing helpers ────────────────────────────────

def _extract_agent_from_tx(tx: dict, slot: int) -> Optional[SolanaAgent]:
    """
    Extract agent registration from a transaction.
    Looks for inner instructions that create AgentAccount PDAs,
    or parses Anchor event logs.
    """
    try:
        meta = tx.get("meta", {})
        if meta.get("err"):
            return None

        # Check log messages for registration-related activity
        log_msgs = meta.get("logMessages", [])
        is_register = any(
            "Instruction: Register" in msg or
            "Instruction: RegisterWithOptions" in msg or
            "Instruction: RegisterEmpty" in msg
            for msg in log_msgs
        )
        if not is_register:
            return None

        # Try to extract from inner instructions that create accounts
        # The agent URI and name are in the instruction data.
        # Simplest approach: look for account keys and try to read AgentAccount
        # from post-transaction account state.

        # Get all account keys from the transaction
        msg = tx.get("transaction", {}).get("message", {})
        account_keys = []
        for key in msg.get("accountKeys", []):
            if isinstance(key, dict):
                account_keys.append(key.get("pubkey", ""))
            else:
                account_keys.append(key)

        # Extract data from Anchor event logs
        agent = _parse_agent_from_logs(log_msgs, account_keys, slot)
        if agent:
            return agent

        # Fallback: parse instruction data directly
        return _parse_agent_from_instructions(tx, slot)

    except Exception as e:
        logger.debug(f"Could not extract agent from tx: {e}")
        return None


def _parse_agent_from_logs(
    log_msgs: list[str],
    account_keys: list[str],
    slot: int,
) -> Optional[SolanaAgent]:
    """
    Parse Anchor event data from program log messages.
    Anchor emits events as "Program data: <base64>" log lines.
    """
    program_id = AGENT_REGISTRY_PROGRAM
    in_program = False

    for msg in log_msgs:
        if f"Program {program_id} invoke" in msg:
            in_program = True
            continue
        if f"Program {program_id} success" in msg or f"Program {program_id} consumed" in msg:
            in_program = False
            continue

        if in_program and msg.startswith("Program data: "):
            b64_data = msg[len("Program data: "):]
            try:
                raw = base64.b64decode(b64_data)
                # Try to decode as an AgentAccount-like event
                if len(raw) > 140:  # minimum size for agent data
                    agent = decode_agent_account(raw, slot)
                    if agent:
                        return agent
            except Exception:
                continue

    return None


def _parse_agent_from_instructions(tx: dict, slot: int) -> Optional[SolanaAgent]:
    """
    Fallback: parse agent data from instruction accounts and inner instructions.
    For register instructions, the agent URI is passed as instruction data.
    """
    try:
        msg = tx.get("transaction", {}).get("message", {})
        instructions = msg.get("instructions", [])

        for ix in instructions:
            program_id = ix.get("programId", "")
            if program_id != AGENT_REGISTRY_PROGRAM:
                continue

            # The instruction data contains the agent URI and name (Borsh-encoded)
            ix_data_b64 = ix.get("data", "")
            if not ix_data_b64:
                continue

            try:
                ix_data = base64.b64decode(ix_data_b64)
            except Exception:
                ix_data = base58.b58decode(ix_data_b64)

            # Check discriminator
            disc = ix_data[:8]
            if disc not in (REGISTER_DISC, bytes([177, 175, 96, 41, 59, 166, 13, 6]),
                            bytes([89, 129, 72, 185, 119, 80, 140, 126])):
                continue

            # Parse register instruction args: name (string), uri (string), collection (string)
            offset = 8
            try:
                nft_name, offset = _read_string(ix_data, offset)
                agent_uri, offset = _read_string(ix_data, offset)
                col_name, offset = _read_string(ix_data, offset)
            except Exception:
                continue

            # Get the asset account key (typically account index 1 or 2)
            accounts = ix.get("accounts", [])
            if len(accounts) < 3:
                continue

            # Account layout for register: [payer, asset, agent_pda, collection, ...]
            asset_key = accounts[1] if len(accounts) > 1 else accounts[0]
            owner_key = accounts[0]

            return SolanaAgent(
                mint_address=asset_key,
                owner=owner_key,
                agent_uri=agent_uri,
                nft_name=nft_name,
                collection=col_name,
                slot=slot,
                agent_id=mint_to_agent_id(asset_key),
            )

    except Exception as e:
        logger.debug(f"Instruction parsing failed: {e}")

    return None


def _extract_feedback_from_tx(tx: dict, slot: int, tx_sig: str) -> Optional[SolanaFeedback]:
    """Extract feedback submission from a transaction."""
    try:
        meta = tx.get("meta", {})
        if meta.get("err"):
            return None

        log_msgs = meta.get("logMessages", [])
        is_feedback = any("Instruction: GiveFeedback" in msg for msg in log_msgs)
        if not is_feedback:
            return None

        # Parse from instruction data
        msg = tx.get("transaction", {}).get("message", {})
        instructions = msg.get("instructions", [])

        for ix in instructions:
            program_id = ix.get("programId", "")
            if program_id != ATOM_ENGINE_PROGRAM:
                continue

            ix_data_b64 = ix.get("data", "")
            if not ix_data_b64:
                continue

            try:
                ix_data = base64.b64decode(ix_data_b64)
            except Exception:
                ix_data = base58.b58decode(ix_data_b64)

            if ix_data[:8] != GIVE_FEEDBACK_DISC:
                continue

            # giveFeedback args: value (i128), value_decimals (u8), tag1, tag2, endpoint, feedbackURI, feedbackHash
            offset = 8
            # Read value as i128 (16 bytes LE)
            value_raw = ix_data[offset:offset + 16]
            value = int.from_bytes(value_raw, "little", signed=True)
            offset += 16
            value_decimals = ix_data[offset]
            offset += 1

            # Normalize to 0-100 scale
            if value_decimals > 0:
                score = value / (10 ** value_decimals)
            else:
                score = value
            score = max(1, min(100, int(score)))

            # Get account keys: [payer, agent_asset, feedback_pda, ...]
            accounts = ix.get("accounts", [])
            reviewer = accounts[0] if accounts else ""
            agent_asset = accounts[1] if len(accounts) > 1 else ""

            return SolanaFeedback(
                agent_mint=agent_asset,
                reviewer=reviewer,
                score=score,
                feedback_index=0,
                is_revoked=False,
                slot=slot,
                tx_signature=tx_sig,
            )

    except Exception as e:
        logger.debug(f"Could not extract feedback from tx: {e}")

    return None
