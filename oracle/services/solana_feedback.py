"""
Solana feedback submission for the 8004-Solana Agent Registry.

Submits giveFeedback instructions to the Agent Registry program,
which internally CPIs to the ATOM Engine for scoring.

Uses solders for Ed25519 signing and transaction construction.
Follows the same pattern as chain.py _ChainBackend but for Solana.

Program addresses (mainnet-beta):
  Agent Registry: 8oo4dC4JvBLwy5tGgiH3WwK4B9PWxL9Z4XjA2jzkQMbQ
  ATOM Engine:    AToMw53aiPQ8j7iHVb4fGt6nzUNxUhcPc3tbPBZuzVVb
"""

import base64
import hashlib
import logging
import struct
import time
from typing import Optional

import base58
import httpx
from solders.keypair import Keypair  # type: ignore[import-untyped]
from solders.pubkey import Pubkey  # type: ignore[import-untyped]
from solders.instruction import Instruction, AccountMeta  # type: ignore[import-untyped]
from solders.transaction import Transaction  # type: ignore[import-untyped]
from solders.message import Message  # type: ignore[import-untyped]
from solders.hash import Hash  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)

# ─── Program IDs ────────────────────────────────────────────────
AGENT_REGISTRY_PROGRAM = Pubkey.from_string("8oo4dC4JvBLwy5tGgiH3WwK4B9PWxL9Z4XjA2jzkQMbQ")
ATOM_ENGINE_PROGRAM = Pubkey.from_string("AToMw53aiPQ8j7iHVb4fGt6nzUNxUhcPc3tbPBZuzVVb")
SYSTEM_PROGRAM = Pubkey.from_string("11111111111111111111111111111111")

# Instruction discriminator for giveFeedback (sha256("global:give_feedback")[:8])
GIVE_FEEDBACK_DISC = bytes([145, 136, 123, 3, 215, 165, 98, 41])

# Account discriminator for AgentAccount (first 8 bytes)
AGENT_ACCOUNT_DISC = bytes([241, 119, 69, 140, 233, 9, 112, 50])
ATOM_STATS_DISC = bytes([190, 187, 50, 59, 203, 39, 136, 244])

TIMEOUT = 30
TX_RATE_LIMIT_SECONDS = 30
MIN_BALANCE_LAMPORTS = 5_000_000  # 0.005 SOL


# ─── Borsh helpers ──────────────────────────────────────────────

def _read_pubkey(data: bytes, offset: int) -> tuple[bytes, int]:
    """Read a 32-byte Solana pubkey as raw bytes."""
    return data[offset:offset + 32], offset + 32


def _read_u8(data: bytes, offset: int) -> tuple[int, int]:
    return data[offset], offset + 1


def _read_u64(data: bytes, offset: int) -> tuple[int, int]:
    return struct.unpack_from("<Q", data, offset)[0], offset + 8


def _read_string(data: bytes, offset: int) -> tuple[str, int]:
    length = struct.unpack_from("<I", data, offset)[0]
    offset += 4
    s = data[offset:offset + length].decode("utf-8", errors="replace")
    return s, offset + length


def _read_option_pubkey(data: bytes, offset: int) -> tuple[Optional[bytes], int]:
    tag = data[offset]
    offset += 1
    if tag == 0:
        return None, offset
    raw = data[offset:offset + 32]
    return raw, offset + 32


def _write_borsh_string(buf: bytearray, s: str) -> None:
    """Write a Borsh string (4-byte LE length prefix + UTF-8 bytes)."""
    encoded = s.encode("utf-8")
    buf.extend(struct.pack("<I", len(encoded)))
    buf.extend(encoded)


def _write_borsh_option_bytes32(buf: bytearray, value: Optional[bytes]) -> None:
    """Write Option<[u8; 32]>: 0x00 for None, 0x01 + 32 bytes for Some."""
    if value is None:
        buf.append(0)
    else:
        buf.append(1)
        buf.extend(value[:32])


def _write_borsh_option_u8(buf: bytearray, value: Optional[int]) -> None:
    """Write Option<u8>: 0x00 for None, 0x01 + byte for Some."""
    if value is None:
        buf.append(0)
    else:
        buf.append(1)
        buf.append(value & 0xFF)


# ─── Agent ID mapping ──────────────────────────────────────────

def mint_to_agent_id(mint_address: str) -> int:
    """Deterministic mapping from base58 mint address to integer agent_id."""
    raw = base58.b58decode(mint_address)
    h = hashlib.sha256(raw).digest()
    return int.from_bytes(h[:4], "big") & 0x7FFFFFFF


# ─── RPC helpers ────────────────────────────────────────────────

def _rpc_call(rpc_url: str, method: str, params: list) -> dict:
    resp = httpx.post(
        rpc_url,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=TIMEOUT,
    )
    data = resp.json()
    if "error" in data:
        raise Exception(f"Solana RPC {method}: {data['error']}")
    return data.get("result")


# ─── On-chain account readers ──────────────────────────────────

class AgentAccountInfo:
    """Parsed agent account data needed for feedback submission."""

    def __init__(
        self,
        asset: Pubkey,
        collection: Pubkey,
        owner: Pubkey,
        atom_enabled: bool,
        feedback_count: int,
    ):
        self.asset = asset
        self.collection = collection
        self.owner = owner
        self.atom_enabled = atom_enabled
        self.feedback_count = feedback_count


def _parse_agent_account(data: bytes) -> Optional[AgentAccountInfo]:
    """Parse an AgentAccount to extract fields needed for feedback submission."""
    try:
        if data[:8] != AGENT_ACCOUNT_DISC:
            return None

        offset = 8
        collection_raw, offset = _read_pubkey(data, offset)
        _creator_raw, offset = _read_pubkey(data, offset)
        owner_raw, offset = _read_pubkey(data, offset)
        asset_raw, offset = _read_pubkey(data, offset)
        _bump, offset = _read_u8(data, offset)
        atom_enabled, offset = _read_u8(data, offset)
        _agent_wallet, offset = _read_option_pubkey(data, offset)
        # feedback_digest (32) + feedback_count (8)
        offset += 32
        feedback_count, offset = _read_u64(data, offset)

        return AgentAccountInfo(
            asset=Pubkey.from_bytes(asset_raw),
            collection=Pubkey.from_bytes(collection_raw),
            owner=Pubkey.from_bytes(owner_raw),
            atom_enabled=bool(atom_enabled),
            feedback_count=feedback_count,
        )
    except Exception as e:
        logger.warning(f"Failed to parse AgentAccount: {e}")
        return None


# ─── Main backend class ────────────────────────────────────────

class SolanaFeedbackBackend:
    """Solana backend for submitting feedback to the 8004 Agent Registry."""

    def __init__(self, rpc_url: str, private_key_hex: str):
        self.rpc_url = rpc_url
        self.chain_name = "solana"

        # Derive Ed25519 keypair from the hex private key (used as seed).
        # EVM keys are 32-byte secp256k1 private keys — we use the same
        # 32 bytes as an Ed25519 seed, giving a different Solana address.
        seed = bytes.fromhex(private_key_hex.removeprefix("0x"))
        if len(seed) != 32:
            raise ValueError(f"Private key must be 32 bytes, got {len(seed)}")
        self._keypair = Keypair.from_seed(seed)

        self._last_tx_time: float = 0.0
        self._low_balance_until: float = 0.0

        # Cache: agent_id (int) → asset pubkey (base58 str)
        self._agent_cache: dict[int, str] = {}
        self._cache_loaded = False

        logger.info(
            f"SolanaFeedbackBackend initialized — "
            f"wallet={self._keypair.pubkey()} "
            f"rpc={rpc_url[:50]}..."
        )

    @property
    def wallet_address(self) -> str:
        return str(self._keypair.pubkey())

    def _rpc(self, method: str, params: list) -> dict:
        return _rpc_call(self.rpc_url, method, params)

    def _get_balance(self) -> int:
        """Get wallet balance in lamports."""
        result = self._rpc("getBalance", [self.wallet_address, {"commitment": "finalized"}])
        return result.get("value", 0)

    def _get_latest_blockhash(self) -> str:
        result = self._rpc("getLatestBlockhash", [{"commitment": "finalized"}])
        return result["value"]["blockhash"]

    def _get_account_data(self, pubkey: Pubkey) -> Optional[bytes]:
        """Fetch raw account data for a pubkey."""
        try:
            result = self._rpc("getAccountInfo", [
                str(pubkey),
                {"encoding": "base64", "commitment": "finalized"},
            ])
            if result and result.get("value"):
                b64_data = result["value"]["data"][0]
                return base64.b64decode(b64_data)
        except Exception as e:
            logger.debug(f"getAccountInfo({pubkey}) failed: {e}")
        return None

    # ─── Agent lookup ───────────────────────────────────────────

    def _load_agent_cache(self) -> None:
        """Load all Solana agent accounts to build agent_id → mint_address cache."""
        if self._cache_loaded:
            return

        logger.info("Solana: loading agent cache via getProgramAccounts...")
        try:
            disc_b58 = base58.b58encode(AGENT_ACCOUNT_DISC).decode()
            accounts = self._rpc("getProgramAccounts", [
                str(AGENT_REGISTRY_PROGRAM),
                {
                    "encoding": "base64",
                    "commitment": "finalized",
                    "filters": [{"memcmp": {"offset": 0, "bytes": disc_b58}}],
                },
            ])

            for acc in (accounts or []):
                try:
                    b64 = acc["account"]["data"][0]
                    data = base64.b64decode(b64)
                    info = _parse_agent_account(data)
                    if info:
                        mint_str = str(info.asset)
                        aid = mint_to_agent_id(mint_str)
                        self._agent_cache[aid] = mint_str
                except Exception:
                    continue

            self._cache_loaded = True
            logger.info(f"Solana: cached {len(self._agent_cache)} agents")
        except Exception as e:
            logger.error(f"Solana: agent cache load failed: {e}")

    def _resolve_mint(self, agent_id: int) -> Optional[str]:
        """Resolve agent_id → mint address (base58)."""
        self._load_agent_cache()
        return self._agent_cache.get(agent_id)

    def agent_exists(self, agent_id: int) -> str | None:
        """Check if an agent exists on Solana. Returns mint address or None."""
        return self._resolve_mint(agent_id)

    # ─── PDA derivation ────────────────────────────────────────

    def _get_agent_pda(self, asset: Pubkey) -> Pubkey:
        """Agent PDA: seeds=["agent", asset]"""
        pda, _bump = Pubkey.find_program_address(
            [b"agent", bytes(asset)],
            AGENT_REGISTRY_PROGRAM,
        )
        return pda

    def _get_atom_config_pda(self) -> Pubkey:
        """ATOM config PDA: seeds=["atom_config"]"""
        pda, _bump = Pubkey.find_program_address(
            [b"atom_config"],
            ATOM_ENGINE_PROGRAM,
        )
        return pda

    def _get_atom_stats_pda(self, asset: Pubkey) -> Pubkey:
        """ATOM stats PDA: seeds=["atom_stats", asset]"""
        pda, _bump = Pubkey.find_program_address(
            [b"atom_stats", bytes(asset)],
            ATOM_ENGINE_PROGRAM,
        )
        return pda

    def _get_registry_authority_pda(self) -> Pubkey:
        """CPI authority PDA: seeds=["cpi_authority"]"""
        pda, _bump = Pubkey.find_program_address(
            [b"cpi_authority"],
            AGENT_REGISTRY_PROGRAM,
        )
        return pda

    # ─── Instruction data encoding ─────────────────────────────

    def _encode_give_feedback_data(
        self,
        score: int,
        tag1: str = "trust",
        tag2: str = "oracle-screening",
        endpoint: str = "",
        feedback_uri: str = "",
    ) -> bytes:
        """
        Encode giveFeedback instruction data (Borsh).

        Layout:
          discriminator (8)
          value (i128, 16 bytes LE)
          valueDecimals (u8)
          score (Option<u8>)
          feedbackFileHash (Option<[u8; 32]>)
          tag1 (string)
          tag2 (string)
          endpoint (string)
          feedbackUri (string)
        """
        buf = bytearray()

        # Instruction discriminator
        buf.extend(GIVE_FEEDBACK_DISC)

        # value: i128 (16 bytes LE, signed)
        buf.extend(score.to_bytes(16, "little", signed=True))

        # valueDecimals: u8 (0 = whole numbers)
        buf.append(0)

        # score: Option<u8> — Some(score) so the ATOM engine can process it
        _write_borsh_option_u8(buf, score)

        # feedbackFileHash: Option<[u8; 32]> — None for oracle MVP
        _write_borsh_option_bytes32(buf, None)

        # tag1: Borsh string
        _write_borsh_string(buf, tag1[:32])

        # tag2: Borsh string
        _write_borsh_string(buf, tag2[:32])

        # endpoint: Borsh string
        _write_borsh_string(buf, endpoint[:250])

        # feedbackUri: Borsh string
        _write_borsh_string(buf, feedback_uri[:250])

        return bytes(buf)

    # ─── Submit feedback ───────────────────────────────────────

    def submit_feedback(
        self,
        agent_id: int,
        score: int,
        comment: str,
        tag1: str = "trust",
        tag2: str = "oracle-screening",
    ) -> str | None:
        """
        Submit feedback to the 8004 Agent Registry for a Solana agent.

        Returns transaction signature on success, None on failure.
        """
        # Circuit breaker
        now_mono = time.monotonic()
        if now_mono < self._low_balance_until:
            return None

        # Resolve agent_id → mint address
        mint_str = self._resolve_mint(agent_id)
        if mint_str is None:
            logger.info(f"Agent {agent_id} not found on Solana — skipping")
            return None

        asset = Pubkey.from_string(mint_str)
        client = self._keypair.pubkey()

        # Don't rate our own agents
        agent_pda = self._get_agent_pda(asset)
        agent_data = self._get_account_data(agent_pda)
        if agent_data is None:
            logger.warning(f"[solana] Agent PDA not found for mint {mint_str[:16]}...")
            return None

        agent_info = _parse_agent_account(agent_data)
        if agent_info is None:
            logger.warning(f"[solana] Could not parse agent account for {mint_str[:16]}...")
            return None

        if agent_info.owner == client:
            logger.info(f"[solana] Agent {agent_id} owned by oracle wallet — skipping self-feedback")
            return None

        # Balance check
        try:
            balance = self._get_balance()
            if balance < MIN_BALANCE_LAMPORTS:
                logger.warning(
                    f"[solana] Balance too low ({balance} lamports < {MIN_BALANCE_LAMPORTS}) — "
                    f"pausing for 5 minutes"
                )
                self._low_balance_until = now_mono + 300
                return None
        except Exception as e:
            logger.warning(f"[solana] Balance check failed: {e}")
            self._low_balance_until = now_mono + 300
            return None

        # Rate limit
        elapsed = now_mono - self._last_tx_time
        if elapsed < TX_RATE_LIMIT_SECONDS:
            wait = TX_RATE_LIMIT_SECONDS - elapsed
            logger.info(f"[solana] Rate limit — waiting {wait:.1f}s")
            time.sleep(wait)

        score = max(1, min(100, score))
        content = comment[:250] if comment else "oracle-screening"

        try:
            # Build instruction data
            ix_data = self._encode_give_feedback_data(
                score=score,
                tag1=tag1,
                tag2=tag2,
                endpoint=content,
            )

            # Build account list
            # Order from 8004-solana-ts instruction-builder:
            #   [client, agentAccount, asset, collection, systemProgram,
            #    atomConfig?, atomStats?, atomEngineProgram?, registryAuthority?]
            accounts = [
                AccountMeta(client, is_signer=True, is_writable=True),
                AccountMeta(agent_pda, is_signer=False, is_writable=True),
                AccountMeta(asset, is_signer=False, is_writable=False),
                AccountMeta(agent_info.collection, is_signer=False, is_writable=False),
                AccountMeta(SYSTEM_PROGRAM, is_signer=False, is_writable=False),
            ]

            # Include ATOM Engine accounts if atom is enabled on this agent
            if agent_info.atom_enabled:
                atom_config = self._get_atom_config_pda()
                atom_stats = self._get_atom_stats_pda(asset)
                registry_authority = self._get_registry_authority_pda()

                accounts.extend([
                    AccountMeta(atom_config, is_signer=False, is_writable=False),
                    AccountMeta(atom_stats, is_signer=False, is_writable=True),
                    AccountMeta(ATOM_ENGINE_PROGRAM, is_signer=False, is_writable=False),
                    AccountMeta(registry_authority, is_signer=False, is_writable=False),
                ])

            ix = Instruction(AGENT_REGISTRY_PROGRAM, ix_data, accounts)

            # Get recent blockhash and build transaction
            blockhash = self._get_latest_blockhash()
            msg = Message.new_with_blockhash(
                [ix],
                client,
                Hash.from_string(blockhash),
            )
            tx = Transaction.new_unsigned(msg)
            tx.sign([self._keypair], Hash.from_string(blockhash))

            # Send
            tx_bytes = bytes(tx)
            tx_b64 = base64.b64encode(tx_bytes).decode("ascii")

            result = self._rpc("sendTransaction", [
                tx_b64,
                {
                    "encoding": "base64",
                    "skipPreflight": False,
                    "preflightCommitment": "confirmed",
                },
            ])

            self._last_tx_time = time.monotonic()

            if result:
                logger.info(
                    f"[solana] Feedback submitted — agent_id={agent_id} "
                    f"mint={mint_str[:16]}... score={score} tx={result}"
                )
                return result

            return None

        except Exception as e:
            self._last_tx_time = time.monotonic()
            logger.error(
                f"[solana] Failed to submit feedback for agent {agent_id} "
                f"(mint={mint_str[:16]}...): {e}"
            )
            err_str = str(e).lower()
            if "insufficient" in err_str or "lamport" in err_str:
                self._low_balance_until = time.monotonic() + 300
                logger.warning("[solana] Insufficient funds — pausing for 5 minutes")
            return None
