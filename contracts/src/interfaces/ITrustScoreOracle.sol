// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITrustScoreOracle — Minimal interface for reading AgentProof trust scores
 * @notice Used by ERC-8183 hooks to gate job assignment based on agent reputation.
 *
 * Score encoding: 0-10000 (divide by 100 for display, e.g. 6741 = 67.41)
 * Tier encoding:  0=unranked, 1=bronze, 2=silver, 3=gold, 4=platinum, 5=diamond
 */
interface ITrustScoreOracle {
    /**
     * @notice Get consensus score without paying (view-only).
     * @param agentId The ERC-8004 agent token ID.
     * @return compositeScore 0-10000 score with 2 decimal places
     * @return tier 0-5 tier classification
     * @return updatedAt Timestamp of last score update
     */
    function viewScore(uint256 agentId) external view returns (
        uint16 compositeScore,
        uint8 tier,
        uint40 updatedAt
    );

    /**
     * @notice Check if a score exists for an agent.
     * @param agentId The ERC-8004 agent token ID.
     * @return True if the agent has been scored at least once.
     */
    function hasScore(uint256 agentId) external view returns (bool);
}
