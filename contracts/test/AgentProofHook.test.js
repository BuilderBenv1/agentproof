const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentProofHook", function () {
  let hook, oracle, identityRegistry, mockACP;
  let owner, escrow, provider, provider2, unregistered;

  const AGENT_ID = 1;
  const AGENT_ID_2 = 2;
  const JOB_ID = 100;
  const MIN_SCORE = 3000; // 30.00
  const MIN_TIER = 1;     // bronze
  const MAX_SCORE_AGE = 0; // 0 = no expiry (default for most tests)
  const ACP_ZERO = ethers.ZeroAddress; // no ACP reference by default

  // ERC-ACP function selectors (canonical spec)
  // Reference: https://github.com/dcrapis/ERC-ACP
  const SEL_SET_PROVIDER = ethers.id("setProvider(uint256,address)").slice(0, 10);
  const SEL_COMPLETE = ethers.id("complete(uint256,bytes32)").slice(0, 10);
  const SEL_REJECT = ethers.id("reject(uint256,bytes32)").slice(0, 10);
  const SEL_FUND = ethers.id("fund(uint256,uint256)").slice(0, 10);
  const SEL_SUBMIT = ethers.id("submit(uint256,bytes32)").slice(0, 10);

  // ─── ERC-ACP canonical hook data encoding helpers ──────────────

  /** setProvider hook data: abi.encode(address provider, bytes optParams) */
  function encodeSetProvider(providerAddr, optParams = "0x") {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes"],
      [providerAddr, optParams]
    );
  }

  /** complete/reject hook data: abi.encode(bytes32 reason, bytes optParams) */
  function encodeOutcome(reason = ethers.ZeroHash, optParams = "0x") {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes"],
      [reason, optParams]
    );
  }

  beforeEach(async function () {
    [owner, escrow, provider, provider2, unregistered] = await ethers.getSigners();

    // Deploy mock TrustScoreOracle
    const MockOracle = await ethers.getContractFactory("MockTrustScoreOracle");
    oracle = await MockOracle.deploy();
    await oracle.waitForDeployment();

    // Deploy mock IdentityRegistry
    const MockRegistry = await ethers.getContractFactory("MockIdentityRegistry");
    identityRegistry = await MockRegistry.deploy();
    await identityRegistry.waitForDeployment();

    // Deploy mock ACP
    const MockACPFactory = await ethers.getContractFactory("MockACP");
    mockACP = await MockACPFactory.deploy();
    await mockACP.waitForDeployment();

    // Register provider → agent ID 1
    await identityRegistry.registerAgent(provider.address, AGENT_ID);
    // Register provider2 → agent ID 2
    await identityRegistry.registerAgent(provider2.address, AGENT_ID_2);

    // Set trust scores
    await oracle.setScore(AGENT_ID, 6500, 3); // 65.00, gold
    await oracle.setScore(AGENT_ID_2, 2000, 0); // 20.00, unranked

    // Deploy AgentProofHook (no ACP reference by default — cache-only mode)
    const Hook = await ethers.getContractFactory("AgentProofHook");
    hook = await Hook.deploy(
      await oracle.getAddress(),
      await identityRegistry.getAddress(),
      MIN_SCORE,
      MIN_TIER,
      MAX_SCORE_AGE,
      ACP_ZERO
    );
    await hook.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set correct oracle address", async function () {
      expect(await hook.oracle()).to.equal(await oracle.getAddress());
    });

    it("should set correct identity registry", async function () {
      expect(await hook.identityRegistry()).to.equal(await identityRegistry.getAddress());
    });

    it("should set correct minScore", async function () {
      expect(await hook.minScore()).to.equal(MIN_SCORE);
    });

    it("should set correct minTier", async function () {
      expect(await hook.minTier()).to.equal(MIN_TIER);
    });

    it("should set correct maxScoreAge", async function () {
      expect(await hook.maxScoreAge()).to.equal(MAX_SCORE_AGE);
    });

    it("should set correct acp (zero = cache-only)", async function () {
      expect(await hook.acp()).to.equal(ethers.ZeroAddress);
    });

    it("should revert with zero oracle address", async function () {
      const Hook = await ethers.getContractFactory("AgentProofHook");
      await expect(
        Hook.deploy(ethers.ZeroAddress, await identityRegistry.getAddress(), MIN_SCORE, MIN_TIER, MAX_SCORE_AGE, ACP_ZERO)
      ).to.be.revertedWithCustomError(hook, "ZeroAddress");
    });

    it("should revert with zero registry address", async function () {
      const Hook = await ethers.getContractFactory("AgentProofHook");
      await expect(
        Hook.deploy(await oracle.getAddress(), ethers.ZeroAddress, MIN_SCORE, MIN_TIER, MAX_SCORE_AGE, ACP_ZERO)
      ).to.be.revertedWithCustomError(hook, "ZeroAddress");
    });
  });

  describe("beforeAction — Provider Gating (ERC-ACP canonical encoding)", function () {
    it("should allow provider with sufficient score and tier", async function () {
      const data = encodeSetProvider(provider.address);
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });

    it("should cache provider address for afterAction resolution", async function () {
      const data = encodeSetProvider(provider.address);
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
      expect(await hook.jobProviders(JOB_ID)).to.equal(provider.address);
    });

    it("should revert when provider score is below minScore", async function () {
      const data = encodeSetProvider(provider2.address);
      await expect(
        hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data)
      ).to.be.revertedWithCustomError(hook, "ScoreTooLow")
        .withArgs(AGENT_ID_2, 2000, MIN_SCORE);
    });

    it("should revert when provider tier is below minTier", async function () {
      await oracle.setScore(AGENT_ID_2, 5000, 0);
      const data = encodeSetProvider(provider2.address);
      await expect(
        hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data)
      ).to.be.revertedWithCustomError(hook, "TierTooLow")
        .withArgs(AGENT_ID_2, 0, MIN_TIER);
    });

    it("should revert when provider is not registered", async function () {
      const data = encodeSetProvider(unregistered.address);
      await expect(
        hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data)
      ).to.be.revertedWithCustomError(hook, "AgentNotRegistered")
        .withArgs(unregistered.address);
    });

    it("should revert when provider has no score", async function () {
      const newAgent = 99;
      await identityRegistry.registerAgent(unregistered.address, newAgent);
      const data = encodeSetProvider(unregistered.address);
      await expect(
        hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data)
      ).to.be.revertedWithCustomError(hook, "AgentNotScored")
        .withArgs(newAgent);
    });

    it("should pass through non-setProvider actions (fund, submit)", async function () {
      const fundData = ethers.AbiCoder.defaultAbiCoder().encode(["bytes"], ["0x"]);
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_FUND, fundData);
      const submitData = ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "bytes"], [ethers.ZeroHash, "0x"]);
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SUBMIT, submitData);
    });

    it("should handle optParams in setProvider data", async function () {
      // Pass extra optParams — hook should still extract provider correctly
      const optParams = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [42]);
      const data = encodeSetProvider(provider.address, optParams);
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });
  });

  describe("afterAction — Job Outcome Recording (ERC-ACP canonical encoding)", function () {
    beforeEach(async function () {
      // Cache provider via beforeAction (simulates normal ACP flow)
      const data = encodeSetProvider(provider.address);
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });

    it("should record completed job using cached provider", async function () {
      const reason = ethers.id("good work");
      const data = encodeOutcome(reason);
      await expect(hook.connect(escrow).afterAction(JOB_ID, SEL_COMPLETE, data))
        .to.emit(hook, "JobOutcomeRecorded")
        .withArgs(AGENT_ID, JOB_ID, true);

      const [completed, rejected, lastJobAt] = await hook.getAgentJobStats(AGENT_ID);
      expect(completed).to.equal(1);
      expect(rejected).to.equal(0);
      expect(lastJobAt).to.be.gt(0);
    });

    it("should record rejected job using cached provider", async function () {
      const data = encodeOutcome();
      await expect(hook.connect(escrow).afterAction(JOB_ID, SEL_REJECT, data))
        .to.emit(hook, "JobOutcomeRecorded")
        .withArgs(AGENT_ID, JOB_ID, false);

      const [completed, rejected] = await hook.getAgentJobStats(AGENT_ID);
      expect(completed).to.equal(0);
      expect(rejected).to.equal(1);
    });

    it("should accumulate stats across multiple jobs", async function () {
      // Cache providers for additional jobs
      const data = encodeSetProvider(provider.address);
      await hook.connect(escrow).beforeAction(JOB_ID + 1, SEL_SET_PROVIDER, data);
      await hook.connect(escrow).beforeAction(JOB_ID + 2, SEL_SET_PROVIDER, data);

      const outcomeData = encodeOutcome();
      await hook.connect(escrow).afterAction(JOB_ID, SEL_COMPLETE, outcomeData);
      await hook.connect(escrow).afterAction(JOB_ID + 1, SEL_COMPLETE, outcomeData);
      await hook.connect(escrow).afterAction(JOB_ID + 2, SEL_REJECT, outcomeData);

      const [completed, rejected] = await hook.getAgentJobStats(AGENT_ID);
      expect(completed).to.equal(2);
      expect(rejected).to.equal(1);
    });

    it("should silently skip when provider not in cache and no ACP", async function () {
      // Job 999 was never seen in beforeAction — no cached provider
      const data = encodeOutcome();
      await hook.connect(escrow).afterAction(999, SEL_COMPLETE, data);
      // Should not revert, just skip
    });

    it("should pass through non-outcome actions (fund)", async function () {
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["bytes"], ["0x"]);
      await hook.connect(escrow).afterAction(JOB_ID, SEL_FUND, data);
    });
  });

  describe("afterAction — ACP Fallback Resolution", function () {
    let hookWithACP;

    beforeEach(async function () {
      // Deploy hook WITH ACP reference
      const Hook = await ethers.getContractFactory("AgentProofHook");
      hookWithACP = await Hook.deploy(
        await oracle.getAddress(),
        await identityRegistry.getAddress(),
        MIN_SCORE,
        MIN_TIER,
        MAX_SCORE_AGE,
        await mockACP.getAddress()
      );
      await hookWithACP.waitForDeployment();

      // Register job in mock ACP (provider set at createJob, not via setProvider)
      await mockACP.setJob(JOB_ID, owner.address, provider.address, escrow.address);
    });

    it("should resolve provider from ACP when not in cache", async function () {
      // No beforeAction(setProvider) — provider was set at createJob
      const data = encodeOutcome();
      await expect(hookWithACP.connect(escrow).afterAction(JOB_ID, SEL_COMPLETE, data))
        .to.emit(hookWithACP, "JobOutcomeRecorded")
        .withArgs(AGENT_ID, JOB_ID, true);
    });

    it("should prefer cache over ACP when both available", async function () {
      // Cache provider2 but ACP has provider
      const setData = encodeSetProvider(provider2.address);
      // Need provider2 to pass gate — set high score
      await oracle.setScore(AGENT_ID_2, 8000, 3);
      await hookWithACP.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, setData);

      const data = encodeOutcome();
      await hookWithACP.connect(escrow).afterAction(JOB_ID, SEL_COMPLETE, data);

      // Should use cached provider2, not ACP's provider
      const [completed2] = await hookWithACP.getAgentJobStats(AGENT_ID_2);
      expect(completed2).to.equal(1);

      const [completed1] = await hookWithACP.getAgentJobStats(AGENT_ID);
      expect(completed1).to.equal(0);
    });

    it("should handle ACP returning unregistered provider gracefully", async function () {
      // Set ACP job with unregistered provider
      await mockACP.setJob(200, owner.address, unregistered.address, escrow.address);

      const data = encodeOutcome();
      // Should not revert — _recordOutcome silently skips unregistered
      await hookWithACP.connect(escrow).afterAction(200, SEL_COMPLETE, data);
    });
  });

  describe("Completion Rate", function () {
    it("should return 0 rate and 0 total for agent with no jobs", async function () {
      const [rate, total] = await hook.getCompletionRate(999);
      expect(rate).to.equal(0);
      expect(total).to.equal(0);
    });

    it("should calculate correct completion rate", async function () {
      // Cache provider for all jobs
      for (let i = 1; i <= 4; i++) {
        await hook.connect(escrow).beforeAction(i, SEL_SET_PROVIDER, encodeSetProvider(provider.address));
      }
      // 3 completed, 1 rejected = 75%
      await hook.connect(escrow).afterAction(1, SEL_COMPLETE, encodeOutcome());
      await hook.connect(escrow).afterAction(2, SEL_COMPLETE, encodeOutcome());
      await hook.connect(escrow).afterAction(3, SEL_COMPLETE, encodeOutcome());
      await hook.connect(escrow).afterAction(4, SEL_REJECT, encodeOutcome());

      const [rate, total] = await hook.getCompletionRate(AGENT_ID);
      expect(rate).to.equal(7500); // 75.00%
      expect(total).to.equal(4);
    });

    it("should return 10000 for 100% completion", async function () {
      for (let i = 1; i <= 2; i++) {
        await hook.connect(escrow).beforeAction(i, SEL_SET_PROVIDER, encodeSetProvider(provider.address));
      }
      await hook.connect(escrow).afterAction(1, SEL_COMPLETE, encodeOutcome());
      await hook.connect(escrow).afterAction(2, SEL_COMPLETE, encodeOutcome());

      const [rate, total] = await hook.getCompletionRate(AGENT_ID);
      expect(rate).to.equal(10000);
      expect(total).to.equal(2);
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to update minScore", async function () {
      await expect(hook.setMinScore(5000))
        .to.emit(hook, "MinScoreUpdated")
        .withArgs(MIN_SCORE, 5000);
      expect(await hook.minScore()).to.equal(5000);
    });

    it("should allow owner to update minTier", async function () {
      await expect(hook.setMinTier(3))
        .to.emit(hook, "MinTierUpdated")
        .withArgs(MIN_TIER, 3);
      expect(await hook.minTier()).to.equal(3);
    });

    it("should reject minTier > 5", async function () {
      await expect(hook.setMinTier(6)).to.be.reverted;
    });

    it("should allow owner to update oracle", async function () {
      const newOracle = provider2.address;
      await expect(hook.setOracle(newOracle))
        .to.emit(hook, "OracleUpdated");
      expect(await hook.oracle()).to.equal(newOracle);
    });

    it("should reject zero address oracle", async function () {
      await expect(hook.setOracle(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(hook, "ZeroAddress");
    });

    it("should allow owner to update identity registry", async function () {
      const newRegistry = provider2.address;
      await expect(hook.setIdentityRegistry(newRegistry))
        .to.emit(hook, "IdentityRegistryUpdated");
      expect(await hook.identityRegistry()).to.equal(newRegistry);
    });

    it("should reject non-owner admin calls", async function () {
      await expect(hook.connect(provider).setMinScore(1000))
        .to.be.revertedWithCustomError(hook, "OwnableUnauthorizedAccount");
      await expect(hook.connect(provider).setMinTier(2))
        .to.be.revertedWithCustomError(hook, "OwnableUnauthorizedAccount");
      await expect(hook.connect(provider).setOracle(provider.address))
        .to.be.revertedWithCustomError(hook, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to update maxScoreAge", async function () {
      await expect(hook.setMaxScoreAge(3600))
        .to.emit(hook, "MaxScoreAgeUpdated")
        .withArgs(0, 3600);
      expect(await hook.maxScoreAge()).to.equal(3600);
    });

    it("should allow owner to set attestation provider", async function () {
      const addr = provider2.address;
      await expect(hook.setAttestationProvider(addr))
        .to.emit(hook, "AttestationProviderUpdated")
        .withArgs(ethers.ZeroAddress, addr);
      expect(await hook.attestationProvider()).to.equal(addr);
    });

    it("should allow owner to set required attestation", async function () {
      const hash = ethers.id("holds >= 1 USDC on avalanche");
      await expect(hook.setRequiredAttestation(hash))
        .to.emit(hook, "RequiredAttestationUpdated")
        .withArgs(ethers.ZeroHash, hash);
      expect(await hook.requiredAttestation()).to.equal(hash);
    });

    it("should allow owner to disable attestation by setting address(0)", async function () {
      await hook.setAttestationProvider(provider2.address);
      await hook.setAttestationProvider(ethers.ZeroAddress);
      expect(await hook.attestationProvider()).to.equal(ethers.ZeroAddress);
    });

    it("should allow owner to set ACP reference", async function () {
      const acpAddr = await mockACP.getAddress();
      await expect(hook.setACP(acpAddr))
        .to.emit(hook, "ACPUpdated")
        .withArgs(ethers.ZeroAddress, acpAddr);
      expect(await hook.acp()).to.equal(acpAddr);
    });
  });

  describe("Attestation Provider Gating", function () {
    let attestationProvider;
    const CONDITION_HASH = ethers.id("holds >= 1 USDC on avalanche");

    beforeEach(async function () {
      const MockAttestation = await ethers.getContractFactory("MockAttestationProvider");
      attestationProvider = await MockAttestation.deploy();
      await attestationProvider.waitForDeployment();
    });

    it("should pass through when no attestation provider is set", async function () {
      const data = encodeSetProvider(provider.address);
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });

    it("should allow provider that passes attestation", async function () {
      await hook.setAttestationProvider(await attestationProvider.getAddress());
      await hook.setRequiredAttestation(CONDITION_HASH);
      await attestationProvider.setResult(provider.address, true);

      const data = encodeSetProvider(provider.address);
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });

    it("should revert when provider fails attestation", async function () {
      await hook.setAttestationProvider(await attestationProvider.getAddress());
      await hook.setRequiredAttestation(CONDITION_HASH);

      const data = encodeSetProvider(provider.address);
      await expect(
        hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data)
      ).to.be.revertedWithCustomError(hook, "AttestationFailed")
        .withArgs(provider.address, CONDITION_HASH);
    });

    it("should skip attestation check after provider is set back to address(0)", async function () {
      await hook.setAttestationProvider(await attestationProvider.getAddress());
      await hook.setRequiredAttestation(CONDITION_HASH);
      await hook.setAttestationProvider(ethers.ZeroAddress);

      const data = encodeSetProvider(provider.address);
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });
  });

  describe("Score Staleness", function () {
    const ONE_HOUR = 3600;

    it("should allow fresh score when maxScoreAge is set", async function () {
      const Hook = await ethers.getContractFactory("AgentProofHook");
      const freshHook = await Hook.deploy(
        await oracle.getAddress(),
        await identityRegistry.getAddress(),
        MIN_SCORE, MIN_TIER, ONE_HOUR, ACP_ZERO
      );
      await freshHook.waitForDeployment();

      const data = encodeSetProvider(provider.address);
      await freshHook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });

    it("should revert when score is stale", async function () {
      const Hook = await ethers.getContractFactory("AgentProofHook");
      const staleHook = await Hook.deploy(
        await oracle.getAddress(),
        await identityRegistry.getAddress(),
        MIN_SCORE, MIN_TIER, ONE_HOUR, ACP_ZERO
      );
      await staleHook.waitForDeployment();

      const block = await ethers.provider.getBlock("latest");
      const staleTime = block.timestamp - (ONE_HOUR * 2);
      await oracle.setScoreAt(AGENT_ID, 6500, 3, staleTime);

      const data = encodeSetProvider(provider.address);
      await expect(
        staleHook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data)
      ).to.be.revertedWithCustomError(staleHook, "ScoreExpired")
        .withArgs(AGENT_ID, staleTime, ONE_HOUR);
    });

    it("should skip staleness check when maxScoreAge is 0", async function () {
      expect(await hook.maxScoreAge()).to.equal(0);
      await oracle.setScoreAt(AGENT_ID, 6500, 3, 1);

      const data = encodeSetProvider(provider.address);
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });

    it("should allow after score is refreshed", async function () {
      const Hook = await ethers.getContractFactory("AgentProofHook");
      const staleHook = await Hook.deploy(
        await oracle.getAddress(),
        await identityRegistry.getAddress(),
        MIN_SCORE, MIN_TIER, ONE_HOUR, ACP_ZERO
      );
      await staleHook.waitForDeployment();

      const block = await ethers.provider.getBlock("latest");
      await oracle.setScoreAt(AGENT_ID, 6500, 3, block.timestamp - (ONE_HOUR * 2));
      await oracle.setScore(AGENT_ID, 6500, 3); // refresh

      const data = encodeSetProvider(provider.address);
      await staleHook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });
  });

  describe("AddressResolver", function () {
    let resolver;

    beforeEach(async function () {
      const Resolver = await ethers.getContractFactory("AddressResolver");
      resolver = await Resolver.deploy(
        await oracle.getAddress(),
        await identityRegistry.getAddress()
      );
      await resolver.waitForDeployment();
    });

    it("should resolve address to trust score", async function () {
      const [score, tier, updatedAt] = await resolver.getTrustScore(provider.address);
      expect(score).to.equal(6500);
      expect(tier).to.equal(3);
      expect(updatedAt).to.be.gt(0);
    });

    it("should revert for unregistered address", async function () {
      await expect(
        resolver.getTrustScore(unregistered.address)
      ).to.be.revertedWithCustomError(resolver, "NotRegistered")
        .withArgs(unregistered.address);
    });

    it("should check meetsThreshold correctly", async function () {
      expect(await resolver.meetsThreshold(provider.address, 3000)).to.be.true;
      expect(await resolver.meetsThreshold(provider.address, 6500)).to.be.true;
      expect(await resolver.meetsThreshold(provider.address, 6501)).to.be.false;
    });

    it("should return false for unregistered address on meetsThreshold", async function () {
      expect(await resolver.meetsThreshold(unregistered.address, 1000)).to.be.false;
    });

    it("should resolve agent ID from address", async function () {
      expect(await resolver.resolveAgentId(provider.address)).to.equal(AGENT_ID);
      expect(await resolver.resolveAgentId(provider2.address)).to.equal(AGENT_ID_2);
    });

    it("should revert resolveAgentId for unregistered address", async function () {
      await expect(
        resolver.resolveAgentId(unregistered.address)
      ).to.be.revertedWithCustomError(resolver, "NotRegistered")
        .withArgs(unregistered.address);
    });
  });
});
