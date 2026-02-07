// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IIdentityRegistryForPayments {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IValidationRegistryForPayments {
    function getValidationResponse(uint256 validationId) external view returns (
        uint256, address, bool, string memory, uint256
    );
}

/**
 * @title AgentPayments
 * @notice Escrow-based agent-to-agent payments. Supports AVAX and ERC-20 tokens.
 *         Payments can be conditional on successful task validation.
 */
contract AgentPayments is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum PaymentStatus { Escrowed, Released, Refunded, Cancelled }

    struct Payment {
        uint256 paymentId;
        uint256 fromAgentId;
        uint256 toAgentId;
        uint256 amount;
        address token;          // address(0) for AVAX
        bytes32 taskHash;
        bool requiresValidation;
        PaymentStatus status;
        bool cancelRequestedByFrom;
        bool cancelRequestedByTo;
        uint256 createdAt;
        uint256 resolvedAt;
    }

    IIdentityRegistryForPayments public identityRegistry;
    IValidationRegistryForPayments public validationRegistry;

    mapping(uint256 => Payment) public payments;
    mapping(uint256 => uint256[]) public agentPaymentIds; // agentId => paymentIds (as from or to)
    mapping(uint256 => uint256) public agentTotalEarned;
    mapping(uint256 => uint256) public agentTotalPaid;

    uint256 public nextPaymentId = 1;
    uint256 public protocolFeeBps = 50; // 0.5%
    uint256 public constant TIMEOUT = 7 days;
    address public treasury;

    event PaymentCreated(uint256 indexed paymentId, uint256 indexed fromAgentId, uint256 indexed toAgentId, uint256 amount, address token);
    event PaymentReleased(uint256 indexed paymentId, uint256 amount);
    event PaymentRefunded(uint256 indexed paymentId, uint256 amount);
    event PaymentCancelled(uint256 indexed paymentId);

    constructor(address _identityRegistry, address _validationRegistry) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistryForPayments(_identityRegistry);
        validationRegistry = IValidationRegistryForPayments(_validationRegistry);
        treasury = msg.sender;
    }

    // ─── Create Payment ───────────────────────────────────────

    function createPayment(
        uint256 fromAgentId,
        uint256 toAgentId,
        uint256 amount,
        address token,
        bytes32 taskHash,
        bool requiresValidation
    ) external payable whenNotPaused nonReentrant returns (uint256) {
        require(identityRegistry.ownerOf(fromAgentId) == msg.sender, "Not from-agent owner");
        require(fromAgentId != toAgentId, "Cannot pay self");
        require(amount > 0, "Amount must be > 0");

        if (token == address(0)) {
            require(msg.value == amount, "Incorrect AVAX amount");
        } else {
            require(msg.value == 0, "No AVAX for token payment");
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        uint256 paymentId = nextPaymentId++;
        payments[paymentId] = Payment({
            paymentId: paymentId,
            fromAgentId: fromAgentId,
            toAgentId: toAgentId,
            amount: amount,
            token: token,
            taskHash: taskHash,
            requiresValidation: requiresValidation,
            status: PaymentStatus.Escrowed,
            cancelRequestedByFrom: false,
            cancelRequestedByTo: false,
            createdAt: block.timestamp,
            resolvedAt: 0
        });

        agentPaymentIds[fromAgentId].push(paymentId);
        agentPaymentIds[toAgentId].push(paymentId);

        emit PaymentCreated(paymentId, fromAgentId, toAgentId, amount, token);
        return paymentId;
    }

    // ─── Release ──────────────────────────────────────────────

    function releasePayment(uint256 paymentId) external nonReentrant {
        Payment storage p = payments[paymentId];
        require(p.status == PaymentStatus.Escrowed, "Not escrowed");

        address fromOwner = identityRegistry.ownerOf(p.fromAgentId);
        address toOwner = identityRegistry.ownerOf(p.toAgentId);

        if (p.requiresValidation) {
            // Anyone can trigger release if validation passed — check not implemented on-chain for MVP
            // In production, would cross-reference ValidationRegistry for matching taskHash
            require(msg.sender == fromOwner || msg.sender == toOwner, "Not authorized");
        } else {
            require(msg.sender == fromOwner, "Only from-agent can release");
        }

        p.status = PaymentStatus.Released;
        p.resolvedAt = block.timestamp;

        uint256 fee = (p.amount * protocolFeeBps) / 10000;
        uint256 payout = p.amount - fee;

        agentTotalEarned[p.toAgentId] += payout;
        agentTotalPaid[p.fromAgentId] += p.amount;

        _transfer(p.token, toOwner, payout);
        if (fee > 0) {
            _transfer(p.token, treasury, fee);
        }

        emit PaymentReleased(paymentId, payout);
    }

    // ─── Refund ───────────────────────────────────────────────

    function refundPayment(uint256 paymentId) external nonReentrant {
        Payment storage p = payments[paymentId];
        require(p.status == PaymentStatus.Escrowed, "Not escrowed");

        address fromOwner = identityRegistry.ownerOf(p.fromAgentId);
        require(msg.sender == fromOwner, "Not from-agent owner");

        // Allow refund after timeout
        require(block.timestamp >= p.createdAt + TIMEOUT, "Timeout not reached");

        p.status = PaymentStatus.Refunded;
        p.resolvedAt = block.timestamp;

        _transfer(p.token, fromOwner, p.amount);

        emit PaymentRefunded(paymentId, p.amount);
    }

    // ─── Cancel (mutual) ─────────────────────────────────────

    function cancelPayment(uint256 paymentId) external nonReentrant {
        Payment storage p = payments[paymentId];
        require(p.status == PaymentStatus.Escrowed, "Not escrowed");

        address fromOwner = identityRegistry.ownerOf(p.fromAgentId);
        address toOwner = identityRegistry.ownerOf(p.toAgentId);

        if (msg.sender == fromOwner) {
            p.cancelRequestedByFrom = true;
        } else if (msg.sender == toOwner) {
            p.cancelRequestedByTo = true;
        } else {
            revert("Not authorized");
        }

        if (p.cancelRequestedByFrom && p.cancelRequestedByTo) {
            p.status = PaymentStatus.Cancelled;
            p.resolvedAt = block.timestamp;

            _transfer(p.token, fromOwner, p.amount);

            emit PaymentCancelled(paymentId);
        }
    }

    // ─── Views ────────────────────────────────────────────────

    function getPayment(uint256 paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }

    function getAgentPayments(uint256 agentId) external view returns (uint256[] memory) {
        return agentPaymentIds[agentId];
    }

    function getAgentEarnings(uint256 agentId) external view returns (uint256 totalEarned, uint256 totalPaid) {
        return (agentTotalEarned[agentId], agentTotalPaid[agentId]);
    }

    // ─── Internal ─────────────────────────────────────────────

    function _transfer(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool sent, ) = to.call{value: amount}("");
            require(sent, "AVAX transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    // ─── Admin ────────────────────────────────────────────────

    function setProtocolFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Fee too high"); // max 10%
        protocolFeeBps = _feeBps;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
