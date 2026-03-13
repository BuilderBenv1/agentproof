"""
Score pusher — pushes composite scores on-chain to TrustScoreOracle contracts.

Runs after each scoring cycle in the autonomous screener. Only pushes agents
whose scores changed by >= min_delta since last push. Batch updates in groups
of 50 to stay under gas limits.

Deploys on ALL configured chains (Avalanche, Base, Ethereum, Linea).
Each chain gets its own oracle contract and independent push cycle.

Disabled by default (score_push_enabled = False in config). Enable after
deploying TrustScoreOracle contracts and setting the *_oracle_address env vars.
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

# Per-chain record of last pushed scores to detect deltas
# chain_name → {agent_id → last_pushed_score}
_last_pushed: dict[str, dict[int, float]] = {}

BATCH_SIZE = 50


def _get_chain_configs(settings) -> list[dict]:
    """Build list of chain configs from settings. Only includes chains with
    both an RPC URL and an oracle address configured."""
    chains = []

    # Per-chain settings
    chain_defs = [
        ("avalanche", settings.avalanche_rpc_url, settings.avax_oracle_address),
        ("base", settings.base_rpc_url, settings.base_oracle_address),
        ("ethereum", settings.ethereum_rpc_url, settings.ethereum_oracle_address),
        ("linea", settings.linea_rpc_url, settings.linea_oracle_address),
    ]

    for name, rpc_url, oracle_addr in chain_defs:
        if rpc_url and oracle_addr:
            chains.append({"name": name, "rpc_url": rpc_url, "oracle_address": oracle_addr})

    # Legacy fallback: if no per-chain addresses set but old single-chain config exists
    if not chains and settings.trust_score_oracle_address:
        rpc_url = settings.avalanche_rpc_url
        if settings.trust_score_oracle_chain == "base" and settings.base_rpc_url:
            rpc_url = settings.base_rpc_url
        elif settings.trust_score_oracle_chain == "ethereum" and settings.ethereum_rpc_url:
            rpc_url = settings.ethereum_rpc_url
        elif settings.trust_score_oracle_chain == "linea" and settings.linea_rpc_url:
            rpc_url = settings.linea_rpc_url
        chains.append({
            "name": settings.trust_score_oracle_chain,
            "rpc_url": rpc_url,
            "oracle_address": settings.trust_score_oracle_address,
        })

    return chains


def _push_to_chain(chain_cfg: dict, agents_to_push: list[tuple], account, min_delta: float) -> int:
    """Push scores to a single chain. Returns number of agents successfully pushed."""
    chain_name = chain_cfg["name"]
    rpc_url = chain_cfg["rpc_url"]
    oracle_address = chain_cfg["oracle_address"]

    try:
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            logger.error("[ScorePusher:%s] Cannot connect to RPC: %s", chain_name, rpc_url[:50])
            return 0
    except Exception as e:
        logger.error("[ScorePusher:%s] RPC connection failed: %s", chain_name, e)
        return 0

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(oracle_address),
        abi=TRUST_SCORE_ORACLE_ABI,
    )

    # Filter to agents with significant score changes on THIS chain
    chain_last = _last_pushed.setdefault(chain_name, {})
    to_push = []
    for agent_id, score_uint16, tier_uint8, raw_score in agents_to_push:
        last = chain_last.get(agent_id, -999)
        if abs(raw_score - last) >= min_delta:
            to_push.append((agent_id, score_uint16, tier_uint8, raw_score))

    if not to_push:
        logger.info("[ScorePusher:%s] No agents with score delta >= %.1f — skipping", chain_name, min_delta)
        return 0

    logger.info("[ScorePusher:%s] Pushing %d agent scores on-chain", chain_name, len(to_push))

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
                    chain_last[b[0]] = b[3]
                logger.info(
                    "[ScorePusher:%s] Batch %d/%d pushed (%d agents), tx=%s",
                    chain_name,
                    i // BATCH_SIZE + 1,
                    (len(to_push) + BATCH_SIZE - 1) // BATCH_SIZE,
                    len(batch),
                    tx_hash.hex()[:16],
                )
            else:
                logger.error("[ScorePusher:%s] Batch tx reverted: %s", chain_name, tx_hash.hex())
        except Exception as e:
            logger.error("[ScorePusher:%s] Batch push failed: %s", chain_name, e)
            break

    return pushed


def push_scores():
    """Push updated scores to TrustScoreOracle contracts on all configured chains.

    Called from the autonomous screener after a scoring cycle.
    Only pushes agents whose scores changed by >= min_delta.
    """
    from config import get_settings
    settings = get_settings()

    if not settings.score_push_enabled:
        logger.info("[ScorePusher] Disabled (score_push_enabled=False)")
        return 0
    if not settings.private_key:
        logger.warning("[ScorePusher] No private key configured for on-chain push")
        return 0

    logger.info("[ScorePusher] Enabled — building chain configs...")
    chains = _get_chain_configs(settings)
    if not chains:
        logger.warning("[ScorePusher] No oracle addresses configured on any chain")
        logger.warning("[ScorePusher] avax=%s base=%s eth=%s linea=%s legacy=%s",
                       settings.avax_oracle_address, settings.base_oracle_address,
                       settings.ethereum_oracle_address, settings.linea_oracle_address,
                       settings.trust_score_oracle_address)
        return 0
    logger.info("[ScorePusher] Chains configured: %s", [c['name'] for c in chains])

    min_delta = settings.score_push_min_delta

    # Fetch all scored agents from Supabase (once, push to all chains)
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
        logger.warning("[ScorePusher] No agents with composite_score > 0 in Supabase")
        return 0
    logger.info("[ScorePusher] Found %d agents with scores to push", len(result.data))

    # Pre-encode all agents
    all_agents = []
    for agent in result.data:
        agent_id = agent["agent_id"]
        score = float(agent.get("composite_score") or 0)
        tier_name = agent.get("tier", "unranked")
        tier_uint8 = TIER_ENCODING.get(tier_name, 0)
        score_uint16 = min(10000, max(0, int(score * 100)))
        all_agents.append((agent_id, score_uint16, tier_uint8, score))

    # Shared wallet across all chains
    w3_tmp = Web3()
    account = w3_tmp.eth.account.from_key(settings.private_key)

    # Push to each chain
    total_pushed = 0
    for chain_cfg in chains:
        try:
            pushed = _push_to_chain(chain_cfg, all_agents, account, min_delta)
            total_pushed += pushed
            if pushed > 0:
                logger.info(
                    "[ScorePusher] %s: pushed %d scores", chain_cfg["name"], pushed
                )
        except Exception as e:
            logger.error(
                "[ScorePusher] %s: chain push failed: %s", chain_cfg["name"], e
            )

    return total_pushed
