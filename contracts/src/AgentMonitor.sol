// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IIdentityRegistryForMonitor {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title AgentMonitor
 * @notice On-chain endpoint registration and uptime logging for AI agents.
 *         Authorized monitor nodes can log uptime checks. Agent owners register endpoints.
 */
contract AgentMonitor is Ownable, Pausable, ReentrancyGuard {

    struct Endpoint {
        uint256 agentId;
        uint256 endpointIndex;
        string url;
        string endpointType; // "https", "a2a", "mcp", "websocket"
        bool isActive;
        uint256 registeredAt;
    }

    struct UptimeCheck {
        uint256 agentId;
        uint256 endpointIndex;
        bool isUp;
        uint256 latencyMs;
        uint256 timestamp;
    }

    IIdentityRegistryForMonitor public identityRegistry;

    // agentId => endpointIndex => Endpoint
    mapping(uint256 => mapping(uint256 => Endpoint)) public endpoints;
    // agentId => number of endpoints registered
    mapping(uint256 => uint256) public endpointCount;

    // agentId => array of uptime checks (capped to latest N per agent on-chain)
    mapping(uint256 => UptimeCheck[]) private _uptimeChecks;

    // agentId => total checks / successful checks (cumulative counters)
    mapping(uint256 => uint256) public totalChecks;
    mapping(uint256 => uint256) public successfulChecks;

    // Authorized monitor addresses
    mapping(address => bool) public authorizedMonitors;

    // ─── Events ──────────────────────────────────────────────────
    event EndpointRegistered(uint256 indexed agentId, uint256 endpointIndex, string url, string endpointType);
    event EndpointRemoved(uint256 indexed agentId, uint256 endpointIndex);
    event UptimeCheckLogged(uint256 indexed agentId, uint256 endpointIndex, bool isUp, uint256 latencyMs);
    event MonitorAuthorized(address indexed monitor);
    event MonitorRevoked(address indexed monitor);

    // ─── Modifiers ───────────────────────────────────────────────

    modifier onlyAgentOwner(uint256 agentId) {
        require(identityRegistry.ownerOf(agentId) == msg.sender, "Not agent owner");
        _;
    }

    modifier onlyMonitor() {
        require(authorizedMonitors[msg.sender], "Not authorized monitor");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────

    constructor(address _identityRegistry) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistryForMonitor(_identityRegistry);
        // Owner is automatically an authorized monitor
        authorizedMonitors[msg.sender] = true;
        emit MonitorAuthorized(msg.sender);
    }

    // ─── Endpoint Management ─────────────────────────────────────

    /**
     * @notice Register an endpoint for an agent. Only the agent owner can call.
     * @param agentId The agent's token ID
     * @param url The endpoint URL
     * @param endpointType The type of endpoint (https, a2a, mcp, websocket)
     */
    function registerEndpoint(
        uint256 agentId,
        string calldata url,
        string calldata endpointType
    ) external whenNotPaused onlyAgentOwner(agentId) {
        require(bytes(url).length > 0, "URL cannot be empty");
        require(bytes(endpointType).length > 0, "Type cannot be empty");

        uint256 idx = endpointCount[agentId];
        require(idx < 10, "Max 10 endpoints");

        endpoints[agentId][idx] = Endpoint({
            agentId: agentId,
            endpointIndex: idx,
            url: url,
            endpointType: endpointType,
            isActive: true,
            registeredAt: block.timestamp
        });

        endpointCount[agentId] = idx + 1;

        emit EndpointRegistered(agentId, idx, url, endpointType);
    }

    /**
     * @notice Remove (deactivate) an endpoint. Only the agent owner can call.
     * @param agentId The agent's token ID
     * @param endpointIndex The index of the endpoint to remove
     */
    function removeEndpoint(
        uint256 agentId,
        uint256 endpointIndex
    ) external whenNotPaused onlyAgentOwner(agentId) {
        require(endpointIndex < endpointCount[agentId], "Invalid endpoint index");
        require(endpoints[agentId][endpointIndex].isActive, "Already removed");

        endpoints[agentId][endpointIndex].isActive = false;

        emit EndpointRemoved(agentId, endpointIndex);
    }

    // ─── Uptime Logging ──────────────────────────────────────────

    /**
     * @notice Log an uptime check for an agent endpoint. Only authorized monitors.
     * @param agentId The agent's token ID
     * @param endpointIndex The endpoint index that was checked
     * @param isUp Whether the endpoint responded successfully
     * @param latencyMs Response latency in milliseconds
     */
    function logUptimeCheck(
        uint256 agentId,
        uint256 endpointIndex,
        bool isUp,
        uint256 latencyMs
    ) external whenNotPaused onlyMonitor {
        require(endpointIndex < endpointCount[agentId], "Invalid endpoint index");
        require(endpoints[agentId][endpointIndex].isActive, "Endpoint inactive");

        _recordCheck(agentId, endpointIndex, isUp, latencyMs);
    }

    /**
     * @notice Batch log uptime checks for gas efficiency.
     * @param agentIds Array of agent IDs
     * @param endpointIndexes Array of endpoint indexes
     * @param isUpResults Array of up/down results
     * @param latencies Array of latency values
     */
    function batchLogUptimeChecks(
        uint256[] calldata agentIds,
        uint256[] calldata endpointIndexes,
        bool[] calldata isUpResults,
        uint256[] calldata latencies
    ) external whenNotPaused onlyMonitor {
        uint256 len = agentIds.length;
        require(
            len == endpointIndexes.length &&
            len == isUpResults.length &&
            len == latencies.length,
            "Array length mismatch"
        );
        require(len <= 50, "Batch too large");

        for (uint256 i = 0; i < len; i++) {
            uint256 agentId = agentIds[i];
            uint256 idx = endpointIndexes[i];

            if (idx < endpointCount[agentId] && endpoints[agentId][idx].isActive) {
                _recordCheck(agentId, idx, isUpResults[i], latencies[i]);
            }
        }
    }

    function _recordCheck(
        uint256 agentId,
        uint256 endpointIndex,
        bool isUp,
        uint256 latencyMs
    ) internal {
        totalChecks[agentId]++;
        if (isUp) {
            successfulChecks[agentId]++;
        }

        // Store latest check on-chain (keep last 10 per agent)
        UptimeCheck memory check = UptimeCheck({
            agentId: agentId,
            endpointIndex: endpointIndex,
            isUp: isUp,
            latencyMs: latencyMs,
            timestamp: block.timestamp
        });

        if (_uptimeChecks[agentId].length < 10) {
            _uptimeChecks[agentId].push(check);
        } else {
            // Circular overwrite
            _uptimeChecks[agentId][totalChecks[agentId] % 10] = check;
        }

        emit UptimeCheckLogged(agentId, endpointIndex, isUp, latencyMs);
    }

    // ─── Views ───────────────────────────────────────────────────

    /**
     * @notice Get all endpoints for an agent.
     */
    function getEndpoints(uint256 agentId) external view returns (Endpoint[] memory) {
        uint256 count = endpointCount[agentId];
        Endpoint[] memory result = new Endpoint[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = endpoints[agentId][i];
        }
        return result;
    }

    /**
     * @notice Get the uptime rate for an agent (basis points, 0-10000).
     */
    function getUptimeRate(uint256 agentId) external view returns (uint256 rateBps) {
        uint256 total = totalChecks[agentId];
        if (total == 0) return 0;
        return (successfulChecks[agentId] * 10000) / total;
    }

    /**
     * @notice Get the latest uptime checks stored on-chain.
     */
    function getLatestChecks(uint256 agentId) external view returns (UptimeCheck[] memory) {
        return _uptimeChecks[agentId];
    }

    /**
     * @notice Get cumulative uptime counts for an agent.
     */
    function getUptimeCounts(uint256 agentId) external view returns (uint256 total, uint256 successful) {
        return (totalChecks[agentId], successfulChecks[agentId]);
    }

    // ─── Admin ───────────────────────────────────────────────────

    function addMonitor(address monitor) external onlyOwner {
        require(monitor != address(0), "Zero address");
        require(!authorizedMonitors[monitor], "Already authorized");
        authorizedMonitors[monitor] = true;
        emit MonitorAuthorized(monitor);
    }

    function removeMonitor(address monitor) external onlyOwner {
        require(authorizedMonitors[monitor], "Not a monitor");
        authorizedMonitors[monitor] = false;
        emit MonitorRevoked(monitor);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
