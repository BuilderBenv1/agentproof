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
 *
 * @dev conditionHash Canonical Format
 *
 *      The conditionHash is computed as:
 *          keccak256(abi.encodePacked(canonicalJSON))
 *
 *      Canonical JSON rules (for interoperability across implementations):
 *        1. Keys sorted alphabetically (Unicode code point order)
 *        2. No whitespace (no spaces after colons or commas)
 *        3. No trailing commas
 *        4. String values use double quotes, no escaping beyond JSON spec
 *        5. Numbers are unquoted integers or decimals (no scientific notation)
 *
 *      Example conditions and their canonical JSON:
 *
 *        Token balance:
 *          {"chain":"avalanche","minAmount":"1000000","token":"0xB97EF..."}
 *
 *        NFT ownership:
 *          {"chain":"ethereum","collection":"0xBC4CA...","minCount":"1"}
 *
 *        EAS attestation:
 *          {"chain":"optimism","schema":"0x1234...","type":"eas"}
 *
 *        Farcaster identity:
 *          {"minFollowers":"100","platform":"farcaster","verified":true}
 *
 *      The hook deployer sets requiredAttestation = keccak256 of the canonical
 *      JSON string. The attestation provider implementation must hash conditions
 *      using the same canonical rules to produce matching hashes.
 */
interface IAttestationProvider {
    /**
     * @notice Verify whether a subject satisfies a condition.
     * @param subject       The address to verify (e.g. the provider wallet).
     * @param conditionHash keccak256 of the canonical condition JSON.
     *                      See contract-level @dev for canonical format spec.
     * @return pass True if the subject satisfies the condition.
     */
    function verify(address subject, bytes32 conditionHash) external view returns (bool pass);
}
