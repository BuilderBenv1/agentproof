// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IIdentityRegistryForInsurance {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IValidationRegistryForInsurance {
    struct ValidationResponse {
        uint256 validationId;
        address validator;
        bool isValid;
        string proofURI;
        uint256 timestamp;
    }
    function getValidationResponse(uint256 validationId) external view returns (ValidationResponse memory);
}

/**
 * @title InsurancePool
 * @notice Agents stake collateral proportional to their reputation tier.
 *         Counterparties can file claims against agents that fail validated tasks.
 */
contract InsurancePool is Ownable, Pausable, ReentrancyGuard {

    enum ClaimStatus { Pending, Disputed, Approved, Rejected }

    struct Stake {
        uint256 amount;
        string tier;
        bool isStaked;
        uint256 stakedAt;
        uint256 unstakeRequestedAt;
    }

    struct Claim {
        uint256 claimId;
        uint256 agentId;
        address claimant;
        uint256 amount;
        uint256 validationId;
        string evidenceURI;
        string disputeURI;
        ClaimStatus status;
        uint256 filedAt;
        uint256 resolvedAt;
    }

    IIdentityRegistryForInsurance public identityRegistry;
    IValidationRegistryForInsurance public validationRegistry;

    mapping(uint256 => Stake) public agentStakes;
    mapping(uint256 => Claim) public claims;
    mapping(uint256 => uint256[]) public agentClaimIds;

    uint256 public nextClaimId = 1;
    uint256 public constant UNSTAKE_COOLDOWN = 7 days;
    uint256 public constant DISPUTE_WINDOW = 48 hours;

    event AgentStaked(uint256 indexed agentId, uint256 amount, string tier);
    event AgentUnstaked(uint256 indexed agentId, uint256 amount);
    event UnstakeRequested(uint256 indexed agentId, uint256 requestedAt);
    event ClaimFiled(uint256 indexed claimId, uint256 indexed agentId, address claimant, uint256 amount);
    event ClaimDisputed(uint256 indexed claimId);
    event ClaimResolved(uint256 indexed claimId, bool inFavorOfClaimant, uint256 amount);

    constructor(address _identityRegistry, address _validationRegistry) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistryForInsurance(_identityRegistry);
        validationRegistry = IValidationRegistryForInsurance(_validationRegistry);
    }

    // ─── Staking ──────────────────────────────────────────────

    function stakeForAgent(uint256 agentId, string calldata tier) external payable whenNotPaused nonReentrant {
        require(identityRegistry.ownerOf(agentId) == msg.sender, "Not agent owner");
        require(!agentStakes[agentId].isStaked, "Already staked");
        uint256 minStake = getMinimumStake(tier);
        require(msg.value >= minStake, "Below minimum stake for tier");

        agentStakes[agentId] = Stake({
            amount: msg.value,
            tier: tier,
            isStaked: true,
            stakedAt: block.timestamp,
            unstakeRequestedAt: 0
        });

        emit AgentStaked(agentId, msg.value, tier);
    }

    function requestUnstake(uint256 agentId) external {
        require(identityRegistry.ownerOf(agentId) == msg.sender, "Not agent owner");
        Stake storage stake = agentStakes[agentId];
        require(stake.isStaked, "Not staked");
        require(stake.unstakeRequestedAt == 0, "Already requested");
        require(!_hasPendingClaims(agentId), "Has pending claims");

        stake.unstakeRequestedAt = block.timestamp;
        emit UnstakeRequested(agentId, block.timestamp);
    }

    function unstake(uint256 agentId) external nonReentrant {
        require(identityRegistry.ownerOf(agentId) == msg.sender, "Not agent owner");
        Stake storage stake = agentStakes[agentId];
        require(stake.isStaked, "Not staked");
        require(stake.unstakeRequestedAt > 0, "Unstake not requested");
        require(block.timestamp >= stake.unstakeRequestedAt + UNSTAKE_COOLDOWN, "Cooldown not elapsed");
        require(!_hasPendingClaims(agentId), "Has pending claims");

        uint256 amount = stake.amount;
        delete agentStakes[agentId];

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");

        emit AgentUnstaked(agentId, amount);
    }

    // ─── Claims ───────────────────────────────────────────────

    function fileClaim(
        uint256 agentId,
        uint256 validationId,
        uint256 amount,
        string calldata evidenceURI
    ) external whenNotPaused {
        Stake storage stake = agentStakes[agentId];
        require(stake.isStaked, "Agent not staked");
        require(amount > 0 && amount <= stake.amount, "Invalid claim amount");

        // Verify the validation failed
        IValidationRegistryForInsurance.ValidationResponse memory resp = validationRegistry.getValidationResponse(validationId);
        require(!resp.isValid, "Validation did not fail");

        uint256 claimId = nextClaimId++;
        claims[claimId] = Claim({
            claimId: claimId,
            agentId: agentId,
            claimant: msg.sender,
            amount: amount,
            validationId: validationId,
            evidenceURI: evidenceURI,
            disputeURI: "",
            status: ClaimStatus.Pending,
            filedAt: block.timestamp,
            resolvedAt: 0
        });
        agentClaimIds[agentId].push(claimId);

        emit ClaimFiled(claimId, agentId, msg.sender, amount);
    }

    function disputeClaim(uint256 claimId, string calldata disputeURI) external {
        Claim storage claim = claims[claimId];
        require(claim.claimId != 0, "Claim does not exist");
        require(claim.status == ClaimStatus.Pending, "Not pending");
        require(block.timestamp <= claim.filedAt + DISPUTE_WINDOW, "Dispute window closed");
        require(identityRegistry.ownerOf(claim.agentId) == msg.sender, "Not agent owner");

        claim.status = ClaimStatus.Disputed;
        claim.disputeURI = disputeURI;

        emit ClaimDisputed(claimId);
    }

    function resolveClaim(uint256 claimId, bool inFavorOfClaimant) external onlyOwner nonReentrant {
        Claim storage claim = claims[claimId];
        require(claim.claimId != 0, "Claim does not exist");
        require(
            claim.status == ClaimStatus.Pending || claim.status == ClaimStatus.Disputed,
            "Already resolved"
        );

        claim.resolvedAt = block.timestamp;

        if (inFavorOfClaimant) {
            claim.status = ClaimStatus.Approved;
            Stake storage stake = agentStakes[claim.agentId];
            uint256 payout = claim.amount > stake.amount ? stake.amount : claim.amount;
            stake.amount -= payout;

            (bool sent, ) = claim.claimant.call{value: payout}("");
            require(sent, "Transfer failed");

            emit ClaimResolved(claimId, true, payout);
        } else {
            claim.status = ClaimStatus.Rejected;
            emit ClaimResolved(claimId, false, 0);
        }
    }

    // ─── Views ────────────────────────────────────────────────

    function getAgentStake(uint256 agentId) external view returns (uint256 stakedAmount, string memory tier, bool isStaked) {
        Stake storage s = agentStakes[agentId];
        return (s.amount, s.tier, s.isStaked);
    }

    function getMinimumStake(string memory tier) public pure returns (uint256) {
        bytes32 t = keccak256(abi.encodePacked(tier));
        if (t == keccak256("diamond")) return 0.05 ether;
        if (t == keccak256("platinum")) return 0.1 ether;
        if (t == keccak256("gold")) return 0.2 ether;
        if (t == keccak256("silver")) return 0.3 ether;
        if (t == keccak256("bronze")) return 0.5 ether;
        return 1 ether; // unranked
    }

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return claims[claimId];
    }

    function getAgentClaims(uint256 agentId) external view returns (uint256[] memory) {
        return agentClaimIds[agentId];
    }

    function isInsured(uint256 agentId) external view returns (bool) {
        return agentStakes[agentId].isStaked;
    }

    // ─── Internal ─────────────────────────────────────────────

    function _hasPendingClaims(uint256 agentId) internal view returns (bool) {
        uint256[] storage claimIds = agentClaimIds[agentId];
        for (uint256 i = 0; i < claimIds.length; i++) {
            ClaimStatus s = claims[claimIds[i]].status;
            if (s == ClaimStatus.Pending || s == ClaimStatus.Disputed) return true;
        }
        return false;
    }

    // ─── Admin ────────────────────────────────────────────────

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
