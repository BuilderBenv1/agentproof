// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IIdentityRegistry.sol";

/**
 * @title MockIdentityRegistry — Test-only mock for ERC-8004 IdentityRegistry
 */
contract MockIdentityRegistry is IIdentityRegistry {
    mapping(address => uint256) private _agentIds;
    mapping(address => bool) private _registered;
    mapping(uint256 => address) private _owners;

    function registerAgent(address owner_, uint256 agentId) external {
        _agentIds[owner_] = agentId;
        _registered[owner_] = true;
        _owners[agentId] = owner_;
    }

    function ownerOf(uint256 tokenId) external view override returns (address) {
        return _owners[tokenId];
    }

    function tokenOfOwnerByIndex(address owner_, uint256 /* index */) external view override returns (uint256) {
        require(_registered[owner_], "Not registered");
        return _agentIds[owner_];
    }

    function balanceOf(address owner_) external view override returns (uint256) {
        return _registered[owner_] ? 1 : 0;
    }
}
