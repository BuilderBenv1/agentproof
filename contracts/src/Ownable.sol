// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Ownable — minimal single-owner access control
 * @notice Inlined to avoid an OpenZeppelin npm dependency for this deploy target.
 *         Matches the OZ v5 Ownable ABI surface used by AgentProofHook:
 *           - owner() view
 *           - transferOwnership(address)
 *           - renounceOwnership()
 *           - OwnershipTransferred(address,address) event
 *           - onlyOwner modifier
 */
abstract contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);

    modifier onlyOwner() {
        if (msg.sender != _owner) revert OwnableUnauthorizedAccount(msg.sender);
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _transferOwnership(initialOwner);
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        if (newOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _transferOwnership(newOwner);
    }

    function renounceOwnership() public onlyOwner {
        _transferOwnership(address(0));
    }

    function _transferOwnership(address newOwner) internal {
        address old = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }
}
