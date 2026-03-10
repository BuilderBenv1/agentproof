"""
Cross-oracle verification — reads Agent402's on-chain scores and compares
with AgentProof's own scores. Pure on-chain verification, no off-chain communication.

AgentProof (Operator #1) uses this to verify consensus with Agent402 (Operator #2).
"""

import logging
from datetime import datetime, timezone

from web3 import Web3

logger = logging.getLogger(__name__)

# V2 contract ABI — read functions for cross-oracle verification
MULTI_ORACLE_READ_ABI = [
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "oracle", "type": "address"},
        ],
        "name": "getOracleScore",
        "outputs": [
            {"name": "compositeScore", "type": "uint16"},
            {"name": "tier", "type": "uint8"},
            {"name": "updatedAt", "type": "uint40"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "agentId", "type": "uint256"}],
        "name": "getConsensusScore",
        "outputs": [
            {"name": "avgScore", "type": "uint16"},
            {"name": "consensusTier", "type": "uint8"},
            {"name": "oracleCount", "type": "uint8"},
            {"name": "divergent", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
]

TIER_NAMES = {0: "unranked", 1: "bronze", 2: "silver", 3: "gold", 4: "platinum", 5: "diamond"}


class CrossOracleService:
    def __init__(self):
        from config import get_settings
        self.settings = get_settings()
        self._contracts: dict[str, any] = {}

    def _get_contract(self, chain: str = "avalanche"):
        """Get or create a web3 contract instance for the given chain."""
        if chain in self._contracts:
            return self._contracts[chain]

        if chain == "avalanche":
            rpc_url = self.settings.avalanche_rpc_url
            addr = self.settings.avax_oracle_address
        elif chain == "base":
            rpc_url = self.settings.base_rpc_url
            addr = self.settings.base_oracle_address
        else:
            return None

        if not rpc_url or not addr:
            return None

        w3 = Web3(Web3.HTTPProvider(rpc_url))
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(addr),
            abi=MULTI_ORACLE_READ_ABI,
        )
        self._contracts[chain] = contract
        return contract

    def verify_agent(self, agent_id: int, chain: str = "avalanche") -> dict | None:
        """Compare AgentProof's score with Agent402's on-chain score for one agent."""
        contract = self._get_contract(chain)
        if not contract:
            return None

        agent402_wallet = self.settings.agent402_oracle_wallet
        if not agent402_wallet:
            logger.debug("No agent402_oracle_wallet configured")
            return None

        try:
            # Read Agent402's (Op2) on-chain score
            op2_score, op2_tier, op2_updated = contract.functions.getOracleScore(
                agent_id, Web3.to_checksum_address(agent402_wallet)
            ).call()

            # Read AgentProof's (Op1) on-chain score (our own wallet)
            w3_tmp = Web3()
            account = w3_tmp.eth.account.from_key(self.settings.private_key)
            op1_score, op1_tier, op1_updated = contract.functions.getOracleScore(
                agent_id, account.address
            ).call()

            # Read consensus
            avg_score, consensus_tier, oracle_count, divergent = (
                contract.functions.getConsensusScore(agent_id).call()
            )

            delta = abs(op1_score - op2_score) / 100

            return {
                "agent_id": agent_id,
                "chain": chain,
                "agentproof_score": op1_score / 100,
                "agentproof_tier": TIER_NAMES.get(op1_tier, "unranked"),
                "agent402_score": op2_score / 100,
                "agent402_tier": TIER_NAMES.get(op2_tier, "unranked"),
                "delta": round(delta, 2),
                "divergent": divergent,
                "consensus_score": avg_score / 100,
                "consensus_tier": TIER_NAMES.get(consensus_tier, "unranked"),
                "oracle_count": oracle_count,
                "verified_at": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            logger.error(f"Cross-oracle verify failed for agent {agent_id}: {e}")
            return None


# Singleton
_cross_oracle_service: CrossOracleService | None = None


def get_cross_oracle_service() -> CrossOracleService:
    global _cross_oracle_service
    if _cross_oracle_service is None:
        _cross_oracle_service = CrossOracleService()
    return _cross_oracle_service
