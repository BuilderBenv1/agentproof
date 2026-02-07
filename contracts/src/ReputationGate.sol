// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentProofCoreForGate {
    struct AgentProfile {
        uint256 agentId;
        address owner;
        string agentURI;
        uint256 feedbackCount;
        uint256 averageRating;
        uint256 validationSuccessRate;
        uint256 totalValidations;
        uint256 completedValidations;
        uint256 successfulValidations;
    }
    function getAgentProfile(uint256 agentId) external view returns (AgentProfile memory);
}

/**
 * @title ReputationGate
 * @notice Middleware contract for DeFi protocols to gate actions by agent reputation.
 *         Provides tier checks, collateral multipliers, interest rate discounts, and trust levels.
 */
contract ReputationGate {

    IAgentProofCoreForGate public agentProofCore;

    // Tier string hashes for comparison
    bytes32 constant DIAMOND = keccak256("diamond");
    bytes32 constant PLATINUM = keccak256("platinum");
    bytes32 constant GOLD = keccak256("gold");
    bytes32 constant SILVER = keccak256("silver");
    bytes32 constant BRONZE = keccak256("bronze");

    constructor(address _agentProofCore) {
        agentProofCore = IAgentProofCoreForGate(_agentProofCore);
    }

    // ─── Tier Gating ──────────────────────────────────────────

    function requireMinimumTier(uint256 agentId, string calldata requiredTier) external view {
        uint256 agentTierLevel = _getTierLevel(agentId);
        uint256 requiredLevel = _tierStringToLevel(requiredTier);
        require(agentTierLevel >= requiredLevel, "Agent does not meet minimum tier");
    }

    // ─── Collateral Multiplier ────────────────────────────────

    function getCollateralMultiplier(uint256 agentId) external view returns (uint256) {
        uint256 tierLevel = _getTierLevel(agentId);
        if (tierLevel >= 5) return 5000;  // Diamond: 50%
        if (tierLevel >= 4) return 6000;  // Platinum: 60%
        if (tierLevel >= 3) return 7500;  // Gold: 75%
        if (tierLevel >= 2) return 8500;  // Silver: 85%
        if (tierLevel >= 1) return 9500;  // Bronze: 95%
        return 10000;                      // Unranked: 100%
    }

    // ─── Interest Rate Discount ───────────────────────────────

    function getInterestRateDiscount(uint256 agentId) external view returns (uint256) {
        uint256 tierLevel = _getTierLevel(agentId);
        if (tierLevel >= 5) return 500;  // Diamond: 5%
        if (tierLevel >= 4) return 300;  // Platinum: 3%
        if (tierLevel >= 3) return 200;  // Gold: 2%
        if (tierLevel >= 2) return 100;  // Silver: 1%
        return 0;                         // Bronze/Unranked: 0%
    }

    // ─── Priority Score ───────────────────────────────────────

    function getPriorityScore(uint256 agentId) external view returns (uint256) {
        IAgentProofCoreForGate.AgentProfile memory profile = agentProofCore.getAgentProfile(agentId);
        if (profile.averageRating > 100) return 100;
        return profile.averageRating;
    }

    // ─── Batch Check ──────────────────────────────────────────

    function batchCheckTier(uint256[] calldata agentIds, string calldata requiredTier)
        external view returns (bool[] memory results)
    {
        uint256 requiredLevel = _tierStringToLevel(requiredTier);
        results = new bool[](agentIds.length);
        for (uint256 i = 0; i < agentIds.length; i++) {
            results[i] = _getTierLevel(agentIds[i]) >= requiredLevel;
        }
    }

    // ─── Trust for Value ──────────────────────────────────────

    function isTrustedForValue(uint256 agentId, uint256 valueAtRisk) external view returns (bool) {
        uint256 tierLevel = _getTierLevel(agentId);
        uint256 maxValue = _tierMaxValue(tierLevel);
        return valueAtRisk <= maxValue;
    }

    function getMaxTrustedValue(uint256 agentId) external view returns (uint256) {
        return _tierMaxValue(_getTierLevel(agentId));
    }

    // ─── Internal ─────────────────────────────────────────────

    function _getTierLevel(uint256 agentId) internal view returns (uint256) {
        IAgentProofCoreForGate.AgentProfile memory profile = agentProofCore.getAgentProfile(agentId);
        // Mirror the backend scoring tier thresholds
        if (profile.averageRating >= 90 && profile.feedbackCount >= 50) return 5; // Diamond
        if (profile.averageRating >= 80 && profile.feedbackCount >= 30) return 4; // Platinum
        if (profile.averageRating >= 70 && profile.feedbackCount >= 20) return 3; // Gold
        if (profile.averageRating >= 60 && profile.feedbackCount >= 10) return 2; // Silver
        if (profile.averageRating >= 50 && profile.feedbackCount >= 5) return 1;  // Bronze
        return 0; // Unranked
    }

    function _tierStringToLevel(string memory tier) internal pure returns (uint256) {
        bytes32 t = keccak256(abi.encodePacked(tier));
        if (t == DIAMOND) return 5;
        if (t == PLATINUM) return 4;
        if (t == GOLD) return 3;
        if (t == SILVER) return 2;
        if (t == BRONZE) return 1;
        return 0;
    }

    function _tierMaxValue(uint256 tierLevel) internal pure returns (uint256) {
        if (tierLevel >= 5) return 1_000_000e6;  // Diamond: 1M USDC
        if (tierLevel >= 4) return 500_000e6;     // Platinum: 500K
        if (tierLevel >= 3) return 100_000e6;     // Gold: 100K
        if (tierLevel >= 2) return 10_000e6;      // Silver: 10K
        if (tierLevel >= 1) return 1_000e6;       // Bronze: 1K
        return 100e6;                              // Unranked: $100
    }
}
