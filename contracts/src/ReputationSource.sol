// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

// Same ITeleporter interfaces as ReputationBridge
interface ITeleporterMessengerSource {
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

interface ITeleporterReceiverSource {
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external;
}

interface IAgentProofCoreForSource {
    function getAgentProfile(uint256 agentId) external view returns (
        uint256, address, string memory, uint256, uint256, uint256, uint256, uint256, uint256
    );
}

/**
 * @title ReputationSource
 * @notice Deployed on C-Chain. Responds to ICM reputation requests from L1s
 *         by reading AgentProofCore and sending back reputation data.
 */
contract ReputationSource is ITeleporterReceiverSource, Ownable {

    IAgentProofCoreForSource public agentProofCore;
    ITeleporterMessengerSource public teleporterMessenger;

    // Whitelist of allowed L1 blockchain IDs
    mapping(bytes32 => bool) public allowedChains;

    uint256 public constant RESPONSE_GAS_LIMIT = 500_000;

    event ReputationRequestReceived(bytes32 indexed sourceChain, uint256 agentId);
    event ReputationResponseSent(bytes32 indexed destChain, uint256 agentId);

    constructor(
        address _agentProofCore,
        address _teleporterMessenger
    ) Ownable(msg.sender) {
        agentProofCore = IAgentProofCoreForSource(_agentProofCore);
        teleporterMessenger = ITeleporterMessengerSource(_teleporterMessenger);
    }

    // ─── Receive Request from L1 ──────────────────────────────

    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external override {
        require(msg.sender == address(teleporterMessenger), "Only Teleporter");
        require(allowedChains[sourceBlockchainID], "Chain not allowed");

        (string memory msgType, uint256 agentId) = abi.decode(message, (string, uint256));

        emit ReputationRequestReceived(sourceBlockchainID, agentId);

        if (keccak256(bytes(msgType)) == keccak256("REQUEST")) {
            _sendReputationResponse(sourceBlockchainID, originSenderAddress, agentId);
        }
    }

    // ─── Send Response ────────────────────────────────────────

    function _sendReputationResponse(
        bytes32 destChainID,
        address destAddress,
        uint256 agentId
    ) internal {
        (
            , , , uint256 feedbackCount, uint256 avgRating,
            uint256 validationSuccessRate, , ,
        ) = agentProofCore.getAgentProfile(agentId);

        string memory tier = _scoreTier(avgRating, feedbackCount);

        bytes memory response = abi.encode(
            agentId,
            avgRating,
            tier,
            feedbackCount,
            validationSuccessRate
        );

        address[] memory relayers = new address[](0);
        ITeleporterMessengerSource.TeleporterMessageInput memory input = ITeleporterMessengerSource.TeleporterMessageInput({
            destinationBlockchainID: destChainID,
            destinationAddress: destAddress,
            feeAmount: 0,
            requiredGasLimit: RESPONSE_GAS_LIMIT,
            allowedRelayerAddresses: relayers,
            message: response
        });

        teleporterMessenger.sendCrossChainMessage(input);
        emit ReputationResponseSent(destChainID, agentId);
    }

    function _scoreTier(uint256 score, uint256 feedback) internal pure returns (string memory) {
        if (score >= 90 && feedback >= 50) return "diamond";
        if (score >= 80 && feedback >= 30) return "platinum";
        if (score >= 70 && feedback >= 20) return "gold";
        if (score >= 60 && feedback >= 10) return "silver";
        if (score >= 50 && feedback >= 5) return "bronze";
        return "unranked";
    }

    // ─── Admin ────────────────────────────────────────────────

    function allowChain(bytes32 chainId) external onlyOwner {
        allowedChains[chainId] = true;
    }

    function disallowChain(bytes32 chainId) external onlyOwner {
        allowedChains[chainId] = false;
    }

    function setAgentProofCore(address _core) external onlyOwner {
        agentProofCore = IAgentProofCoreForSource(_core);
    }
}
