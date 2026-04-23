// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Ownable.sol";
import "./interfaces/IACPHook.sol";
import "./interfaces/IACP.sol";
import "./interfaces/ITrustScoreOracle.sol";
import "./interfaces/IIdentityRegistry.sol";
import "./interfaces/IAttestationProvider.sol";

/**
 * @title AgentProofHook — ERC-ACP Profile A Reputation Gate
 * @notice An IACPHook implementation that gates provider assignment based on
 *         AgentProof trust scores and tracks job outcomes for off-chain indexing.
 *
 *         Conforms to the canonical ERC-ACP hook data encoding:
 *         https://github.com/dcrapis/ERC-ACP
 *
 * Integration point: ERC-ACP (Agentic Commerce) + ERC-8004 (Agent Identity) + AgentProof Oracle
 *
 * beforeAction on setProvider:
 *   data = abi.encode(address provider, bytes optParams)
 *   1. Resolves provider address → ERC-8004 agent ID via IdentityRegistry
 *   2. Reads trust score from TrustScoreOracle.viewScore()
 *   3. Reverts if score is stale (updatedAt + maxScoreAge < now)
 *   4. Reverts if score < minScore OR tier < minTier
 *   5. (Optional) Verifies credential attestation via IAttestationProvider
 *   6. Caches provider address for afterAction resolution
 *
 * afterAction on complete/reject:
 *   data = abi.encode(bytes32 reason, bytes optParams)
 *   1. Resolves provider via jobProviders cache or IACP.getJob()
 *   2. Records job outcome (completed/rejected) per agent
 *   3. Emits JobOutcomeRecorded for off-chain indexing
 */
contract AgentProofHook is IACPHook, Ownable {

    // ─── External Dependencies ─────────────────────────────────────

    ITrustScoreOracle public oracle;
    IIdentityRegistry public identityRegistry;
    IAttestationProvider public attestationProvider; // address(0) = disabled
    IACP public acp; // address(0) = provider resolution via cache only

    // ─── Configuration ─────────────────────────────────────────────

    uint16 public minScore;  // 0-10000 (e.g. 3000 = 30.00)
    uint8 public minTier;    // 0-5 (e.g. 1 = bronze minimum)
    uint40 public maxScoreAge; // seconds — 0 = no expiry check
    bytes32 public requiredAttestation; // condition hash for attestation check

    // ─── Job Outcome Tracking ──────────────────────────────────────

    struct AgentJobStats {
        uint32 completed;
        uint32 rejected;
        uint40 lastJobAt;
    }

    mapping(uint256 => AgentJobStats) public agentStats;

    /// @notice Provider cache — populated by beforeAction(setProvider),
    ///         read by afterAction(complete/reject) to resolve the provider
    ///         without requiring a second call to the ACP contract.
    mapping(uint256 => address) public jobProviders;

    // ─── ERC-ACP Function Selectors ─────────────────────────────────
    // Reference: https://github.com/dcrapis/ERC-ACP/blob/main/contracts/AgenticCommerce.sol

    // setProvider(uint256 jobId, address provider)
    bytes4 private constant SEL_SET_PROVIDER = bytes4(keccak256("setProvider(uint256,address)"));
    // complete(uint256 jobId, bytes32 reason)
    bytes4 private constant SEL_COMPLETE = bytes4(keccak256("complete(uint256,bytes32)"));
    // reject(uint256 jobId, bytes32 reason)
    bytes4 private constant SEL_REJECT = bytes4(keccak256("reject(uint256,bytes32)"));

    // ─── Events ────────────────────────────────────────────────────

    event JobOutcomeRecorded(uint256 indexed agentId, uint256 indexed jobId, bool completed);
    event ProviderGated(uint256 indexed agentId, uint256 indexed jobId, uint16 score, uint8 tier);
    event MinScoreUpdated(uint16 oldMinScore, uint16 newMinScore);
    event MinTierUpdated(uint8 oldMinTier, uint8 newMinTier);
    event OracleUpdated(address oldOracle, address newOracle);
    event IdentityRegistryUpdated(address oldRegistry, address newRegistry);
    event AttestationProviderUpdated(address oldProvider, address newProvider);
    event RequiredAttestationUpdated(bytes32 oldHash, bytes32 newHash);
    event MaxScoreAgeUpdated(uint40 oldMaxAge, uint40 newMaxAge);
    event ACPUpdated(address oldACP, address newACP);

    // ─── Errors ────────────────────────────────────────────────────

    error ScoreTooLow(uint256 agentId, uint16 score, uint16 required);
    error TierTooLow(uint256 agentId, uint8 tier, uint8 required);
    error AgentNotRegistered(address provider);
    error AgentNotScored(uint256 agentId);
    error AttestationFailed(address provider, bytes32 conditionHash);
    error ScoreExpired(uint256 agentId, uint40 updatedAt, uint40 maxAge);
    error ZeroAddress();

    // ─── Constructor ───────────────────────────────────────────────

    constructor(
        address _oracle,
        address _identityRegistry,
        uint16 _minScore,
        uint8 _minTier,
        uint40 _maxScoreAge,
        address _acp
    ) Ownable(msg.sender) {
        if (_oracle == address(0) || _identityRegistry == address(0)) revert ZeroAddress();
        oracle = ITrustScoreOracle(_oracle);
        identityRegistry = IIdentityRegistry(_identityRegistry);
        minScore = _minScore;
        minTier = _minTier;
        maxScoreAge = _maxScoreAge;
        acp = IACP(_acp); // address(0) = cache-only mode
    }

    // ─── IACPHook Implementation ───────────────────────────────────

    /**
     * @notice Called before a job action executes. Gates setProvider by trust score.
     *
     * ERC-ACP hook data encoding:
     *   setProvider: abi.encode(address provider, bytes optParams)
     */
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external override {
        if (selector == SEL_SET_PROVIDER) {
            // ERC-ACP canonical encoding: abi.encode(address provider, bytes optParams)
            // Provider is the first ABI-encoded param (bytes 0-31)
            (address provider, ) = abi.decode(data, (address, bytes));
            jobProviders[jobId] = provider;
            _gateProvider(provider);
        }
        // All other actions (fund, submit, claimRefund) pass through
    }

    /**
     * @notice Called after a job action executes. Records outcomes for complete/reject.
     *
     * ERC-ACP hook data encoding:
     *   complete: abi.encode(bytes32 reason, bytes optParams)
     *   reject:   abi.encode(bytes32 reason, bytes optParams)
     *
     * Provider is resolved from jobProviders cache (set during setProvider)
     * or via IACP.getJob() if an ACP contract reference is configured.
     */
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata) external override {
        if (selector == SEL_COMPLETE) {
            address provider = _resolveProvider(jobId);
            if (provider != address(0)) {
                _recordOutcome(jobId, provider, true);
            }
        } else if (selector == SEL_REJECT) {
            address provider = _resolveProvider(jobId);
            if (provider != address(0)) {
                _recordOutcome(jobId, provider, false);
            }
        }
    }

    // ─── Internal ──────────────────────────────────────────────────

    /**
     * @dev Resolve the provider for a job — cache first, then ACP fallback.
     */
    function _resolveProvider(uint256 jobId) internal view returns (address) {
        address provider = jobProviders[jobId];
        if (provider != address(0)) return provider;

        // Fallback: query ACP contract if configured
        if (address(acp) != address(0)) {
            (, , provider, , , , , ) = acp.getJob(jobId);
        }
        return provider;
    }

    /**
     * @dev Gate a provider assignment by checking their AgentProof trust score.
     */
    function _gateProvider(address provider) internal view {
        // Resolve provider address → ERC-8004 agent ID
        uint256 balance = identityRegistry.balanceOf(provider);
        if (balance == 0) revert AgentNotRegistered(provider);

        uint256 agentId = identityRegistry.tokenOfOwnerByIndex(provider, 0);

        // Check trust score exists
        if (!oracle.hasScore(agentId)) revert AgentNotScored(agentId);

        // Read consensus score (free view call — no gas overhead)
        (uint16 score, uint8 tier, uint40 updatedAt) = oracle.viewScore(agentId);

        // Enforce score freshness (0 = no expiry check)
        if (maxScoreAge > 0 && block.timestamp - updatedAt > maxScoreAge) {
            revert ScoreExpired(agentId, updatedAt, maxScoreAge);
        }

        // Enforce minimum score
        if (score < minScore) revert ScoreTooLow(agentId, score, minScore);

        // Enforce minimum tier
        if (tier < minTier) revert TierTooLow(agentId, tier, minTier);

        // Optional attestation check (e.g. InsumerAPI credential verification)
        if (address(attestationProvider) != address(0)) {
            if (!attestationProvider.verify(provider, requiredAttestation)) {
                revert AttestationFailed(provider, requiredAttestation);
            }
        }
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

    function setMaxScoreAge(uint40 _maxScoreAge) external onlyOwner {
        uint40 old = maxScoreAge;
        maxScoreAge = _maxScoreAge;
        emit MaxScoreAgeUpdated(old, _maxScoreAge);
    }

    function setAttestationProvider(address _provider) external onlyOwner {
        address old = address(attestationProvider);
        attestationProvider = IAttestationProvider(_provider); // address(0) disables
        emit AttestationProviderUpdated(old, _provider);
    }

    function setRequiredAttestation(bytes32 _conditionHash) external onlyOwner {
        bytes32 old = requiredAttestation;
        requiredAttestation = _conditionHash;
        emit RequiredAttestationUpdated(old, _conditionHash);
    }

    function setACP(address _acp) external onlyOwner {
        address old = address(acp);
        acp = IACP(_acp); // address(0) = cache-only mode
        emit ACPUpdated(old, _acp);
    }
}
