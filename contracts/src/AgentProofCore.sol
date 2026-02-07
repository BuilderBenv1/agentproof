// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IIdentityRegistryCore {
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function totalAgents() external view returns (uint256);
    function isRegistered(address owner) external view returns (bool);
}

interface IReputationRegistryCore {
    function getFeedbackCount(uint256 agentId) external view returns (uint256);
    function getAverageRating(uint256 agentId) external view returns (uint256);
}

interface IValidationRegistryCore {
    function getSuccessRate(uint256 agentId) external view returns (uint256);
    function getValidationCounts(uint256 agentId) external view returns (uint256, uint256, uint256);
}

/**
 * @title AgentProofCore
 * @notice Orchestrator contract that aggregates data from Identity, Reputation,
 *         and Validation registries. Provides convenience views for frontends/indexers.
 */
contract AgentProofCore is Ownable, Pausable, ReentrancyGuard {
    IIdentityRegistryCore public identityRegistry;
    IReputationRegistryCore public reputationRegistry;
    IValidationRegistryCore public validationRegistry;

    struct AgentProfile {
        uint256 agentId;
        address owner;
        string agentURI;
        uint256 feedbackCount;
        uint256 averageRating;
        uint256 validationSuccessRate;
        uint256 totalValidations;
        uint256 completedValidations;
        uint256 successfulValidations;
    }

    /// @notice agentId => category string
    mapping(uint256 => string) private _agentCategories;

    /// @notice category => array of agentIds
    mapping(string => uint256[]) private _categoryAgents;

    event RegistriesUpdated(address identity, address reputation, address validation);
    event AgentCategorySet(uint256 indexed agentId, string category);

    constructor(
        address _identityRegistry,
        address _reputationRegistry,
        address _validationRegistry
    ) Ownable(msg.sender) {
        require(_identityRegistry != address(0), "Invalid identity registry");
        require(_reputationRegistry != address(0), "Invalid reputation registry");
        require(_validationRegistry != address(0), "Invalid validation registry");

        identityRegistry = IIdentityRegistryCore(_identityRegistry);
        reputationRegistry = IReputationRegistryCore(_reputationRegistry);
        validationRegistry = IValidationRegistryCore(_validationRegistry);
    }

    /**
     * @notice Get a combined profile for an agent.
     * @param agentId The agent's token ID
     * @return profile The AgentProfile struct with all aggregated data
     */
    function getAgentProfile(uint256 agentId) external view returns (AgentProfile memory profile) {
        profile.agentId = agentId;
        profile.owner = identityRegistry.ownerOf(agentId);
        profile.agentURI = identityRegistry.tokenURI(agentId);
        profile.feedbackCount = reputationRegistry.getFeedbackCount(agentId);
        profile.averageRating = reputationRegistry.getAverageRating(agentId);
        profile.validationSuccessRate = validationRegistry.getSuccessRate(agentId);

        (uint256 total, uint256 completed, uint256 successful) = validationRegistry.getValidationCounts(agentId);
        profile.totalValidations = total;
        profile.completedValidations = completed;
        profile.successfulValidations = successful;
    }

    /**
     * @notice Get top agents by on-chain average rating.
     *         Note: For a production system, ranking should be done off-chain by the indexer.
     *         This function iterates on-chain and is gas-intensive for large agent counts.
     * @param count Maximum number of agents to return
     * @return agentIds Array of agent IDs sorted by average rating (descending)
     * @return ratings Array of corresponding average ratings
     */
    function getTopAgents(uint256 count) external view returns (
        uint256[] memory agentIds,
        uint256[] memory ratings
    ) {
        uint256 totalAgentsCount = identityRegistry.totalAgents();
        if (count > totalAgentsCount) {
            count = totalAgentsCount;
        }

        // Collect all agent ratings
        uint256[] memory allIds = new uint256[](totalAgentsCount);
        uint256[] memory allRatings = new uint256[](totalAgentsCount);

        for (uint256 i = 0; i < totalAgentsCount; i++) {
            uint256 id = i + 1;
            allIds[i] = id;
            allRatings[i] = reputationRegistry.getAverageRating(id);
        }

        // Simple selection sort for top N (acceptable for small datasets on testnet)
        for (uint256 i = 0; i < count; i++) {
            uint256 maxIdx = i;
            for (uint256 j = i + 1; j < totalAgentsCount; j++) {
                if (allRatings[j] > allRatings[maxIdx]) {
                    maxIdx = j;
                }
            }
            if (maxIdx != i) {
                (allIds[i], allIds[maxIdx]) = (allIds[maxIdx], allIds[i]);
                (allRatings[i], allRatings[maxIdx]) = (allRatings[maxIdx], allRatings[i]);
            }
        }

        // Copy top N results
        agentIds = new uint256[](count);
        ratings = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            agentIds[i] = allIds[i];
            ratings[i] = allRatings[i];
        }
    }

    /**
     * @notice Set the category for an agent. Only the agent owner can set this.
     * @param agentId The agent's token ID
     * @param category The category slug
     */
    function setAgentCategory(uint256 agentId, string calldata category) external {
        require(identityRegistry.ownerOf(agentId) == msg.sender, "Not agent owner");
        require(bytes(category).length > 0, "Category cannot be empty");

        // Remove from old category if exists
        string memory oldCategory = _agentCategories[agentId];
        if (bytes(oldCategory).length > 0) {
            _removeFromCategory(oldCategory, agentId);
        }

        _agentCategories[agentId] = category;
        _categoryAgents[category].push(agentId);

        emit AgentCategorySet(agentId, category);
    }

    /**
     * @notice Get agents in a specific category.
     * @param category The category slug
     * @return Array of agent IDs
     */
    function getAgentsByCategory(string calldata category) external view returns (uint256[] memory) {
        return _categoryAgents[category];
    }

    /**
     * @notice Get the category of an agent.
     * @param agentId The agent's token ID
     * @return The category slug
     */
    function getAgentCategory(uint256 agentId) external view returns (string memory) {
        return _agentCategories[agentId];
    }

    // --- Owner functions ---

    function updateRegistries(
        address _identityRegistry,
        address _reputationRegistry,
        address _validationRegistry
    ) external onlyOwner {
        require(_identityRegistry != address(0), "Invalid identity registry");
        require(_reputationRegistry != address(0), "Invalid reputation registry");
        require(_validationRegistry != address(0), "Invalid validation registry");

        identityRegistry = IIdentityRegistryCore(_identityRegistry);
        reputationRegistry = IReputationRegistryCore(_reputationRegistry);
        validationRegistry = IValidationRegistryCore(_validationRegistry);

        emit RegistriesUpdated(_identityRegistry, _reputationRegistry, _validationRegistry);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- Internal ---

    function _removeFromCategory(string memory category, uint256 agentId) internal {
        uint256[] storage agents = _categoryAgents[category];
        for (uint256 i = 0; i < agents.length; i++) {
            if (agents[i] == agentId) {
                agents[i] = agents[agents.length - 1];
                agents.pop();
                break;
            }
        }
    }
}
