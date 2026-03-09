const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentProofHook", function () {
  let hook, oracle, identityRegistry;
  let owner, escrow, provider, provider2, unregistered;

  const AGENT_ID = 1;
  const AGENT_ID_2 = 2;
  const JOB_ID = 100;
  const MIN_SCORE = 3000; // 30.00
  const MIN_TIER = 1;     // bronze
  const MAX_SCORE_AGE = 0; // 0 = no expiry (default for most tests)

  // ERC-8183 function selectors
  const SEL_SET_PROVIDER = ethers.id("setProvider(uint256,address)").slice(0, 10);
  const SEL_COMPLETE = ethers.id("complete(uint256)").slice(0, 10);
  const SEL_REJECT = ethers.id("reject(uint256)").slice(0, 10);
  const SEL_FUND = ethers.id("fund(uint256)").slice(0, 10);
  const SEL_SUBMIT = ethers.id("submit(uint256,bytes)").slice(0, 10);

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

    // Register provider → agent ID 1
    await identityRegistry.registerAgent(provider.address, AGENT_ID);
    // Register provider2 → agent ID 2
    await identityRegistry.registerAgent(provider2.address, AGENT_ID_2);

    // Set trust scores
    await oracle.setScore(AGENT_ID, 6500, 3); // 65.00, gold
    await oracle.setScore(AGENT_ID_2, 2000, 0); // 20.00, unranked

    // Deploy AgentProofHook
    const Hook = await ethers.getContractFactory("AgentProofHook");
    hook = await Hook.deploy(
      await oracle.getAddress(),
      await identityRegistry.getAddress(),
      MIN_SCORE,
      MIN_TIER,
      MAX_SCORE_AGE
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

    it("should revert with zero oracle address", async function () {
      const Hook = await ethers.getContractFactory("AgentProofHook");
      await expect(
        Hook.deploy(ethers.ZeroAddress, await identityRegistry.getAddress(), MIN_SCORE, MIN_TIER, MAX_SCORE_AGE)
      ).to.be.revertedWithCustomError(hook, "ZeroAddress");
    });

    it("should revert with zero registry address", async function () {
      const Hook = await ethers.getContractFactory("AgentProofHook");
      await expect(
        Hook.deploy(await oracle.getAddress(), ethers.ZeroAddress, MIN_SCORE, MIN_TIER, MAX_SCORE_AGE)
      ).to.be.revertedWithCustomError(hook, "ZeroAddress");
    });
  });

  describe("beforeAction — Provider Gating", function () {
    it("should allow provider with sufficient score and tier", async function () {
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      // Should not revert
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });

    it("should revert when provider score is below minScore", async function () {
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider2.address]
      );
      await expect(
        hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data)
      ).to.be.revertedWithCustomError(hook, "ScoreTooLow")
        .withArgs(AGENT_ID_2, 2000, MIN_SCORE);
    });

    it("should revert when provider tier is below minTier", async function () {
      // Set score high but tier still 0 (unranked)
      await oracle.setScore(AGENT_ID_2, 5000, 0);
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider2.address]
      );
      await expect(
        hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data)
      ).to.be.revertedWithCustomError(hook, "TierTooLow")
        .withArgs(AGENT_ID_2, 0, MIN_TIER);
    });

    it("should revert when provider is not registered", async function () {
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, unregistered.address]
      );
      await expect(
        hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data)
      ).to.be.revertedWithCustomError(hook, "AgentNotRegistered")
        .withArgs(unregistered.address);
    });

    it("should revert when provider has no score", async function () {
      // Register a new agent with no score
      const newAgent = 99;
      await identityRegistry.registerAgent(unregistered.address, newAgent);
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, unregistered.address]
      );
      await expect(
        hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data)
      ).to.be.revertedWithCustomError(hook, "AgentNotScored")
        .withArgs(newAgent);
    });

    it("should pass through non-setProvider actions (fund, submit)", async function () {
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [JOB_ID]);
      // fund — should not revert
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_FUND, data);
      // submit — should not revert
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SUBMIT, data);
    });
  });

  describe("afterAction — Job Outcome Recording", function () {
    it("should record completed job and emit event", async function () {
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      await expect(hook.connect(escrow).afterAction(JOB_ID, SEL_COMPLETE, data))
        .to.emit(hook, "JobOutcomeRecorded")
        .withArgs(AGENT_ID, JOB_ID, true);

      const [completed, rejected, lastJobAt] = await hook.getAgentJobStats(AGENT_ID);
      expect(completed).to.equal(1);
      expect(rejected).to.equal(0);
      expect(lastJobAt).to.be.gt(0);
    });

    it("should record rejected job and emit event", async function () {
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      await expect(hook.connect(escrow).afterAction(JOB_ID, SEL_REJECT, data))
        .to.emit(hook, "JobOutcomeRecorded")
        .withArgs(AGENT_ID, JOB_ID, false);

      const [completed, rejected] = await hook.getAgentJobStats(AGENT_ID);
      expect(completed).to.equal(0);
      expect(rejected).to.equal(1);
    });

    it("should accumulate stats across multiple jobs", async function () {
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      await hook.connect(escrow).afterAction(JOB_ID, SEL_COMPLETE, data);
      await hook.connect(escrow).afterAction(JOB_ID + 1, SEL_COMPLETE, data);
      await hook.connect(escrow).afterAction(JOB_ID + 2, SEL_REJECT, data);

      const [completed, rejected] = await hook.getAgentJobStats(AGENT_ID);
      expect(completed).to.equal(2);
      expect(rejected).to.equal(1);
    });

    it("should silently skip unregistered provider on outcome", async function () {
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, unregistered.address]
      );
      // Should not revert — silently skips
      await hook.connect(escrow).afterAction(JOB_ID, SEL_COMPLETE, data);
    });

    it("should pass through non-outcome actions (fund)", async function () {
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [JOB_ID]);
      await hook.connect(escrow).afterAction(JOB_ID, SEL_FUND, data);
    });
  });

  describe("Completion Rate", function () {
    it("should return 0 rate and 0 total for agent with no jobs", async function () {
      const [rate, total] = await hook.getCompletionRate(999);
      expect(rate).to.equal(0);
      expect(total).to.equal(0);
    });

    it("should calculate correct completion rate", async function () {
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      // 3 completed, 1 rejected = 75%
      await hook.connect(escrow).afterAction(1, SEL_COMPLETE, data);
      await hook.connect(escrow).afterAction(2, SEL_COMPLETE, data);
      await hook.connect(escrow).afterAction(3, SEL_COMPLETE, data);
      await hook.connect(escrow).afterAction(4, SEL_REJECT, data);

      const [rate, total] = await hook.getCompletionRate(AGENT_ID);
      expect(rate).to.equal(7500); // 75.00%
      expect(total).to.equal(4);
    });

    it("should return 10000 for 100% completion", async function () {
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      await hook.connect(escrow).afterAction(1, SEL_COMPLETE, data);
      await hook.connect(escrow).afterAction(2, SEL_COMPLETE, data);

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
  });

  describe("Attestation Provider Gating", function () {
    let attestationProvider;
    const CONDITION_HASH = ethers.id("holds >= 1 USDC on avalanche");

    beforeEach(async function () {
      // Deploy mock attestation provider
      const MockAttestation = await ethers.getContractFactory("MockAttestationProvider");
      attestationProvider = await MockAttestation.deploy();
      await attestationProvider.waitForDeployment();
    });

    it("should pass through when no attestation provider is set", async function () {
      // No attestation provider configured — backward compatible
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });

    it("should allow provider that passes attestation", async function () {
      // Configure attestation
      await hook.setAttestationProvider(await attestationProvider.getAddress());
      await hook.setRequiredAttestation(CONDITION_HASH);
      await attestationProvider.setResult(provider.address, true);

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      // Should not revert
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });

    it("should revert when provider fails attestation", async function () {
      await hook.setAttestationProvider(await attestationProvider.getAddress());
      await hook.setRequiredAttestation(CONDITION_HASH);
      // provider passes trust score but NOT attestation (default is false)

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      await expect(
        hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data)
      ).to.be.revertedWithCustomError(hook, "AttestationFailed")
        .withArgs(provider.address, CONDITION_HASH);
    });

    it("should skip attestation check after provider is set back to address(0)", async function () {
      // Enable then disable
      await hook.setAttestationProvider(await attestationProvider.getAddress());
      await hook.setRequiredAttestation(CONDITION_HASH);
      await hook.setAttestationProvider(ethers.ZeroAddress);

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      // Should pass — attestation disabled
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });
  });

  describe("Score Staleness", function () {
    const ONE_HOUR = 3600;

    it("should allow fresh score when maxScoreAge is set", async function () {
      // Deploy hook with 1-hour max age
      const Hook = await ethers.getContractFactory("AgentProofHook");
      const freshHook = await Hook.deploy(
        await oracle.getAddress(),
        await identityRegistry.getAddress(),
        MIN_SCORE,
        MIN_TIER,
        ONE_HOUR
      );
      await freshHook.waitForDeployment();

      // Score was just set in beforeEach — it's fresh
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      await freshHook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });

    it("should revert when score is stale", async function () {
      const Hook = await ethers.getContractFactory("AgentProofHook");
      const staleHook = await Hook.deploy(
        await oracle.getAddress(),
        await identityRegistry.getAddress(),
        MIN_SCORE,
        MIN_TIER,
        ONE_HOUR
      );
      await staleHook.waitForDeployment();

      // Set score with an old timestamp (2 hours ago)
      const block = await ethers.provider.getBlock("latest");
      const staleTime = block.timestamp - (ONE_HOUR * 2);
      await oracle.setScoreAt(AGENT_ID, 6500, 3, staleTime);

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      await expect(
        staleHook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data)
      ).to.be.revertedWithCustomError(staleHook, "ScoreExpired")
        .withArgs(AGENT_ID, staleTime, ONE_HOUR);
    });

    it("should skip staleness check when maxScoreAge is 0", async function () {
      // Default hook has maxScoreAge = 0
      expect(await hook.maxScoreAge()).to.equal(0);

      // Set an old score — should still pass because staleness is disabled
      await oracle.setScoreAt(AGENT_ID, 6500, 3, 1);

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });

    it("should allow after score is refreshed", async function () {
      const Hook = await ethers.getContractFactory("AgentProofHook");
      const staleHook = await Hook.deploy(
        await oracle.getAddress(),
        await identityRegistry.getAddress(),
        MIN_SCORE,
        MIN_TIER,
        ONE_HOUR
      );
      await staleHook.waitForDeployment();

      // Set stale score
      const block = await ethers.provider.getBlock("latest");
      await oracle.setScoreAt(AGENT_ID, 6500, 3, block.timestamp - (ONE_HOUR * 2));

      // Refresh it
      await oracle.setScore(AGENT_ID, 6500, 3);

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address"],
        [JOB_ID, provider.address]
      );
      // Should pass now — score is fresh
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
      // provider has score 6500
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
