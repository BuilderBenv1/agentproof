export const IDENTITY_REGISTRY_ABI = [
  "function registerAgent(string agentURI) external payable returns (uint256)",
  "function updateAgentURI(uint256 agentId, string newURI) external",
  "function getAgentURI(uint256 agentId) external view returns (string)",
  "function getAgentOwner(uint256 agentId) external view returns (address)",
  "function isRegistered(address owner) external view returns (bool)",
  "function getAgentIdByOwner(address owner) external view returns (uint256)",
  "function totalAgents() external view returns (uint256)",
  "function registrationBond() external view returns (uint256)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI)",
  "event AgentURIUpdated(uint256 indexed agentId, string newURI)",
] as const;

export const REPUTATION_REGISTRY_ABI = [
  "function submitFeedback(uint256 agentId, uint8 rating, string feedbackURI, bytes32 taskHash) external",
  "function getFeedbackCount(uint256 agentId) external view returns (uint256)",
  "function getAverageRating(uint256 agentId) external view returns (uint256)",
  "function getFeedback(uint256 agentId, uint256 index) external view returns (tuple(address reviewer, uint8 rating, string feedbackURI, bytes32 taskHash, uint256 timestamp))",
  "function getRatingSum(uint256 agentId) external view returns (uint256)",
  "event FeedbackSubmitted(uint256 indexed agentId, address indexed reviewer, uint8 rating, bytes32 taskHash)",
] as const;

export const VALIDATION_REGISTRY_ABI = [
  "function requestValidation(uint256 agentId, bytes32 taskHash, string taskURI) external returns (uint256)",
  "function submitValidation(uint256 validationId, bool isValid, string proofURI) external",
  "function getValidation(uint256 validationId) external view returns (tuple(uint256 agentId, bytes32 taskHash, string taskURI, address requester, uint256 timestamp, bool isCompleted))",
  "function getValidationResponse(uint256 validationId) external view returns (tuple(uint256 validationId, address validator, bool isValid, string proofURI, uint256 timestamp))",
  "function getValidationsForAgent(uint256 agentId) external view returns (uint256[])",
  "function getSuccessRate(uint256 agentId) external view returns (uint256)",
  "function getValidationCounts(uint256 agentId) external view returns (uint256 total, uint256 completed, uint256 successful)",
  "function totalValidations() external view returns (uint256)",
  "event ValidationRequested(uint256 indexed validationId, uint256 indexed agentId, bytes32 taskHash)",
  "event ValidationSubmitted(uint256 indexed validationId, address indexed validator, bool isValid)",
] as const;

export const AGENTPROOF_CORE_ABI = [
  "function getAgentProfile(uint256 agentId) external view returns (tuple(uint256 agentId, address owner, string agentURI, uint256 feedbackCount, uint256 averageRating, uint256 validationSuccessRate, uint256 totalValidations, uint256 completedValidations, uint256 successfulValidations))",
  "function getTopAgents(uint256 count) external view returns (uint256[] agentIds, uint256[] ratings)",
  "function setAgentCategory(uint256 agentId, string category) external",
  "function getAgentsByCategory(string category) external view returns (uint256[])",
  "function getAgentCategory(uint256 agentId) external view returns (string)",
] as const;
