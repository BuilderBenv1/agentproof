// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/ITrustScoreOracle.sol";

/**
 * @title MockTrustScoreOracle — Test-only mock for TrustScoreOracle
 */
contract MockTrustScoreOracle is ITrustScoreOracle {
    struct Score {
        uint16 compositeScore;
        uint8 tier;
        uint40 updatedAt;
        bool exists;
    }

    mapping(uint256 => Score) private _scores;

    function setScore(uint256 agentId, uint16 compositeScore, uint8 tier) external {
        _scores[agentId] = Score(compositeScore, tier, uint40(block.timestamp), true);
    }

    function viewScore(uint256 agentId) external view override returns (
        uint16 compositeScore, uint8 tier, uint40 updatedAt
    ) {
        Score storage s = _scores[agentId];
        return (s.compositeScore, s.tier, s.updatedAt);
    }

    function hasScore(uint256 agentId) external view override returns (bool) {
        return _scores[agentId].exists;
    }
}
