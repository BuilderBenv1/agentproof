// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentFactory — Gasless Agent Launcher with Built-in Trust
 * @notice Registers ERC-8004 agents on SKALE and bakes in AgentProof trust checks.
 *         Every agent launched through this factory can verify counterparty trust
 *         on-chain before transacting — no integration required.
 *
 *         Flow: launch() → ERC-8004 register → oracle screens → agent is born with a score
 *         Agent-to-agent: agentA calls requireTrust(agentB) → reads TrustScoreOracle → pass/fail
 */

interface IIdentityRegistry {
    function register(string calldata agentURI) external payable returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

interface ITrustScoreOracle {
    function getScore(uint256 agentId) external view returns (uint16 compositeScore, uint8 tier, uint40 updatedAt);
}

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}

contract AgentFactory is IERC721Receiver {
    address public owner;
    IIdentityRegistry public immutable identityRegistry;
    ITrustScoreOracle public trustOracle;

    // Minimum tier required for agent-to-agent transactions (default: bronze = 1)
    uint8 public defaultMinTier;

    // Track all agents launched through this factory
    mapping(uint256 => bool) public isFactoryAgent;
    mapping(address => uint256[]) public agentsByOwner;
    uint256 public totalLaunched;

    // Per-agent custom trust thresholds (0 = use defaultMinTier)
    mapping(uint256 => uint8) public agentMinTier;

    event AgentLaunched(uint256 indexed agentId, address indexed owner, string agentURI);
    event TrustOracleUpdated(address indexed oldOracle, address indexed newOracle);
    event DefaultMinTierUpdated(uint8 oldTier, uint8 newTier);
    event AgentMinTierUpdated(uint256 indexed agentId, uint8 minTier);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    error NotOwner();
    error NotAgentOwner();
    error TrustCheckFailed(uint256 agentId, uint16 score, uint8 tier, uint8 requiredTier);
    error OracleNotSet();
    error AgentNotScored(uint256 agentId);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        address _identityRegistry,
        address _trustOracle,
        uint8 _defaultMinTier
    ) {
        owner = msg.sender;
        identityRegistry = IIdentityRegistry(_identityRegistry);
        trustOracle = ITrustScoreOracle(_trustOracle);
        defaultMinTier = _defaultMinTier;
    }

    // ─── Launch ─────────────────────────────────────────────────────────────

    /**
     * @notice Launch a new agent on ERC-8004 with built-in trust.
     * @param agentURI The metadata URI for the agent (HTTPS or IPFS).
     * @return agentId The ERC-8004 token ID of the newly registered agent.
     */
    function launch(string calldata agentURI) external returns (uint256 agentId) {
        agentId = identityRegistry.register(agentURI);

        isFactoryAgent[agentId] = true;
        agentsByOwner[msg.sender].push(agentId);
        totalLaunched++;

        emit AgentLaunched(agentId, msg.sender, agentURI);
    }

    // ─── Trust Handshake ────────────────────────────────────────────────────

    /**
     * @notice Check if an agent meets the trust threshold. Reverts if not.
     *         Call this before any agent-to-agent transaction.
     * @param agentId The ERC-8004 agent ID to check.
     */
    function requireTrust(uint256 agentId) public view {
        if (address(trustOracle) == address(0)) revert OracleNotSet();

        (uint16 score, uint8 tier, uint40 updatedAt) = trustOracle.getScore(agentId);

        if (updatedAt == 0) revert AgentNotScored(agentId);

        uint8 required = agentMinTier[agentId];
        if (required == 0) required = defaultMinTier;

        if (tier < required) {
            revert TrustCheckFailed(agentId, score, tier, required);
        }
    }

    /**
     * @notice Check trust without reverting. Returns true if agent meets threshold.
     */
    function checkTrust(uint256 agentId) external view returns (bool trusted, uint16 score, uint8 tier) {
        if (address(trustOracle) == address(0)) return (false, 0, 0);

        (score, tier,) = trustOracle.getScore(agentId);

        uint8 required = agentMinTier[agentId];
        if (required == 0) required = defaultMinTier;

        trusted = tier >= required;
    }

    /**
     * @notice Get the full trust profile for an agent.
     */
    function getTrustProfile(uint256 agentId) external view returns (
        uint16 compositeScore,
        uint8 tier,
        uint40 lastUpdated,
        bool isFactory,
        bool meetsTrust
    ) {
        if (address(trustOracle) != address(0)) {
            (compositeScore, tier, lastUpdated) = trustOracle.getScore(agentId);
        }
        isFactory = isFactoryAgent[agentId];

        uint8 required = agentMinTier[agentId];
        if (required == 0) required = defaultMinTier;
        meetsTrust = tier >= required;
    }

    // ─── Agent Owner Functions ──────────────────────────────────────────────

    /**
     * @notice Set a custom minimum tier for your agent's counterparty checks.
     */
    function setAgentMinTier(uint256 agentId, uint8 minTier) external {
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        agentMinTier[agentId] = minTier;
        emit AgentMinTierUpdated(agentId, minTier);
    }

    /**
     * @notice Get all agents launched by an owner through this factory.
     */
    function getAgentsByOwner(address _owner) external view returns (uint256[] memory) {
        return agentsByOwner[_owner];
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    function setTrustOracle(address _oracle) external onlyOwner {
        emit TrustOracleUpdated(address(trustOracle), _oracle);
        trustOracle = ITrustScoreOracle(_oracle);
    }

    function setDefaultMinTier(uint8 _tier) external onlyOwner {
        emit DefaultMinTierUpdated(defaultMinTier, _tier);
        defaultMinTier = _tier;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ─── ERC-721 Receiver ───────────────────────────────────────────────────

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
