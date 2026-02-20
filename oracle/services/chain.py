"""
On-chain feedback submission via the ReputationRegistry contract.

Supports multiple chains (Avalanche C-Chain + Ethereum mainnet).
ERC-8004 uses CREATE2 — same contract addresses on both chains.
Each chain has independent 30-second rate limiting.
"""

import json
import logging
import time
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from config import get_settings

logger = logging.getLogger(__name__)

# Official ERC-8004 Reputation Registry ABI (Ava Labs mainnet)
# Verified from implementation 0x16e0fa7f7c56b9a767e34b192b51f921be31da34
# (proxy at 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63)
REPUTATION_REGISTRY_ABI = json.loads("""[
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "value", "type": "int128"},
            {"name": "valueDecimals", "type": "uint8"},
            {"name": "tag1", "type": "string"},
            {"name": "tag2", "type": "string"},
            {"name": "endpoint", "type": "string"},
            {"name": "feedbackURI", "type": "string"},
            {"name": "feedbackHash", "type": "bytes32"}
        ],
        "name": "giveFeedback",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "clientAddresses", "type": "address[]"},
            {"name": "tag1", "type": "string"},
            {"name": "tag2", "type": "string"}
        ],
        "name": "getSummary",
        "outputs": [
            {"name": "count", "type": "uint64"},
            {"name": "summaryValue", "type": "int128"},
            {"name": "summaryValueDecimals", "type": "uint8"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
]""")

IDENTITY_REGISTRY_ABI = json.loads("""[
    {
        "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    }
]""")

# ERC-721 Transfer(address,address,uint256) event topic for scanning mints
TRANSFER_EVENT_TOPIC = Web3.keccak(text="Transfer(address,address,uint256)")

# Minimum seconds between successive transactions (per chain)
TX_RATE_LIMIT_SECONDS = 30


class _ChainBackend:
    """Single-chain backend: holds w3, contracts, account, rate limit state."""

    def __init__(
        self,
        chain_name: str,
        rpc_url: str,
        chain_id: int,
        identity_registry_addr: str,
        reputation_registry_addr: str,
        private_key: str,
        *,
        poa_middleware: bool = False,
    ):
        self.chain_name = chain_name
        self.chain_id = chain_id
        self._w3 = Web3(Web3.HTTPProvider(rpc_url))

        if poa_middleware:
            self._w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        self._account = self._w3.eth.account.from_key(private_key)

        self._identity_registry = self._w3.eth.contract(
            address=Web3.to_checksum_address(identity_registry_addr),
            abi=IDENTITY_REGISTRY_ABI,
        )
        self._reputation_registry = self._w3.eth.contract(
            address=Web3.to_checksum_address(reputation_registry_addr),
            abi=REPUTATION_REGISTRY_ABI,
        )

        self._last_tx_time: float = 0.0
        self._low_balance_until: float = 0.0  # circuit breaker for empty wallet
        self._min_balance_wei: int = 50_000_000_000_000  # 0.00005 ETH (~2 txs buffer)

        logger.info(
            f"_ChainBackend initialized — chain={chain_name} chain_id={chain_id} "
            f"wallet={self._account.address} "
            f"reputation_registry={reputation_registry_addr}"
        )

    @property
    def wallet_address(self) -> str:
        return self._account.address

    def agent_exists(self, agent_id: int) -> str | None:
        """Check if agent_id is registered on this chain. Returns owner address or None."""
        try:
            owner = self._identity_registry.functions.ownerOf(agent_id).call()
            return owner
        except Exception:
            return None

    def submit_feedback(
        self,
        agent_id: int,
        score: int,
        comment: str,
        tag1: str = "trust",
        tag2: str = "oracle-screening",
    ) -> str | None:
        """
        Submit reputation feedback via the ERC-8004 giveFeedback function.

        Returns transaction hash hex string on success, None on failure.
        """
        # Circuit breaker: skip if wallet was recently found to be broke
        now_mono = time.monotonic()
        if now_mono < self._low_balance_until:
            return None

        # Pre-flight balance check — avoid wasting RPC calls when broke
        try:
            balance = self._w3.eth.get_balance(self._account.address)
            if balance < self._min_balance_wei:
                logger.warning(
                    f"[{self.chain_name}] Wallet balance too low "
                    f"({balance} wei < {self._min_balance_wei} wei) — "
                    f"pausing on-chain feedback for 5 minutes"
                )
                self._low_balance_until = now_mono + 300  # 5 min circuit breaker
                return None
        except Exception as e:
            logger.warning(f"[{self.chain_name}] Balance check failed: {e}")
            self._low_balance_until = now_mono + 300  # trip breaker on RPC failure too
            return None

        # Check agent exists on this chain's IdentityRegistry
        owner = self.agent_exists(agent_id)
        if owner is None:
            logger.info(
                f"Agent {agent_id} not found on {self.chain_name} IdentityRegistry — skipping"
            )
            return None

        logger.info(
            f"Agent {agent_id} found on {self.chain_name} — owner={owner[:10]}..."
        )

        # Don't rate our own agent
        if owner.lower() == self._account.address.lower():
            logger.info(
                f"Agent {agent_id} owned by oracle wallet on {self.chain_name} — "
                f"skipping self-feedback"
            )
            return None

        # Enforce per-chain rate limit
        now = time.monotonic()
        elapsed = now - self._last_tx_time
        if elapsed < TX_RATE_LIMIT_SECONDS:
            wait = TX_RATE_LIMIT_SECONDS - elapsed
            logger.info(
                f"Rate limiting {self.chain_name} — waiting {wait:.1f}s before next tx"
            )
            time.sleep(wait)

        # Clamp score to valid range
        score = max(1, min(100, score))

        # Build a unique nonce for this feedback
        nonce_input = f"{tag2}:{agent_id}:{int(time.time())}"
        feedback_nonce = Web3.keccak(text=nonce_input)

        content = comment[:256] if comment else "oracle-screening"

        try:
            call = self._reputation_registry.functions.giveFeedback(
                agent_id,
                score,              # value (int128)
                0,                  # valueDecimals (whole numbers)
                tag1,               # tag1
                tag2,               # tag2
                content,            # endpoint field
                "",                 # feedbackURI (empty for MVP)
                feedback_nonce,
            )

            estimated_gas = call.estimate_gas({"from": self._account.address})
            gas_limit = int(estimated_gas * 1.3)

            tx = call.build_transaction({
                "from": self._account.address,
                "nonce": self._w3.eth.get_transaction_count(self._account.address),
                "gas": gas_limit,
                "gasPrice": self._w3.eth.gas_price,
                "chainId": self.chain_id,
            })

            signed = self._account.sign_transaction(tx)
            tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

            self._last_tx_time = time.monotonic()

            if receipt.status == 1:
                hex_hash = tx_hash.hex()
                logger.info(
                    f"On-chain feedback submitted — agent_id={agent_id} "
                    f"score={score} chain={self.chain_name} tx={hex_hash}"
                )
                return hex_hash
            else:
                logger.error(
                    f"Feedback tx reverted — agent_id={agent_id} "
                    f"chain={self.chain_name} tx={tx_hash.hex()}"
                )
                return None

        except Exception as e:
            self._last_tx_time = time.monotonic()
            logger.error(
                f"Failed to submit on-chain feedback for agent {agent_id} "
                f"on {self.chain_name}: {e}"
            )
            # Trip circuit breaker on insufficient funds to stop hammering
            err_str = str(e).lower()
            if "insufficient funds" in err_str or "funds for gas" in err_str:
                self._low_balance_until = time.monotonic() + 300
                logger.warning(
                    f"[{self.chain_name}] Insufficient funds detected — "
                    f"pausing on-chain feedback for 5 minutes"
                )
            return None


class ChainService:
    """Multi-chain feedback service. Routes to Avalanche or Ethereum automatically."""

    def __init__(self):
        settings = get_settings()

        # Avalanche backend (always initialized)
        self._avax = _ChainBackend(
            chain_name="avalanche",
            rpc_url=settings.avalanche_rpc_url,
            chain_id=43114,
            identity_registry_addr=settings.erc8004_identity_registry,
            reputation_registry_addr=settings.reputation_registry,
            private_key=settings.private_key,
            poa_middleware=True,
        )

        # Ethereum backend (optional — only if ETHEREUM_RPC_URL is set)
        self._eth: _ChainBackend | None = None
        if settings.ethereum_rpc_url:
            try:
                self._eth = _ChainBackend(
                    chain_name="ethereum",
                    rpc_url=settings.ethereum_rpc_url,
                    chain_id=1,
                    identity_registry_addr=settings.eth_identity_registry,
                    reputation_registry_addr=settings.eth_reputation_registry,
                    private_key=settings.private_key,
                    poa_middleware=False,
                )
            except Exception as e:
                logger.error(f"Ethereum backend init failed: {e}")
                self._eth = None
        else:
            logger.info("ETHEREUM_RPC_URL not set — Ethereum feedback disabled")

        self._cached_oracle_agent_id: int | None = None

        logger.info(
            f"ChainService initialized — avax={settings.reputation_registry}, "
            f"eth={'enabled' if self._eth else 'disabled'}"
        )

    def get_oracle_agent_id(self) -> int | None:
        """Look up the oracle wallet's registered agent ID on the IdentityRegistry (Avalanche)."""
        if self._cached_oracle_agent_id is not None:
            return self._cached_oracle_agent_id

        settings = get_settings()

        # Fast path: use explicit config if set
        if settings.oracle_agent_id:
            self._cached_oracle_agent_id = settings.oracle_agent_id
            logger.info(f"Oracle agent ID from config: {settings.oracle_agent_id}")
            return settings.oracle_agent_id

        try:
            balance = self._avax._identity_registry.functions.balanceOf(
                self._avax.wallet_address
            ).call()

            if balance == 0:
                logger.warning("Oracle wallet has no registered agent")
                return None

            # No tokenOfOwnerByIndex on this contract — scan Transfer events
            # for mints (from=0x0) to the oracle wallet
            registry_addr = Web3.to_checksum_address(settings.erc8004_identity_registry)
            wallet_topic = "0x" + self._avax.wallet_address.lower()[2:].zfill(64)
            zero_topic = "0x" + "0" * 64

            latest = self._avax._w3.eth.block_number
            # Scan last 50k blocks in 2000-block chunks (Avalanche RPC limit)
            from_block = max(0, latest - 50_000)
            chunk = 2000

            for start in range(from_block, latest + 1, chunk):
                end = min(start + chunk - 1, latest)
                logs = self._avax._w3.eth.get_logs({
                    "address": registry_addr,
                    "fromBlock": start,
                    "toBlock": end,
                    "topics": [
                        TRANSFER_EVENT_TOPIC,
                        zero_topic,      # from = address(0) (mint)
                        wallet_topic,    # to = oracle wallet
                    ],
                })
                if logs:
                    # Use the most recent mint
                    agent_id = int(logs[-1].topics[3].hex(), 16)
                    self._cached_oracle_agent_id = agent_id
                    logger.info(f"Oracle agent ID resolved from Transfer events: {agent_id}")
                    return agent_id

            logger.warning("balanceOf > 0 but no Transfer mint events found for oracle wallet")
            return None
        except Exception as e:
            logger.error(f"Failed to look up oracle agent ID: {e}")
            return None

    def submit_feedback(
        self,
        agent_id: int,
        score: int,
        comment: str,
        tag1: str = "trust",
        tag2: str = "oracle-screening",
    ) -> str | None:
        """
        Submit reputation feedback, auto-routing to the correct chain.

        Tries Avalanche first (agents 1-1621 live there). If the agent
        isn't found on Avalanche and the Ethereum backend is available,
        tries Ethereum.

        Returns transaction hash hex string on success, None on failure.
        """
        # Try Avalanche first
        result = self._avax.submit_feedback(agent_id, score, comment, tag1, tag2)
        if result is not None:
            return result

        # Agent not on Avalanche — try Ethereum if available
        if self._eth is not None:
            logger.info(
                f"Agent {agent_id} not on Avalanche — trying Ethereum"
            )
            return self._eth.submit_feedback(agent_id, score, comment, tag1, tag2)

        return None

    def get_agent_onchain_data(self, agent_id: int) -> dict | None:
        """Read agent owner + URI from the Avalanche IdentityRegistry."""
        try:
            owner = self._avax._identity_registry.functions.ownerOf(agent_id).call()
            uri = self._avax._identity_registry.functions.tokenURI(agent_id).call()
            return {"owner_address": owner, "agent_uri": uri}
        except Exception as e:
            logger.warning(f"Failed to read agent {agent_id} from chain: {e}")
            return None


def ensure_oracle_agent_indexed() -> bool:
    """
    Verify the oracle's own agent_id exists in Supabase.
    If missing (indexer hasn't picked it up yet), insert it from on-chain data.
    Returns True if the agent is confirmed present.
    """
    settings = get_settings()
    if not settings.oracle_agent_id:
        return False

    agent_id = settings.oracle_agent_id

    try:
        from database import get_supabase
        db = get_supabase()

        result = (
            db.table("agents")
            .select("agent_id")
            .eq("agent_id", agent_id)
            .limit(1)
            .execute()
        )
        if result.data:
            logger.info(f"Oracle agent #{agent_id} already in Supabase")
            return True

        # Not in DB — read from chain and insert
        chain = get_chain_service()
        if chain is None:
            logger.warning("No ChainService — cannot backfill oracle agent")
            return False

        onchain = chain.get_agent_onchain_data(agent_id)
        if onchain is None:
            logger.error(f"Oracle agent #{agent_id} not found on-chain either")
            return False

        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()

        db.table("agents").insert({
            "agent_id": agent_id,
            "owner_address": onchain["owner_address"],
            "agent_uri": onchain["agent_uri"],
            "name": settings.oracle_agent_name,
            "description": settings.oracle_agent_description,
            "category": "data",
            "registered_at": now,
            "updated_at": now,
        }).execute()

        logger.info(
            f"Oracle agent #{agent_id} backfilled into Supabase from on-chain data "
            f"(owner={onchain['owner_address'][:10]}...)"
        )
        return True

    except Exception as e:
        logger.error(f"ensure_oracle_agent_indexed failed: {e}")
        return False


# Singleton — lazily initialized, None if PRIVATE_KEY not set
_chain_service: ChainService | None = None
_chain_service_initialized = False


def get_chain_service() -> ChainService | None:
    """
    Return the ChainService singleton, or None if PRIVATE_KEY is not configured.
    Safe to call repeatedly — only initializes once.
    """
    global _chain_service, _chain_service_initialized
    if _chain_service_initialized:
        return _chain_service

    _chain_service_initialized = True
    settings = get_settings()

    if not settings.private_key:
        logger.info("ORACLE_PRIVATE_KEY not set — on-chain feedback submission disabled")
        return None

    if not settings.reputation_registry:
        logger.info("REPUTATION_REGISTRY not set — on-chain feedback submission disabled")
        return None

    try:
        _chain_service = ChainService()
    except Exception as e:
        logger.error(f"ChainService initialization failed: {e}")
        _chain_service = None

    return _chain_service
