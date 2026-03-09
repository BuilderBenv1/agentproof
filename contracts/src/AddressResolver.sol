// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/ITrustScoreOracle.sol";
import "./interfaces/IIdentityRegistry.sol";

/**
 * @title AddressResolver — Address-to-AgentId Trust Score Adapter
 * @notice Thin resolution layer that bridges address-based oracle consumers
 *         (e.g. AsterPay KYA) with AgentProof's agentId-based ITrustScoreOracle.
 *
 *         address → IIdentityRegistry → agentId → ITrustScoreOracle → score
 *
 *         No logic beyond resolution. Reverts if address has no ERC-8004 identity.
 */
contract AddressResolver {

    ITrustScoreOracle public immutable oracle;
    IIdentityRegistry public immutable registry;

    error NotRegistered(address account);

    constructor(address _oracle, address _registry) {
        oracle = ITrustScoreOracle(_oracle);
        registry = IIdentityRegistry(_registry);
    }

    /**
     * @notice Resolve an address to its trust score via ERC-8004 identity.
     * @param account The wallet address to look up.
     * @return compositeScore 0-10000 score with 2 decimal places
     * @return tier 0-5 tier classification
     * @return updatedAt Timestamp of last score update
     */
    function getTrustScore(address account) external view returns (
        uint16 compositeScore,
        uint8 tier,
        uint40 updatedAt
    ) {
        if (registry.balanceOf(account) == 0) revert NotRegistered(account);
        uint256 agentId = registry.tokenOfOwnerByIndex(account, 0);
        return oracle.viewScore(agentId);
    }

    /**
     * @notice Check if an address meets a minimum trust score.
     * @param account The wallet address to check.
     * @param minScore Minimum score threshold (0-10000).
     * @return meets True if the address has a score >= minScore.
     */
    function meetsThreshold(address account, uint16 minScore) external view returns (bool meets) {
        if (registry.balanceOf(account) == 0) return false;
        uint256 agentId = registry.tokenOfOwnerByIndex(account, 0);
        if (!oracle.hasScore(agentId)) return false;
        (uint16 score, , ) = oracle.viewScore(agentId);
        return score >= minScore;
    }

    /**
     * @notice Resolve an address to its ERC-8004 agent ID.
     * @param account The wallet address to resolve.
     * @return agentId The ERC-8004 token ID.
     */
    function resolveAgentId(address account) external view returns (uint256 agentId) {
        if (registry.balanceOf(account) == 0) revert NotRegistered(account);
        return registry.tokenOfOwnerByIndex(account, 0);
    }
}
