// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IReputationGate {
    function requireMinimumTier(uint256 agentId, string calldata requiredTier) external view;
    function getCollateralMultiplier(uint256 agentId) external view returns (uint256);
    function getInterestRateDiscount(uint256 agentId) external view returns (uint256);
}

interface IIdentityRegistryForVault {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title ReputationGatedVault
 * @notice Example vault demonstrating reputation-gated DeFi integration.
 *         NOT for production — illustrates integration patterns.
 */
contract ReputationGatedVault is Ownable {
    using SafeERC20 for IERC20;

    IReputationGate public gate;
    IIdentityRegistryForVault public identityRegistry;
    IERC20 public depositToken;

    uint256 public baseInterestRate = 500; // 5% in basis points
    mapping(uint256 => uint256) public agentDeposits;
    mapping(uint256 => uint256) public agentBorrows;

    event Deposited(uint256 indexed agentId, uint256 amount, uint256 adjustedCollateral);
    event Borrowed(uint256 indexed agentId, uint256 amount, uint256 adjustedRate);
    event Withdrawn(uint256 indexed agentId, uint256 amount);
    event Repaid(uint256 indexed agentId, uint256 amount);

    constructor(
        address _gate,
        address _identityRegistry,
        address _depositToken
    ) Ownable(msg.sender) {
        gate = IReputationGate(_gate);
        identityRegistry = IIdentityRegistryForVault(_identityRegistry);
        depositToken = IERC20(_depositToken);
    }

    // Only agents with Silver+ can deposit
    function deposit(uint256 agentId, uint256 amount) external {
        require(identityRegistry.ownerOf(agentId) == msg.sender, "Not agent owner");
        gate.requireMinimumTier(agentId, "silver");

        uint256 multiplier = gate.getCollateralMultiplier(agentId);
        uint256 effectiveCollateral = (amount * 10000) / multiplier;

        depositToken.safeTransferFrom(msg.sender, address(this), amount);
        agentDeposits[agentId] += effectiveCollateral;

        emit Deposited(agentId, amount, effectiveCollateral);
    }

    // Only agents with Gold+ can borrow
    function borrow(uint256 agentId, uint256 amount) external {
        require(identityRegistry.ownerOf(agentId) == msg.sender, "Not agent owner");
        gate.requireMinimumTier(agentId, "gold");
        require(agentDeposits[agentId] >= amount, "Insufficient collateral");

        uint256 discount = gate.getInterestRateDiscount(agentId);
        uint256 adjustedRate = baseInterestRate - ((baseInterestRate * discount) / 10000);

        agentBorrows[agentId] += amount;
        depositToken.safeTransfer(msg.sender, amount);

        emit Borrowed(agentId, amount, adjustedRate);
    }

    function repay(uint256 agentId, uint256 amount) external {
        require(agentBorrows[agentId] >= amount, "Repaying too much");
        depositToken.safeTransferFrom(msg.sender, address(this), amount);
        agentBorrows[agentId] -= amount;
        emit Repaid(agentId, amount);
    }

    function withdraw(uint256 agentId, uint256 amount) external {
        require(identityRegistry.ownerOf(agentId) == msg.sender, "Not agent owner");
        require(agentDeposits[agentId] >= amount, "Insufficient deposit");
        require(agentBorrows[agentId] == 0, "Outstanding borrows");

        agentDeposits[agentId] -= amount;
        depositToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(agentId, amount);
    }

    function getAgentPosition(uint256 agentId) external view returns (uint256 deposited, uint256 borrowed) {
        return (agentDeposits[agentId], agentBorrows[agentId]);
    }
}
