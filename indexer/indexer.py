#!/usr/bin/env python3
"""
AgentProof Event Indexer — Standalone Service

Indexes events from official ERC-8004 registries (Identity + Reputation) across all
configured chains and from AgentProof's custom ValidationRegistry on Avalanche.
Syncs data to Supabase.

Set chain RPC URLs in .env (e.g. BASE_RPC_URL, POLYGON_RPC_URL) to enable indexing
on those chains. All chains use the same CREATE2-deployed ERC-8004 contracts.
Set USE_OFFICIAL_ERC8004=True in .env to use the official Ava Labs registries.
"""

import base64
import json
import logging
import time
import sys
from datetime import datetime, timezone

import httpx
from web3 import Web3
from supabase import create_client

from config import (
    AVALANCHE_RPC_URL,
    ERC8004_IDENTITY_REGISTRY,
    ERC8004_REPUTATION_REGISTRY,
    IDENTITY_REGISTRY_ADDRESS,
    REPUTATION_REGISTRY_ADDRESS,
    VALIDATION_REGISTRY_ADDRESS,
    AGENT_MONITOR_ADDRESS,
    AGENT_SPLITS_ADDRESS,
    USE_OFFICIAL_ERC8004,
    SUPABASE_URL,
    SUPABASE_KEY,
    POLL_INTERVAL,
    CONFIRMATION_BLOCKS,
    MAX_BLOCK_RANGE,
    DEFAULT_START_BLOCK,
    ACTIVE_CHAINS,
    CHAIN_START_BLOCKS,
)
from scoring import (
    calculate_composite_score,
    calculate_std_dev,
    calculate_account_age_days,
    determine_tier,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("indexer")

# ─── Official ERC-8004 ABI fragments ────────────────────────────────────────
ERC8004_IDENTITY_ABI = json.loads("""[
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":false,"name":"agentURI","type":"string"},{"indexed":true,"name":"owner","type":"address"}],"name":"Registered","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":false,"name":"newURI","type":"string"},{"indexed":true,"name":"updatedBy","type":"address"}],"name":"URIUpdated","type":"event"}
]""")

# ERC-721 fallback ABI — some chains (SKALE) use NFT-based registries where
# agent registration emits Transfer(address(0), owner, tokenId) instead of Registered.
ERC721_IDENTITY_ABI = json.loads("""[
    {"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":true,"name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"}
]""")

# Chains whose ERC-8004 registry uses ERC-721 Transfer events instead of Registered
ERC721_REGISTRY_CHAINS = {"skale"}

ERC8004_REPUTATION_ABI = json.loads("""[
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":true,"name":"clientAddress","type":"address"},{"indexed":false,"name":"feedbackIndex","type":"uint64"},{"indexed":false,"name":"value","type":"int128"},{"indexed":false,"name":"valueDecimals","type":"uint8"},{"indexed":true,"name":"indexedTag1","type":"string"},{"indexed":false,"name":"tag1","type":"string"},{"indexed":false,"name":"tag2","type":"string"},{"indexed":false,"name":"endpoint","type":"string"},{"indexed":false,"name":"feedbackURI","type":"string"},{"indexed":false,"name":"feedbackHash","type":"bytes32"}],"name":"NewFeedback","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":true,"name":"clientAddress","type":"address"},{"indexed":true,"name":"feedbackIndex","type":"uint64"}],"name":"FeedbackRevoked","type":"event"}
]""")

# ─── Custom (legacy) ABI fragments ──────────────────────────────────────────
CUSTOM_IDENTITY_ABI = json.loads("""[
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":true,"name":"owner","type":"address"},{"indexed":false,"name":"agentURI","type":"string"}],"name":"AgentRegistered","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":false,"name":"newURI","type":"string"}],"name":"AgentURIUpdated","type":"event"}
]""")

CUSTOM_REPUTATION_ABI = json.loads("""[
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":true,"name":"reviewer","type":"address"},{"indexed":false,"name":"rating","type":"uint8"},{"indexed":false,"name":"taskHash","type":"bytes32"}],"name":"FeedbackSubmitted","type":"event"}
]""")

VALIDATION_ABI = json.loads("""[
    {"anonymous":false,"inputs":[{"indexed":true,"name":"validationId","type":"uint256"},{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":false,"name":"taskHash","type":"bytes32"}],"name":"ValidationRequested","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"validationId","type":"uint256"},{"indexed":true,"name":"validator","type":"address"},{"indexed":false,"name":"isValid","type":"bool"}],"name":"ValidationSubmitted","type":"event"}
]""")

# ─── Phase 4 ABI fragments ────────────────────────────────────────────
AGENT_MONITOR_ABI = json.loads("""[
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":false,"name":"endpointIndex","type":"uint256"},{"indexed":false,"name":"url","type":"string"},{"indexed":false,"name":"endpointType","type":"string"}],"name":"EndpointRegistered","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":false,"name":"endpointIndex","type":"uint256"}],"name":"EndpointRemoved","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":false,"name":"endpointIndex","type":"uint256"},{"indexed":false,"name":"isUp","type":"bool"},{"indexed":false,"name":"latencyMs","type":"uint256"}],"name":"UptimeCheckLogged","type":"event"}
]""")

AGENT_SPLITS_ABI = json.loads("""[
    {"anonymous":false,"inputs":[{"indexed":true,"name":"splitId","type":"uint256"},{"indexed":true,"name":"creatorAgentId","type":"uint256"},{"indexed":false,"name":"agentIds","type":"uint256[]"},{"indexed":false,"name":"sharesBps","type":"uint256[]"}],"name":"SplitCreated","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"splitId","type":"uint256"}],"name":"SplitDeactivated","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"splitPaymentId","type":"uint256"},{"indexed":true,"name":"splitId","type":"uint256"},{"indexed":false,"name":"amount","type":"uint256"},{"indexed":false,"name":"token","type":"address"},{"indexed":false,"name":"payer","type":"address"}],"name":"SplitPaymentReceived","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"splitPaymentId","type":"uint256"},{"indexed":true,"name":"splitId","type":"uint256"},{"indexed":false,"name":"amounts","type":"uint256[]"}],"name":"SplitDistributed","type":"event"}
]""")


def _sanitize_text(value: str | None) -> str | None:
    """Strip null bytes (\\x00) that PostgreSQL text columns reject."""
    if value is None:
        return None
    return value.replace("\x00", "")


def parse_agent_uri(uri: str) -> dict:
    """Parse an agent metadata URI (base64 data URI, IPFS, or HTTPS) into a dict."""
    metadata = {}
    try:
        if uri.startswith("data:application/json;base64,"):
            raw = base64.b64decode(uri.split(",", 1)[1])
            metadata = json.loads(raw)
        elif uri.startswith("http://") or uri.startswith("https://"):
            resp = httpx.get(uri, timeout=10, follow_redirects=True)
            if resp.status_code == 200:
                metadata = resp.json()
        elif uri.startswith("ipfs://"):
            gateway_url = f"https://ipfs.io/ipfs/{uri[7:]}"
            resp = httpx.get(gateway_url, timeout=10, follow_redirects=True)
            if resp.status_code == 200:
                metadata = resp.json()
    except Exception as e:
        logger.warning(f"Failed to parse agent URI: {e}")
    return metadata


class ChainConnection:
    """Holds Web3 connection and contracts for a single chain."""

    def __init__(self, chain_name: str, rpc_url: str, use_official: bool):
        self.chain_name = chain_name
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.use_official = use_official

        # Same CREATE2 addresses on all chains
        identity_addr = ERC8004_IDENTITY_REGISTRY if use_official else IDENTITY_REGISTRY_ADDRESS
        reputation_addr = ERC8004_REPUTATION_REGISTRY if use_official else REPUTATION_REGISTRY_ADDRESS

        # Identity contract
        self.identity_contract = None
        self.identity_mode = None
        self.erc721_identity_contract = None
        if chain_name in ERC721_REGISTRY_CHAINS and ERC8004_IDENTITY_REGISTRY:
            # ERC-721 based registry — listen for Transfer events, read tokenURI/ownerOf
            self.erc721_identity_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(ERC8004_IDENTITY_REGISTRY),
                abi=ERC721_IDENTITY_ABI,
            )
            # Also set up standard contract for URIUpdated if supported
            self.identity_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(ERC8004_IDENTITY_REGISTRY),
                abi=ERC8004_IDENTITY_ABI,
            )
            self.identity_mode = "erc721"
        elif use_official and ERC8004_IDENTITY_REGISTRY:
            self.identity_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(ERC8004_IDENTITY_REGISTRY),
                abi=ERC8004_IDENTITY_ABI,
            )
            self.identity_mode = "erc8004"
        elif IDENTITY_REGISTRY_ADDRESS:
            self.identity_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(IDENTITY_REGISTRY_ADDRESS),
                abi=CUSTOM_IDENTITY_ABI,
            )
            self.identity_mode = "custom"

        # Reputation contract
        self.reputation_contract = None
        self.reputation_mode = None
        if use_official and ERC8004_REPUTATION_REGISTRY:
            self.reputation_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(ERC8004_REPUTATION_REGISTRY),
                abi=ERC8004_REPUTATION_ABI,
            )
            self.reputation_mode = "erc8004"
        elif REPUTATION_REGISTRY_ADDRESS:
            self.reputation_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(REPUTATION_REGISTRY_ADDRESS),
                abi=CUSTOM_REPUTATION_ABI,
            )
            self.reputation_mode = "custom"

        # Validation, Monitor, Splits — only on Avalanche (custom contracts)
        self.validation_contract = None
        self.monitor_contract = None
        self.splits_contract = None
        if chain_name == "avalanche":
            if VALIDATION_REGISTRY_ADDRESS:
                self.validation_contract = self.w3.eth.contract(
                    address=Web3.to_checksum_address(VALIDATION_REGISTRY_ADDRESS),
                    abi=VALIDATION_ABI,
                )
            if AGENT_MONITOR_ADDRESS:
                self.monitor_contract = self.w3.eth.contract(
                    address=Web3.to_checksum_address(AGENT_MONITOR_ADDRESS),
                    abi=AGENT_MONITOR_ABI,
                )
            if AGENT_SPLITS_ADDRESS:
                self.splits_contract = self.w3.eth.contract(
                    address=Web3.to_checksum_address(AGENT_SPLITS_ADDRESS),
                    abi=AGENT_SPLITS_ABI,
                )


class AgentProofIndexer:
    def __init__(self):
        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.error("Supabase URL and key must be configured")
            sys.exit(1)
        self.db = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Connected to Supabase")

        self.use_official = USE_OFFICIAL_ERC8004
        logger.info(f"Registry mode: {'Official ERC-8004' if self.use_official else 'Custom AgentProof'}")

        # ─── Connect to all configured chains ───
        self.chains: dict[str, ChainConnection] = {}
        for chain_name, rpc_url in ACTIVE_CHAINS.items():
            try:
                conn = ChainConnection(chain_name, rpc_url, self.use_official)
                if conn.w3.is_connected():
                    self.chains[chain_name] = conn
                    logger.info(f"[{chain_name}] Connected (chain ID: {conn.w3.eth.chain_id})")
                else:
                    logger.warning(f"[{chain_name}] Failed to connect to {rpc_url}")
            except Exception as e:
                logger.warning(f"[{chain_name}] Connection error: {e}")

        if not self.chains:
            logger.error("No chains connected. Check RPC URLs.")
            sys.exit(1)

        logger.info(f"Indexing {len(self.chains)} chains: {', '.join(self.chains.keys())}")

        # Keep backward-compatible references for scoring/leaderboard methods
        # (these don't need chain-specific Web3)
        primary = next(iter(self.chains.values()))
        self.w3 = primary.w3

        # Store current chain context for event processing methods
        self._current_chain: str = "avalanche"
        self._current_conn: ChainConnection | None = None

        # Track which agents need rescoring each cycle (event-driven)
        self._affected_agents: set[int] = set()

    # ─── State persistence ───────────────────────────────────────────────────

    def _get_chain_start_block(self, chain_name: str) -> int:
        """Get the appropriate start block for a chain.
        Uses per-chain config if set (non-zero), otherwise starts from
        recent history (current block - 10000) to avoid scanning from genesis."""
        configured = CHAIN_START_BLOCKS.get(chain_name, 0)
        if configured > 0:
            return configured
        # No configured start block — start from recent history
        try:
            conn = self.chains.get(chain_name)
            if conn:
                current = conn.w3.eth.block_number
                return max(0, current - 10000)
        except Exception:
            pass
        return 0

    def get_last_block(self, contract_name: str) -> int:
        # Extract chain name from contract_name (format: "chain:contract")
        chain_name = contract_name.split(":")[0] if ":" in contract_name else "avalanche"
        start_block = self._get_chain_start_block(chain_name)

        try:
            result = (
                self.db.table("indexer_state")
                .select("last_block")
                .eq("contract_name", contract_name)
                .execute()
            )
            if result.data:
                stored = result.data[0]["last_block"]
                if stored < start_block:
                    logger.info(f"Fast-forwarding {contract_name} from block {stored} to {start_block}")
                    self.set_last_block(contract_name, start_block)
                    return start_block
                return stored
            self.db.table("indexer_state").insert(
                {"contract_name": contract_name, "last_block": start_block}
            ).execute()
            logger.info(f"Initialized {contract_name} indexer state at block {start_block}")
            return start_block
        except Exception as e:
            logger.error(f"Error getting last block for {contract_name}: {e}")
            return start_block

    def set_last_block(self, contract_name: str, block: int):
        try:
            self.db.table("indexer_state").upsert(
                {
                    "contract_name": contract_name,
                    "last_block": block,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="contract_name",
            ).execute()
        except Exception as e:
            logger.error(f"Error setting last block for {contract_name}: {e}")

    def get_block_timestamp(self, block_number: int) -> datetime:
        w3 = self._current_conn.w3 if self._current_conn else self.w3
        block = w3.eth.get_block(block_number)
        return datetime.fromtimestamp(block.timestamp, tz=timezone.utc)

    # ─── Identity events ─────────────────────────────────────────────────────

    def process_identity_events(self, from_block: int, to_block: int) -> int:
        conn = self._current_conn
        if not conn:
            return 0

        if conn.identity_mode == "erc721":
            return self._process_erc721_identity(from_block, to_block)
        elif conn.identity_mode == "erc8004":
            if not conn.identity_contract:
                return 0
            return self._process_erc8004_identity(from_block, to_block)
        else:
            if not conn.identity_contract:
                return 0
            return self._process_custom_identity(from_block, to_block)

    def _process_erc8004_identity(self, from_block: int, to_block: int) -> int:
        conn = self._current_conn
        count = 0

        # Registered events
        try:
            events = conn.identity_contract.events.Registered().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                owner = event.args.owner
                uri = event.args.agentURI
                ts = self.get_block_timestamp(event.blockNumber)

                # Parse the agent URI to extract metadata
                metadata = parse_agent_uri(uri)

                self.db.table("agents").upsert(
                    {
                        "agent_id": agent_id,
                        "owner_address": owner,
                        "agent_uri": _sanitize_text(uri),
                        "name": _sanitize_text(metadata.get("name")),
                        "description": _sanitize_text(metadata.get("description")),
                        "category": metadata.get("category", "general"),
                        "image_url": _sanitize_text(metadata.get("image")),
                        "registered_at": ts.isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "registry_source": "erc8004",
                        "source_chain": self._current_chain,
                    },
                    on_conflict="agent_id,source_chain",
                ).execute()
                self._affected_agents.add(agent_id)
                logger.info(f"[ERC8004-ID] Agent #{agent_id} registered by {owner}")
                count += 1
        except Exception as e:
            logger.error(f"Error processing ERC-8004 Registered events: {e}")

        # URIUpdated events
        try:
            events = conn.identity_contract.events.URIUpdated().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                new_uri = event.args.newURI
                metadata = parse_agent_uri(new_uri)

                update = {
                    "agent_uri": _sanitize_text(new_uri),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                if metadata.get("name"):
                    update["name"] = _sanitize_text(metadata["name"])
                if metadata.get("description"):
                    update["description"] = _sanitize_text(metadata["description"])
                if metadata.get("image"):
                    update["image_url"] = _sanitize_text(metadata["image"])

                self.db.table("agents").update(update).eq("agent_id", agent_id).eq("source_chain", self._current_chain).execute()
                self._affected_agents.add(agent_id)
                logger.info(f"[ERC8004-ID] [{self._current_chain}] Agent #{agent_id} URI updated")
                count += 1
        except Exception as e:
            logger.error(f"Error processing ERC-8004 URIUpdated events: {e}")

        return count

    def _process_erc721_identity(self, from_block: int, to_block: int) -> int:
        """Process ERC-721 based identity registries (e.g. SKALE).

        Listens for Transfer(address(0), owner, tokenId) mint events, then reads
        tokenURI() and ownerOf() to extract agent metadata.
        """
        conn = self._current_conn
        if not conn or not conn.erc721_identity_contract:
            return 0
        count = 0
        nft = conn.erc721_identity_contract
        zero = "0x0000000000000000000000000000000000000000"

        try:
            # Filter for mints only (from = address(0))
            events = nft.events.Transfer().get_logs(
                from_block=from_block,
                to_block=to_block,
                argument_filters={"from": zero},
            )
            for event in events:
                token_id = event.args.tokenId
                owner = event.args.to
                ts = self.get_block_timestamp(event.blockNumber)

                # Read URI from the contract
                uri = ""
                try:
                    uri = nft.functions.tokenURI(token_id).call()
                except Exception:
                    pass

                metadata = parse_agent_uri(uri) if uri else {}

                self.db.table("agents").upsert(
                    {
                        "agent_id": token_id,
                        "owner_address": owner,
                        "agent_uri": _sanitize_text(uri),
                        "name": _sanitize_text(metadata.get("name")),
                        "description": _sanitize_text(metadata.get("description")),
                        "category": metadata.get("category", "general"),
                        "image_url": _sanitize_text(metadata.get("image")),
                        "registered_at": ts.isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "registry_source": "erc8004",
                        "source_chain": self._current_chain,
                    },
                    on_conflict="agent_id,source_chain",
                ).execute()
                self._affected_agents.add(token_id)
                logger.info(f"[ERC721-ID] [{self._current_chain}] Agent #{token_id} registered by {owner}")
                count += 1
        except Exception as e:
            logger.error(f"Error processing ERC-721 Transfer (mint) events: {e}")

        return count

    def _process_custom_identity(self, from_block: int, to_block: int) -> int:
        conn = self._current_conn
        count = 0

        try:
            events = conn.identity_contract.events.AgentRegistered().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                owner = event.args.owner
                uri = event.args.agentURI
                ts = self.get_block_timestamp(event.blockNumber)

                self.db.table("agents").upsert(
                    {
                        "agent_id": agent_id,
                        "owner_address": owner,
                        "agent_uri": _sanitize_text(uri),
                        "registered_at": ts.isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "registry_source": "custom",
                        "source_chain": self._current_chain,
                    },
                    on_conflict="agent_id,source_chain",
                ).execute()
                self._affected_agents.add(agent_id)
                logger.info(f"[CUSTOM-ID] Agent #{agent_id} registered by {owner}")
                count += 1
        except Exception as e:
            logger.error(f"Error processing custom AgentRegistered events: {e}")

        try:
            events = conn.identity_contract.events.AgentURIUpdated().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                new_uri = event.args.newURI
                self.db.table("agents").update(
                    {"agent_uri": _sanitize_text(new_uri), "updated_at": datetime.now(timezone.utc).isoformat()}
                ).eq("agent_id", agent_id).eq("source_chain", self._current_chain).execute()
                logger.info(f"[CUSTOM-ID] [{self._current_chain}] Agent #{agent_id} URI updated")
                count += 1
        except Exception as e:
            logger.error(f"Error processing custom AgentURIUpdated events: {e}")

        return count

    # ─── Reputation events ───────────────────────────────────────────────────

    def process_reputation_events(self, from_block: int, to_block: int) -> int:
        conn = self._current_conn
        if not conn or not conn.reputation_contract:
            return 0

        if conn.reputation_mode == "erc8004":
            return self._process_erc8004_reputation(from_block, to_block)
        else:
            return self._process_custom_reputation(from_block, to_block)

    def _process_erc8004_reputation(self, from_block: int, to_block: int) -> int:
        """Process NewFeedback events from the official ERC-8004 Reputation Registry.

        The official contract uses int128 value with uint8 valueDecimals.
        We normalise this to a 1-100 scale for our scoring engine.
        """
        count = 0
        try:
            events = self._current_conn.reputation_contract.events.NewFeedback().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                client = event.args.clientAddress
                feedback_index = event.args.feedbackIndex
                raw_value = event.args.value  # int128
                decimals = event.args.valueDecimals  # uint8
                tag1 = event.args.tag1
                tag2 = event.args.tag2
                feedback_hash = event.args.feedbackHash.hex()
                tx_hash = event.transactionHash.hex()
                block = event.blockNumber
                ts = self.get_block_timestamp(block)

                # Normalise the value to a 0-100 scale
                # ERC-8004 uses signed int128 with decimals. Typical range: 0-100.
                if decimals > 0:
                    normalised = float(raw_value) / (10 ** decimals)
                else:
                    normalised = float(raw_value)
                # Clamp to 1-100 for our scoring engine
                rating = max(1, min(100, int(round(normalised))))

                self.db.table("reputation_events").upsert(
                    {
                        "agent_id": agent_id,
                        "reviewer_address": client,
                        "rating": rating,
                        "feedback_uri": getattr(event.args, "feedbackURI", ""),
                        "task_hash": feedback_hash,
                        "tx_hash": tx_hash,
                        "block_number": block,
                        "created_at": ts.isoformat(),
                        "tag1": tag1,
                        "tag2": tag2,
                        "registry_source": "erc8004",
                    },
                    on_conflict="tx_hash",
                ).execute()
                self._affected_agents.add(agent_id)
                logger.info(
                    f"[ERC8004-REP] Agent #{agent_id} rated {rating} "
                    f"(raw={raw_value}, dec={decimals}) by {client[:10]}..."
                )
                count += 1
        except Exception as e:
            logger.error(f"Error processing ERC-8004 NewFeedback events: {e}")

        return count

    def _process_custom_reputation(self, from_block: int, to_block: int) -> int:
        count = 0
        try:
            events = self._current_conn.reputation_contract.events.FeedbackSubmitted().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                reviewer = event.args.reviewer
                rating = event.args.rating
                task_hash = event.args.taskHash.hex()
                tx_hash = event.transactionHash.hex()
                block = event.blockNumber
                ts = self.get_block_timestamp(block)

                self.db.table("reputation_events").upsert(
                    {
                        "agent_id": agent_id,
                        "reviewer_address": reviewer,
                        "rating": rating,
                        "task_hash": task_hash,
                        "tx_hash": tx_hash,
                        "block_number": block,
                        "created_at": ts.isoformat(),
                        "registry_source": "custom",
                    },
                    on_conflict="tx_hash",
                ).execute()
                self._affected_agents.add(agent_id)
                logger.info(f"[CUSTOM-REP] Agent #{agent_id} rated {rating} by {reviewer[:10]}...")
                count += 1
        except Exception as e:
            logger.error(f"Error processing custom FeedbackSubmitted events: {e}")

        return count

    # ─── Validation events (always custom) ───────────────────────────────────

    def process_validation_events(self, from_block: int, to_block: int) -> int:
        conn = self._current_conn
        if not conn or not conn.validation_contract:
            return 0

        count = 0

        try:
            events = conn.validation_contract.events.ValidationRequested().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                vid = event.args.validationId
                agent_id = event.args.agentId
                task_hash = event.args.taskHash.hex()
                tx_hash = event.transactionHash.hex()
                block = event.blockNumber
                ts = self.get_block_timestamp(block)

                self.db.table("validation_records").upsert(
                    {
                        "validation_id": vid,
                        "agent_id": agent_id,
                        "task_hash": task_hash,
                        "requester_address": "",
                        "requested_at": ts.isoformat(),
                        "tx_hash": tx_hash,
                        "block_number": block,
                    },
                    on_conflict="validation_id",
                ).execute()
                logger.info(f"[VALIDATION] Request #{vid} for agent #{agent_id}")
                count += 1
        except Exception as e:
            logger.error(f"Error processing ValidationRequested events: {e}")

        try:
            events = conn.validation_contract.events.ValidationSubmitted().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                vid = event.args.validationId
                validator = event.args.validator
                is_valid = event.args.isValid
                ts = self.get_block_timestamp(event.blockNumber)

                self.db.table("validation_records").update(
                    {
                        "validator_address": validator,
                        "is_valid": is_valid,
                        "validated_at": ts.isoformat(),
                    }
                ).eq("validation_id", vid).execute()
                logger.info(f"[VALIDATION] Response #{vid}: valid={is_valid}")
                count += 1
        except Exception as e:
            logger.error(f"Error processing ValidationSubmitted events: {e}")

        return count

    # ─── Phase 4: AgentMonitor events ────────────────────────────────────────

    def process_monitor_events(self, from_block: int, to_block: int) -> int:
        conn = self._current_conn
        if not conn or not conn.monitor_contract:
            return 0

        count = 0

        # EndpointRegistered
        try:
            events = conn.monitor_contract.events.EndpointRegistered().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                ts = self.get_block_timestamp(event.blockNumber)

                self.db.table("agent_monitoring_endpoints").upsert(
                    {
                        "agent_id": agent_id,
                        "endpoint_index": event.args.endpointIndex,
                        "url": event.args.url,
                        "endpoint_type": event.args.endpointType,
                        "is_active": True,
                        "registered_at": ts.isoformat(),
                        "tx_hash": event.transactionHash.hex(),
                        "block_number": event.blockNumber,
                    },
                    on_conflict="agent_id,endpoint_index",
                ).execute()
                self._log_audit(agent_id, "endpoint_registered", event)
                logger.info(f"[MONITOR] Endpoint registered for agent #{agent_id}")
                count += 1
        except Exception as e:
            logger.error(f"Error processing EndpointRegistered events: {e}")

        # EndpointRemoved
        try:
            events = conn.monitor_contract.events.EndpointRemoved().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                self.db.table("agent_monitoring_endpoints").update(
                    {"is_active": False}
                ).eq("agent_id", agent_id).eq("endpoint_index", event.args.endpointIndex).execute()
                logger.info(f"[MONITOR] Endpoint removed for agent #{agent_id}")
                count += 1
        except Exception as e:
            logger.error(f"Error processing EndpointRemoved events: {e}")

        # UptimeCheckLogged
        try:
            events = conn.monitor_contract.events.UptimeCheckLogged().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                ts = self.get_block_timestamp(event.blockNumber)

                self.db.table("uptime_checks").insert({
                    "agent_id": agent_id,
                    "endpoint_index": event.args.endpointIndex,
                    "is_up": event.args.isUp,
                    "latency_ms": event.args.latencyMs,
                    "checked_at": ts.isoformat(),
                    "source": "onchain",
                    "tx_hash": event.transactionHash.hex(),
                    "block_number": event.blockNumber,
                }).execute()
                count += 1
        except Exception as e:
            logger.error(f"Error processing UptimeCheckLogged events: {e}")

        return count

    # ─── Phase 4: AgentSplits events ──────────────────────────────────────

    def process_splits_events(self, from_block: int, to_block: int) -> int:
        conn = self._current_conn
        if not conn or not conn.splits_contract:
            return 0

        count = 0

        # SplitCreated
        try:
            events = conn.splits_contract.events.SplitCreated().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                ts = self.get_block_timestamp(event.blockNumber)
                agent_ids = list(event.args.agentIds)
                shares = list(event.args.sharesBps)

                self.db.table("revenue_splits").upsert(
                    {
                        "split_id": event.args.splitId,
                        "creator_agent_id": event.args.creatorAgentId,
                        "agent_ids": agent_ids,
                        "shares_bps": shares,
                        "is_active": True,
                        "created_at": ts.isoformat(),
                        "tx_hash": event.transactionHash.hex(),
                        "block_number": event.blockNumber,
                    },
                    on_conflict="split_id",
                ).execute()
                self._log_audit(event.args.creatorAgentId, "split_created", event)
                logger.info(f"[SPLITS] Split #{event.args.splitId} created")
                count += 1
        except Exception as e:
            logger.error(f"Error processing SplitCreated events: {e}")

        # SplitDeactivated
        try:
            events = conn.splits_contract.events.SplitDeactivated().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                self.db.table("revenue_splits").update(
                    {"is_active": False}
                ).eq("split_id", event.args.splitId).execute()
                logger.info(f"[SPLITS] Split #{event.args.splitId} deactivated")
                count += 1
        except Exception as e:
            logger.error(f"Error processing SplitDeactivated events: {e}")

        # SplitPaymentReceived
        try:
            events = conn.splits_contract.events.SplitPaymentReceived().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                ts = self.get_block_timestamp(event.blockNumber)

                self.db.table("split_payments").upsert(
                    {
                        "split_payment_id": event.args.splitPaymentId,
                        "split_id": event.args.splitId,
                        "amount": str(event.args.amount),
                        "token_address": event.args.token,
                        "payer_address": event.args.payer,
                        "distributed": False,
                        "created_at": ts.isoformat(),
                        "tx_hash": event.transactionHash.hex(),
                        "block_number": event.blockNumber,
                    },
                    on_conflict="split_payment_id",
                ).execute()
                logger.info(f"[SPLITS] Payment #{event.args.splitPaymentId} received for split #{event.args.splitId}")
                count += 1
        except Exception as e:
            logger.error(f"Error processing SplitPaymentReceived events: {e}")

        # SplitDistributed
        try:
            events = conn.splits_contract.events.SplitDistributed().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                ts = self.get_block_timestamp(event.blockNumber)
                amounts = [str(a) for a in event.args.amounts]

                self.db.table("split_payments").update(
                    {
                        "distributed": True,
                        "distributed_at": ts.isoformat(),
                        "distribution_amounts": amounts,
                    }
                ).eq("split_payment_id", event.args.splitPaymentId).execute()
                logger.info(f"[SPLITS] Payment #{event.args.splitPaymentId} distributed")
                count += 1
        except Exception as e:
            logger.error(f"Error processing SplitDistributed events: {e}")

        return count

    # ─── Audit logging helper ─────────────────────────────────────────────

    def _log_audit(self, agent_id, action, event):
        try:
            self.db.table("audit_logs").insert({
                "agent_id": agent_id,
                "action": action,
                "actor_address": event.address if hasattr(event, "address") else "",
                "details": {},
                "tx_hash": event.transactionHash.hex(),
                "block_number": event.blockNumber,
                "source": "indexer",
            }).execute()
        except Exception:
            pass

    # ─── Scoring / Leaderboard ───────────────────────────────────────────────

    def rescore_agent(self, agent_id: int):
        """Rescore a single agent. Called only when that agent has new data."""
        try:
            agent_rows = (
                self.db.table("agents")
                .select("*")
                .eq("agent_id", agent_id)
                .execute()
            )
            if not agent_rows.data:
                return
        except Exception as e:
            logger.error(f"Error fetching agent #{agent_id} for rescore: {e}")
            return

        # Use earliest registration across chains for age
        canonical = min(agent_rows.data, key=lambda a: a.get("registered_at", "9"))

        try:
            ratings_result = (
                self.db.table("reputation_events")
                .select("rating")
                .eq("agent_id", agent_id)
                .execute()
            )
            ratings = [r["rating"] for r in ratings_result.data]
        except Exception:
            ratings = []

        feedback_count = len(ratings)
        avg_rating = sum(ratings) / len(ratings) if ratings else 0
        std_dev = calculate_std_dev(ratings)

        try:
            validations = (
                self.db.table("validation_records")
                .select("is_valid")
                .eq("agent_id", agent_id)
                .not_.is_("is_valid", "null")
                .execute()
            )
            completed = len(validations.data)
            successful = sum(1 for v in validations.data if v["is_valid"])
            success_rate = (successful / completed * 100) if completed > 0 else 0
        except Exception:
            success_rate = 0

        registered_at = datetime.fromisoformat(
            canonical["registered_at"].replace("Z", "+00:00")
        )
        age_days = calculate_account_age_days(registered_at)
        chains_present = len(agent_rows.data)

        uptime_pct = -1.0
        try:
            uptime_result = (
                self.db.table("uptime_daily_summary")
                .select("total_checks,successful_checks")
                .eq("agent_id", agent_id)
                .order("summary_date", desc=True)
                .limit(30)
                .execute()
            )
            if uptime_result.data:
                total_checks = sum(s["total_checks"] for s in uptime_result.data)
                successful_checks = sum(s["successful_checks"] for s in uptime_result.data)
                if total_checks > 0:
                    uptime_pct = (successful_checks / total_checks) * 100
        except Exception:
            pass

        old_score = canonical.get("composite_score", 0)

        composite = calculate_composite_score(
            average_rating=avg_rating,
            feedback_count=feedback_count,
            rating_std_dev=std_dev,
            validation_success_rate=success_rate,
            account_age_days=age_days,
            uptime_pct=uptime_pct,
        )
        tier = determine_tier(composite, feedback_count)

        try:
            update_data = {
                "total_feedback": feedback_count,
                "average_rating": round(avg_rating, 2),
                "composite_score": composite,
                "validation_success_rate": round(success_rate, 2),
                "tier": tier,
                "chains_active": chains_present,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if uptime_pct >= 0:
                update_data["uptime_score"] = round(uptime_pct, 2)

            self.db.table("agents").update(update_data).eq("agent_id", agent_id).execute()
        except Exception as e:
            logger.error(f"Error updating scores for agent #{agent_id}: {e}")
            return

        # Write score_history only if score actually changed
        if round(composite, 2) != round(old_score, 2):
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            try:
                self.db.table("score_history").upsert(
                    {
                        "agent_id": agent_id,
                        "composite_score": composite,
                        "average_rating": round(avg_rating, 2),
                        "total_feedback": feedback_count,
                        "validation_success_rate": round(success_rate, 2),
                        "snapshot_date": today,
                    },
                    on_conflict="agent_id,snapshot_date",
                ).execute()
            except Exception:
                pass

        # Incremental leaderboard update — upsert this agent's rank
        try:
            cat = canonical.get("category", "general") or "general"
            self.db.table("leaderboard_cache").upsert(
                {
                    "agent_id": agent_id,
                    "category": cat,
                    "composite_score": composite,
                    "trend": "up" if composite > old_score else "down" if composite < old_score else "stable",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="agent_id",
            ).execute()
        except Exception:
            pass

    def rescore_agents(self, agent_ids: set[int]):
        """Rescore only the agents that received new events this cycle."""
        if not agent_ids:
            return
        logger.info(f"Rescoring {len(agent_ids)} affected agents")
        for agent_id in agent_ids:
            self.rescore_agent(agent_id)

    # ─── Main loop ───────────────────────────────────────────────────────────

    def _process_contract_chunked(
        self, contract_name: str, process_fn, from_block: int, to_block: int
    ) -> int:
        """Process events in chunks of MAX_BLOCK_RANGE to stay within RPC limits."""
        total = 0
        chunk_start = from_block

        while chunk_start <= to_block:
            chunk_end = min(chunk_start + MAX_BLOCK_RANGE - 1, to_block)
            try:
                count = process_fn(chunk_start, chunk_end)
                total += count
            except Exception as e:
                logger.error(f"Error processing {contract_name} blocks {chunk_start}-{chunk_end}: {e}")
            # Persist progress after each chunk so we don't re-scan on crash
            self.set_last_block(contract_name, chunk_end)
            chunk_start = chunk_end + 1

        return total

    def run_cycle(self):
        total_events = 0

        for chain_name, conn in self.chains.items():
            self._current_chain = chain_name
            self._current_conn = conn

            try:
                current_block = conn.w3.eth.block_number
            except Exception as e:
                logger.error(f"[{chain_name}] Error getting block number: {e}")
                continue

            safe_block = current_block - CONFIRMATION_BLOCKS
            if safe_block < 0:
                continue

            # Identity + Reputation on all chains; Validation/Monitor/Splits only on Avalanche
            contracts = [
                (f"{chain_name}:identity", self.process_identity_events),
                (f"{chain_name}:reputation", self.process_reputation_events),
            ]
            if chain_name == "avalanche":
                contracts.extend([
                    (f"{chain_name}:validation", self.process_validation_events),
                    (f"{chain_name}:agent_monitor", self.process_monitor_events),
                    (f"{chain_name}:agent_splits", self.process_splits_events),
                ])

            for contract_name, process_fn in contracts:
                last = self.get_last_block(contract_name)
                if last < safe_block:
                    start = last + 1
                    gap = safe_block - start + 1
                    if gap > MAX_BLOCK_RANGE:
                        logger.info(f"[{contract_name}] Catching up {gap} blocks in chunks of {MAX_BLOCK_RANGE}")
                    count = self._process_contract_chunked(contract_name, process_fn, start, safe_block)
                    total_events += count

        if total_events > 0:
            logger.info(f"Processed {total_events} events across {len(self.chains)} chains")
            self.rescore_agents(self._affected_agents)
        self._affected_agents = set()

    def run(self):
        mode = "Official ERC-8004" if self.use_official else "Custom"
        chains_str = ", ".join(self.chains.keys())
        logger.info(f"Starting indexer [{mode}] on {len(self.chains)} chains: {chains_str}")
        logger.info(f"Poll: {POLL_INTERVAL}s, confirmations: {CONFIRMATION_BLOCKS}")

        while True:
            try:
                self.run_cycle()
            except KeyboardInterrupt:
                logger.info("Shutting down indexer...")
                break
            except Exception as e:
                logger.error(f"Indexer cycle error: {e}", exc_info=True)

            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    identity_addr = ERC8004_IDENTITY_REGISTRY if USE_OFFICIAL_ERC8004 else IDENTITY_REGISTRY_ADDRESS
    if not identity_addr:
        logger.error("No identity registry configured. Set ERC8004_IDENTITY_REGISTRY or IDENTITY_REGISTRY_ADDRESS in .env")
        sys.exit(1)

    indexer = AgentProofIndexer()
    indexer.run()
