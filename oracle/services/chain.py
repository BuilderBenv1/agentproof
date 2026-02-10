"""
On-chain feedback submission via the ReputationRegistry contract.

Submits ERC-8004 reputation feedback after the oracle screens agents.
Rate-limited to 1 tx per 30 seconds to manage gas costs.
"""

import json
import logging
import time
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from config import get_settings

logger = logging.getLogger(__name__)

REPUTATION_REGISTRY_ABI = json.loads("""[
    {
        "inputs": [
            {"internalType": "uint256", "name": "agentId", "type": "uint256"},
            {"internalType": "uint8", "name": "rating", "type": "uint8"},
            {"internalType": "string", "name": "feedbackURI", "type": "string"},
            {"internalType": "bytes32", "name": "taskHash", "type": "bytes32"}
        ],
        "name": "submitFeedback",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "agentId", "type": "uint256"}],
        "name": "getFeedbackCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
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
    }
]""")

# ERC-721 Transfer(address,address,uint256) event topic for scanning mints
TRANSFER_EVENT_TOPIC = Web3.keccak(text="Transfer(address,address,uint256)")

# Minimum seconds between successive transactions
TX_RATE_LIMIT_SECONDS = 30


class ChainService:
    """Submits on-chain reputation feedback to the ReputationRegistry."""

    def __init__(self):
        settings = get_settings()
        self._w3 = Web3(Web3.HTTPProvider(settings.avalanche_rpc_url))
        self._w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        self._account = self._w3.eth.account.from_key(settings.private_key)

        self._reputation_registry = self._w3.eth.contract(
            address=Web3.to_checksum_address(settings.reputation_registry),
            abi=REPUTATION_REGISTRY_ABI,
        )
        self._identity_registry = self._w3.eth.contract(
            address=Web3.to_checksum_address(settings.erc8004_identity_registry),
            abi=IDENTITY_REGISTRY_ABI,
        )

        self._last_tx_time: float = 0.0
        self._cached_oracle_agent_id: int | None = None

        logger.info(
            f"ChainService initialized — wallet={self._account.address}, "
            f"reputation_registry={settings.reputation_registry}"
        )

    def get_oracle_agent_id(self) -> int | None:
        """Look up the oracle wallet's registered agent ID on the IdentityRegistry."""
        if self._cached_oracle_agent_id is not None:
            return self._cached_oracle_agent_id

        settings = get_settings()

        # Fast path: use explicit config if set
        if settings.oracle_agent_id:
            self._cached_oracle_agent_id = settings.oracle_agent_id
            logger.info(f"Oracle agent ID from config: {settings.oracle_agent_id}")
            return settings.oracle_agent_id

        try:
            balance = self._identity_registry.functions.balanceOf(
                self._account.address
            ).call()

            if balance == 0:
                logger.warning("Oracle wallet has no registered agent")
                return None

            # No tokenOfOwnerByIndex on this contract — scan Transfer events
            # for mints (from=0x0) to the oracle wallet
            registry_addr = Web3.to_checksum_address(settings.erc8004_identity_registry)
            wallet_topic = "0x" + self._account.address.lower()[2:].zfill(64)
            zero_topic = "0x" + "0" * 64

            latest = self._w3.eth.block_number
            # Scan last 500k blocks (~1 week on C-Chain) in chunks
            from_block = max(0, latest - 500_000)
            chunk = 100_000

            for start in range(from_block, latest + 1, chunk):
                end = min(start + chunk - 1, latest)
                logs = self._w3.eth.get_logs({
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

    def submit_feedback(self, agent_id: int, score: int, comment: str) -> str | None:
        """
        Submit a reputation feedback transaction to the ReputationRegistry.

        Args:
            agent_id: The on-chain agent token ID to rate.
            score: Rating from 1-100.
            comment: Screening summary text (stored as feedbackURI).

        Returns:
            Transaction hash hex string on success, None on failure.
        """
        # Enforce rate limit
        now = time.monotonic()
        elapsed = now - self._last_tx_time
        if elapsed < TX_RATE_LIMIT_SECONDS:
            wait = TX_RATE_LIMIT_SECONDS - elapsed
            logger.debug(f"Rate limiting — waiting {wait:.1f}s before next tx")
            time.sleep(wait)

        # Clamp score to valid range
        score = max(1, min(100, score))

        # Build a deterministic task hash from the screening context
        task_hash_input = f"oracle-screening:{agent_id}:{int(time.time())}"
        task_hash = Web3.keccak(text=task_hash_input)

        # Use comment as the feedbackURI (short text, no IPFS needed for MVP)
        feedback_uri = comment[:256] if comment else "oracle-screening"

        try:
            nonce = self._w3.eth.get_transaction_count(self._account.address)
            gas_price = self._w3.eth.gas_price

            tx = self._reputation_registry.functions.submitFeedback(
                agent_id, score, feedback_uri, task_hash
            ).build_transaction({
                "from": self._account.address,
                "nonce": nonce,
                "gas": 200_000,
                "gasPrice": gas_price,
                "chainId": 43114,  # Avalanche C-Chain mainnet
            })

            signed = self._account.sign_transaction(tx)
            tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

            self._last_tx_time = time.monotonic()

            if receipt.status == 1:
                hex_hash = tx_hash.hex()
                logger.info(
                    f"On-chain feedback submitted — agent_id={agent_id} "
                    f"score={score} tx={hex_hash}"
                )
                return hex_hash
            else:
                logger.error(
                    f"Feedback tx reverted — agent_id={agent_id} tx={tx_hash.hex()}"
                )
                return None

        except Exception as e:
            self._last_tx_time = time.monotonic()
            logger.error(f"Failed to submit on-chain feedback for agent {agent_id}: {e}")
            return None


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
