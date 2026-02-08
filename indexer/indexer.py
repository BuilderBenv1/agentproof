#!/usr/bin/env python3
"""
AgentProof Event Indexer — Standalone Service

Indexes events from official ERC-8004 registries (Identity + Reputation) on Avalanche
and from AgentProof's custom ValidationRegistry. Syncs data to Supabase.

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


class AgentProofIndexer:
    def __init__(self):
        logger.info(f"Connecting to {AVALANCHE_RPC_URL}")
        self.w3 = Web3(Web3.HTTPProvider(AVALANCHE_RPC_URL))

        if not self.w3.is_connected():
            logger.error("Failed to connect to Avalanche RPC")
            sys.exit(1)
        logger.info(f"Connected to chain ID: {self.w3.eth.chain_id}")

        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.error("Supabase URL and key must be configured")
            sys.exit(1)
        self.db = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Connected to Supabase")

        self.use_official = USE_OFFICIAL_ERC8004
        logger.info(f"Registry mode: {'Official ERC-8004' if self.use_official else 'Custom AgentProof'}")

        # ─── Identity contract ───
        if self.use_official and ERC8004_IDENTITY_REGISTRY:
            self.identity_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(ERC8004_IDENTITY_REGISTRY),
                abi=ERC8004_IDENTITY_ABI,
            )
            self.identity_mode = "erc8004"
            logger.info(f"Identity Registry (ERC-8004): {ERC8004_IDENTITY_REGISTRY}")
        elif IDENTITY_REGISTRY_ADDRESS:
            self.identity_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(IDENTITY_REGISTRY_ADDRESS),
                abi=CUSTOM_IDENTITY_ABI,
            )
            self.identity_mode = "custom"
            logger.info(f"Identity Registry (custom): {IDENTITY_REGISTRY_ADDRESS}")
        else:
            self.identity_contract = None
            self.identity_mode = None

        # ─── Reputation contract ───
        if self.use_official and ERC8004_REPUTATION_REGISTRY:
            self.reputation_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(ERC8004_REPUTATION_REGISTRY),
                abi=ERC8004_REPUTATION_ABI,
            )
            self.reputation_mode = "erc8004"
            logger.info(f"Reputation Registry (ERC-8004): {ERC8004_REPUTATION_REGISTRY}")
        elif REPUTATION_REGISTRY_ADDRESS:
            self.reputation_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(REPUTATION_REGISTRY_ADDRESS),
                abi=CUSTOM_REPUTATION_ABI,
            )
            self.reputation_mode = "custom"
            logger.info(f"Reputation Registry (custom): {REPUTATION_REGISTRY_ADDRESS}")
        else:
            self.reputation_contract = None
            self.reputation_mode = None

        # ─── Validation contract (always custom) ───
        self.validation_contract = None
        if VALIDATION_REGISTRY_ADDRESS:
            self.validation_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(VALIDATION_REGISTRY_ADDRESS),
                abi=VALIDATION_ABI,
            )
            logger.info(f"Validation Registry (custom): {VALIDATION_REGISTRY_ADDRESS}")

        # ─── Phase 4: AgentMonitor ───
        self.monitor_contract = None
        if AGENT_MONITOR_ADDRESS:
            self.monitor_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(AGENT_MONITOR_ADDRESS),
                abi=AGENT_MONITOR_ABI,
            )
            logger.info(f"AgentMonitor: {AGENT_MONITOR_ADDRESS}")

        # ─── Phase 4: AgentSplits ───
        self.splits_contract = None
        if AGENT_SPLITS_ADDRESS:
            self.splits_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(AGENT_SPLITS_ADDRESS),
                abi=AGENT_SPLITS_ABI,
            )
            logger.info(f"AgentSplits: {AGENT_SPLITS_ADDRESS}")

    # ─── State persistence ───────────────────────────────────────────────────

    def get_last_block(self, contract_name: str) -> int:
        try:
            result = (
                self.db.table("indexer_state")
                .select("last_block")
                .eq("contract_name", contract_name)
                .execute()
            )
            if result.data:
                stored = result.data[0]["last_block"]
                # If stored block is below the default start, fast-forward
                if stored < DEFAULT_START_BLOCK:
                    logger.info(f"Fast-forwarding {contract_name} from block {stored} to {DEFAULT_START_BLOCK}")
                    self.set_last_block(contract_name, DEFAULT_START_BLOCK)
                    return DEFAULT_START_BLOCK
                return stored
            self.db.table("indexer_state").insert(
                {"contract_name": contract_name, "last_block": DEFAULT_START_BLOCK}
            ).execute()
            logger.info(f"Initialized {contract_name} indexer state at block {DEFAULT_START_BLOCK}")
            return DEFAULT_START_BLOCK
        except Exception as e:
            logger.error(f"Error getting last block for {contract_name}: {e}")
            return DEFAULT_START_BLOCK

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
        block = self.w3.eth.get_block(block_number)
        return datetime.fromtimestamp(block.timestamp, tz=timezone.utc)

    # ─── Identity events ─────────────────────────────────────────────────────

    def process_identity_events(self, from_block: int, to_block: int) -> int:
        if not self.identity_contract:
            return 0

        if self.identity_mode == "erc8004":
            return self._process_erc8004_identity(from_block, to_block)
        else:
            return self._process_custom_identity(from_block, to_block)

    def _process_erc8004_identity(self, from_block: int, to_block: int) -> int:
        count = 0

        # Registered events
        try:
            events = self.identity_contract.events.Registered().get_logs(
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
                        "agent_uri": uri,
                        "name": metadata.get("name"),
                        "description": metadata.get("description"),
                        "category": metadata.get("category", "general"),
                        "image_url": metadata.get("image"),
                        "registered_at": ts.isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "registry_source": "erc8004",
                    },
                    on_conflict="agent_id",
                ).execute()
                logger.info(f"[ERC8004-ID] Agent #{agent_id} registered by {owner}")
                count += 1
        except Exception as e:
            logger.error(f"Error processing ERC-8004 Registered events: {e}")

        # URIUpdated events
        try:
            events = self.identity_contract.events.URIUpdated().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                new_uri = event.args.newURI
                metadata = parse_agent_uri(new_uri)

                update = {
                    "agent_uri": new_uri,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                if metadata.get("name"):
                    update["name"] = metadata["name"]
                if metadata.get("description"):
                    update["description"] = metadata["description"]
                if metadata.get("image"):
                    update["image_url"] = metadata["image"]

                self.db.table("agents").update(update).eq("agent_id", agent_id).execute()
                logger.info(f"[ERC8004-ID] Agent #{agent_id} URI updated")
                count += 1
        except Exception as e:
            logger.error(f"Error processing ERC-8004 URIUpdated events: {e}")

        return count

    def _process_custom_identity(self, from_block: int, to_block: int) -> int:
        count = 0

        try:
            events = self.identity_contract.events.AgentRegistered().get_logs(
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
                        "agent_uri": uri,
                        "registered_at": ts.isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "registry_source": "custom",
                    },
                    on_conflict="agent_id",
                ).execute()
                logger.info(f"[CUSTOM-ID] Agent #{agent_id} registered by {owner}")
                count += 1
        except Exception as e:
            logger.error(f"Error processing custom AgentRegistered events: {e}")

        try:
            events = self.identity_contract.events.AgentURIUpdated().get_logs(
                from_block=from_block, to_block=to_block
            )
            for event in events:
                agent_id = event.args.agentId
                new_uri = event.args.newURI
                self.db.table("agents").update(
                    {"agent_uri": new_uri, "updated_at": datetime.now(timezone.utc).isoformat()}
                ).eq("agent_id", agent_id).execute()
                logger.info(f"[CUSTOM-ID] Agent #{agent_id} URI updated")
                count += 1
        except Exception as e:
            logger.error(f"Error processing custom AgentURIUpdated events: {e}")

        return count

    # ─── Reputation events ───────────────────────────────────────────────────

    def process_reputation_events(self, from_block: int, to_block: int) -> int:
        if not self.reputation_contract:
            return 0

        if self.reputation_mode == "erc8004":
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
            events = self.reputation_contract.events.NewFeedback().get_logs(
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
            events = self.reputation_contract.events.FeedbackSubmitted().get_logs(
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
                logger.info(f"[CUSTOM-REP] Agent #{agent_id} rated {rating} by {reviewer[:10]}...")
                count += 1
        except Exception as e:
            logger.error(f"Error processing custom FeedbackSubmitted events: {e}")

        return count

    # ─── Validation events (always custom) ───────────────────────────────────

    def process_validation_events(self, from_block: int, to_block: int) -> int:
        if not self.validation_contract:
            return 0

        count = 0

        try:
            events = self.validation_contract.events.ValidationRequested().get_logs(
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
            events = self.validation_contract.events.ValidationSubmitted().get_logs(
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
        if not self.monitor_contract:
            return 0

        count = 0

        # EndpointRegistered
        try:
            events = self.monitor_contract.events.EndpointRegistered().get_logs(
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
            events = self.monitor_contract.events.EndpointRemoved().get_logs(
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
            events = self.monitor_contract.events.UptimeCheckLogged().get_logs(
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
        if not self.splits_contract:
            return 0

        count = 0

        # SplitCreated
        try:
            events = self.splits_contract.events.SplitCreated().get_logs(
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
            events = self.splits_contract.events.SplitDeactivated().get_logs(
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
            events = self.splits_contract.events.SplitPaymentReceived().get_logs(
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
            events = self.splits_contract.events.SplitDistributed().get_logs(
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

    def recalculate_scores(self):
        try:
            agents = self.db.table("agents").select("*").execute()
        except Exception as e:
            logger.error(f"Error fetching agents: {e}")
            return

        for agent in agents.data:
            agent_id = agent["agent_id"]

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
                agent["registered_at"].replace("Z", "+00:00")
            )
            age_days = calculate_account_age_days(registered_at)

            # Uptime percentage from daily summaries (last 30 days)
            uptime_pct = -1.0  # negative = no data
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
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                if uptime_pct >= 0:
                    update_data["uptime_score"] = round(uptime_pct, 2)

                self.db.table("agents").update(update_data).eq("agent_id", agent_id).execute()
            except Exception as e:
                logger.error(f"Error updating scores for agent #{agent_id}: {e}")

    def update_leaderboard(self):
        try:
            agents = (
                self.db.table("agents")
                .select("agent_id, category, composite_score")
                .order("composite_score", desc=True)
                .execute()
            )
        except Exception as e:
            logger.error(f"Error fetching agents for leaderboard: {e}")
            return

        try:
            self.db.table("leaderboard_cache").delete().neq("id", 0).execute()
        except Exception:
            pass

        now = datetime.now(timezone.utc).isoformat()
        categories: dict[str, list] = {}

        for rank, agent in enumerate(agents.data, 1):
            try:
                self.db.table("agents").update({"rank": rank}).eq(
                    "agent_id", agent["agent_id"]
                ).execute()
            except Exception:
                pass

            cat = agent.get("category", "general") or "general"
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(agent)

        for category, cat_agents in categories.items():
            for cat_rank, agent in enumerate(cat_agents, 1):
                try:
                    self.db.table("leaderboard_cache").insert(
                        {
                            "category": category,
                            "agent_id": agent["agent_id"],
                            "rank": cat_rank,
                            "composite_score": agent["composite_score"],
                            "trend": "stable",
                            "updated_at": now,
                        }
                    ).execute()
                except Exception:
                    pass

    def take_daily_snapshot(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        try:
            agents = self.db.table("agents").select(
                "agent_id, composite_score, average_rating, total_feedback, validation_success_rate"
            ).execute()
        except Exception as e:
            logger.error(f"Error fetching agents for snapshot: {e}")
            return

        for agent in agents.data:
            try:
                self.db.table("score_history").upsert(
                    {
                        "agent_id": agent["agent_id"],
                        "composite_score": agent["composite_score"],
                        "average_rating": agent["average_rating"],
                        "total_feedback": agent["total_feedback"],
                        "validation_success_rate": agent["validation_success_rate"],
                        "snapshot_date": today,
                    },
                    on_conflict="agent_id,snapshot_date",
                ).execute()
            except Exception:
                pass

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
        try:
            current_block = self.w3.eth.block_number
        except Exception as e:
            logger.error(f"Error getting block number: {e}")
            return

        safe_block = current_block - CONFIRMATION_BLOCKS
        if safe_block < 0:
            return

        total_events = 0

        # Process each contract with chunking
        contracts = [
            ("identity", self.process_identity_events),
            ("reputation", self.process_reputation_events),
            ("validation", self.process_validation_events),
            ("agent_monitor", self.process_monitor_events),
            ("agent_splits", self.process_splits_events),
        ]

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
            logger.info(f"Processed {total_events} events up to block {safe_block}")
            self.recalculate_scores()
            self.update_leaderboard()
            self.take_daily_snapshot()

    def run(self):
        mode = "Official ERC-8004" if self.use_official else "Custom"
        logger.info(f"Starting indexer [{mode}] (poll: {POLL_INTERVAL}s, confirmations: {CONFIRMATION_BLOCKS})")

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
