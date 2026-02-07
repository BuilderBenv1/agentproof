// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IIdentityRegistryForValidation {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title ValidationRegistry
 * @notice Manages task validation requests and responses for AI agents.
 *         Anyone can request a validation, and validators can submit results.
 */
contract ValidationRegistry is Ownable, Pausable, ReentrancyGuard {
    struct ValidationRequest {
        uint256 agentId;
        bytes32 taskHash;
        string taskURI;
        address requester;
        uint256 timestamp;
        bool isCompleted;
    }

    struct ValidationResponse {
        uint256 validationId;
        address validator;
        bool isValid;
        string proofURI;
        uint256 timestamp;
    }

    IIdentityRegistryForValidation public identityRegistry;

    uint256 private _nextValidationId;

    /// @notice validationId => ValidationRequest
    mapping(uint256 => ValidationRequest) private _requests;

    /// @notice validationId => ValidationResponse
    mapping(uint256 => ValidationResponse) private _responses;

    /// @notice agentId => array of validationIds
    mapping(uint256 => uint256[]) private _agentValidations;

    /// @notice agentId => successful validation count
    mapping(uint256 => uint256) private _successCount;

    /// @notice agentId => total completed validation count
    mapping(uint256 => uint256) private _completedCount;

    event ValidationRequested(
        uint256 indexed validationId,
        uint256 indexed agentId,
        bytes32 taskHash
    );

    event ValidationSubmitted(
        uint256 indexed validationId,
        address indexed validator,
        bool isValid
    );

    constructor(address _identityRegistry) Ownable(msg.sender) {
        require(_identityRegistry != address(0), "Invalid registry address");
        identityRegistry = IIdentityRegistryForValidation(_identityRegistry);
        _nextValidationId = 1;
    }

    /**
     * @notice Request validation for an agent's task.
     * @param agentId The agent's token ID
     * @param taskHash Hash of the task to validate
     * @param taskURI URI with task details
     * @return validationId The new validation request ID
     */
    function requestValidation(
        uint256 agentId,
        bytes32 taskHash,
        string calldata taskURI
    ) external nonReentrant whenNotPaused returns (uint256) {
        // Verify agent exists
        identityRegistry.ownerOf(agentId);

        uint256 validationId = _nextValidationId;
        _nextValidationId++;

        _requests[validationId] = ValidationRequest({
            agentId: agentId,
            taskHash: taskHash,
            taskURI: taskURI,
            requester: msg.sender,
            timestamp: block.timestamp,
            isCompleted: false
        });

        _agentValidations[agentId].push(validationId);

        emit ValidationRequested(validationId, agentId, taskHash);
        return validationId;
    }

    /**
     * @notice Submit a validation response for a pending request.
     * @param validationId The validation request ID
     * @param isValid Whether the task was valid
     * @param proofURI URI to validation proof
     */
    function submitValidation(
        uint256 validationId,
        bool isValid,
        string calldata proofURI
    ) external nonReentrant whenNotPaused {
        ValidationRequest storage request = _requests[validationId];
        require(request.timestamp > 0, "Validation not found");
        require(!request.isCompleted, "Already validated");
        require(request.requester != msg.sender, "Requester cannot validate own request");

        request.isCompleted = true;

        _responses[validationId] = ValidationResponse({
            validationId: validationId,
            validator: msg.sender,
            isValid: isValid,
            proofURI: proofURI,
            timestamp: block.timestamp
        });

        uint256 agentId = request.agentId;
        _completedCount[agentId]++;
        if (isValid) {
            _successCount[agentId]++;
        }

        emit ValidationSubmitted(validationId, msg.sender, isValid);
    }

    /**
     * @notice Get a validation request.
     * @param validationId The validation ID
     * @return The ValidationRequest struct
     */
    function getValidation(uint256 validationId) external view returns (ValidationRequest memory) {
        require(_requests[validationId].timestamp > 0, "Validation not found");
        return _requests[validationId];
    }

    /**
     * @notice Get a validation response.
     * @param validationId The validation ID
     * @return The ValidationResponse struct
     */
    function getValidationResponse(uint256 validationId) external view returns (ValidationResponse memory) {
        require(_responses[validationId].timestamp > 0, "Response not found");
        return _responses[validationId];
    }

    /**
     * @notice Get all validation IDs for an agent.
     * @param agentId The agent's token ID
     * @return Array of validation IDs
     */
    function getValidationsForAgent(uint256 agentId) external view returns (uint256[] memory) {
        return _agentValidations[agentId];
    }

    /**
     * @notice Get validation success rate for an agent (as percentage 0-100).
     * @param agentId The agent's token ID
     * @return successRate Percentage of successful validations
     */
    function getSuccessRate(uint256 agentId) external view returns (uint256) {
        uint256 completed = _completedCount[agentId];
        if (completed == 0) return 0;
        return (_successCount[agentId] * 100) / completed;
    }

    /**
     * @notice Get validation counts for an agent.
     * @param agentId The agent's token ID
     * @return total Total validation requests
     * @return completed Completed validations
     * @return successful Successful validations
     */
    function getValidationCounts(uint256 agentId) external view returns (
        uint256 total,
        uint256 completed,
        uint256 successful
    ) {
        total = _agentValidations[agentId].length;
        completed = _completedCount[agentId];
        successful = _successCount[agentId];
    }

    /**
     * @notice Get the total number of validation requests.
     * @return Total validation count
     */
    function totalValidations() external view returns (uint256) {
        return _nextValidationId - 1;
    }

    // --- Owner functions ---

    function setIdentityRegistry(address _identityRegistry) external onlyOwner {
        require(_identityRegistry != address(0), "Invalid address");
        identityRegistry = IIdentityRegistryForValidation(_identityRegistry);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
