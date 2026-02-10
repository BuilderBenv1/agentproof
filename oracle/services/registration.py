"""
Optional self-registration of the Trust Oracle as an ERC-8004 agent.
Called once during startup if SELF_REGISTER=True.
"""

import json
import logging
from web3 import Web3

from config import get_settings

logger = logging.getLogger(__name__)

ERC8004_REGISTER_ABI = json.loads("""[
    {"inputs":[{"name":"agentURI","type":"string"}],"name":"register","outputs":[{"type":"uint256"}],"stateMutability":"payable","type":"function"},
    {"inputs":[{"name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"}
]""")

# ERC-721 Transfer event topic for parsing minted token ID from receipt
TRANSFER_EVENT_TOPIC = Web3.keccak(text="Transfer(address,address,uint256)").hex()


def register_oracle_agent() -> int | None:
    """
    Register the Trust Oracle as an ERC-8004 agent on Avalanche.
    Returns the agent_id if successful, None otherwise.
    """
    settings = get_settings()

    if not settings.private_key:
        logger.warning("No PRIVATE_KEY configured — skipping self-registration")
        return None

    if not settings.erc8004_identity_registry:
        logger.warning("No ERC8004_IDENTITY_REGISTRY configured — skipping self-registration")
        return None

    w3 = Web3(Web3.HTTPProvider(settings.avalanche_rpc_url))
    if not w3.is_connected():
        logger.error("Cannot connect to Avalanche RPC — skipping self-registration")
        return None

    account = w3.eth.account.from_key(settings.private_key)
    registry = w3.eth.contract(
        address=Web3.to_checksum_address(settings.erc8004_identity_registry),
        abi=ERC8004_REGISTER_ABI,
    )

    # Check if already registered
    balance = registry.functions.balanceOf(account.address).call()
    if balance > 0:
        logger.info(f"Oracle wallet {account.address} already has {balance} agent(s) registered")
        return None

    # Use a short HTTPS URL instead of a base64 data URI.
    # The data URI was 809 chars and needed ~745k gas for on-chain string storage.
    # A short URL needs ~135k gas — 5x cheaper.
    agent_uri = f"{settings.oracle_base_url}/.well-known/agent.json"
    logger.info(f"Registering with URI: {agent_uri}")

    try:
        call = registry.functions.register(agent_uri)
        estimated_gas = call.estimate_gas({
            "from": account.address,
            "value": 0,
        })
        gas_limit = int(estimated_gas * 1.3)  # 30% buffer
        logger.info(f"Estimated gas: {estimated_gas}, using limit: {gas_limit}")

        tx = call.build_transaction(
            {
                "from": account.address,
                "value": 0,
                "nonce": w3.eth.get_transaction_count(account.address),
                "gas": gas_limit,
                "gasPrice": w3.eth.gas_price,
                "chainId": 43114,
            }
        )
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

        if receipt.status == 1:
            # Parse token ID from the ERC-721 Transfer event in the receipt
            agent_id = None
            for log in receipt.logs:
                if len(log.topics) >= 4 and log.topics[0].hex() == TRANSFER_EVENT_TOPIC:
                    agent_id = int(log.topics[3].hex(), 16)
                    break
            logger.info(
                f"Oracle agent registered! agent_id={agent_id} tx={tx_hash.hex()}"
            )
            return agent_id
        else:
            logger.error(f"Registration tx reverted: {tx_hash.hex()}")
            return None
    except Exception as e:
        logger.error(f"Self-registration failed: {e}")
        return None
