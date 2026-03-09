// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAttestationProvider — Boolean attestation verification interface
 * @notice Minimal interface for verifying credential attestations on-chain.
 *         Compatible with InsumerAPI (32 chains, ECDSA-signed attestations)
 *         and any service that can verify "does address X satisfy condition Y?"
 *
 * Use cases: token balance checks, NFT ownership, EAS attestations,
 *            Farcaster identity verification, KYC status.
 */
interface IAttestationProvider {
    /**
     * @notice Verify whether a subject satisfies a condition.
     * @param subject       The address to verify (e.g. the provider wallet).
     * @param conditionHash SHA-256 of the canonical condition JSON
     *                      (e.g. "holds >= 1 TOKEN_X on chain Y").
     * @return pass True if the subject satisfies the condition.
     */
    function verify(address subject, bytes32 conditionHash) external view returns (bool pass);
}
