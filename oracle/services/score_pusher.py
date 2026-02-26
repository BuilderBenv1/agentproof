"""
Score pusher — pushes composite scores on-chain to TrustScoreOracle contract.

Runs after each scoring cycle in the autonomous screener. Only pushes agents
whose scores changed by >= min_delta since last push. Batch updates in groups
of 50 to stay under gas limits.

Disabled by default (score_push_enabled = False in config). Enable after
deploying TrustScoreOracle and setting trust_score_oracle_address.
"""

import logging

from web3 import Web3

logger = logging.getLogger(__name__)

# Tier name → uint8 encoding for the contract
TIER_ENCODING = {
    "unranked": 0,
    "bronze": 1,
    "silver": 2,
    "gold": 3,
    "platinum": 4,
    "diamond": 5,
}

TRUST_SCORE_ORACLE_ABI = [
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "compositeScore", "type": "uint16"},
            {"name": "tier", "type": "uint8"},
        ],
        "name": "updateScore",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "agentIds", "type": "uint256[]"},
            {"name": "compositeScores", "type": "uint16[]"},
            {"name": "tiers", "type": "uint8[]"},
        ],
        "name": "batchUpdateScores",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]

# In-memory record of last pushed scores to detect deltas
_last_pushed: dict[int, float] = {}  # agent_id → last pushed composite_score

BATCH_SIZE = 50


def push_scores():
    """Push updated scores to the TrustScoreOracle contract.

    Called from the autonomous screener after a scoring cycle.
    Only pushes agents whose scores changed by >= min_delta.
    """
    from config import get_settings
    settings = get_settings()

    if not settings.score_push_enabled:
        return 0
    if not settings.trust_score_oracle_address:
        logger.warning("[ScorePusher] No trust_score_oracle_address configured")
        return 0
    if not settings.private_key:
        logger.warning("[ScorePusher] No private key configured for on-chain push")
        return 0

    min_delta = settings.score_push_min_delta

    # Connect to the correct chain
    rpc_url = settings.avalanche_rpc_url
    if settings.trust_score_oracle_chain == "base" and settings.base_rpc_url:
        rpc_url = settings.base_rpc_url

    try:
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            logger.error("[ScorePusher] Cannot connect to RPC: %s", rpc_url[:50])
            return 0
    except Exception as e:
        logger.error("[ScorePusher] RPC connection failed: %s", e)
        return 0

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(settings.trust_score_oracle_address),
        abi=TRUST_SCORE_ORACLE_ABI,
    )
    account = w3.eth.account.from_key(settings.private_key)

    # Fetch all scored agents from Supabase
    from database import get_supabase
    db = get_supabase()

    try:
        result = (
            db.table("agents")
            .select("agent_id, composite_score, tier")
            .gt("composite_score", 0)
            .order("composite_score", desc=True)
            .limit(5000)
            .execute()
        )
    except Exception as e:
        logger.error("[ScorePusher] Failed to fetch agents: %s", e)
        return 0

    if not result.data:
        return 0

    # Filter to agents with significant score changes
    to_push = []
    for agent in result.data:
        agent_id = agent["agent_id"]
        score = float(agent.get("composite_score") or 0)
        last = _last_pushed.get(agent_id, -999)

        if abs(score - last) >= min_delta:
            tier_name = agent.get("tier", "unranked")
            tier_uint8 = TIER_ENCODING.get(tier_name, 0)
            score_uint16 = min(10000, max(0, int(score * 100)))
            to_push.append((agent_id, score_uint16, tier_uint8, score))

    if not to_push:
        return 0

    logger.info("[ScorePusher] Pushing %d agent scores on-chain", len(to_push))

    pushed = 0
    for i in range(0, len(to_push), BATCH_SIZE):
        batch = to_push[i:i + BATCH_SIZE]
        ids = [b[0] for b in batch]
        scores_uint16 = [b[1] for b in batch]
        tiers_uint8 = [b[2] for b in batch]

        try:
            nonce = w3.eth.get_transaction_count(account.address)
            tx = contract.functions.batchUpdateScores(
                ids, scores_uint16, tiers_uint8
            ).build_transaction({
                "from": account.address,
                "nonce": nonce,
                "gas": 300_000 + 30_000 * len(batch),
                "maxFeePerGas": w3.eth.gas_price * 2,
                "maxPriorityFeePerGas": w3.to_wei(2, "gwei"),
            })
            signed = account.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

            if receipt.status == 1:
                pushed += len(batch)
                for b in batch:
                    _last_pushed[b[0]] = b[3]
                logger.info(
                    "[ScorePusher] Batch %d/%d pushed (%d agents), tx=%s",
                    i // BATCH_SIZE + 1,
                    (len(to_push) + BATCH_SIZE - 1) // BATCH_SIZE,
                    len(batch),
                    tx_hash.hex()[:16],
                )
            else:
                logger.error("[ScorePusher] Batch tx reverted: %s", tx_hash.hex())
        except Exception as e:
            logger.error("[ScorePusher] Batch push failed: %s", e)
            break

    return pushed
