// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IIdentityRegistryForSplits {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title AgentSplits
 * @notice Multi-agent revenue splits. Allows 2-10 agents to share revenue
 *         from tasks. Supports AVAX and ERC-20 tokens. Shares defined in
 *         basis points (BPS) that must sum to 10000.
 */
contract AgentSplits is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Split {
        uint256 splitId;
        uint256 creatorAgentId;
        uint256[] agentIds;
        uint256[] sharesBps;   // basis points, must sum to 10000
        bool isActive;
        uint256 createdAt;
    }

    struct SplitPayment {
        uint256 splitPaymentId;
        uint256 splitId;
        uint256 amount;
        address token;         // address(0) for AVAX
        bytes32 taskHash;
        address payer;
        bool distributed;
        uint256 createdAt;
        uint256 distributedAt;
    }

    IIdentityRegistryForSplits public identityRegistry;

    mapping(uint256 => Split) public splits;
    mapping(uint256 => SplitPayment) public splitPayments;

    // agentId => splitIds that include this agent
    mapping(uint256 => uint256[]) private _agentSplitIds;

    uint256 public nextSplitId = 1;
    uint256 public nextSplitPaymentId = 1;
    uint256 public protocolFeeBps = 50; // 0.5%
    address public treasury;

    // ─── Events ──────────────────────────────────────────────────

    event SplitCreated(uint256 indexed splitId, uint256 indexed creatorAgentId, uint256[] agentIds, uint256[] sharesBps);
    event SplitDeactivated(uint256 indexed splitId);
    event SplitPaymentReceived(uint256 indexed splitPaymentId, uint256 indexed splitId, uint256 amount, address token, address payer);
    event SplitDistributed(uint256 indexed splitPaymentId, uint256 indexed splitId, uint256[] amounts);

    // ─── Constructor ─────────────────────────────────────────────

    constructor(address _identityRegistry) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistryForSplits(_identityRegistry);
        treasury = msg.sender;
    }

    // ─── Create Split ────────────────────────────────────────────

    /**
     * @notice Create a new revenue split among 2-10 agents.
     * @param creatorAgentId The agent creating the split (must be in the list)
     * @param agentIds Array of agent IDs participating in the split
     * @param sharesBps Array of shares in basis points (must sum to 10000)
     */
    function createSplit(
        uint256 creatorAgentId,
        uint256[] calldata agentIds,
        uint256[] calldata sharesBps
    ) external whenNotPaused returns (uint256) {
        require(identityRegistry.ownerOf(creatorAgentId) == msg.sender, "Not agent owner");
        require(agentIds.length >= 2 && agentIds.length <= 10, "2-10 agents required");
        require(agentIds.length == sharesBps.length, "Array length mismatch");

        // Verify shares sum to 10000 and no duplicates
        uint256 totalBps = 0;
        for (uint256 i = 0; i < agentIds.length; i++) {
            require(sharesBps[i] > 0, "Share must be > 0");
            totalBps += sharesBps[i];

            // Check for duplicates
            for (uint256 j = i + 1; j < agentIds.length; j++) {
                require(agentIds[i] != agentIds[j], "Duplicate agent");
            }

            // Verify each agent exists (ownerOf will revert if not)
            identityRegistry.ownerOf(agentIds[i]);
        }
        require(totalBps == 10000, "Shares must sum to 10000 BPS");

        // Verify creator is in the agent list
        bool creatorFound = false;
        for (uint256 i = 0; i < agentIds.length; i++) {
            if (agentIds[i] == creatorAgentId) {
                creatorFound = true;
                break;
            }
        }
        require(creatorFound, "Creator must be a participant");

        uint256 splitId = nextSplitId++;

        // Copy arrays to storage
        splits[splitId].splitId = splitId;
        splits[splitId].creatorAgentId = creatorAgentId;
        splits[splitId].isActive = true;
        splits[splitId].createdAt = block.timestamp;

        for (uint256 i = 0; i < agentIds.length; i++) {
            splits[splitId].agentIds.push(agentIds[i]);
            splits[splitId].sharesBps.push(sharesBps[i]);
            _agentSplitIds[agentIds[i]].push(splitId);
        }

        emit SplitCreated(splitId, creatorAgentId, agentIds, sharesBps);
        return splitId;
    }

    /**
     * @notice Deactivate a split. Only the creator can deactivate.
     * @param splitId The split to deactivate
     */
    function deactivateSplit(uint256 splitId) external whenNotPaused {
        Split storage s = splits[splitId];
        require(s.splitId != 0, "Split does not exist");
        require(s.isActive, "Already inactive");
        require(identityRegistry.ownerOf(s.creatorAgentId) == msg.sender, "Not split creator");

        s.isActive = false;

        emit SplitDeactivated(splitId);
    }

    // ─── Payments ────────────────────────────────────────────────

    /**
     * @notice Send a payment to a split. Anyone can pay into a split.
     *         For AVAX, send value with the call. For ERC-20, approve first.
     * @param splitId The split to pay into
     * @param amount The payment amount (for ERC-20; for AVAX use msg.value)
     * @param token Token address (address(0) for AVAX)
     * @param taskHash Optional task reference hash
     */
    function payToSplit(
        uint256 splitId,
        uint256 amount,
        address token,
        bytes32 taskHash
    ) external payable whenNotPaused nonReentrant returns (uint256) {
        Split storage s = splits[splitId];
        require(s.splitId != 0, "Split does not exist");
        require(s.isActive, "Split inactive");

        if (token == address(0)) {
            require(msg.value > 0, "No AVAX sent");
            amount = msg.value;
        } else {
            require(msg.value == 0, "No AVAX for token payment");
            require(amount > 0, "Amount must be > 0");
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        uint256 paymentId = nextSplitPaymentId++;

        splitPayments[paymentId] = SplitPayment({
            splitPaymentId: paymentId,
            splitId: splitId,
            amount: amount,
            token: token,
            taskHash: taskHash,
            payer: msg.sender,
            distributed: false,
            createdAt: block.timestamp,
            distributedAt: 0
        });

        emit SplitPaymentReceived(paymentId, splitId, amount, token, msg.sender);
        return paymentId;
    }

    /**
     * @notice Distribute a split payment to all participants.
     *         Anyone can trigger distribution. Deducts protocol fee first.
     * @param splitPaymentId The payment to distribute
     */
    function distributeSplit(uint256 splitPaymentId) external whenNotPaused nonReentrant {
        SplitPayment storage p = splitPayments[splitPaymentId];
        require(p.splitPaymentId != 0, "Payment does not exist");
        require(!p.distributed, "Already distributed");

        Split storage s = splits[p.splitId];

        // Calculate protocol fee
        uint256 fee = (p.amount * protocolFeeBps) / 10000;
        uint256 distributable = p.amount - fee;

        // Transfer fee to treasury
        if (fee > 0) {
            _transfer(p.token, treasury, fee);
        }

        // Distribute to each agent owner per their BPS share
        uint256[] memory amounts = new uint256[](s.agentIds.length);
        uint256 distributed = 0;

        for (uint256 i = 0; i < s.agentIds.length; i++) {
            uint256 share;
            if (i == s.agentIds.length - 1) {
                // Last agent gets remainder to avoid rounding dust
                share = distributable - distributed;
            } else {
                share = (distributable * s.sharesBps[i]) / 10000;
            }

            amounts[i] = share;
            distributed += share;

            address recipient = identityRegistry.ownerOf(s.agentIds[i]);
            _transfer(p.token, recipient, share);
        }

        p.distributed = true;
        p.distributedAt = block.timestamp;

        emit SplitDistributed(splitPaymentId, p.splitId, amounts);
    }

    // ─── Views ───────────────────────────────────────────────────

    /**
     * @notice Get full split details.
     */
    function getSplit(uint256 splitId) external view returns (
        uint256, uint256, uint256[] memory, uint256[] memory, bool, uint256
    ) {
        Split storage s = splits[splitId];
        return (s.splitId, s.creatorAgentId, s.agentIds, s.sharesBps, s.isActive, s.createdAt);
    }

    /**
     * @notice Get full split payment details.
     */
    function getSplitPayment(uint256 splitPaymentId) external view returns (SplitPayment memory) {
        return splitPayments[splitPaymentId];
    }

    /**
     * @notice Get all split IDs for a given agent.
     */
    function getAgentSplits(uint256 agentId) external view returns (uint256[] memory) {
        return _agentSplitIds[agentId];
    }

    /**
     * @notice Get participant count and agent IDs for a split.
     */
    function getSplitParticipants(uint256 splitId) external view returns (uint256[] memory agentIds, uint256[] memory sharesBps) {
        Split storage s = splits[splitId];
        return (s.agentIds, s.sharesBps);
    }

    // ─── Internal ────────────────────────────────────────────────

    function _transfer(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool sent, ) = to.call{value: amount}("");
            require(sent, "AVAX transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    // ─── Admin ───────────────────────────────────────────────────

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

    // Allow contract to receive AVAX
    receive() external payable {}
}
