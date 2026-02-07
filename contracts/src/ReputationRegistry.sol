// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IIdentityRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function totalAgents() external view returns (uint256);
}

/**
 * @title ReputationRegistry
 * @notice Stores on-chain feedback for AI agents. Anyone can submit ratings (1-100)
 *         with anti-gaming measures: no self-rating, 24h cooldown per reviewer per agent.
 */
contract ReputationRegistry is Ownable, Pausable, ReentrancyGuard {
    struct Feedback {
        address reviewer;
        uint8 rating;
        string feedbackURI;
        bytes32 taskHash;
        uint256 timestamp;
    }

    IIdentityRegistry public identityRegistry;

    /// @notice agentId => array of Feedback
    mapping(uint256 => Feedback[]) private _feedbacks;

    /// @notice agentId => cumulative rating sum (for average calculation)
    mapping(uint256 => uint256) private _ratingSum;

    /// @notice agentId => reviewer => last feedback timestamp (for rate limiting)
    mapping(uint256 => mapping(address => uint256)) private _lastFeedbackTime;

    uint256 public constant RATE_LIMIT_PERIOD = 24 hours;

    event FeedbackSubmitted(
        uint256 indexed agentId,
        address indexed reviewer,
        uint8 rating,
        bytes32 taskHash
    );

    constructor(address _identityRegistry) Ownable(msg.sender) {
        require(_identityRegistry != address(0), "Invalid registry address");
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    /**
     * @notice Submit feedback for an agent.
     * @param agentId The agent's token ID
     * @param rating Rating from 1 to 100
     * @param feedbackURI URI to detailed feedback (IPFS or HTTPS)
     * @param taskHash Hash of the task being reviewed
     */
    function submitFeedback(
        uint256 agentId,
        uint8 rating,
        string calldata feedbackURI,
        bytes32 taskHash
    ) external nonReentrant whenNotPaused {
        require(rating >= 1 && rating <= 100, "Rating must be 1-100");

        // Verify agent exists by calling ownerOf (reverts if not minted)
        address agentOwner = identityRegistry.ownerOf(agentId);
        require(agentOwner != msg.sender, "Cannot rate own agent");

        // Rate limiting: 1 feedback per reviewer per agent per 24h
        uint256 lastTime = _lastFeedbackTime[agentId][msg.sender];
        require(
            block.timestamp >= lastTime + RATE_LIMIT_PERIOD,
            "Rate limit: wait 24h between feedback"
        );

        _feedbacks[agentId].push(Feedback({
            reviewer: msg.sender,
            rating: rating,
            feedbackURI: feedbackURI,
            taskHash: taskHash,
            timestamp: block.timestamp
        }));

        _ratingSum[agentId] += rating;
        _lastFeedbackTime[agentId][msg.sender] = block.timestamp;

        emit FeedbackSubmitted(agentId, msg.sender, rating, taskHash);
    }

    /**
     * @notice Get the total number of feedback entries for an agent.
     * @param agentId The agent's token ID
     * @return count Total feedback count
     */
    function getFeedbackCount(uint256 agentId) external view returns (uint256) {
        return _feedbacks[agentId].length;
    }

    /**
     * @notice Get the average rating for an agent (0 if no feedback).
     * @param agentId The agent's token ID
     * @return average The average rating (1-100 scale)
     */
    function getAverageRating(uint256 agentId) external view returns (uint256) {
        uint256 count = _feedbacks[agentId].length;
        if (count == 0) return 0;
        return _ratingSum[agentId] / count;
    }

    /**
     * @notice Get a specific feedback entry.
     * @param agentId The agent's token ID
     * @param index The feedback index
     * @return The Feedback struct
     */
    function getFeedback(uint256 agentId, uint256 index) external view returns (Feedback memory) {
        require(index < _feedbacks[agentId].length, "Index out of bounds");
        return _feedbacks[agentId][index];
    }

    /**
     * @notice Get the cumulative rating sum for an agent (useful for off-chain calculations).
     * @param agentId The agent's token ID
     * @return The sum of all ratings
     */
    function getRatingSum(uint256 agentId) external view returns (uint256) {
        return _ratingSum[agentId];
    }

    // --- Owner functions ---

    function setIdentityRegistry(address _identityRegistry) external onlyOwner {
        require(_identityRegistry != address(0), "Invalid address");
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
