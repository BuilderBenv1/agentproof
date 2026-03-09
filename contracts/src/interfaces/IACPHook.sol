// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IACPHook — ERC-8183 Agentic Commerce Protocol Hook Interface
 * @notice Hooks are called before and after job lifecycle actions (setProvider, fund,
 *         submit, complete, reject, claimRefund). A hook can revert to block an action.
 */
interface IACPHook {
    /**
     * @notice Called before a job action executes.
     * @param jobId   The ID of the job being acted on.
     * @param selector The function selector of the action (e.g., setProvider.selector).
     * @param data    ABI-encoded parameters of the action.
     */
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external;

    /**
     * @notice Called after a job action executes.
     * @param jobId   The ID of the job being acted on.
     * @param selector The function selector of the action.
     * @param data    ABI-encoded parameters of the action.
     */
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
}
