// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IACPHook.sol";
import "./interfaces/IACP.sol";
import "./interfaces/ITrustScoreOracle.sol";
import "./interfaces/IIdentityRegistry.sol";

/**
 * @title RiskAssessedHook — ERC-ACP Profile A Risk-Scaled Collateral Gate
 * @notice An IACPHook that scales collateral requirements inversely by trust score.
 *
 *         Unlike AgentProofHook (binary pass/fail), this hook is graduated:
 *         higher trust = lower collateral. It doesn't block agents — it prices their risk.
 *
 *         Implements ERC-ACP Hook Profile A Example #5 ("Risk-Assessed Jobs"):
 *         "hooks require staked collateral, check reputation scores, enforce bonds
 *          that get slashed on failed evaluations, or query external risk oracles."
 *
 * Flow:
 *   1. Provider stakes native token via stake()
 *   2. beforeAction(setProvider): calculates required collateral from trust tier + job budget,
 *      locks collateral from provider's staked balance
 *   3. afterAction(complete): releases locked collateral back to provider
 *   4. afterAction(reject): slashes locked collateral, transfers to slash recipient
 *   5. Provider unstakes unlocked collateral via unstake()
 */
contract RiskAssessedHook is IACPHook, Ownable, ReentrancyGuard {

    // ─── External Dependencies ─────────────────────────────────────

    ITrustScoreOracle public oracle;
    IIdentityRegistry public identityRegistry;
    IACP public acp;

    // ─── Configuration ─────────────────────────────────────────────

    uint40 public maxScoreAge;
    address public slashRecipient;

    // Tier → collateral basis points (10000 = 100%)
    mapping(uint8 => uint16) public collateralBps;

    // Tier → max job budget in wei
    mapping(uint8 => uint256) public maxExposure;

    // ─── Staking State ─────────────────────────────────────────────

    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public lockedBalance;

    // ─── Job State ─────────────────────────────────────────────────

    mapping(uint256 => address) public jobProviders;
    mapping(uint256 => uint256) public jobCollateral;
    mapping(uint256 => bool) public jobSettled;

    // ─── ERC-ACP Function Selectors ────────────────────────────────

    bytes4 private constant SEL_SET_PROVIDER = bytes4(keccak256("setProvider(uint256,address)"));
    bytes4 private constant SEL_COMPLETE = bytes4(keccak256("complete(uint256,bytes32)"));
    bytes4 private constant SEL_REJECT = bytes4(keccak256("reject(uint256,bytes32)"));

    // ─── Events ────────────────────────────────────────────────────

    event CollateralLocked(uint256 indexed agentId, uint256 indexed jobId, uint256 amount, uint256 budget, uint8 tier);
    event CollateralReleased(uint256 indexed agentId, uint256 indexed jobId, uint256 amount);
    event CollateralSlashed(uint256 indexed agentId, uint256 indexed jobId, uint256 amount);
    event Staked(address indexed provider, uint256 amount);
    event Unstaked(address indexed provider, uint256 amount);
    event CollateralBpsUpdated(uint8 tier, uint16 oldBps, uint16 newBps);
    event MaxExposureUpdated(uint8 tier, uint256 oldMax, uint256 newMax);
    event SlashRecipientUpdated(address oldRecipient, address newRecipient);
    event OracleUpdated(address oldOracle, address newOracle);
    event IdentityRegistryUpdated(address oldRegistry, address newRegistry);
    event ACPUpdated(address oldACP, address newACP);
    event MaxScoreAgeUpdated(uint40 oldMaxAge, uint40 newMaxAge);

    // ─── Errors ────────────────────────────────────────────────────

    error ExposureTooHigh(uint256 agentId, uint256 budget, uint256 maxAllowed);
    error InsufficientCollateral(address provider, uint256 required, uint256 available);
    error InsufficientBalance(uint256 requested, uint256 available);
    error AgentNotRegistered(address provider);
    error AgentNotScored(uint256 agentId);
    error ScoreExpired(uint256 agentId, uint40 updatedAt, uint40 maxAge);
    error JobAlreadySettled(uint256 jobId);
    error ZeroAddress();
    error ZeroAmount();

    // ─── Constructor ───────────────────────────────────────────────

    constructor(
        address _oracle,
        address _identityRegistry,
        address _acp,
        uint40 _maxScoreAge
    ) Ownable(msg.sender) {
        if (_oracle == address(0) || _identityRegistry == address(0) || _acp == address(0))
            revert ZeroAddress();

        oracle = ITrustScoreOracle(_oracle);
        identityRegistry = IIdentityRegistry(_identityRegistry);
        acp = IACP(_acp);
        maxScoreAge = _maxScoreAge;
        slashRecipient = msg.sender;

        // Default collateral bps (from ReputationGate)
        collateralBps[5] = 5000;  // Diamond: 50%
        collateralBps[4] = 6000;  // Platinum: 60%
        collateralBps[3] = 7500;  // Gold: 75%
        collateralBps[2] = 8500;  // Silver: 85%
        collateralBps[1] = 9500;  // Bronze: 95%
        collateralBps[0] = 10000; // Unranked: 100%

        // Default max exposure (native token)
        maxExposure[5] = 1000 ether;  // Diamond
        maxExposure[4] = 500 ether;   // Platinum
        maxExposure[3] = 100 ether;   // Gold
        maxExposure[2] = 10 ether;    // Silver
        maxExposure[1] = 1 ether;     // Bronze
        maxExposure[0] = 0.1 ether;   // Unranked
    }

    // ─── IACPHook Implementation ───────────────────────────────────

    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external override {
        if (selector == SEL_SET_PROVIDER) {
            (address provider, ) = abi.decode(data, (address, bytes));
            jobProviders[jobId] = provider;
            _assessAndLock(jobId, provider);
        }
    }

    function afterAction(uint256 jobId, bytes4 selector, bytes calldata) external override {
        if (selector == SEL_COMPLETE) {
            _settleJob(jobId, false);
        } else if (selector == SEL_REJECT) {
            _settleJob(jobId, true);
        }
    }

    // ─── Staking ───────────────────────────────────────────────────

    function stake() external payable {
        if (msg.value == 0) revert ZeroAmount();
        stakedBalance[msg.sender] += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 available = stakedBalance[msg.sender] - lockedBalance[msg.sender];
        if (amount > available) revert InsufficientBalance(amount, available);

        stakedBalance[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
        emit Unstaked(msg.sender, amount);
    }

    // ─── Views ─────────────────────────────────────────────────────

    function availableBalance(address provider) external view returns (uint256) {
        return stakedBalance[provider] - lockedBalance[provider];
    }

    /**
     * @notice Preview collateral requirement for a provider on a specific job.
     * @return required The collateral amount in wei
     * @return tier The provider's trust tier
     * @return budget The job budget from ACP
     */
    function getRequiredCollateral(uint256 jobId, address provider) external view returns (
        uint256 required, uint8 tier, uint256 budget
    ) {
        uint256 balance = identityRegistry.balanceOf(provider);
        if (balance == 0) return (0, 0, 0);

        uint256 agentId = identityRegistry.tokenOfOwnerByIndex(provider, 0);
        if (!oracle.hasScore(agentId)) return (0, 0, 0);

        (, tier, ) = oracle.viewScore(agentId);
        (, , , , , budget, , ) = acp.getJob(jobId);

        required = (budget * collateralBps[tier]) / 10000;
    }

    // ─── Internal ──────────────────────────────────────────────────

    function _assessAndLock(uint256 jobId, address provider) internal {
        // Resolve provider → agentId
        uint256 balance = identityRegistry.balanceOf(provider);
        if (balance == 0) revert AgentNotRegistered(provider);
        uint256 agentId = identityRegistry.tokenOfOwnerByIndex(provider, 0);

        // Check trust score exists
        if (!oracle.hasScore(agentId)) revert AgentNotScored(agentId);

        // Read score
        (, uint8 tier, uint40 updatedAt) = oracle.viewScore(agentId);

        // Enforce freshness
        if (maxScoreAge > 0 && block.timestamp - updatedAt > maxScoreAge) {
            revert ScoreExpired(agentId, updatedAt, maxScoreAge);
        }

        // Read job budget from ACP
        (, , , , , uint256 budget, , ) = acp.getJob(jobId);

        // Check max exposure for tier
        if (budget > maxExposure[tier]) {
            revert ExposureTooHigh(agentId, budget, maxExposure[tier]);
        }

        // Calculate required collateral
        uint256 required = (budget * collateralBps[tier]) / 10000;
        jobCollateral[jobId] = required;

        // Check available collateral
        uint256 available = stakedBalance[provider] - lockedBalance[provider];
        if (available < required) {
            revert InsufficientCollateral(provider, required, available);
        }

        // Lock collateral
        lockedBalance[provider] += required;

        emit CollateralLocked(agentId, jobId, required, budget, tier);
    }

    function _settleJob(uint256 jobId, bool slash) internal {
        if (jobSettled[jobId]) revert JobAlreadySettled(jobId);

        address provider = _resolveProvider(jobId);
        if (provider == address(0)) return;

        uint256 amount = jobCollateral[jobId];
        if (amount == 0) return;

        jobSettled[jobId] = true;

        uint256 agentId;
        uint256 bal = identityRegistry.balanceOf(provider);
        if (bal > 0) {
            agentId = identityRegistry.tokenOfOwnerByIndex(provider, 0);
        }

        if (slash) {
            // Slash: deduct from both locked and staked, transfer to recipient
            lockedBalance[provider] -= amount;
            stakedBalance[provider] -= amount;
            payable(slashRecipient).transfer(amount);
            emit CollateralSlashed(agentId, jobId, amount);
        } else {
            // Release: unlock collateral (stays in stakedBalance)
            lockedBalance[provider] -= amount;
            emit CollateralReleased(agentId, jobId, amount);
        }
    }

    function _resolveProvider(uint256 jobId) internal view returns (address) {
        address provider = jobProviders[jobId];
        if (provider != address(0)) return provider;

        (, , provider, , , , , ) = acp.getJob(jobId);
        return provider;
    }

    // ─── Admin ─────────────────────────────────────────────────────

    function setCollateralBps(uint8 tier, uint16 bps) external onlyOwner {
        require(tier <= 5, "Invalid tier");
        require(bps <= 10000, "Invalid bps");
        uint16 old = collateralBps[tier];
        collateralBps[tier] = bps;
        emit CollateralBpsUpdated(tier, old, bps);
    }

    function setMaxExposure(uint8 tier, uint256 maxBudget) external onlyOwner {
        require(tier <= 5, "Invalid tier");
        uint256 old = maxExposure[tier];
        maxExposure[tier] = maxBudget;
        emit MaxExposureUpdated(tier, old, maxBudget);
    }

    function setSlashRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        address old = slashRecipient;
        slashRecipient = _recipient;
        emit SlashRecipientUpdated(old, _recipient);
    }

    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert ZeroAddress();
        address old = address(oracle);
        oracle = ITrustScoreOracle(_oracle);
        emit OracleUpdated(old, _oracle);
    }

    function setIdentityRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        address old = address(identityRegistry);
        identityRegistry = IIdentityRegistry(_registry);
        emit IdentityRegistryUpdated(old, _registry);
    }

    function setACP(address _acp) external onlyOwner {
        if (_acp == address(0)) revert ZeroAddress();
        address old = address(acp);
        acp = IACP(_acp);
        emit ACPUpdated(old, _acp);
    }

    function setMaxScoreAge(uint40 _maxScoreAge) external onlyOwner {
        uint40 old = maxScoreAge;
        maxScoreAge = _maxScoreAge;
        emit MaxScoreAgeUpdated(old, _maxScoreAge);
    }
}
