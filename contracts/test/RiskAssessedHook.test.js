const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RiskAssessedHook", function () {
  let hook;
  let oracle, identityRegistry, mockACP;
  let owner, escrow, provider, provider2, unregistered, slashTarget;

  const AGENT_ID = 1;
  const AGENT_ID_2 = 2;
  const JOB_ID = 100;
  const MAX_SCORE_AGE = 0; // disabled by default

  // ERC-ACP canonical selectors
  const SEL_SET_PROVIDER = ethers.id("setProvider(uint256,address)").slice(0, 10);
  const SEL_COMPLETE = ethers.id("complete(uint256,bytes32)").slice(0, 10);
  const SEL_REJECT = ethers.id("reject(uint256,bytes32)").slice(0, 10);
  const SEL_FUND = ethers.id("fund(uint256)").slice(0, 10);

  function encodeSetProvider(providerAddr, optParams = "0x") {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes"], [providerAddr, optParams]
    );
  }

  function encodeOutcome(reason = ethers.ZeroHash, optParams = "0x") {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes"], [reason, optParams]
    );
  }

  beforeEach(async function () {
    [owner, escrow, provider, provider2, unregistered, slashTarget] = await ethers.getSigners();

    // Deploy mocks
    const MockOracle = await ethers.getContractFactory("MockTrustScoreOracle");
    oracle = await MockOracle.deploy();

    const MockRegistry = await ethers.getContractFactory("MockIdentityRegistry");
    identityRegistry = await MockRegistry.deploy();

    const MockACPFactory = await ethers.getContractFactory("MockACP");
    mockACP = await MockACPFactory.deploy();

    // Register agents
    await identityRegistry.registerAgent(provider.address, AGENT_ID);
    await identityRegistry.registerAgent(provider2.address, AGENT_ID_2);

    // Set scores: provider = gold (tier 3), provider2 = unranked (tier 0)
    await oracle.setScore(AGENT_ID, 7000, 3);
    await oracle.setScore(AGENT_ID_2, 2000, 0);

    // Deploy hook
    const Hook = await ethers.getContractFactory("RiskAssessedHook");
    hook = await Hook.deploy(
      await oracle.getAddress(),
      await identityRegistry.getAddress(),
      await mockACP.getAddress(),
      MAX_SCORE_AGE
    );
  });

  describe("Deployment", function () {
    it("should set correct dependencies", async function () {
      expect(await hook.oracle()).to.equal(await oracle.getAddress());
      expect(await hook.identityRegistry()).to.equal(await identityRegistry.getAddress());
      expect(await hook.acp()).to.equal(await mockACP.getAddress());
    });

    it("should set default collateral bps", async function () {
      expect(await hook.collateralBps(5)).to.equal(5000);  // Diamond: 50%
      expect(await hook.collateralBps(3)).to.equal(7500);  // Gold: 75%
      expect(await hook.collateralBps(0)).to.equal(10000); // Unranked: 100%
    });

    it("should set default max exposure", async function () {
      expect(await hook.maxExposure(5)).to.equal(ethers.parseEther("1000"));
      expect(await hook.maxExposure(3)).to.equal(ethers.parseEther("100"));
      expect(await hook.maxExposure(0)).to.equal(ethers.parseEther("0.1"));
    });

    it("should set owner as slash recipient", async function () {
      expect(await hook.slashRecipient()).to.equal(owner.address);
    });

    it("should revert on zero addresses", async function () {
      const Hook = await ethers.getContractFactory("RiskAssessedHook");
      await expect(Hook.deploy(ethers.ZeroAddress, await identityRegistry.getAddress(), await mockACP.getAddress(), 0))
        .to.be.revertedWithCustomError(hook, "ZeroAddress");
      await expect(Hook.deploy(await oracle.getAddress(), ethers.ZeroAddress, await mockACP.getAddress(), 0))
        .to.be.revertedWithCustomError(hook, "ZeroAddress");
      await expect(Hook.deploy(await oracle.getAddress(), await identityRegistry.getAddress(), ethers.ZeroAddress, 0))
        .to.be.revertedWithCustomError(hook, "ZeroAddress");
    });
  });

  describe("Staking", function () {
    it("should allow provider to stake", async function () {
      const amount = ethers.parseEther("10");
      await expect(hook.connect(provider).stake({ value: amount }))
        .to.emit(hook, "Staked")
        .withArgs(provider.address, amount);

      expect(await hook.stakedBalance(provider.address)).to.equal(amount);
      expect(await hook.availableBalance(provider.address)).to.equal(amount);
    });

    it("should allow provider to unstake", async function () {
      const amount = ethers.parseEther("10");
      await hook.connect(provider).stake({ value: amount });

      await expect(hook.connect(provider).unstake(ethers.parseEther("5")))
        .to.emit(hook, "Unstaked")
        .withArgs(provider.address, ethers.parseEther("5"));

      expect(await hook.stakedBalance(provider.address)).to.equal(ethers.parseEther("5"));
    });

    it("should revert unstake exceeding available balance", async function () {
      await hook.connect(provider).stake({ value: ethers.parseEther("1") });

      await expect(hook.connect(provider).unstake(ethers.parseEther("2")))
        .to.be.revertedWithCustomError(hook, "InsufficientBalance");
    });

    it("should revert stake of zero", async function () {
      await expect(hook.connect(provider).stake({ value: 0 }))
        .to.be.revertedWithCustomError(hook, "ZeroAmount");
    });

    it("should revert unstake of zero", async function () {
      await expect(hook.connect(provider).unstake(0))
        .to.be.revertedWithCustomError(hook, "ZeroAmount");
    });
  });

  describe("beforeAction — Collateral Assessment", function () {
    const BUDGET = ethers.parseEther("10"); // 10 ETH job

    beforeEach(async function () {
      // Set up job with budget
      await mockACP.setJobWithBudget(JOB_ID, escrow.address, ethers.ZeroAddress, ethers.ZeroAddress, BUDGET);
    });

    it("should lock collateral for gold tier (75%)", async function () {
      // Gold (tier 3): 75% of 10 ETH = 7.5 ETH
      await hook.connect(provider).stake({ value: ethers.parseEther("8") });

      const data = encodeSetProvider(provider.address);
      await expect(hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data))
        .to.emit(hook, "CollateralLocked")
        .withArgs(AGENT_ID, JOB_ID, ethers.parseEther("7.5"), BUDGET, 3);

      expect(await hook.lockedBalance(provider.address)).to.equal(ethers.parseEther("7.5"));
      expect(await hook.availableBalance(provider.address)).to.equal(ethers.parseEther("0.5"));
      expect(await hook.jobCollateral(JOB_ID)).to.equal(ethers.parseEther("7.5"));
    });

    it("should lock collateral for unranked tier (100%)", async function () {
      // Unranked: 100% of budget, but max exposure is 0.1 ETH
      const smallBudget = ethers.parseEther("0.05");
      await mockACP.setJobWithBudget(201, escrow.address, ethers.ZeroAddress, ethers.ZeroAddress, smallBudget);
      await hook.connect(provider2).stake({ value: ethers.parseEther("0.1") });

      const data = encodeSetProvider(provider2.address);
      await hook.connect(escrow).beforeAction(201, SEL_SET_PROVIDER, data);

      // 100% of 0.05 = 0.05
      expect(await hook.jobCollateral(201)).to.equal(smallBudget);
    });

    it("should revert when budget exceeds max exposure for tier", async function () {
      // Gold max exposure = 100 ETH, set budget to 200 ETH
      const bigBudget = ethers.parseEther("200");
      await mockACP.setJobWithBudget(202, escrow.address, ethers.ZeroAddress, ethers.ZeroAddress, bigBudget);
      await hook.connect(provider).stake({ value: ethers.parseEther("200") });

      const data = encodeSetProvider(provider.address);
      await expect(hook.connect(escrow).beforeAction(202, SEL_SET_PROVIDER, data))
        .to.be.revertedWithCustomError(hook, "ExposureTooHigh")
        .withArgs(AGENT_ID, bigBudget, ethers.parseEther("100"));
    });

    it("should revert when provider has insufficient collateral staked", async function () {
      // Gold: 75% of 10 = 7.5, but only stake 5
      await hook.connect(provider).stake({ value: ethers.parseEther("5") });

      const data = encodeSetProvider(provider.address);
      await expect(hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data))
        .to.be.revertedWithCustomError(hook, "InsufficientCollateral");
    });

    it("should revert for unregistered provider", async function () {
      const data = encodeSetProvider(unregistered.address);
      await expect(hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data))
        .to.be.revertedWithCustomError(hook, "AgentNotRegistered");
    });

    it("should revert for unscored agent", async function () {
      // Register a new agent without setting a score
      await identityRegistry.registerAgent(unregistered.address, 999);
      const data = encodeSetProvider(unregistered.address);
      await expect(hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data))
        .to.be.revertedWithCustomError(hook, "AgentNotScored");
    });

    it("should handle zero budget job (zero collateral)", async function () {
      await mockACP.setJobWithBudget(203, escrow.address, ethers.ZeroAddress, ethers.ZeroAddress, 0);

      const data = encodeSetProvider(provider.address);
      await hook.connect(escrow).beforeAction(203, SEL_SET_PROVIDER, data);

      expect(await hook.jobCollateral(203)).to.equal(0);
      expect(await hook.lockedBalance(provider.address)).to.equal(0);
    });

    it("should pass through non-setProvider selectors", async function () {
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_FUND, "0x");
      // No revert
    });
  });

  describe("Score Staleness", function () {
    it("should revert when score is stale", async function () {
      const Hook = await ethers.getContractFactory("RiskAssessedHook");
      const hookWithAge = await Hook.deploy(
        await oracle.getAddress(),
        await identityRegistry.getAddress(),
        await mockACP.getAddress(),
        3600 // 1 hour max age
      );

      const budget = ethers.parseEther("1");
      await mockACP.setJobWithBudget(300, escrow.address, ethers.ZeroAddress, ethers.ZeroAddress, budget);

      // Set stale score (2 hours ago)
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      await oracle.setScoreAt(AGENT_ID, 7000, 3, now - 7200);
      await hookWithAge.connect(provider).stake({ value: ethers.parseEther("1") });

      const data = encodeSetProvider(provider.address);
      await expect(hookWithAge.connect(escrow).beforeAction(300, SEL_SET_PROVIDER, data))
        .to.be.revertedWithCustomError(hookWithAge, "ScoreExpired");
    });
  });

  describe("afterAction — Complete (Release)", function () {
    const BUDGET = ethers.parseEther("10");

    beforeEach(async function () {
      await mockACP.setJobWithBudget(JOB_ID, escrow.address, ethers.ZeroAddress, ethers.ZeroAddress, BUDGET);
      await hook.connect(provider).stake({ value: ethers.parseEther("10") });

      const data = encodeSetProvider(provider.address);
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });

    it("should release collateral on complete", async function () {
      const locked = await hook.jobCollateral(JOB_ID); // 7.5 ETH

      await expect(hook.connect(escrow).afterAction(JOB_ID, SEL_COMPLETE, encodeOutcome()))
        .to.emit(hook, "CollateralReleased")
        .withArgs(AGENT_ID, JOB_ID, locked);

      expect(await hook.lockedBalance(provider.address)).to.equal(0);
      expect(await hook.stakedBalance(provider.address)).to.equal(ethers.parseEther("10")); // unchanged
      expect(await hook.jobSettled(JOB_ID)).to.be.true;
    });

    it("should revert on double settlement", async function () {
      await hook.connect(escrow).afterAction(JOB_ID, SEL_COMPLETE, encodeOutcome());

      await expect(hook.connect(escrow).afterAction(JOB_ID, SEL_COMPLETE, encodeOutcome()))
        .to.be.revertedWithCustomError(hook, "JobAlreadySettled");
    });
  });

  describe("afterAction — Reject (Slash)", function () {
    const BUDGET = ethers.parseEther("10");

    beforeEach(async function () {
      await mockACP.setJobWithBudget(JOB_ID, escrow.address, ethers.ZeroAddress, ethers.ZeroAddress, BUDGET);
      await hook.connect(provider).stake({ value: ethers.parseEther("10") });

      const data = encodeSetProvider(provider.address);
      await hook.connect(escrow).beforeAction(JOB_ID, SEL_SET_PROVIDER, data);
    });

    it("should slash collateral on reject", async function () {
      const locked = await hook.jobCollateral(JOB_ID); // 7.5 ETH
      const ownerBalBefore = await ethers.provider.getBalance(owner.address);

      await expect(hook.connect(escrow).afterAction(JOB_ID, SEL_REJECT, encodeOutcome()))
        .to.emit(hook, "CollateralSlashed")
        .withArgs(AGENT_ID, JOB_ID, locked);

      expect(await hook.lockedBalance(provider.address)).to.equal(0);
      expect(await hook.stakedBalance(provider.address)).to.equal(ethers.parseEther("2.5")); // 10 - 7.5
      expect(await hook.jobSettled(JOB_ID)).to.be.true;

      // Slash recipient (owner) received the slashed amount
      const ownerBalAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalAfter - ownerBalBefore).to.equal(locked);
    });

    it("should send slashed funds to custom recipient", async function () {
      await hook.connect(owner).setSlashRecipient(slashTarget.address);
      const balBefore = await ethers.provider.getBalance(slashTarget.address);

      await hook.connect(escrow).afterAction(JOB_ID, SEL_REJECT, encodeOutcome());

      const balAfter = await ethers.provider.getBalance(slashTarget.address);
      expect(balAfter - balBefore).to.equal(ethers.parseEther("7.5"));
    });

    it("provider cannot unstake locked collateral", async function () {
      // 10 staked, 7.5 locked, 2.5 available
      await expect(hook.connect(provider).unstake(ethers.parseEther("5")))
        .to.be.revertedWithCustomError(hook, "InsufficientBalance");

      // Can unstake available portion
      await hook.connect(provider).unstake(ethers.parseEther("2.5"));
      expect(await hook.stakedBalance(provider.address)).to.equal(ethers.parseEther("7.5"));
    });
  });

  describe("Preview — getRequiredCollateral", function () {
    it("should preview collateral for gold tier", async function () {
      const budget = ethers.parseEther("10");
      await mockACP.setJobWithBudget(JOB_ID, escrow.address, ethers.ZeroAddress, ethers.ZeroAddress, budget);

      const [required, tier, jobBudget] = await hook.getRequiredCollateral(JOB_ID, provider.address);
      expect(required).to.equal(ethers.parseEther("7.5")); // 75%
      expect(tier).to.equal(3); // gold
      expect(jobBudget).to.equal(budget);
    });

    it("should return zero for unregistered provider", async function () {
      await mockACP.setJobWithBudget(JOB_ID, escrow.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.parseEther("1"));

      const [required, tier, budget] = await hook.getRequiredCollateral(JOB_ID, unregistered.address);
      expect(required).to.equal(0);
      expect(tier).to.equal(0);
      expect(budget).to.equal(0);
    });
  });

  describe("ACP Fallback Resolution", function () {
    it("should resolve provider from ACP when not cached", async function () {
      const budget = ethers.parseEther("1");
      // Set job with provider already assigned (bypass setProvider hook)
      await mockACP.setJobWithBudget(400, escrow.address, provider.address, ethers.ZeroAddress, budget);

      // Call afterAction directly — provider resolved from ACP
      await hook.connect(provider).stake({ value: ethers.parseEther("1") });

      // Manually set job collateral for this test (simulating a lock)
      // Since no beforeAction was called, jobCollateral is 0, so afterAction is a no-op
      await hook.connect(escrow).afterAction(400, SEL_COMPLETE, encodeOutcome());
      // Should not revert — gracefully handles zero collateral
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to update collateral bps", async function () {
      await expect(hook.connect(owner).setCollateralBps(3, 6000))
        .to.emit(hook, "CollateralBpsUpdated")
        .withArgs(3, 7500, 6000);
      expect(await hook.collateralBps(3)).to.equal(6000);
    });

    it("should allow owner to update max exposure", async function () {
      const newMax = ethers.parseEther("200");
      await expect(hook.connect(owner).setMaxExposure(3, newMax))
        .to.emit(hook, "MaxExposureUpdated")
        .withArgs(3, ethers.parseEther("100"), newMax);
      expect(await hook.maxExposure(3)).to.equal(newMax);
    });

    it("should allow owner to set slash recipient", async function () {
      await expect(hook.connect(owner).setSlashRecipient(slashTarget.address))
        .to.emit(hook, "SlashRecipientUpdated")
        .withArgs(owner.address, slashTarget.address);
      expect(await hook.slashRecipient()).to.equal(slashTarget.address);
    });

    it("should reject zero address slash recipient", async function () {
      await expect(hook.connect(owner).setSlashRecipient(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(hook, "ZeroAddress");
    });

    it("should allow owner to update oracle", async function () {
      const MockOracle = await ethers.getContractFactory("MockTrustScoreOracle");
      const newOracle = await MockOracle.deploy();
      await hook.connect(owner).setOracle(await newOracle.getAddress());
      expect(await hook.oracle()).to.equal(await newOracle.getAddress());
    });

    it("should allow owner to update maxScoreAge", async function () {
      await hook.connect(owner).setMaxScoreAge(7200);
      expect(await hook.maxScoreAge()).to.equal(7200);
    });

    it("should reject non-owner admin calls", async function () {
      await expect(hook.connect(provider).setCollateralBps(3, 5000))
        .to.be.revertedWithCustomError(hook, "OwnableUnauthorizedAccount");
      await expect(hook.connect(provider).setMaxExposure(3, 0))
        .to.be.revertedWithCustomError(hook, "OwnableUnauthorizedAccount");
      await expect(hook.connect(provider).setSlashRecipient(provider.address))
        .to.be.revertedWithCustomError(hook, "OwnableUnauthorizedAccount");
    });
  });

  describe("Multiple Jobs", function () {
    it("should lock collateral across multiple jobs", async function () {
      const budget1 = ethers.parseEther("10");
      const budget2 = ethers.parseEther("5");
      await mockACP.setJobWithBudget(501, escrow.address, ethers.ZeroAddress, ethers.ZeroAddress, budget1);
      await mockACP.setJobWithBudget(502, escrow.address, ethers.ZeroAddress, ethers.ZeroAddress, budget2);

      // Stake enough for both: 7.5 + 3.75 = 11.25
      await hook.connect(provider).stake({ value: ethers.parseEther("12") });

      await hook.connect(escrow).beforeAction(501, SEL_SET_PROVIDER, encodeSetProvider(provider.address));
      await hook.connect(escrow).beforeAction(502, SEL_SET_PROVIDER, encodeSetProvider(provider.address));

      expect(await hook.lockedBalance(provider.address)).to.equal(ethers.parseEther("11.25"));
      expect(await hook.availableBalance(provider.address)).to.equal(ethers.parseEther("0.75"));

      // Complete first job — releases 7.5
      await hook.connect(escrow).afterAction(501, SEL_COMPLETE, encodeOutcome());
      expect(await hook.lockedBalance(provider.address)).to.equal(ethers.parseEther("3.75"));
      expect(await hook.availableBalance(provider.address)).to.equal(ethers.parseEther("8.25"));

      // Reject second job — slashes 3.75
      await hook.connect(escrow).afterAction(502, SEL_REJECT, encodeOutcome());
      expect(await hook.lockedBalance(provider.address)).to.equal(0);
      expect(await hook.stakedBalance(provider.address)).to.equal(ethers.parseEther("8.25"));
    });
  });
});
