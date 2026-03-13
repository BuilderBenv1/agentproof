// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ITrustScoreOracle.sol";

/**
 * @title ReputationGateV2 — Oracle-Backed Trust Gate for the Agent Economy
 * @author AgentProof (Synthesis Hackathon — "Agents that trust")
 * @notice Middleware contract that any protocol can use to gate agent actions
 *         by their AgentProof trust score. Reads directly from TrustScoreOracle.
 *
 *         Unlike V1 (which read from AgentProofCore), V2 reads from the
 *         multi-oracle TrustScoreOracle for consensus-based trust scores.
 *
 * Score encoding: 0-10000 (divide by 100 for display, e.g. 6741 = 67.41)
 * Tier encoding:  0=unranked, 1=bronze, 2=silver, 3=gold, 4=platinum, 5=diamond
 *
 * Usage by integrating contracts:
 *   ReputationGateV2 gate = ReputationGateV2(GATE_ADDRESS);
 *   gate.requireTrust(agentId);  // reverts if agent below threshold
 *   gate.isTrusted(agentId);     // returns bool
 *   gate.getMaxValue(agentId);   // returns max USDC value agent is trusted for
 */
contract ReputationGateV2 is Ownable {

    ITrustScoreOracle public oracle;

    uint16 public minScore;     // 0-10000 — minimum composite score to pass gate
    uint8  public minTier;      // 0-5 — minimum tier to pass gate
    uint40 public maxScoreAge;  // seconds — 0 = no freshness check

    // ─── Value Limits per Tier ──────────────────────────────────────
    // Configurable by owner. Defaults set in constructor.
    // Denominated in USDC base units (6 decimals).
    mapping(uint8 => uint256) public tierValueLimit;

    // ─── Events ─────────────────────────────────────────────────────

    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event ThresholdsUpdated(uint16 minScore, uint8 minTier, uint40 maxScoreAge);
    event TierValueLimitUpdated(uint8 indexed tier, uint256 limit);
    event AgentGated(uint256 indexed agentId, uint16 score, uint8 tier, bool passed);

    // ─── Errors ─────────────────────────────────────────────────────

    error ScoreBelowMinimum(uint256 agentId, uint16 score, uint16 required);
    error TierBelowMinimum(uint256 agentId, uint8 tier, uint8 required);
    error ScoreExpired(uint256 agentId, uint40 updatedAt, uint40 maxAge);
    error AgentNotScored(uint256 agentId);
    error ZeroAddress();

    // ─── Constructor ────────────────────────────────────────────────

    constructor(
        address _oracle,
        uint16 _minScore,
        uint8 _minTier,
        uint40 _maxScoreAge
    ) Ownable(msg.sender) {
        if (_oracle == address(0)) revert ZeroAddress();
        oracle = ITrustScoreOracle(_oracle);
        minScore = _minScore;
        minTier = _minTier;
        maxScoreAge = _maxScoreAge;

        // Default value limits per tier (USDC, 6 decimals)
        tierValueLimit[0] = 100e6;           // Unranked: $100
        tierValueLimit[1] = 1_000e6;         // Bronze: $1K
        tierValueLimit[2] = 10_000e6;        // Silver: $10K
        tierValueLimit[3] = 100_000e6;       // Gold: $100K
        tierValueLimit[4] = 500_000e6;       // Platinum: $500K
        tierValueLimit[5] = 1_000_000e6;     // Diamond: $1M
    }

    // ─── Core Gate Functions ────────────────────────────────────────

    /**
     * @notice Revert if the agent does not meet the minimum trust threshold.
     *         Call this from your contract to gate any action.
     */
    function requireTrust(uint256 agentId) external view {
        (uint16 score, uint8 tier, uint40 updatedAt) = oracle.viewScore(agentId);

        if (updatedAt == 0) revert AgentNotScored(agentId);

        if (maxScoreAge > 0 && block.timestamp - updatedAt > maxScoreAge) {
            revert ScoreExpired(agentId, updatedAt, maxScoreAge);
        }

        if (score < minScore) revert ScoreBelowMinimum(agentId, score, minScore);
        if (tier < minTier) revert TierBelowMinimum(agentId, tier, minTier);
    }

    /**
     * @notice Check if an agent meets the trust threshold (no revert).
     */
    function isTrusted(uint256 agentId) external view returns (bool) {
        (uint16 score, uint8 tier, uint40 updatedAt) = oracle.viewScore(agentId);

        if (updatedAt == 0) return false;
        if (maxScoreAge > 0 && block.timestamp - updatedAt > maxScoreAge) return false;
        if (score < minScore) return false;
        if (tier < minTier) return false;

        return true;
    }

    /**
     * @notice Get full trust assessment for an agent.
     * @return score The agent's composite score (0-10000)
     * @return tier The agent's tier (0-5)
     * @return trusted Whether the agent passes the gate
     * @return maxValue Maximum value the agent is trusted for (USDC base units)
     */
    function checkAgent(uint256 agentId) external view returns (
        uint16 score,
        uint8 tier,
        bool trusted,
        uint256 maxValue
    ) {
        uint40 updatedAt;
        (score, tier, updatedAt) = oracle.viewScore(agentId);

        trusted = updatedAt > 0
            && (maxScoreAge == 0 || block.timestamp - updatedAt <= maxScoreAge)
            && score >= minScore
            && tier >= minTier;

        maxValue = tierValueLimit[tier];
    }

    // ─── Value Gating ───────────────────────────────────────────────

    /**
     * @notice Check if an agent is trusted for a specific value amount.
     */
    function isTrustedForValue(uint256 agentId, uint256 valueAtRisk) external view returns (bool) {
        (uint16 score, uint8 tier, uint40 updatedAt) = oracle.viewScore(agentId);

        if (updatedAt == 0) return false;
        if (maxScoreAge > 0 && block.timestamp - updatedAt > maxScoreAge) return false;
        if (score < minScore) return false;
        if (tier < minTier) return false;

        return valueAtRisk <= tierValueLimit[tier];
    }

    /**
     * @notice Get maximum value an agent is trusted to handle.
     */
    function getMaxValue(uint256 agentId) external view returns (uint256) {
        (, uint8 tier, ) = oracle.viewScore(agentId);
        return tierValueLimit[tier];
    }

    // ─── Collateral Scaling ─────────────────────────────────────────

    /**
     * @notice Get collateral multiplier for an agent (basis points).
     *         Higher trust = lower collateral requirement.
     * @return multiplier 5000-10000 (50%-100% of face value)
     */
    function getCollateralMultiplier(uint256 agentId) external view returns (uint256 multiplier) {
        (, uint8 tier, ) = oracle.viewScore(agentId);

        if (tier >= 5) return 5000;   // Diamond: 50%
        if (tier >= 4) return 6000;   // Platinum: 60%
        if (tier >= 3) return 7500;   // Gold: 75%
        if (tier >= 2) return 8500;   // Silver: 85%
        if (tier >= 1) return 9500;   // Bronze: 95%
        return 10000;                  // Unranked: 100%
    }

    // ─── Batch Operations ───────────────────────────────────────────

    /**
     * @notice Check multiple agents against the trust threshold.
     */
    function batchCheckTrust(uint256[] calldata agentIds) external view returns (bool[] memory results) {
        results = new bool[](agentIds.length);
        for (uint256 i = 0; i < agentIds.length; i++) {
            (uint16 score, uint8 tier, uint40 updatedAt) = oracle.viewScore(agentIds[i]);
            results[i] = updatedAt > 0
                && (maxScoreAge == 0 || block.timestamp - updatedAt <= maxScoreAge)
                && score >= minScore
                && tier >= minTier;
        }
    }

    /**
     * @notice Filter a list of agents to only those that pass the gate.
     * @return trusted Array of agent IDs that pass
     * @return count Number of trusted agents
     */
    function filterTrusted(uint256[] calldata agentIds) external view returns (
        uint256[] memory trusted,
        uint256 count
    ) {
        trusted = new uint256[](agentIds.length);
        count = 0;
        for (uint256 i = 0; i < agentIds.length; i++) {
            (uint16 score, uint8 tier, uint40 updatedAt) = oracle.viewScore(agentIds[i]);
            bool passes = updatedAt > 0
                && (maxScoreAge == 0 || block.timestamp - updatedAt <= maxScoreAge)
                && score >= minScore
                && tier >= minTier;
            if (passes) {
                trusted[count] = agentIds[i];
                count++;
            }
        }
    }

    // ─── Admin ──────────────────────────────────────────────────────

    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert ZeroAddress();
        address old = address(oracle);
        oracle = ITrustScoreOracle(_oracle);
        emit OracleUpdated(old, _oracle);
    }

    function setThresholds(uint16 _minScore, uint8 _minTier, uint40 _maxScoreAge) external onlyOwner {
        require(_minScore <= 10000, "Score out of range");
        require(_minTier <= 5, "Tier out of range");
        minScore = _minScore;
        minTier = _minTier;
        maxScoreAge = _maxScoreAge;
        emit ThresholdsUpdated(_minScore, _minTier, _maxScoreAge);
    }

    function setTierValueLimit(uint8 _tier, uint256 _limit) external onlyOwner {
        require(_tier <= 5, "Invalid tier");
        tierValueLimit[_tier] = _limit;
        emit TierValueLimitUpdated(_tier, _limit);
    }
}
