// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ReputationGate — ERC-8004 × ERC-8183 Job-Anchored Feedback
 * @notice Wraps the official ERC-8004 ReputationRegistry so that feedback is
 *         only accepted when accompanied by an AgentProof oracle attestation
 *         proving the rating is anchored to a completed on-chain job record
 *         (AgentProofHook.JobOutcomeRecorded).
 *
 *         Attack vectors closed:
 *           1. Fake ratings — caller must present an oracle-signed attestation
 *              binding (client, agentId, jobId, chain, feedbackHash). No attestation,
 *              no feedback call reaches the registry.
 *           2. Unverified service — the oracle only signs after observing
 *              JobOutcomeRecorded(agentId, jobId, completed=true) on the configured
 *              AgentProofHook. The jobKey mapping enforces one rating per job.
 *
 *         Trust model: ONE designated oracle signer produces attestations.
 *         The owner can rotate the signer. When ERC-8183 hooks expose a per-job
 *         completion view on-chain (e.g. `getJobRecord(jobId)`), a future
 *         ReputationGateV2 can replace the signature path with a direct read.
 *
 *         EIP-191 `personal_sign` is used for signer ergonomics (oracle can
 *         sign with any eth wallet without custom tooling).
 */

interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;
}

contract ReputationGate {
    // ─── Immutables / storage ────────────────────────────────────────

    IReputationRegistry public immutable reputationRegistry;
    /// @notice Domain-separates attestations so the same signature cannot be
    ///         replayed on a different gate deployment or a different chain.
    bytes32 public immutable DOMAIN_SEPARATOR;

    address public owner;
    address public oracleSigner;

    /// @notice One rating per (hookChain, jobId) pair — the anti-sybil core.
    mapping(bytes32 => bool) public jobRated;
    /// @notice Used attestation digests — prevents replay of the same signature.
    mapping(bytes32 => bool) public usedAttestations;

    // ─── Events ──────────────────────────────────────────────────────

    event FeedbackGated(
        uint256 indexed agentId,
        bytes32 indexed hookChain,
        uint256 indexed jobId,
        address client,
        int128 value
    );
    event OracleSignerUpdated(address oldSigner, address newSigner);
    event OwnershipTransferred(address oldOwner, address newOwner);

    // ─── Errors ──────────────────────────────────────────────────────

    error NotOwner();
    error ZeroAddress();
    error AttestationExpired();
    error JobAlreadyRated();
    error AttestationReplayed();
    error InvalidSignature();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _reputationRegistry, address _oracleSigner) {
        if (_reputationRegistry == address(0)) revert ZeroAddress();
        if (_oracleSigner == address(0)) revert ZeroAddress();
        reputationRegistry = IReputationRegistry(_reputationRegistry);
        oracleSigner = _oracleSigner;
        owner = msg.sender;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("AgentProof.ReputationGate.v1"),
                block.chainid,
                address(this)
            )
        );
    }

    // ─── Core: gated feedback submission ─────────────────────────────

    /// @notice Oracle-signed proof that a jobId exists and was completed.
    struct Attestation {
        bytes32 hookChain;   // keccak256(bytes("avalanche")) — identifies the hook chain
        uint256 jobId;       // AgentProofHook jobId referenced by JobOutcomeRecorded
        uint256 deadline;    // Unix timestamp after which the attestation is invalid
        bytes signature;     // 65-byte oracle signature (EIP-191 personal_sign)
    }

    /// @notice ERC-8004 feedback payload — grouped to keep callsite stack-safe.
    struct Feedback {
        uint256 agentId;
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
    }

    /**
     * @notice Submit feedback anchored to a verified ERC-8183 job.
     * @dev The signed digest binds msg.sender as the client, so an attestation
     *      issued to one caller cannot be used by anyone else.
     */
    function giveFeedbackVerified(
        Feedback calldata fb,
        Attestation calldata proof
    ) external {
        _consumeAttestation(fb.agentId, fb.feedbackHash, proof);

        reputationRegistry.giveFeedback(
            fb.agentId,
            fb.value,
            fb.valueDecimals,
            fb.tag1,
            fb.tag2,
            fb.endpoint,
            fb.feedbackURI,
            fb.feedbackHash
        );

        emit FeedbackGated(fb.agentId, proof.hookChain, proof.jobId, msg.sender, fb.value);
    }

    /// @dev Validates + commits the attestation. Separated from the forward call
    ///      so stack pressure in `giveFeedbackVerified` stays within EVM limits.
    function _consumeAttestation(
        uint256 agentId,
        bytes32 feedbackHash,
        Attestation calldata proof
    ) internal {
        if (block.timestamp > proof.deadline) revert AttestationExpired();

        bytes32 jobKey = keccak256(abi.encode(proof.hookChain, proof.jobId));
        if (jobRated[jobKey]) revert JobAlreadyRated();

        bytes32 digest = keccak256(
            abi.encode(
                DOMAIN_SEPARATOR,
                msg.sender,      // client binding — attestation is NOT transferable
                agentId,
                proof.hookChain,
                proof.jobId,
                proof.deadline,
                feedbackHash
            )
        );
        if (usedAttestations[digest]) revert AttestationReplayed();

        bytes32 ethSigned = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)
        );
        if (_recover(ethSigned, proof.signature) != oracleSigner) revert InvalidSignature();

        // Commit state BEFORE the external call
        usedAttestations[digest] = true;
        jobRated[jobKey] = true;
    }

    /// @notice The exact digest an oracle should sign (pre-EIP-191 wrapping).
    /// @dev    Clients can call this off-chain (eth_call) to get the bytes32
    ///         to hand to the oracle. The oracle then personal_sign's it.
    function attestationDigest(
        address client,
        uint256 agentId,
        bytes32 hookChain,
        uint256 jobId,
        uint256 deadline,
        bytes32 feedbackHash
    ) external view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_SEPARATOR,
                client,
                agentId,
                hookChain,
                jobId,
                deadline,
                feedbackHash
            )
        );
    }

    // ─── Admin ───────────────────────────────────────────────────────

    function setOracleSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        emit OracleSignerUpdated(oracleSigner, newSigner);
        oracleSigner = newSigner;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ─── Internals ──────────────────────────────────────────────────

    function _recover(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignature();
        // EIP-2 s-value malleability check (upper half of curve order)
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert InvalidSignature();
        }
        address recovered = ecrecover(hash, v, r, s);
        if (recovered == address(0)) revert InvalidSignature();
        return recovered;
    }
}
