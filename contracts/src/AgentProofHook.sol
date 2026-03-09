// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IACPHook.sol";
import "./interfaces/ITrustScoreOracle.sol";
import "./interfaces/IIdentityRegistry.sol";

/**
 * @title AgentProofHook — ERC-8183 Reputation-Gated Jobs
 * @notice An IACPHook implementation that gates provider assignment based on
 *         AgentProof trust scores and tracks job outcomes for off-chain indexing.
 *
 * Integration point: ERC-8183 (Agentic Commerce) + ERC-8004 (Agent Identity) + AgentProof Oracle
 *
 * beforeAction on setProvider:
 *   1. Resolves provider address → ERC-8004 agent ID via IdentityRegistry
 *   2. Reads trust score from TrustScoreOracle.viewScore()
 *   3. Reverts if score < minScore OR tier < minTier
 *
 * afterAction on complete/reject:
 *   1. Records job outcome (completed/rejected) per agent
 *   2. Emits JobOutcomeRecorded for off-chain indexing
 */
contract AgentProofHook is IACPHook, Ownable {

    // ─── External Dependencies ─────────────────────────────────────

    ITrustScoreOracle public oracle;
    IIdentityRegistry public identityRegistry;

    // ─── Configuration ─────────────────────────────────────────────

    uint16 public minScore;  // 0-10000 (e.g. 3000 = 30.00)
    uint8 public minTier;    // 0-5 (e.g. 1 = bronze minimum)

    // ─── Job Outcome Tracking ──────────────────────────────────────

    struct AgentJobStats {
        uint32 completed;
        uint32 rejected;
        uint40 lastJobAt;
    }

    mapping(uint256 => AgentJobStats) public agentStats;

    // ─── ERC-8183 Function Selectors ───────────────────────────────

    // setProvider(uint256 jobId, address provider)
    bytes4 private constant SEL_SET_PROVIDER = bytes4(keccak256("setProvider(uint256,address)"));
    // complete(uint256 jobId)
    bytes4 private constant SEL_COMPLETE = bytes4(keccak256("complete(uint256)"));
    // reject(uint256 jobId)
    bytes4 private constant SEL_REJECT = bytes4(keccak256("reject(uint256)"));

    // ─── Events ────────────────────────────────────────────────────

    event JobOutcomeRecorded(uint256 indexed agentId, uint256 indexed jobId, bool completed);
    event ProviderGated(uint256 indexed agentId, uint256 indexed jobId, uint16 score, uint8 tier);
    event MinScoreUpdated(uint16 oldMinScore, uint16 newMinScore);
    event MinTierUpdated(uint8 oldMinTier, uint8 newMinTier);
    event OracleUpdated(address oldOracle, address newOracle);
    event IdentityRegistryUpdated(address oldRegistry, address newRegistry);

    // ─── Errors ────────────────────────────────────────────────────

    error ScoreTooLow(uint256 agentId, uint16 score, uint16 required);
    error TierTooLow(uint256 agentId, uint8 tier, uint8 required);
    error AgentNotRegistered(address provider);
    error AgentNotScored(uint256 agentId);
    error ZeroAddress();

    // ─── Constructor ───────────────────────────────────────────────

    constructor(
        address _oracle,
        address _identityRegistry,
        uint16 _minScore,
        uint8 _minTier
    ) Ownable(msg.sender) {
        if (_oracle == address(0) || _identityRegistry == address(0)) revert ZeroAddress();
        oracle = ITrustScoreOracle(_oracle);
        identityRegistry = IIdentityRegistry(_identityRegistry);
        minScore = _minScore;
        minTier = _minTier;
    }

    // ─── IACPHook Implementation ───────────────────────────────────

    /**
     * @notice Called before a job action executes. Gates setProvider by trust score.
     */
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external override {
        if (selector == SEL_SET_PROVIDER) {
            // data = abi.encode(jobId, provider) — provider is the second param
            address provider = abi.decode(data[32:], (address));
            _gateProvider(jobId, provider);
        }
        // All other actions (fund, submit, claimRefund) pass through
    }

    /**
     * @notice Called after a job action executes. Records outcomes for complete/reject.
     */
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata data) external override {
        if (selector == SEL_COMPLETE) {
            address provider = abi.decode(data[32:], (address));
            _recordOutcome(jobId, provider, true);
        } else if (selector == SEL_REJECT) {
            address provider = abi.decode(data[32:], (address));
            _recordOutcome(jobId, provider, false);
        }
    }

    // ─── Internal ──────────────────────────────────────────────────

    /**
     * @dev Gate a provider assignment by checking their AgentProof trust score.
     */
    function _gateProvider(uint256 /* jobId */, address provider) internal view {
        // Resolve provider address → ERC-8004 agent ID
        uint256 balance = identityRegistry.balanceOf(provider);
        if (balance == 0) revert AgentNotRegistered(provider);

        uint256 agentId = identityRegistry.tokenOfOwnerByIndex(provider, 0);

        // Check trust score exists
        if (!oracle.hasScore(agentId)) revert AgentNotScored(agentId);

        // Read consensus score (free view call — no gas overhead)
        (uint16 score, uint8 tier, ) = oracle.viewScore(agentId);

        // Enforce minimum score
        if (score < minScore) revert ScoreTooLow(agentId, score, minScore);

        // Enforce minimum tier
        if (tier < minTier) revert TierTooLow(agentId, tier, minTier);

        // Note: ProviderGated event not emitted in view context
        // The escrow contract will emit its own setProvider event
    }

    /**
     * @dev Record a job outcome for an agent (completed or rejected).
     */
    function _recordOutcome(uint256 jobId, address provider, bool completed) internal {
        uint256 balance = identityRegistry.balanceOf(provider);
        if (balance == 0) return; // Silently skip unregistered providers

        uint256 agentId = identityRegistry.tokenOfOwnerByIndex(provider, 0);

        AgentJobStats storage stats = agentStats[agentId];
        if (completed) {
            stats.completed++;
        } else {
            stats.rejected++;
        }
        stats.lastJobAt = uint40(block.timestamp);

        emit JobOutcomeRecorded(agentId, jobId, completed);
    }

    // ─── Views ─────────────────────────────────────────────────────

    /**
     * @notice Get job completion stats for an agent.
     */
    function getAgentJobStats(uint256 agentId) external view returns (
        uint32 completed,
        uint32 rejected,
        uint40 lastJobAt
    ) {
        AgentJobStats storage s = agentStats[agentId];
        return (s.completed, s.rejected, s.lastJobAt);
    }

    /**
     * @notice Get job completion rate for an agent (0-10000, 2 decimal places).
     * @return rate Completion rate (e.g. 8500 = 85.00%), 0 if no jobs
     * @return totalJobs Total number of jobs (completed + rejected)
     */
    function getCompletionRate(uint256 agentId) external view returns (uint16 rate, uint32 totalJobs) {
        AgentJobStats storage s = agentStats[agentId];
        totalJobs = s.completed + s.rejected;
        if (totalJobs == 0) return (0, 0);
        rate = uint16((uint256(s.completed) * 10000) / totalJobs);
    }

    // ─── Admin ─────────────────────────────────────────────────────

    function setMinScore(uint16 _minScore) external onlyOwner {
        uint16 old = minScore;
        minScore = _minScore;
        emit MinScoreUpdated(old, _minScore);
    }

    function setMinTier(uint8 _minTier) external onlyOwner {
        require(_minTier <= 5, "Invalid tier");
        uint8 old = minTier;
        minTier = _minTier;
        emit MinTierUpdated(old, _minTier);
    }

    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert ZeroAddress();
        address old = address(oracle);
        oracle = ITrustScoreOracle(_oracle);
        emit OracleUpdated(old, _oracle);
    }

    function setIdentityRegistry(address _identityRegistry) external onlyOwner {
        if (_identityRegistry == address(0)) revert ZeroAddress();
        address old = address(identityRegistry);
        identityRegistry = IIdentityRegistry(_identityRegistry);
        emit IdentityRegistryUpdated(old, _identityRegistry);
    }
}
