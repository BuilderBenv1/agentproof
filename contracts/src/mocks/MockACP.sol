// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IACP.sol";

/**
 * @title MockACP — Test-only mock for Agentic Commerce Protocol
 */
contract MockACP is IACP {
    struct Job {
        uint256 id;
        address client;
        address provider;
        address evaluator;
        string description;
        uint256 budget;
        uint256 expiredAt;
        uint8 status;
    }

    mapping(uint256 => Job) private _jobs;

    function setJob(
        uint256 jobId,
        address client,
        address provider,
        address evaluator
    ) external {
        _jobs[jobId] = Job(jobId, client, provider, evaluator, "", 0, 0, 0);
    }

    function setJobWithBudget(
        uint256 jobId,
        address client,
        address provider,
        address evaluator,
        uint256 budget
    ) external {
        _jobs[jobId] = Job(jobId, client, provider, evaluator, "", budget, 0, 0);
    }

    function getJob(uint256 jobId) external view override returns (
        uint256 id,
        address client,
        address provider,
        address evaluator,
        string memory description,
        uint256 budget,
        uint256 expiredAt,
        uint8 status
    ) {
        Job storage j = _jobs[jobId];
        return (j.id, j.client, j.provider, j.evaluator, j.description, j.budget, j.expiredAt, j.status);
    }
}
