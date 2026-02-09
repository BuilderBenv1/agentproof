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
    {"inputs":[{"name":"agentURI","type":"string"}],"name":"registerAgent","outputs":[{"type":"uint256"}],"stateMutability":"payable","type":"function"},
    {"inputs":[{"name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"}
]""")


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

    # Build agent metadata as data URI
    metadata = {
        "name": settings.oracle_agent_name,
        "description": settings.oracle_agent_description,
        "version": settings.oracle_version,
        "category": "data",
        "type": "oracle",
        "protocols": ["rest", "a2a", "mcp"],
        "endpoints": {
            "rest": f"{settings.oracle_base_url}/api/v1",
            "a2a": f"{settings.oracle_base_url}/.well-known/agent.json",
            "mcp": f"{settings.oracle_base_url}/mcp",
        },
        "skills": [
            "evaluate_agent",
            "find_trusted_agents",
            "risk_check",
            "network_stats",
        ],
    }
    metadata_json = json.dumps(metadata)
    agent_uri = f"data:application/json;base64,{__import__('base64').b64encode(metadata_json.encode()).decode()}"

    try:
        tx = registry.functions.registerAgent(agent_uri).build_transaction(
            {
                "from": account.address,
                "value": w3.to_wei(0.1, "ether"),  # Registration bond
                "nonce": w3.eth.get_transaction_count(account.address),
                "gas": 300_000,
                "gasPrice": w3.eth.gas_price,
                "chainId": 43114,
            }
        )
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

        if receipt.status == 1:
            logger.info(
                f"Oracle agent registered successfully! tx={tx_hash.hex()}"
            )
            return receipt.status
        else:
            logger.error(f"Registration tx reverted: {tx_hash.hex()}")
            return None
    except Exception as e:
        logger.error(f"Self-registration failed: {e}")
        return None
