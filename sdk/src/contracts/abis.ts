// ─── Official ERC-8004 Identity Registry ABI ───────────────────────
// Deployed by Ava Labs. ERC-721 based agent identity.
export const IDENTITY_REGISTRY_ABI = [
  "function register(string agentURI) external returns (uint256)",
  "function setAgentURI(uint256 agentId, string agentURI) external",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "event Registered(uint256 indexed agentId, address indexed owner, string agentURI)",
  "event URIUpdated(uint256 indexed agentId, string agentURI)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
] as const;

// ─── Official ERC-8004 Reputation Registry ABI ─────────────────────
// Deployed by Ava Labs. Feedback with int128 values, tags, and revocation.
export const REPUTATION_REGISTRY_ABI = [
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, bytes32 tag1, bytes32 tag2, string endpoint, string feedbackURI, bytes32 feedbackHash) external",
  "function revokeFeedback(uint256 feedbackId) external",
  "function appendResponse(uint256 feedbackId, string responseURI) external",
  "function getFeedbackCount(uint256 agentId) external view returns (uint256)",
  "function readFeedback(uint256 feedbackId) external view returns (tuple(uint256 agentId, address reviewer, int128 value, uint8 valueDecimals, bytes32 tag1, bytes32 tag2, string endpoint, string feedbackURI, bytes32 feedbackHash, uint256 timestamp, bool revoked, string responseURI))",
  "function getSummary(uint256 agentId) external view returns (tuple(uint256 totalFeedback, int128 averageValue, uint8 averageValueDecimals))",
  "event NewFeedback(uint256 indexed feedbackId, uint256 indexed agentId, address indexed reviewer, int128 value, uint8 valueDecimals, bytes32 tag1, bytes32 tag2)",
  "event FeedbackRevoked(uint256 indexed feedbackId)",
] as const;

// ─── Legacy Custom Identity Registry ABI (AgentProof v1) ───────────
// Kept for backwards compatibility with custom contracts.
export const LEGACY_IDENTITY_REGISTRY_ABI = [
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

// ─── Legacy Custom Reputation Registry ABI (AgentProof v1) ─────────
export const LEGACY_REPUTATION_REGISTRY_ABI = [
  "function submitFeedback(uint256 agentId, uint8 rating, string feedbackURI, bytes32 taskHash) external",
  "function getFeedbackCount(uint256 agentId) external view returns (uint256)",
  "function getAverageRating(uint256 agentId) external view returns (uint256)",
  "function getFeedback(uint256 agentId, uint256 index) external view returns (tuple(address reviewer, uint8 rating, string feedbackURI, bytes32 taskHash, uint256 timestamp))",
  "function getRatingSum(uint256 agentId) external view returns (uint256)",
  "event FeedbackSubmitted(uint256 indexed agentId, address indexed reviewer, uint8 rating, bytes32 taskHash)",
] as const;

// ─── AgentProof Validation Registry ABI (custom, no ERC-8004 equivalent) ──
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

// ─── InsurancePool ABI (Phase 3) ─────────────────────────────────────
export const INSURANCE_POOL_ABI = [
  "function stakeForAgent(uint256 agentId, string tier) external payable",
  "function requestUnstake(uint256 agentId) external",
  "function unstake(uint256 agentId) external",
  "function fileClaim(uint256 agentId, uint256 validationId, uint256 amount, string evidenceURI) external",
  "function disputeClaim(uint256 claimId, string disputeURI) external",
  "function resolveClaim(uint256 claimId, bool inFavorOfClaimant) external",
  "function getAgentStake(uint256 agentId) external view returns (uint256 stakedAmount, string tier, bool isStaked)",
  "function getMinimumStake(string tier) external pure returns (uint256)",
  "function getClaim(uint256 claimId) external view returns (tuple(uint256 claimId, uint256 agentId, address claimant, uint256 amount, uint256 validationId, string evidenceURI, string disputeURI, uint8 status, uint256 filedAt, uint256 resolvedAt))",
  "function getAgentClaims(uint256 agentId) external view returns (uint256[])",
  "function isInsured(uint256 agentId) external view returns (bool)",
  "event AgentStaked(uint256 indexed agentId, uint256 amount, string tier)",
  "event AgentUnstaked(uint256 indexed agentId, uint256 amount)",
  "event ClaimFiled(uint256 indexed claimId, uint256 indexed agentId, address claimant, uint256 amount)",
  "event ClaimDisputed(uint256 indexed claimId)",
  "event ClaimResolved(uint256 indexed claimId, bool inFavorOfClaimant, uint256 amount)",
] as const;

// ─── AgentPayments ABI (Phase 3) ────────────────────────────────────
export const AGENT_PAYMENTS_ABI = [
  "function createPayment(uint256 fromAgentId, uint256 toAgentId, uint256 amount, address token, bytes32 taskHash, bool requiresValidation) external payable returns (uint256)",
  "function releasePayment(uint256 paymentId) external",
  "function refundPayment(uint256 paymentId) external",
  "function cancelPayment(uint256 paymentId) external",
  "function getPayment(uint256 paymentId) external view returns (tuple(uint256 paymentId, uint256 fromAgentId, uint256 toAgentId, uint256 amount, address token, bytes32 taskHash, bool requiresValidation, uint8 status, uint256 createdAt, uint256 resolvedAt, bool fromCancelRequested, bool toCancelRequested))",
  "function getAgentEarnings(uint256 agentId) external view returns (uint256 totalEarned, uint256 totalPaid)",
  "function protocolFeeBps() external view returns (uint256)",
  "event PaymentCreated(uint256 indexed paymentId, uint256 indexed fromAgentId, uint256 indexed toAgentId, uint256 amount, address token)",
  "event PaymentReleased(uint256 indexed paymentId, uint256 amount, uint256 fee)",
  "event PaymentRefunded(uint256 indexed paymentId, uint256 amount)",
  "event PaymentCancelled(uint256 indexed paymentId)",
] as const;

// ─── ReputationGate ABI (Phase 3) ──────────────────────────────────
export const REPUTATION_GATE_ABI = [
  "function requireMinimumTier(uint256 agentId, string requiredTier) external view",
  "function getCollateralMultiplier(uint256 agentId) external view returns (uint256)",
  "function getInterestRateDiscount(uint256 agentId) external view returns (uint256)",
  "function getPriorityScore(uint256 agentId) external view returns (uint256)",
  "function batchCheckTier(uint256[] agentIds, string requiredTier) external view returns (bool[])",
  "function isTrustedForValue(uint256 agentId, uint256 valueAtRisk) external view returns (bool)",
  "function getMaxTrustedValue(uint256 agentId) external view returns (uint256)",
] as const;

// ─── AgentMonitor ABI (Phase 4) ──────────────────────────────────────
export const AGENT_MONITOR_ABI = [
  "function registerEndpoint(uint256 agentId, string url, string endpointType) external",
  "function removeEndpoint(uint256 agentId, uint256 endpointIndex) external",
  "function logUptimeCheck(uint256 agentId, uint256 endpointIndex, bool isUp, uint256 latencyMs) external",
  "function batchLogUptimeChecks(uint256[] agentIds, uint256[] endpointIndexes, bool[] isUpResults, uint256[] latencies) external",
  "function getEndpoints(uint256 agentId) external view returns (tuple(uint256 agentId, uint256 endpointIndex, string url, string endpointType, bool isActive, uint256 registeredAt)[])",
  "function getUptimeRate(uint256 agentId) external view returns (uint256)",
  "function getUptimeCounts(uint256 agentId) external view returns (uint256 total, uint256 successful)",
  "function getLatestChecks(uint256 agentId) external view returns (tuple(uint256 agentId, uint256 endpointIndex, bool isUp, uint256 latencyMs, uint256 timestamp)[])",
  "function authorizedMonitors(address) external view returns (bool)",
  "event EndpointRegistered(uint256 indexed agentId, uint256 endpointIndex, string url, string endpointType)",
  "event EndpointRemoved(uint256 indexed agentId, uint256 endpointIndex)",
  "event UptimeCheckLogged(uint256 indexed agentId, uint256 endpointIndex, bool isUp, uint256 latencyMs)",
] as const;

// ─── AgentSplits ABI (Phase 4) ──────────────────────────────────────
export const AGENT_SPLITS_ABI = [
  "function createSplit(uint256 creatorAgentId, uint256[] agentIds, uint256[] sharesBps) external returns (uint256)",
  "function deactivateSplit(uint256 splitId) external",
  "function payToSplit(uint256 splitId, uint256 amount, address token, bytes32 taskHash) external payable returns (uint256)",
  "function distributeSplit(uint256 splitPaymentId) external",
  "function getSplit(uint256 splitId) external view returns (uint256, uint256, uint256[], uint256[], bool, uint256)",
  "function getSplitPayment(uint256 splitPaymentId) external view returns (tuple(uint256 splitPaymentId, uint256 splitId, uint256 amount, address token, bytes32 taskHash, address payer, bool distributed, uint256 createdAt, uint256 distributedAt))",
  "function getAgentSplits(uint256 agentId) external view returns (uint256[])",
  "function getSplitParticipants(uint256 splitId) external view returns (uint256[] agentIds, uint256[] sharesBps)",
  "function protocolFeeBps() external view returns (uint256)",
  "event SplitCreated(uint256 indexed splitId, uint256 indexed creatorAgentId, uint256[] agentIds, uint256[] sharesBps)",
  "event SplitDeactivated(uint256 indexed splitId)",
  "event SplitPaymentReceived(uint256 indexed splitPaymentId, uint256 indexed splitId, uint256 amount, address token, address payer)",
  "event SplitDistributed(uint256 indexed splitPaymentId, uint256 indexed splitId, uint256[] amounts)",
] as const;

// ─── AgentProof Core ABI (custom aggregation contract) ─────────────
export const AGENTPROOF_CORE_ABI = [
  "function getAgentProfile(uint256 agentId) external view returns (tuple(uint256 agentId, address owner, string agentURI, uint256 feedbackCount, uint256 averageRating, uint256 validationSuccessRate, uint256 totalValidations, uint256 completedValidations, uint256 successfulValidations))",
  "function getTopAgents(uint256 count) external view returns (uint256[] agentIds, uint256[] ratings)",
  "function setAgentCategory(uint256 agentId, string category) external",
  "function getAgentsByCategory(string category) external view returns (uint256[])",
  "function getAgentCategory(uint256 agentId) external view returns (string)",
] as const;
