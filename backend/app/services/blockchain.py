import json
import os
from web3 import Web3
from app.config import get_settings

# ABI fragments for the contracts (only the functions/events we need)
IDENTITY_REGISTRY_ABI = json.loads("""[
    {"inputs":[],"name":"totalAgents","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getAgentURI","outputs":[{"type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getAgentOwner","outputs":[{"type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"owner","type":"address"}],"name":"isRegistered","outputs":[{"type":"bool"}],"stateMutability":"view","type":"function"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":true,"name":"owner","type":"address"},{"name":"agentURI","type":"string"}],"name":"AgentRegistered","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"name":"newURI","type":"string"}],"name":"AgentURIUpdated","type":"event"}
]""")

REPUTATION_REGISTRY_ABI = json.loads("""[
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getFeedbackCount","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getAverageRating","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"},{"name":"index","type":"uint256"}],"name":"getFeedback","outputs":[{"components":[{"name":"reviewer","type":"address"},{"name":"rating","type":"uint8"},{"name":"feedbackURI","type":"string"},{"name":"taskHash","type":"bytes32"},{"name":"timestamp","type":"uint256"}],"type":"tuple"}],"stateMutability":"view","type":"function"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"agentId","type":"uint256"},{"indexed":true,"name":"reviewer","type":"address"},{"name":"rating","type":"uint8"},{"name":"taskHash","type":"bytes32"}],"name":"FeedbackSubmitted","type":"event"}
]""")

VALIDATION_REGISTRY_ABI = json.loads("""[
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getSuccessRate","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agentId","type":"uint256"}],"name":"getValidationCounts","outputs":[{"name":"total","type":"uint256"},{"name":"completed","type":"uint256"},{"name":"successful","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"validationId","type":"uint256"}],"name":"getValidation","outputs":[{"components":[{"name":"agentId","type":"uint256"},{"name":"taskHash","type":"bytes32"},{"name":"taskURI","type":"string"},{"name":"requester","type":"address"},{"name":"timestamp","type":"uint256"},{"name":"isCompleted","type":"bool"}],"type":"tuple"}],"stateMutability":"view","type":"function"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"validationId","type":"uint256"},{"indexed":true,"name":"agentId","type":"uint256"},{"name":"taskHash","type":"bytes32"}],"name":"ValidationRequested","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"validationId","type":"uint256"},{"indexed":true,"name":"validator","type":"address"},{"name":"isValid","type":"bool"}],"name":"ValidationSubmitted","type":"event"}
]""")


class BlockchainService:
    def __init__(self):
        settings = get_settings()
        self.w3 = Web3(Web3.HTTPProvider(settings.avalanche_rpc_url))

        self.identity_registry = None
        self.reputation_registry = None
        self.validation_registry = None

        if settings.identity_registry_address:
            self.identity_registry = self.w3.eth.contract(
                address=Web3.to_checksum_address(settings.identity_registry_address),
                abi=IDENTITY_REGISTRY_ABI,
            )
        if settings.reputation_registry_address:
            self.reputation_registry = self.w3.eth.contract(
                address=Web3.to_checksum_address(settings.reputation_registry_address),
                abi=REPUTATION_REGISTRY_ABI,
            )
        if settings.validation_registry_address:
            self.validation_registry = self.w3.eth.contract(
                address=Web3.to_checksum_address(settings.validation_registry_address),
                abi=VALIDATION_REGISTRY_ABI,
            )

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
        return self.identity_registry.events.AgentRegistered().get_logs(
            fromBlock=from_block, toBlock=to_block
        )

    def get_uri_update_events(self, from_block: int, to_block: int):
        if not self.identity_registry:
            return []
        return self.identity_registry.events.AgentURIUpdated().get_logs(
            fromBlock=from_block, toBlock=to_block
        )

    def get_feedback_events(self, from_block: int, to_block: int):
        if not self.reputation_registry:
            return []
        return self.reputation_registry.events.FeedbackSubmitted().get_logs(
            fromBlock=from_block, toBlock=to_block
        )

    def get_validation_requested_events(self, from_block: int, to_block: int):
        if not self.validation_registry:
            return []
        return self.validation_registry.events.ValidationRequested().get_logs(
            fromBlock=from_block, toBlock=to_block
        )

    def get_validation_submitted_events(self, from_block: int, to_block: int):
        if not self.validation_registry:
            return []
        return self.validation_registry.events.ValidationSubmitted().get_logs(
            fromBlock=from_block, toBlock=to_block
        )

    def get_agent_uri(self, agent_id: int) -> str:
        if not self.identity_registry:
            return ""
        return self.identity_registry.functions.getAgentURI(agent_id).call()

    def get_agent_owner(self, agent_id: int) -> str:
        if not self.identity_registry:
            return ""
        return self.identity_registry.functions.getAgentOwner(agent_id).call()

    def get_total_agents(self) -> int:
        if not self.identity_registry:
            return 0
        return self.identity_registry.functions.totalAgents().call()


_blockchain_service: BlockchainService | None = None


def get_blockchain_service() -> BlockchainService:
    global _blockchain_service
    if _blockchain_service is None:
        _blockchain_service = BlockchainService()
    return _blockchain_service
