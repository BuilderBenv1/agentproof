// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ITeleporterMessenger
 * @notice Minimal interface for Avalanche ICM/Teleporter messaging.
 */
interface ITeleporterMessenger {
    struct TeleporterMessageInput {
        bytes32 destinationBlockchainID;
        address destinationAddress;
        uint256 feeAmount;
        uint256 requiredGasLimit;
        address[] allowedRelayerAddresses;
        bytes message;
    }
    function sendCrossChainMessage(TeleporterMessageInput calldata messageInput) external returns (bytes32);
}

interface ITeleporterReceiver {
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external;
}

/**
 * @title ReputationBridge
 * @notice Deployed on Avalanche L1s to consume AgentProof reputation from C-Chain via ICM.
 *         Caches reputation data for gas-efficient reads by L1 dApps.
 */
contract ReputationBridge is ITeleporterReceiver, Ownable {

    struct CachedReputation {
        uint256 agentId;
        uint256 compositeScore;
        string tier;
        uint256 totalFeedback;
        uint256 validationSuccessRate;
        uint256 lastUpdated;
        bool exists;
    }

    ITeleporterMessenger public teleporterMessenger;
    bytes32 public cChainBlockchainID;
    address public cChainReputationSource;

    mapping(uint256 => CachedReputation) public reputationCache;

    uint256 public constant DEFAULT_GAS_LIMIT = 500_000;

    event ReputationRequested(uint256 indexed agentId);
    event ReputationReceived(uint256 indexed agentId, uint256 compositeScore, string tier);

    constructor(
        address _teleporterMessenger,
        bytes32 _cChainBlockchainID,
        address _cChainReputationSource
    ) Ownable(msg.sender) {
        teleporterMessenger = ITeleporterMessenger(_teleporterMessenger);
        cChainBlockchainID = _cChainBlockchainID;
        cChainReputationSource = _cChainReputationSource;
    }

    // ─── Request Reputation ───────────────────────────────────

    function requestReputation(uint256 agentId) external {
        bytes memory message = abi.encode("REQUEST", agentId);

        address[] memory relayers = new address[](0);
        ITeleporterMessenger.TeleporterMessageInput memory input = ITeleporterMessenger.TeleporterMessageInput({
            destinationBlockchainID: cChainBlockchainID,
            destinationAddress: cChainReputationSource,
            feeAmount: 0,
            requiredGasLimit: DEFAULT_GAS_LIMIT,
            allowedRelayerAddresses: relayers,
            message: message
        });

        teleporterMessenger.sendCrossChainMessage(input);
        emit ReputationRequested(agentId);
    }

    // ─── Receive from C-Chain ─────────────────────────────────

    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external override {
        require(msg.sender == address(teleporterMessenger), "Only Teleporter");
        require(sourceBlockchainID == cChainBlockchainID, "Invalid source chain");
        require(originSenderAddress == cChainReputationSource, "Invalid source address");

        (
            uint256 agentId,
            uint256 compositeScore,
            string memory tier,
            uint256 totalFeedback,
            uint256 validationSuccessRate
        ) = abi.decode(message, (uint256, uint256, string, uint256, uint256));

        reputationCache[agentId] = CachedReputation({
            agentId: agentId,
            compositeScore: compositeScore,
            tier: tier,
            totalFeedback: totalFeedback,
            validationSuccessRate: validationSuccessRate,
            lastUpdated: block.timestamp,
            exists: true
        });

        emit ReputationReceived(agentId, compositeScore, tier);
    }

    // ─── Read Cached Data ─────────────────────────────────────

    function getReputation(uint256 agentId) external view returns (CachedReputation memory) {
        require(reputationCache[agentId].exists, "No cached reputation");
        return reputationCache[agentId];
    }

    function getTier(uint256 agentId) external view returns (string memory) {
        require(reputationCache[agentId].exists, "No cached reputation");
        return reputationCache[agentId].tier;
    }

    function getScore(uint256 agentId) external view returns (uint256) {
        require(reputationCache[agentId].exists, "No cached reputation");
        return reputationCache[agentId].compositeScore;
    }

    function isMinimumTier(uint256 agentId, string calldata requiredTier) external view returns (bool) {
        if (!reputationCache[agentId].exists) return false;
        uint256 cachedLevel = _tierToLevel(reputationCache[agentId].tier);
        uint256 requiredLevel = _tierToLevel(requiredTier);
        return cachedLevel >= requiredLevel;
    }

    function isReputationFresh(uint256 agentId, uint256 maxAge) external view returns (bool) {
        if (!reputationCache[agentId].exists) return false;
        return block.timestamp <= reputationCache[agentId].lastUpdated + maxAge;
    }

    // ─── Internal ─────────────────────────────────────────────

    function _tierToLevel(string memory tier) internal pure returns (uint256) {
        bytes32 t = keccak256(abi.encodePacked(tier));
        if (t == keccak256("diamond")) return 5;
        if (t == keccak256("platinum")) return 4;
        if (t == keccak256("gold")) return 3;
        if (t == keccak256("silver")) return 2;
        if (t == keccak256("bronze")) return 1;
        return 0;
    }

    // ─── Admin ────────────────────────────────────────────────

    function updateConfig(
        address _teleporter,
        bytes32 _chainId,
        address _source
    ) external onlyOwner {
        teleporterMessenger = ITeleporterMessenger(_teleporter);
        cChainBlockchainID = _chainId;
        cChainReputationSource = _source;
    }
}
