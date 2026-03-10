// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TrustScoreOracle (V2 — Multi-Oracle)
 * @notice On-chain trust score oracle supporting multiple independent oracle operators.
 *
 * Each authorized oracle pushes composite scores independently. The contract
 * stores per-oracle scores and provides consensus views (average across oracles).
 * Divergence between oracles is detected on-chain and flagged automatically.
 *
 * Tier encoding: 0=unranked, 1=bronze, 2=silver, 3=gold, 4=platinum, 5=diamond
 * Score encoding: 0-10000 (divide by 100 for display, e.g. 6741 = 67.41)
 */
contract TrustScoreOracle is Ownable, Pausable {

    struct AgentScore {
        uint16 compositeScore;  // 0-10000 (2 decimal places)
        uint8 tier;             // 0-5
        uint40 updatedAt;       // block.timestamp
    }

    // ─── Multi-Oracle Storage ────────────────────────────────────────

    mapping(address => bool) public authorizedOracles;
    address[] public oracleList;
    mapping(address => string) public oracleNames;

    // Per-oracle scores: agentId => oracle => score
    mapping(uint256 => mapping(address => AgentScore)) public oracleScores;

    // Consensus view (latest write updates this as running average)
    mapping(uint256 => AgentScore) public scores;

    uint256 public queryFee;
    uint256 public totalUpdates;
    uint256 public totalQueries;
    uint16 public divergenceThreshold = 1000; // 10 points on 0-100 scale

    // ─── Events ──────────────────────────────────────────────────────

    event ScoreUpdated(uint256 indexed agentId, uint16 compositeScore, uint8 tier, address indexed oracle);
    event BatchUpdated(uint256 count, address indexed oracle);
    event QueryFeeChanged(uint256 oldFee, uint256 newFee);
    event OracleAdded(address indexed oracle, string name);
    event OracleRemoved(address indexed oracle);
    event DivergenceDetected(uint256 indexed agentId, uint16 score1, uint16 score2);
    event DivergenceThresholdChanged(uint16 oldThreshold, uint16 newThreshold);

    // ─── Errors ──────────────────────────────────────────────────────

    error InsufficientFee(uint256 required, uint256 provided);
    error NotAuthorized();
    error ScoreOutOfRange(uint16 score);
    error InvalidTier(uint8 tier);
    error LengthMismatch();
    error OracleAlreadyAuthorized();
    error OracleNotFound();

    // ─── Constructor ─────────────────────────────────────────────────

    constructor(address _initialOracle, uint256 _queryFee) Ownable(msg.sender) {
        queryFee = _queryFee;
        _addOracle(_initialOracle, "AgentProof");
    }

    // ─── Read (paid) ─────────────────────────────────────────────────

    /**
     * @notice Get the consensus trust score for an agent. Requires payment of queryFee.
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
     * @notice Get consensus score without paying (view-only, for off-chain reads).
     */
    function viewScore(uint256 agentId) external view returns (
        uint16 compositeScore, uint8 tier, uint40 updatedAt
    ) {
        AgentScore storage s = scores[agentId];
        return (s.compositeScore, s.tier, s.updatedAt);
    }

    /**
     * @notice Get a specific oracle's score for an agent (free view).
     */
    function getOracleScore(uint256 agentId, address oracle) external view returns (
        uint16 compositeScore, uint8 tier, uint40 updatedAt
    ) {
        AgentScore storage s = oracleScores[agentId][oracle];
        return (s.compositeScore, s.tier, s.updatedAt);
    }

    /**
     * @notice Get consensus score across all oracles with divergence detection.
     * @return avgScore Average of all oracle scores
     * @return consensusTier Tier of the average score
     * @return oracleCount Number of oracles that have scored this agent
     * @return divergent True if any two oracles differ by more than divergenceThreshold
     */
    function getConsensusScore(uint256 agentId) external view returns (
        uint16 avgScore, uint8 consensusTier, uint8 oracleCount, bool divergent
    ) {
        uint256 totalScore = 0;
        uint256 count = 0;
        uint16 minScore = type(uint16).max;
        uint16 maxScore = 0;

        for (uint256 i = 0; i < oracleList.length; i++) {
            AgentScore storage s = oracleScores[agentId][oracleList[i]];
            if (s.updatedAt > 0) {
                totalScore += s.compositeScore;
                count++;
                if (s.compositeScore < minScore) minScore = s.compositeScore;
                if (s.compositeScore > maxScore) maxScore = s.compositeScore;
            }
        }

        if (count == 0) {
            return (0, 0, 0, false);
        }

        avgScore = uint16(totalScore / count);
        consensusTier = _scoreTier(avgScore);
        oracleCount = uint8(count);
        divergent = (count > 1) && (maxScore - minScore > divergenceThreshold);
    }

    /**
     * @notice Get the number of authorized oracles.
     */
    function oracleCount() external view returns (uint256) {
        return oracleList.length;
    }

    // ─── Write (oracle only) ─────────────────────────────────────────

    /**
     * @notice Update the score for a single agent. Only callable by authorized oracles.
     */
    function updateScore(uint256 agentId, uint16 compositeScore, uint8 tier) external {
        if (!authorizedOracles[msg.sender]) revert NotAuthorized();
        if (compositeScore > 10000) revert ScoreOutOfRange(compositeScore);
        if (tier > 5) revert InvalidTier(tier);

        // Store per-oracle score
        oracleScores[agentId][msg.sender] = AgentScore(compositeScore, tier, uint40(block.timestamp));

        // Update consensus view
        _updateConsensus(agentId);

        totalUpdates++;
        emit ScoreUpdated(agentId, compositeScore, tier, msg.sender);
    }

    /**
     * @notice Batch update scores for multiple agents. Gas-efficient for periodic pushes.
     */
    function batchUpdateScores(
        uint256[] calldata agentIds,
        uint16[] calldata compositeScores,
        uint8[] calldata tiers
    ) external {
        if (!authorizedOracles[msg.sender]) revert NotAuthorized();
        if (agentIds.length != compositeScores.length || agentIds.length != tiers.length)
            revert LengthMismatch();

        for (uint256 i = 0; i < agentIds.length; i++) {
            if (compositeScores[i] > 10000) revert ScoreOutOfRange(compositeScores[i]);
            if (tiers[i] > 5) revert InvalidTier(tiers[i]);

            oracleScores[agentIds[i]][msg.sender] = AgentScore(
                compositeScores[i], tiers[i], uint40(block.timestamp)
            );

            // Update consensus and check divergence
            _updateConsensus(agentIds[i]);

            emit ScoreUpdated(agentIds[i], compositeScores[i], tiers[i], msg.sender);
        }
        totalUpdates += agentIds.length;
        emit BatchUpdated(agentIds.length, msg.sender);
    }

    // ─── Internal ────────────────────────────────────────────────────

    /**
     * @dev Recalculate consensus score for an agent from all oracle submissions.
     */
    function _updateConsensus(uint256 agentId) internal {
        uint256 totalScore = 0;
        uint256 count = 0;
        uint16 minScore = type(uint16).max;
        uint16 maxScore = 0;

        for (uint256 i = 0; i < oracleList.length; i++) {
            AgentScore storage s = oracleScores[agentId][oracleList[i]];
            if (s.updatedAt > 0) {
                totalScore += s.compositeScore;
                count++;
                if (s.compositeScore < minScore) minScore = s.compositeScore;
                if (s.compositeScore > maxScore) maxScore = s.compositeScore;
            }
        }

        if (count > 0) {
            uint16 avg = uint16(totalScore / count);
            scores[agentId] = AgentScore(avg, _scoreTier(avg), uint40(block.timestamp));

            // Emit divergence event if threshold exceeded
            if (count > 1 && (maxScore - minScore) > divergenceThreshold) {
                emit DivergenceDetected(agentId, minScore, maxScore);
            }
        }
    }

    /**
     * @dev Map a uint16 score (0-10000) to a tier (0-5).
     */
    function _scoreTier(uint16 score) internal pure returns (uint8) {
        if (score >= 9000) return 5; // diamond
        if (score >= 8000) return 4; // platinum
        if (score >= 7000) return 3; // gold
        if (score >= 6000) return 2; // silver
        if (score >= 5000) return 1; // bronze
        return 0; // unranked
    }

    function _addOracle(address oracle, string memory name) internal {
        authorizedOracles[oracle] = true;
        oracleList.push(oracle);
        oracleNames[oracle] = name;
        emit OracleAdded(oracle, name);
    }

    // ─── Admin ───────────────────────────────────────────────────────

    function addOracle(address oracle, string calldata name) external onlyOwner {
        if (authorizedOracles[oracle]) revert OracleAlreadyAuthorized();
        _addOracle(oracle, name);
    }

    function removeOracle(address oracle) external onlyOwner {
        if (!authorizedOracles[oracle]) revert OracleNotFound();
        authorizedOracles[oracle] = false;

        // Remove from oracleList array
        for (uint256 i = 0; i < oracleList.length; i++) {
            if (oracleList[i] == oracle) {
                oracleList[i] = oracleList[oracleList.length - 1];
                oracleList.pop();
                break;
            }
        }
        delete oracleNames[oracle];
        emit OracleRemoved(oracle);
    }

    function setQueryFee(uint256 _fee) external onlyOwner {
        uint256 old = queryFee;
        queryFee = _fee;
        emit QueryFeeChanged(old, _fee);
    }

    function setDivergenceThreshold(uint16 _threshold) external onlyOwner {
        uint16 old = divergenceThreshold;
        divergenceThreshold = _threshold;
        emit DivergenceThresholdChanged(old, _threshold);
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

    function withdrawTo(address payable to) external onlyOwner {
        to.transfer(address(this).balance);
    }
}
