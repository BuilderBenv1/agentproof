// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IACP — Minimal interface for reading Agentic Commerce Protocol job data
 * @notice Used by hooks to resolve job participants (provider, client, evaluator)
 *         when the hook callback data doesn't include them directly.
 *
 *         Reference: https://github.com/dcrapis/ERC-ACP
 */
interface IACP {
    /**
     * @notice Get the full job record.
     * @param jobId The job identifier.
     */
    function getJob(uint256 jobId) external view returns (
        uint256 id,
        address client,
        address provider,
        address evaluator,
        string memory description,
        uint256 budget,
        uint256 expiredAt,
        uint8 status
    );
}
