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
      MIN_TIER
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

    it("should revert with zero oracle address", async function () {
      const Hook = await ethers.getContractFactory("AgentProofHook");
      await expect(
        Hook.deploy(ethers.ZeroAddress, await identityRegistry.getAddress(), MIN_SCORE, MIN_TIER)
      ).to.be.revertedWithCustomError(hook, "ZeroAddress");
    });

    it("should revert with zero registry address", async function () {
      const Hook = await ethers.getContractFactory("AgentProofHook");
      await expect(
        Hook.deploy(await oracle.getAddress(), ethers.ZeroAddress, MIN_SCORE, MIN_TIER)
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
  });
});
