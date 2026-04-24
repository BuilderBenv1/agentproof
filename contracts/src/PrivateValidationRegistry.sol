// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Ownable.sol";
import "./lib/BITE.sol";

/**
 * @title PrivateValidationRegistry — Sealed-ballot agent validation on SKALE
 *
 * Validators submit threshold-encrypted (TE) `isValid` votes via BITE. Votes
 * remain hidden — both in the mempool and in contract storage — until quorum
 * is reached. Anyone can then pay the CTX fee to trigger reveal: the SKALE
 * validator committee threshold-decrypts the ballots and calls `onDecrypt`,
 * which tallies the result and emits only the aggregate consensus.
 *
 * Privacy properties:
 *   - Individual votes are never stored as plaintext on-chain.
 *   - Per-validator vote events expose participation only, never the choice.
 *   - The reveal callback emits only the aggregate (consensus + counts), never
 *     per-validator outcomes. Individual votes briefly appear in the BITE
 *     callback's calldata at decrypt time — that is the inherent surface of
 *     CTX-style threshold decryption and the canonical limit of this design.
 *
 * Indexer compatibility:
 *   - `ValidationRequested(validationId, agentId, taskHash)` matches the
 *     legacy ValidationRegistry shape — drops straight into existing indexers.
 *   - `ValidationSubmitted(validationId, validator, isValid)` is emitted at
 *     reveal with `validator = address(this)` to signal a consensus emission.
 */
contract PrivateValidationRegistry is Ownable, IBiteSupplicant {

    // ─── Constants ─────────────────────────────────────────────────────

    uint256 internal constant CTX_GAS_LIMIT = 2_500_000;
    uint256 internal constant CTX_GAS_PAYMENT = 0.06 ether;

    // ─── Types ─────────────────────────────────────────────────────────

    enum State { Open, Revealing, Resolved }

    struct Validation {
        uint256 agentId;
        bytes32 taskHash;
        address requester;
        uint40 createdAt;
        uint40 deadline;
        uint8 quorum;
        uint8 votesReceived;
        uint8 yesVotes;
        State state;
        bool consensusValid;
        string taskURI;
    }

    // ─── Storage ───────────────────────────────────────────────────────

    uint256 public validationCount;

    mapping(uint256 => Validation) public validations;
    mapping(uint256 => bytes[]) private encryptedBallots;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => uint256[]) private validationsByAgent;

    // ─── Events ────────────────────────────────────────────────────────

    event ValidationRequested(
        uint256 indexed validationId,
        uint256 indexed agentId,
        bytes32 taskHash
    );

    /// @notice Emitted on each vote — exposes participation only.
    event PrivateVoteSubmitted(
        uint256 indexed validationId,
        address indexed validator,
        uint8 votesSoFar
    );

    /// @notice Quorum reached — anyone can now trigger reveal.
    event QuorumReached(uint256 indexed validationId, uint8 votes);

    /// @notice Consensus reveal — aggregate result with per-side counts.
    event ConsensusReached(
        uint256 indexed validationId,
        bool consensusValid,
        uint8 yesVotes,
        uint8 totalVotes
    );

    /// @notice Indexer-compatible — `validator = address(this)` signals consensus emission.
    event ValidationSubmitted(
        uint256 indexed validationId,
        address indexed validator,
        bool isValid
    );

    // ─── Errors ────────────────────────────────────────────────────────

    error ValidationNotOpen(uint256 validationId, State actual);
    error ValidationNotRevealing(uint256 validationId, State actual);
    error AlreadyVoted(uint256 validationId, address validator);
    error EmptyBallot();
    error QuorumNotReached(uint256 validationId, uint8 received, uint8 required);
    error InsufficientCTXPayment(uint256 sent, uint256 required);
    error OnlyBITE(address caller);
    error InvalidQuorum();

    // ─── Constructor ───────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── Validation lifecycle ──────────────────────────────────────────

    /**
     * @notice Open a new private validation round for an agent.
     * @param agentId       ERC-8004 agent ID being validated.
     * @param taskHash      Hash of the task being attested to.
     * @param taskURI       Off-chain pointer to task details / proof inputs.
     * @param quorum        Number of encrypted votes required before reveal can fire.
     * @param votingPeriod  Seconds the round stays open (deadline beyond which
     *                      reveal can be triggered even without quorum).
     */
    function requestValidation(
        uint256 agentId,
        bytes32 taskHash,
        string calldata taskURI,
        uint8 quorum,
        uint40 votingPeriod
    ) external returns (uint256 validationId) {
        if (quorum == 0) revert InvalidQuorum();

        validationId = ++validationCount;
        Validation storage v = validations[validationId];
        v.agentId = agentId;
        v.taskHash = taskHash;
        v.taskURI = taskURI;
        v.requester = msg.sender;
        v.createdAt = uint40(block.timestamp);
        v.deadline = uint40(block.timestamp + votingPeriod);
        v.quorum = quorum;
        v.state = State.Open;

        validationsByAgent[agentId].push(validationId);

        emit ValidationRequested(validationId, agentId, taskHash);
    }

    /**
     * @notice Submit a TE-encrypted `isValid` vote.
     * @dev    Encrypt off-chain via @skalenetwork/bite — `bite.encryptMessageForCTX(
     *         abi.encode(bool isValid), address(this))`. The AAD binds the
     *         ballot to this contract so it cannot be replayed elsewhere.
     */
    function submitEncryptedVote(uint256 validationId, bytes calldata teEncryptedVote) external {
        Validation storage v = validations[validationId];
        if (v.state != State.Open) revert ValidationNotOpen(validationId, v.state);
        if (hasVoted[validationId][msg.sender]) {
            revert AlreadyVoted(validationId, msg.sender);
        }
        if (teEncryptedVote.length == 0) revert EmptyBallot();

        encryptedBallots[validationId].push(teEncryptedVote);
        hasVoted[validationId][msg.sender] = true;
        v.votesReceived += 1;

        emit PrivateVoteSubmitted(validationId, msg.sender, v.votesReceived);

        if (v.votesReceived == v.quorum) {
            emit QuorumReached(validationId, v.votesReceived);
        }
    }

    /**
     * @notice Trigger threshold decryption + tally. Anyone can call once quorum
     *         is met or the voting period expires.
     * @dev    Caller pays the CTX fee (0.06 sFUEL on SKALE Base / Sepolia).
     *         The contract forwards it to the BITE-spawned callback contract.
     */
    function triggerReveal(uint256 validationId) external payable {
        Validation storage v = validations[validationId];
        if (v.state != State.Open) revert ValidationNotOpen(validationId, v.state);
        if (msg.value < CTX_GAS_PAYMENT) {
            revert InsufficientCTXPayment(msg.value, CTX_GAS_PAYMENT);
        }
        if (v.votesReceived < v.quorum && block.timestamp < v.deadline) {
            revert QuorumNotReached(validationId, v.votesReceived, v.quorum);
        }
        if (v.votesReceived == 0) revert EmptyBallot();

        v.state = State.Revealing;

        bytes[] memory encArgs = new bytes[](v.votesReceived);
        bytes[] memory plainArgs = new bytes[](v.votesReceived);
        bytes memory routingTag = abi.encode(validationId);
        for (uint256 i = 0; i < v.votesReceived; i++) {
            encArgs[i] = encryptedBallots[validationId][i];
            plainArgs[i] = routingTag;
        }

        address payable callbackSender = BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            CTX_GAS_LIMIT,
            encArgs,
            plainArgs
        );
        callbackSender.transfer(msg.value);
    }

    /**
     * @notice BITE callback. Tallies the decrypted ballots and emits only the
     *         aggregate consensus — never per-validator outcomes.
     */
    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external override {
        if (msg.sender != BITE.SUBMIT_CTX_ADDRESS) revert OnlyBITE(msg.sender);
        if (decryptedArguments.length == 0) revert EmptyBallot();

        uint256 validationId = abi.decode(plaintextArguments[0], (uint256));
        Validation storage v = validations[validationId];
        if (v.state != State.Revealing) {
            revert ValidationNotRevealing(validationId, v.state);
        }

        uint8 yes = 0;
        uint256 total = decryptedArguments.length;
        for (uint256 i = 0; i < total; i++) {
            bool isValid = abi.decode(decryptedArguments[i], (bool));
            if (isValid) {
                yes += 1;
            }
        }

        bool consensus = uint256(yes) * 2 > total;

        v.state = State.Resolved;
        v.yesVotes = yes;
        v.consensusValid = consensus;

        // Free encrypted ballot storage — they're now decrypted, no reason to keep them.
        delete encryptedBallots[validationId];

        emit ConsensusReached(validationId, consensus, yes, uint8(total));
        emit ValidationSubmitted(validationId, address(this), consensus);
    }

    // ─── Views ─────────────────────────────────────────────────────────

    function getValidation(uint256 validationId)
        external
        view
        returns (
            uint256 agentId,
            bytes32 taskHash,
            string memory taskURI,
            address requester,
            uint40 createdAt,
            uint40 deadline,
            uint8 quorum,
            uint8 votesReceived,
            State state,
            bool consensusValid,
            uint8 yesVotes
        )
    {
        Validation storage v = validations[validationId];
        return (
            v.agentId,
            v.taskHash,
            v.taskURI,
            v.requester,
            v.createdAt,
            v.deadline,
            v.quorum,
            v.votesReceived,
            v.state,
            v.consensusValid,
            v.yesVotes
        );
    }

    function getEncryptedBallotCount(uint256 validationId) external view returns (uint256) {
        return encryptedBallots[validationId].length;
    }

    function getValidationsForAgent(uint256 agentId) external view returns (uint256[] memory) {
        return validationsByAgent[agentId];
    }

    /**
     * @notice Aggregate success rate for an agent across all resolved validations.
     * @return rate     Percentage (0-10000, 2 decimal places). 0 if no resolved rounds.
     * @return resolved Number of validations that have reached consensus.
     */
    function getSuccessRate(uint256 agentId)
        external
        view
        returns (uint16 rate, uint32 resolved)
    {
        uint256[] storage ids = validationsByAgent[agentId];
        uint32 valid = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            Validation storage v = validations[ids[i]];
            if (v.state == State.Resolved) {
                resolved += 1;
                if (v.consensusValid) valid += 1;
            }
        }
        if (resolved == 0) return (0, 0);
        rate = uint16((uint256(valid) * 10000) / resolved);
    }
}
