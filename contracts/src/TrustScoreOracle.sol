// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TrustScoreOracle
 * @notice On-chain trust score oracle for the ERC-8004 agent ecosystem.
 *
 * The AgentProof oracle server pushes composite scores on-chain; integrating
 * protocols read them with a small per-query fee. Scores are the full 8-signal
 * Bayesian composite computed off-chain (more accurate than on-chain-only
 * averageRating from ReputationGate).
 *
 * Tier encoding: 0=unranked, 1=bronze, 2=silver, 3=gold, 4=platinum, 5=diamond
 * Score encoding: 0-10000 (divide by 100 for display, e.g. 6741 = 67.41)
 */
contract TrustScoreOracle is Ownable, Pausable {

    struct AgentScore {
        uint16 compositeScore;  // 0-10000 (2 decimal places)
        uint8 tier;             // 0-5
        uint40 updatedAt;       // block.timestamp (fits until year 36812)
    }

    mapping(uint256 => AgentScore) public scores;

    uint256 public queryFee;
    address public oracleUpdater;
    uint256 public totalUpdates;
    uint256 public totalQueries;

    event ScoreUpdated(uint256 indexed agentId, uint16 compositeScore, uint8 tier);
    event BatchUpdated(uint256 count);
    event QueryFeeChanged(uint256 oldFee, uint256 newFee);
    event OracleUpdaterChanged(address oldUpdater, address newUpdater);

    error InsufficientFee(uint256 required, uint256 provided);
    error NotAuthorized();
    error ScoreOutOfRange(uint16 score);
    error InvalidTier(uint8 tier);
    error LengthMismatch();

    constructor(address _updater, uint256 _queryFee) Ownable(msg.sender) {
        oracleUpdater = _updater;
        queryFee = _queryFee;
    }

    // ─── Read (paid) ──────────────────────────────────────────────────

    /**
     * @notice Get the trust score for an agent. Requires payment of queryFee.
     * @param agentId The ERC-8004 agent token ID
     * @return compositeScore 0-10000 (divide by 100 for display)
     * @return tier 0=unranked, 1=bronze, 2=silver, 3=gold, 4=platinum, 5=diamond
     * @return updatedAt Timestamp of last update
     */
    function getScore(uint256 agentId) external payable whenNotPaused returns (
        uint16 compositeScore, uint8 tier, uint40 updatedAt
    ) {
        if (msg.value < queryFee) revert InsufficientFee(queryFee, msg.value);
        totalQueries++;
        AgentScore storage s = scores[agentId];
        return (s.compositeScore, s.tier, s.updatedAt);
    }

    /**
     * @notice Check if a score exists for an agent (free view).
     */
    function hasScore(uint256 agentId) external view returns (bool) {
        return scores[agentId].updatedAt > 0;
    }

    /**
     * @notice Get score without paying (view-only, for off-chain reads).
     * @dev On-chain calls from other contracts should use getScore() and pay the fee.
     */
    function viewScore(uint256 agentId) external view returns (
        uint16 compositeScore, uint8 tier, uint40 updatedAt
    ) {
        AgentScore storage s = scores[agentId];
        return (s.compositeScore, s.tier, s.updatedAt);
    }

    // ─── Write (oracle only) ──────────────────────────────────────────

    /**
     * @notice Update the score for a single agent. Only callable by oracleUpdater.
     */
    function updateScore(uint256 agentId, uint16 compositeScore, uint8 tier) external {
        if (msg.sender != oracleUpdater) revert NotAuthorized();
        if (compositeScore > 10000) revert ScoreOutOfRange(compositeScore);
        if (tier > 5) revert InvalidTier(tier);

        scores[agentId] = AgentScore(compositeScore, tier, uint40(block.timestamp));
        totalUpdates++;
        emit ScoreUpdated(agentId, compositeScore, tier);
    }

    /**
     * @notice Batch update scores for multiple agents. Gas-efficient for periodic pushes.
     */
    function batchUpdateScores(
        uint256[] calldata agentIds,
        uint16[] calldata compositeScores,
        uint8[] calldata tiers
    ) external {
        if (msg.sender != oracleUpdater) revert NotAuthorized();
        if (agentIds.length != compositeScores.length || agentIds.length != tiers.length)
            revert LengthMismatch();

        for (uint256 i = 0; i < agentIds.length; i++) {
            if (compositeScores[i] > 10000) revert ScoreOutOfRange(compositeScores[i]);
            if (tiers[i] > 5) revert InvalidTier(tiers[i]);
            scores[agentIds[i]] = AgentScore(compositeScores[i], tiers[i], uint40(block.timestamp));
            emit ScoreUpdated(agentIds[i], compositeScores[i], tiers[i]);
        }
        totalUpdates += agentIds.length;
        emit BatchUpdated(agentIds.length);
    }

    // ─── Admin ────────────────────────────────────────────────────────

    function setQueryFee(uint256 _fee) external onlyOwner {
        uint256 old = queryFee;
        queryFee = _fee;
        emit QueryFeeChanged(old, _fee);
    }

    function setOracleUpdater(address _updater) external onlyOwner {
        address old = oracleUpdater;
        oracleUpdater = _updater;
        emit OracleUpdaterChanged(old, _updater);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @notice Withdraw to a specific address.
     */
    function withdrawTo(address payable to) external onlyOwner {
        to.transfer(address(this).balance);
    }
}
