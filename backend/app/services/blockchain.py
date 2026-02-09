import json
import logging
import httpx
from dataclasses import dataclass
from eth_abi import decode as abi_decode
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
from app.config import get_settings


@dataclass
class _RawEventArgs:
    agentId: int
    owner: str
    agentURI: str


@dataclass
class _RawEvent:
    """Lightweight event object matching the interface indexer.py expects
    (event.args.agentId, event.args.owner, event.args.agentURI,
    event.blockNumber, event.transactionHash)."""
    agentId: int
    owner: str
    agentURI: str
    blockNumber: int
    transactionHash: bytes

    @property
    def args(self):
        return _RawEventArgs(agentId=self.agentId, owner=self.owner, agentURI=self.agentURI)

logger = logging.getLogger(__name__)

# ─── Official ERC-8004 Identity Registry ABI (Ava Labs) ─────────────
# Event param order verified from Snowtrace: Registered(uint256,string,address)
ERC8004_IDENTITY_ABI = json.loads("""[
    {"inputs":[],"name":"totalSupply","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":false,"name":"agentURI","type":"string"},{"indexed":true,"name":"owner","type":"address"}],"name":"Registered","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":false,"name":"newURI","type":"string"},{"indexed":true,"name":"updatedBy","type":"address"}],"name":"URIUpdated","type":"event"}
]""")

# ─── Official ERC-8004 Reputation Registry ABI (Ava Labs) ───────────
ERC8004_REPUTATION_ABI = json.loads("""[
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getFeedbackCount","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getSummary","outputs":[{"components":[{"name":"totalFeedback","type":"uint256"},{"name":"averageValue","type":"int128"},{"name":"averageValueDecimals","type":"uint8"}],"type":"tuple"}],"stateMutability":"view","type":"function"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"feedbackId","type":"uint256"},{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":true,"name":"reviewer","type":"address"},{"indexed":false,"name":"value","type":"int128"},{"indexed":false,"name":"valueDecimals","type":"uint8"},{"indexed":false,"name":"tag1","type":"bytes32"},{"indexed":false,"name":"tag2","type":"bytes32"}],"name":"NewFeedback","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"feedbackId","type":"uint256"}],"name":"FeedbackRevoked","type":"event"}
]""")

# ─── Legacy Custom Identity Registry ABI ─────────────────────────────
LEGACY_IDENTITY_ABI = json.loads("""[
    {"inputs":[],"name":"totalAgents","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getAgentURI","outputs":[{"type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getAgentOwner","outputs":[{"type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"owner","type":"address"}],"name":"isRegistered","outputs":[{"type":"bool"}],"stateMutability":"view","type":"function"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":true,"name":"owner","type":"address"},{"indexed":false,"name":"agentURI","type":"string"}],"name":"AgentRegistered","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":false,"name":"newURI","type":"string"}],"name":"AgentURIUpdated","type":"event"}
]""")

# ─── Legacy Custom Reputation Registry ABI ───────────────────────────
LEGACY_REPUTATION_ABI = json.loads("""[
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getFeedbackCount","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getAverageRating","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"},{"name":"index","type":"uint256"}],"name":"getFeedback","outputs":[{"components":[{"name":"reviewer","type":"address"},{"name":"rating","type":"uint8"},{"name":"feedbackURI","type":"string"},{"name":"taskHash","type":"bytes32"},{"name":"timestamp","type":"uint256"}],"type":"tuple"}],"stateMutability":"view","type":"function"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":true,"name":"reviewer","type":"address"},{"indexed":false,"name":"rating","type":"uint8"},{"indexed":false,"name":"taskHash","type":"bytes32"}],"name":"FeedbackSubmitted","type":"event"}
]""")

# ─── Validation Registry ABI (always custom) ────────────────────────
VALIDATION_REGISTRY_ABI = json.loads("""[
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getSuccessRate","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getValidationCounts","outputs":[{"name":"total","type":"uint256"},{"name":"completed","type":"uint256"},{"name":"successful","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"validationId","type":"uint256"}],"name":"getValidation","outputs":[{"components":[{"name":"agentId","type":"uint256"},{"name":"taskHash","type":"bytes32"},{"name":"taskURI","type":"string"},{"name":"requester","type":"address"},{"name":"timestamp","type":"uint256"},{"name":"isCompleted","type":"bool"}],"type":"tuple"}],"stateMutability":"view","type":"function"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"validationId","type":"uint256"},{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":false,"name":"taskHash","type":"bytes32"}],"name":"ValidationRequested","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"validationId","type":"uint256"},{"indexed":true,"name":"validator","type":"address"},{"indexed":false,"name":"isValid","type":"bool"}],"name":"ValidationSubmitted","type":"event"}
]""")


class BlockchainService:
    def __init__(self):
        settings = get_settings()
        self.w3 = Web3(Web3.HTTPProvider(settings.avalanche_rpc_url))
        # Avalanche C-Chain uses POA consensus; some blocks have extraData > 32 bytes
        self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        self.use_official = settings.use_official_erc8004

        # Ethereum web3 instance (for cross-chain ERC-8004 indexing)
        # Try primary + fallback RPCs until one connects
        self.w3_eth = None
        self._eth_rpc_url = ""  # current active URL for raw httpx calls
        self._eth_rpc_urls = settings.ethereum_rpc_urls
        self._eth_rpc_index = 0
        for i, rpc_url in enumerate(self._eth_rpc_urls):
            try:
                candidate = Web3(Web3.HTTPProvider(rpc_url))
                if candidate.is_connected():
                    self.w3_eth = candidate
                    self._eth_rpc_url = rpc_url
                    self._eth_rpc_index = i
                    logger.info(f"Ethereum RPC connected: {rpc_url[:50]}...")
                    break
                else:
                    logger.warning(f"Ethereum RPC not reachable: {rpc_url[:50]}...")
            except Exception as e:
                logger.warning(f"Ethereum RPC failed: {rpc_url[:50]}... — {e}")

        self.identity_registry = None
        self.reputation_registry = None
        self.validation_registry = None

        # Identity registry: official ERC-8004 or legacy
        identity_addr = settings.active_identity_address
        if identity_addr:
            abi = ERC8004_IDENTITY_ABI if self.use_official else LEGACY_IDENTITY_ABI
            self.identity_registry = self.w3.eth.contract(
                address=Web3.to_checksum_address(identity_addr),
                abi=abi,
            )

        # Reputation registry: official ERC-8004 or legacy
        reputation_addr = settings.active_reputation_address
        if reputation_addr:
            abi = ERC8004_REPUTATION_ABI if self.use_official else LEGACY_REPUTATION_ABI
            self.reputation_registry = self.w3.eth.contract(
                address=Web3.to_checksum_address(reputation_addr),
                abi=abi,
            )

        # Dedicated ERC-8004 Identity Registry (always at official address)
        self.erc8004_identity = None
        erc8004_addr = settings.erc8004_identity_registry
        if erc8004_addr:
            self.erc8004_identity = self.w3.eth.contract(
                address=Web3.to_checksum_address(erc8004_addr),
                abi=ERC8004_IDENTITY_ABI,
            )

        # ERC-8004 Identity Registry on Ethereum mainnet
        self.erc8004_eth_identity = None
        eth_identity_addr = settings.erc8004_eth_identity_registry
        if eth_identity_addr and self.w3_eth:
            self.erc8004_eth_identity = self.w3_eth.eth.contract(
                address=Web3.to_checksum_address(eth_identity_addr),
                abi=ERC8004_IDENTITY_ABI,
            )
            logger.info(f"ERC-8004 Ethereum Identity Registry: {eth_identity_addr}")

        # Validation: always custom
        if settings.validation_registry_address:
            self.validation_registry = self.w3.eth.contract(
                address=Web3.to_checksum_address(settings.validation_registry_address),
                abi=VALIDATION_REGISTRY_ABI,
            )

    def reconnect_eth(self) -> bool:
        """Cycle to the next Ethereum RPC fallback. Returns True if reconnected."""
        if not self._eth_rpc_urls:
            return False
        start = self._eth_rpc_index
        for offset in range(1, len(self._eth_rpc_urls) + 1):
            idx = (start + offset) % len(self._eth_rpc_urls)
            rpc_url = self._eth_rpc_urls[idx]
            try:
                candidate = Web3(Web3.HTTPProvider(rpc_url))
                if candidate.is_connected():
                    self.w3_eth = candidate
                    self._eth_rpc_url = rpc_url
                    self._eth_rpc_index = idx
                    # Re-bind the Ethereum identity contract
                    settings = get_settings()
                    eth_addr = settings.erc8004_eth_identity_registry
                    if eth_addr:
                        self.erc8004_eth_identity = self.w3_eth.eth.contract(
                            address=Web3.to_checksum_address(eth_addr),
                            abi=ERC8004_IDENTITY_ABI,
                        )
                    logger.info(f"Ethereum RPC reconnected via fallback: {rpc_url[:50]}...")
                    return True
            except Exception:
                continue
        logger.error("All Ethereum RPC fallbacks exhausted")
        return False

    def probe_eth_block_range_limit(self) -> int:
        """Probe the ETH RPC to discover its max eth_getLogs block range.
        Returns detected limit, or 0 if probing fails.
        Tests progressively: 10 → 100 → 500 → 800 → 1800.
        Alchemy free=10, Alchemy PAYG=2000, publicnode/llamarpc≈1000."""
        if not self._eth_rpc_url:
            return 0
        settings = get_settings()
        addr = settings.erc8004_eth_identity_registry
        topic0 = "0x" + Web3.keccak(text="Registered(uint256,string,address)").hex()
        last_ok = 0
        for test_range in [10, 100, 500, 800, 1800]:
            payload = {
                "jsonrpc": "2.0", "method": "eth_getLogs", "id": 1,
                "params": [{
                    "address": addr,
                    "fromBlock": hex(24420000),
                    "toBlock": hex(24420000 + test_range),
                    "topics": [topic0],
                }],
            }
            try:
                r = httpx.post(self._eth_rpc_url, json=payload, timeout=15)
                resp = r.json()
                if r.status_code != 200 or "error" in resp:
                    err = resp.get("error", {})
                    logger.info(
                        f"ETH RPC block range probe: {test_range} blocks → rejected "
                        f"({err.get('message', '')[:80]})"
                    )
                    return last_ok if last_ok > 0 else max(test_range // 2, 1)
                last_ok = test_range
            except Exception:
                return last_ok if last_ok > 0 else max(test_range // 2, 1)
        return last_ok  # all passed

    def is_connected(self) -> bool:
        try:
            return self.w3.is_connected()
        except Exception:
            return False

    def get_current_block(self) -> int:
        return self.w3.eth.block_number

    def get_identity_events(self, from_block: int, to_block: int):
        if not self.identity_registry:
            return []
        event_name = "Registered" if self.use_official else "AgentRegistered"
        return getattr(self.identity_registry.events, event_name)().get_logs(
            from_block=from_block, to_block=to_block
        )

    def get_erc8004_registered_events(self, from_block: int, to_block: int):
        """Get Registered events from the official ERC-8004 Identity Registry."""
        if not self.erc8004_identity:
            logger.warning("ERC-8004 identity contract not initialized")
            return []
        try:
            events = self.erc8004_identity.events.Registered().get_logs(
                from_block=from_block, to_block=to_block
            )
            logger.info(f"ERC-8004 get_logs({from_block}-{to_block}): {len(events)} events")
            return events
        except Exception as e:
            logger.error(f"ERC-8004 get_logs({from_block}-{to_block}) FAILED: {e}")
            raise

    def get_eth_current_block(self) -> int:
        """Get current block number on Ethereum mainnet."""
        if not self.w3_eth:
            return 0
        return self.w3_eth.eth.block_number

    def get_erc8004_eth_registered_events(self, from_block: int, to_block: int):
        """Get Registered events from the ERC-8004 Identity Registry on Ethereum.

        Uses raw httpx JSON-RPC calls instead of web3.py's get_logs to:
        - Bypass web3.py v7 middleware that wraps address in an array
        - Capture the full RPC error body for debugging (e.g. Alchemy block range limits)
        - Work with any RPC provider without middleware quirks
        """
        settings = get_settings()
        addr = settings.erc8004_eth_identity_registry
        if not addr or not self._eth_rpc_url:
            logger.warning("ERC-8004 Ethereum identity not configured (addr=%s, rpc=%s)", bool(addr), bool(self._eth_rpc_url))
            return []
        topic0 = "0x" + Web3.keccak(text="Registered(uint256,string,address)").hex()

        payload = {
            "jsonrpc": "2.0", "method": "eth_getLogs", "id": 1,
            "params": [{
                "address": addr,
                "fromBlock": hex(from_block),
                "toBlock": hex(to_block),
                "topics": [topic0],
            }],
        }

        for attempt in range(2):  # try current RPC, then fallback
            rpc_url = self._eth_rpc_url
            try:
                r = httpx.post(rpc_url, json=payload, timeout=30)
            except httpx.RequestError as e:
                logger.error(f"ERC-8004 ETH HTTP error ({rpc_url[:50]}): {e}")
                if attempt == 0 and self.reconnect_eth():
                    continue
                raise

            if r.status_code != 200:
                body = r.text[:500]
                logger.error(
                    f"ERC-8004 ETH get_logs({from_block}-{to_block}) HTTP {r.status_code} "
                    f"from {rpc_url[:50]}: {body}"
                )
                if attempt == 0 and self.reconnect_eth():
                    continue
                raise Exception(f"eth_getLogs HTTP {r.status_code}: {body}")

            resp = r.json()
            if "error" in resp:
                err_msg = resp["error"].get("message", str(resp["error"]))
                logger.error(
                    f"ERC-8004 ETH get_logs({from_block}-{to_block}) RPC error "
                    f"from {rpc_url[:50]}: {err_msg}"
                )
                if attempt == 0 and self.reconnect_eth():
                    continue
                raise Exception(f"eth_getLogs RPC error: {err_msg}")

            # Decode raw logs into event-like objects
            # Registered(uint256 indexed agentId, string agentURI, address indexed owner)
            raw_logs = resp["result"]
            events = []
            for log in raw_logs:
                try:
                    agent_id = int(log["topics"][1], 16)
                    owner = "0x" + log["topics"][2][-40:]
                    # data contains the ABI-encoded agentURI string
                    data_bytes = bytes.fromhex(log["data"][2:])
                    agent_uri = abi_decode(["string"], data_bytes)[0] if data_bytes else ""
                    events.append(_RawEvent(
                        agentId=agent_id,
                        owner=Web3.to_checksum_address(owner),
                        agentURI=agent_uri,
                        blockNumber=int(log["blockNumber"], 16),
                        transactionHash=bytes.fromhex(log["transactionHash"][2:]),
                    ))
                except Exception as e:
                    logger.warning(f"Failed to decode ETH log: {e}")
            logger.info(f"ERC-8004 ETH get_logs({from_block}-{to_block}): {len(events)} events")
            return events

        return []  # unreachable

    def diagnose_erc8004_identity(self):
        """One-time diagnostic: check contract, compute topic, try raw logs."""
        settings = get_settings()
        addr = settings.erc8004_identity_registry
        logger.info(f"=== ERC-8004 IDENTITY DIAGNOSTIC ===")
        logger.info(f"erc8004_identity_registry address from settings: '{addr}'")
        logger.info(f"erc8004_identity contract initialized: {self.erc8004_identity is not None}")
        if self.erc8004_identity:
            logger.info(f"erc8004_identity contract address: {self.erc8004_identity.address}")

        # Compute expected topic0 for Registered(uint256,string,address)
        sig = "Registered(uint256,string,address)"
        topic0 = Web3.keccak(text=sig).hex()
        logger.info(f"Expected topic0 for '{sig}': {topic0}")

        # Also check what topic0 web3 derives from ABI
        if self.erc8004_identity:
            try:
                abi_topic = self.erc8004_identity.events.Registered().event_abi
                logger.info(f"ABI event definition: {json.dumps(abi_topic)}")
            except Exception as e:
                logger.error(f"Error reading ABI event: {e}")

        # Try raw eth.get_logs with explicit topic
        if addr:
            try:
                raw_logs = self.w3.eth.get_logs({
                    "address": Web3.to_checksum_address(addr),
                    "fromBlock": 77_389_000,
                    "toBlock": 77_391_000,
                })
                logger.info(f"Raw get_logs (no topic filter, 77389000-77391000): {len(raw_logs)} logs")
                for i, log in enumerate(raw_logs[:5]):
                    logger.info(f"  Log {i}: topics={[t.hex() for t in log['topics']]}, block={log['blockNumber']}")
            except Exception as e:
                logger.error(f"Raw get_logs failed: {e}")

            # Also try with topic0 filter
            try:
                filtered_logs = self.w3.eth.get_logs({
                    "address": Web3.to_checksum_address(addr),
                    "fromBlock": 77_389_000,
                    "toBlock": 77_391_000,
                    "topics": [topic0],
                })
                logger.info(f"Filtered get_logs (topic0={topic0[:18]}..., 77389000-77391000): {len(filtered_logs)} logs")
            except Exception as e:
                logger.error(f"Filtered get_logs failed: {e}")

            # Try contract.events approach
            if self.erc8004_identity:
                try:
                    events = self.erc8004_identity.events.Registered().get_logs(
                        from_block=77_389_000, to_block=77_391_000
                    )
                    logger.info(f"contract.events.Registered().get_logs(77389000-77391000): {len(events)} events")
                except Exception as e:
                    logger.error(f"contract.events.Registered().get_logs failed: {e}")

        logger.info(f"=== END ERC-8004 DIAGNOSTIC ===")

    def get_uri_update_events(self, from_block: int, to_block: int):
        if not self.identity_registry:
            return []
        event_name = "URIUpdated" if self.use_official else "AgentURIUpdated"
        return getattr(self.identity_registry.events, event_name)().get_logs(
            from_block=from_block, to_block=to_block
        )

    def get_feedback_events(self, from_block: int, to_block: int):
        if not self.reputation_registry:
            return []
        event_name = "NewFeedback" if self.use_official else "FeedbackSubmitted"
        return getattr(self.reputation_registry.events, event_name)().get_logs(
            from_block=from_block, to_block=to_block
        )

    def get_validation_requested_events(self, from_block: int, to_block: int):
        if not self.validation_registry:
            return []
        return self.validation_registry.events.ValidationRequested().get_logs(
            from_block=from_block, to_block=to_block
        )

    def get_validation_submitted_events(self, from_block: int, to_block: int):
        if not self.validation_registry:
            return []
        return self.validation_registry.events.ValidationSubmitted().get_logs(
            from_block=from_block, to_block=to_block
        )

    def get_agent_uri(self, agent_id: int) -> str:
        if not self.identity_registry:
            return ""
        if self.use_official:
            return self.identity_registry.functions.tokenURI(agent_id).call()
        return self.identity_registry.functions.getAgentURI(agent_id).call()

    def get_agent_owner(self, agent_id: int) -> str:
        if not self.identity_registry:
            return ""
        if self.use_official:
            return self.identity_registry.functions.ownerOf(agent_id).call()
        return self.identity_registry.functions.getAgentOwner(agent_id).call()

    def get_total_agents(self) -> int:
        if not self.identity_registry:
            return 0
        if self.use_official:
            return self.identity_registry.functions.totalSupply().call()
        return self.identity_registry.functions.totalAgents().call()

    def get_reputation_summary(self, agent_id: int) -> dict:
        """Get reputation summary from official ERC-8004 registry."""
        if not self.reputation_registry or not self.use_official:
            return {"total_feedback": 0, "average_value": 0, "average_value_decimals": 0}
        try:
            result = self.reputation_registry.functions.getSummary(agent_id).call()
            return {
                "total_feedback": result[0],
                "average_value": result[1],
                "average_value_decimals": result[2],
            }
        except Exception:
            return {"total_feedback": 0, "average_value": 0, "average_value_decimals": 0}

    def get_erc8004_stats(self) -> dict:
        """Get aggregate stats from official ERC-8004 registries."""
        stats = {
            "registry_mode": "erc8004" if self.use_official else "custom",
            "identity_registry": "",
            "reputation_registry": "",
            "total_agents": 0,
            "connected": self.is_connected(),
        }

        settings = get_settings()
        stats["identity_registry"] = settings.active_identity_address
        stats["reputation_registry"] = settings.active_reputation_address

        try:
            stats["total_agents"] = self.get_total_agents()
        except Exception:
            pass

        return stats


_blockchain_service: BlockchainService | None = None


def get_blockchain_service() -> BlockchainService:
    global _blockchain_service
    if _blockchain_service is None:
        _blockchain_service = BlockchainService()
    return _blockchain_service
