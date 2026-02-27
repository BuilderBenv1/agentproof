"""
Generic EVM chain indexer using raw httpx JSON-RPC calls.

Works with any EVM chain that has the ERC-8004 IdentityRegistry and
ReputationRegistry deployed at the standard CREATE2 addresses.
"""

import logging
from datetime import datetime, timezone

import httpx
from eth_abi import decode as abi_decode
from web3 import Web3

from app.services.blockchain import _RawEvent, _RawFeedbackEvent, _RawFeedbackArgs

logger = logging.getLogger(__name__)

# CREATE2 deterministic addresses (same on every mainnet)
IDENTITY_ADDR = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
REPUTATION_ADDR = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"

# Pre-computed event topic hashes
REGISTERED_TOPIC = "0x" + Web3.keccak(text="Registered(uint256,string,address)").hex()
NEW_FEEDBACK_TOPIC = "0x" + Web3.keccak(
    text="NewFeedback(uint256,address,uint64,int128,uint8,string,string,string,string,string,bytes32)"
).hex()

TIMEOUT = 30


def get_current_block(rpc_url: str) -> int:
    """Get the current block number from an RPC endpoint."""
    resp = httpx.post(
        rpc_url,
        json={"jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1},
        timeout=TIMEOUT,
    )
    data = resp.json()
    if "error" in data:
        raise Exception(f"eth_blockNumber error: {data['error']}")
    return int(data["result"], 16)


def get_block_timestamp(rpc_url: str, block_num: int) -> datetime:
    """Get block timestamp from an RPC endpoint."""
    resp = httpx.post(
        rpc_url,
        json={
            "jsonrpc": "2.0",
            "method": "eth_getBlockByNumber",
            "params": [hex(block_num), False],
            "id": 1,
        },
        timeout=TIMEOUT,
    )
    data = resp.json()
    if "error" in data or not data.get("result"):
        return datetime.now(timezone.utc)
    ts = int(data["result"]["timestamp"], 16)
    return datetime.fromtimestamp(ts, tz=timezone.utc)


def fetch_registered_events(
    rpc_url: str, from_block: int, to_block: int
) -> list:
    """Fetch Registered events from the ERC-8004 Identity Registry."""
    payload = {
        "jsonrpc": "2.0",
        "method": "eth_getLogs",
        "id": 1,
        "params": [
            {
                "address": IDENTITY_ADDR,
                "fromBlock": hex(from_block),
                "toBlock": hex(to_block),
                "topics": [REGISTERED_TOPIC],
            }
        ],
    }

    resp = httpx.post(rpc_url, json=payload, timeout=TIMEOUT)
    if resp.status_code != 200:
        raise Exception(f"eth_getLogs HTTP {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    if "error" in data:
        err_msg = data["error"].get("message", str(data["error"]))
        raise Exception(f"eth_getLogs RPC error: {err_msg}")

    events = []
    for log in data["result"]:
        try:
            agent_id = int(log["topics"][1], 16)
            owner = "0x" + log["topics"][2][-40:]
            data_bytes = bytes.fromhex(log["data"][2:])
            agent_uri = abi_decode(["string"], data_bytes)[0] if data_bytes else ""
            events.append(
                _RawEvent(
                    agentId=agent_id,
                    owner=Web3.to_checksum_address(owner),
                    agentURI=agent_uri,
                    blockNumber=int(log["blockNumber"], 16),
                    transactionHash=bytes.fromhex(log["transactionHash"][2:]),
                )
            )
        except Exception as e:
            logger.warning(f"Failed to decode identity log: {e}")

    return events


def fetch_feedback_events(
    rpc_url: str, from_block: int, to_block: int
) -> list:
    """Fetch NewFeedback events from the ERC-8004 Reputation Registry."""
    payload = {
        "jsonrpc": "2.0",
        "method": "eth_getLogs",
        "id": 1,
        "params": [
            {
                "address": REPUTATION_ADDR,
                "fromBlock": hex(from_block),
                "toBlock": hex(to_block),
                "topics": [NEW_FEEDBACK_TOPIC],
            }
        ],
    }

    resp = httpx.post(rpc_url, json=payload, timeout=TIMEOUT)
    if resp.status_code != 200:
        raise Exception(f"eth_getLogs HTTP {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    if "error" in data:
        err_msg = data["error"].get("message", str(data["error"]))
        raise Exception(f"eth_getLogs RPC error: {err_msg}")

    events = []
    for log in data["result"]:
        try:
            agent_id = int(log["topics"][1], 16)
            client_addr = "0x" + log["topics"][2][-40:]
            data_bytes = bytes.fromhex(log["data"][2:])
            decoded = abi_decode(
                ["uint64", "int128", "uint8", "string", "string", "string", "string", "bytes32"],
                data_bytes,
            )
            events.append(
                _RawFeedbackEvent(
                    _args=_RawFeedbackArgs(
                        agentId=agent_id,
                        clientAddress=Web3.to_checksum_address(client_addr),
                        value=int(decoded[1]),
                        feedbackHash=decoded[7],
                        tag1=decoded[3],
                        tag2=decoded[4],
                    ),
                    blockNumber=int(log["blockNumber"], 16),
                    transactionHash=bytes.fromhex(log["transactionHash"][2:]),
                )
            )
        except Exception as e:
            logger.warning(f"Failed to decode feedback log: {e}")

    return events
