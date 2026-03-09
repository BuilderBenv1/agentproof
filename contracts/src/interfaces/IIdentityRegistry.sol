// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IIdentityRegistry — Minimal ERC-8004 identity registry interface
 * @notice Used by AgentProofHook to resolve wallet addresses to agent token IDs.
 *         Follows ERC-721 Enumerable patterns used by ERC-8004 IdentityRegistry.
 */
interface IIdentityRegistry {
    /**
     * @notice Get the owner of an agent token.
     */
    function ownerOf(uint256 tokenId) external view returns (address);

    /**
     * @notice Get the token ID at a given index for an owner.
     * @dev Used to resolve an address → agent ID (index 0 = primary agent).
     */
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);

    /**
     * @notice Get the number of agents owned by an address.
     */
    function balanceOf(address owner) external view returns (uint256);
}
