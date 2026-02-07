const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReputationGate", function () {
  let identityRegistry, reputationRegistry, validationRegistry, agentProofCore, reputationGate;
  let owner, agent1, agent2, reviewer;
  const BOND = ethers.parseEther("0.1");
  const URI = "https://example.com/agent.json";

  beforeEach(async function () {
    [owner, agent1, agent2, reviewer] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.waitForDeployment();

    const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
    reputationRegistry = await ReputationRegistry.deploy(await identityRegistry.getAddress());
    await reputationRegistry.waitForDeployment();

    const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
    validationRegistry = await ValidationRegistry.deploy(await identityRegistry.getAddress());
    await validationRegistry.waitForDeployment();

    const AgentProofCore = await ethers.getContractFactory("AgentProofCore");
    agentProofCore = await AgentProofCore.deploy(
      await identityRegistry.getAddress(),
      await reputationRegistry.getAddress(),
      await validationRegistry.getAddress()
    );
    await agentProofCore.waitForDeployment();

    const ReputationGate = await ethers.getContractFactory("ReputationGate");
    reputationGate = await ReputationGate.deploy(await agentProofCore.getAddress());
    await reputationGate.waitForDeployment();

    // Register an agent
    await identityRegistry.connect(agent1).registerAgent(URI, { value: BOND });
  });

  describe("Tier Gating", function () {
    it("should not revert for unranked agent with unranked requirement", async function () {
      // Agent has no feedback, so unranked
      await expect(
        reputationGate.requireMinimumTier(1, "unranked")
      ).to.not.be.reverted;
    });

    it("should revert if agent doesn't meet tier", async function () {
      await expect(
        reputationGate.requireMinimumTier(1, "bronze")
      ).to.be.revertedWith("Agent does not meet minimum tier");
    });
  });

  describe("Collateral Multiplier", function () {
    it("should return 10000 for unranked agent", async function () {
      const multiplier = await reputationGate.getCollateralMultiplier(1);
      expect(multiplier).to.equal(10000);
    });
  });

  describe("Interest Rate Discount", function () {
    it("should return 0 for unranked agent", async function () {
      const discount = await reputationGate.getInterestRateDiscount(1);
      expect(discount).to.equal(0);
    });
  });

  describe("Priority Score", function () {
    it("should return average rating as priority", async function () {
      const score = await reputationGate.getPriorityScore(1);
      expect(score).to.equal(0); // No feedback yet
    });
  });

  describe("Batch Check", function () {
    it("should check multiple agents at once", async function () {
      await identityRegistry.connect(agent2).registerAgent(URI, { value: BOND });
      const results = await reputationGate.batchCheckTier([1, 2], "unranked");
      expect(results[0]).to.be.true;
      expect(results[1]).to.be.true;
    });

    it("should fail batch check for agents below tier", async function () {
      const results = await reputationGate.batchCheckTier([1], "bronze");
      expect(results[0]).to.be.false;
    });
  });

  describe("Trust for Value", function () {
    it("should trust unranked for small values", async function () {
      const trusted = await reputationGate.isTrustedForValue(1, 50e6); // $50
      expect(trusted).to.be.true;
    });

    it("should not trust unranked for large values", async function () {
      const trusted = await reputationGate.isTrustedForValue(1, 200e6); // $200
      expect(trusted).to.be.false;
    });

    it("should return max trusted value", async function () {
      const maxVal = await reputationGate.getMaxTrustedValue(1);
      expect(maxVal).to.equal(100e6); // $100 for unranked
    });
  });
});
