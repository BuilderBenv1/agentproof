const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("InsurancePool", function () {
  let identityRegistry, validationRegistry, insurancePool;
  let owner, agent1Owner, agent2Owner, claimant;
  const BOND = ethers.parseEther("0.1");
  const URI = "https://example.com/agent.json";
  const TASK_HASH = ethers.keccak256(ethers.toUtf8Bytes("task-1"));
  const TASK_URI = "https://example.com/task.json";

  beforeEach(async function () {
    [owner, agent1Owner, agent2Owner, claimant] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.waitForDeployment();

    const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
    validationRegistry = await ValidationRegistry.deploy(await identityRegistry.getAddress());
    await validationRegistry.waitForDeployment();

    const InsurancePool = await ethers.getContractFactory("InsurancePool");
    insurancePool = await InsurancePool.deploy(
      await identityRegistry.getAddress(),
      await validationRegistry.getAddress()
    );
    await insurancePool.waitForDeployment();

    // Register agent 1
    await identityRegistry.connect(agent1Owner).registerAgent(URI, { value: BOND });
  });

  describe("Staking", function () {
    it("should allow agent owner to stake with correct tier", async function () {
      await insurancePool.connect(agent1Owner).stakeForAgent(1, "gold", {
        value: ethers.parseEther("0.2"),
      });
      const [amount, tier, isStaked] = await insurancePool.getAgentStake(1);
      expect(amount).to.equal(ethers.parseEther("0.2"));
      expect(tier).to.equal("gold");
      expect(isStaked).to.be.true;
    });

    it("should revert if below minimum stake", async function () {
      await expect(
        insurancePool.connect(agent1Owner).stakeForAgent(1, "gold", {
          value: ethers.parseEther("0.1"),
        })
      ).to.be.revertedWith("Below minimum stake for tier");
    });

    it("should revert if not agent owner", async function () {
      await expect(
        insurancePool.connect(claimant).stakeForAgent(1, "unranked", {
          value: ethers.parseEther("1"),
        })
      ).to.be.revertedWith("Not agent owner");
    });

    it("should revert if already staked", async function () {
      await insurancePool.connect(agent1Owner).stakeForAgent(1, "unranked", {
        value: ethers.parseEther("1"),
      });
      await expect(
        insurancePool.connect(agent1Owner).stakeForAgent(1, "unranked", {
          value: ethers.parseEther("1"),
        })
      ).to.be.revertedWith("Already staked");
    });

    it("should return correct minimum stakes for all tiers", async function () {
      expect(await insurancePool.getMinimumStake("diamond")).to.equal(ethers.parseEther("0.05"));
      expect(await insurancePool.getMinimumStake("platinum")).to.equal(ethers.parseEther("0.1"));
      expect(await insurancePool.getMinimumStake("gold")).to.equal(ethers.parseEther("0.2"));
      expect(await insurancePool.getMinimumStake("silver")).to.equal(ethers.parseEther("0.3"));
      expect(await insurancePool.getMinimumStake("bronze")).to.equal(ethers.parseEther("0.5"));
      expect(await insurancePool.getMinimumStake("unranked")).to.equal(ethers.parseEther("1"));
    });

    it("should report insured status", async function () {
      expect(await insurancePool.isInsured(1)).to.be.false;
      await insurancePool.connect(agent1Owner).stakeForAgent(1, "unranked", {
        value: ethers.parseEther("1"),
      });
      expect(await insurancePool.isInsured(1)).to.be.true;
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      await insurancePool.connect(agent1Owner).stakeForAgent(1, "unranked", {
        value: ethers.parseEther("1"),
      });
    });

    it("should request unstake", async function () {
      await insurancePool.connect(agent1Owner).requestUnstake(1);
      const stake = await insurancePool.agentStakes(1);
      expect(stake.unstakeRequestedAt).to.be.gt(0);
    });

    it("should unstake after cooldown", async function () {
      await insurancePool.connect(agent1Owner).requestUnstake(1);
      await time.increase(7 * 24 * 60 * 60 + 1); // 7 days + 1s
      const balBefore = await ethers.provider.getBalance(agent1Owner.address);
      await insurancePool.connect(agent1Owner).unstake(1);
      const balAfter = await ethers.provider.getBalance(agent1Owner.address);
      expect(balAfter).to.be.gt(balBefore);
      expect(await insurancePool.isInsured(1)).to.be.false;
    });

    it("should revert unstake before cooldown", async function () {
      await insurancePool.connect(agent1Owner).requestUnstake(1);
      await expect(
        insurancePool.connect(agent1Owner).unstake(1)
      ).to.be.revertedWith("Cooldown not elapsed");
    });
  });

  describe("Claims", function () {
    beforeEach(async function () {
      // Stake for agent 1
      await insurancePool.connect(agent1Owner).stakeForAgent(1, "unranked", {
        value: ethers.parseEther("1"),
      });
      // Create a validation that fails
      await validationRegistry.connect(claimant).requestValidation(1, TASK_HASH, TASK_URI);
      await validationRegistry.connect(owner).submitValidation(1, false, "https://proof.json");
    });

    it("should file a claim against a failed validation", async function () {
      await insurancePool.connect(claimant).fileClaim(
        1, 1, ethers.parseEther("0.5"), "https://evidence.json"
      );
      const claim = await insurancePool.getClaim(1);
      expect(claim.agentId).to.equal(1);
      expect(claim.claimant).to.equal(claimant.address);
      expect(claim.amount).to.equal(ethers.parseEther("0.5"));
      expect(claim.status).to.equal(0); // Pending
    });

    it("should allow agent to dispute within window", async function () {
      await insurancePool.connect(claimant).fileClaim(
        1, 1, ethers.parseEther("0.5"), "https://evidence.json"
      );
      await insurancePool.connect(agent1Owner).disputeClaim(1, "https://dispute.json");
      const claim = await insurancePool.getClaim(1);
      expect(claim.status).to.equal(1); // Disputed
    });

    it("should resolve claim in favor of claimant", async function () {
      await insurancePool.connect(claimant).fileClaim(
        1, 1, ethers.parseEther("0.5"), "https://evidence.json"
      );
      const balBefore = await ethers.provider.getBalance(claimant.address);
      await insurancePool.connect(owner).resolveClaim(1, true);
      const balAfter = await ethers.provider.getBalance(claimant.address);
      expect(balAfter).to.be.gt(balBefore);
      const claim = await insurancePool.getClaim(1);
      expect(claim.status).to.equal(2); // Approved
    });

    it("should resolve claim in favor of agent", async function () {
      await insurancePool.connect(claimant).fileClaim(
        1, 1, ethers.parseEther("0.5"), "https://evidence.json"
      );
      await insurancePool.connect(owner).resolveClaim(1, false);
      const claim = await insurancePool.getClaim(1);
      expect(claim.status).to.equal(3); // Rejected
    });

    it("should prevent unstake with pending claims", async function () {
      await insurancePool.connect(claimant).fileClaim(
        1, 1, ethers.parseEther("0.5"), "https://evidence.json"
      );
      await expect(
        insurancePool.connect(agent1Owner).requestUnstake(1)
      ).to.be.revertedWith("Has pending claims");
    });

    it("should track agent claims", async function () {
      await insurancePool.connect(claimant).fileClaim(
        1, 1, ethers.parseEther("0.3"), "https://ev1.json"
      );
      // Resolve first claim so we can file another
      await insurancePool.connect(owner).resolveClaim(1, false);
      await insurancePool.connect(claimant).fileClaim(
        1, 1, ethers.parseEther("0.2"), "https://ev2.json"
      );
      const claimIds = await insurancePool.getAgentClaims(1);
      expect(claimIds.length).to.equal(2);
    });
  });
});
