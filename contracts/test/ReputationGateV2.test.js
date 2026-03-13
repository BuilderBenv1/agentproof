const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ReputationGateV2", function () {
  let oracle, gate;
  let owner, oracleOperator, user;
  const QUERY_FEE = ethers.parseEther("0.001");

  // Agent IDs
  const DIAMOND_AGENT = 1;
  const GOLD_AGENT = 2;
  const BRONZE_AGENT = 3;
  const UNRANKED_AGENT = 4;
  const UNSCORED_AGENT = 99;

  beforeEach(async function () {
    [owner, oracleOperator, user] = await ethers.getSigners();

    // Deploy TrustScoreOracle
    const TrustScoreOracle = await ethers.getContractFactory("TrustScoreOracle");
    oracle = await TrustScoreOracle.deploy(oracleOperator.address, QUERY_FEE);
    await oracle.waitForDeployment();

    // Deploy ReputationGateV2: minScore=3000 (30.00), minTier=1 (bronze), maxScoreAge=0
    const ReputationGateV2 = await ethers.getContractFactory("ReputationGateV2");
    gate = await ReputationGateV2.deploy(await oracle.getAddress(), 3000, 1, 0);
    await gate.waitForDeployment();

    // Seed scores
    await oracle.connect(oracleOperator).updateScore(DIAMOND_AGENT, 9500, 5);
    await oracle.connect(oracleOperator).updateScore(GOLD_AGENT, 7200, 3);
    await oracle.connect(oracleOperator).updateScore(BRONZE_AGENT, 5100, 1);
    await oracle.connect(oracleOperator).updateScore(UNRANKED_AGENT, 2000, 0);
  });

  describe("Deployment", function () {
    it("should set oracle address", async function () {
      expect(await gate.oracle()).to.equal(await oracle.getAddress());
    });

    it("should set thresholds", async function () {
      expect(await gate.minScore()).to.equal(3000);
      expect(await gate.minTier()).to.equal(1);
      expect(await gate.maxScoreAge()).to.equal(0);
    });

    it("should set default tier value limits", async function () {
      expect(await gate.tierValueLimit(0)).to.equal(100_000_000n);       // $100
      expect(await gate.tierValueLimit(1)).to.equal(1_000_000_000n);     // $1K
      expect(await gate.tierValueLimit(3)).to.equal(100_000_000_000n);   // $100K
      expect(await gate.tierValueLimit(5)).to.equal(1_000_000_000_000n); // $1M
    });

    it("should revert on zero oracle address", async function () {
      const ReputationGateV2 = await ethers.getContractFactory("ReputationGateV2");
      await expect(
        ReputationGateV2.deploy(ethers.ZeroAddress, 3000, 1, 0)
      ).to.be.revertedWithCustomError(gate, "ZeroAddress");
    });
  });

  describe("requireTrust", function () {
    it("should pass for diamond agent", async function () {
      await gate.requireTrust(DIAMOND_AGENT); // no revert
    });

    it("should pass for gold agent", async function () {
      await gate.requireTrust(GOLD_AGENT);
    });

    it("should pass for bronze agent", async function () {
      await gate.requireTrust(BRONZE_AGENT);
    });

    it("should revert for unranked agent (below minScore)", async function () {
      // Score 2000 < minScore 3000, so ScoreBelowMinimum fires first
      await expect(gate.requireTrust(UNRANKED_AGENT))
        .to.be.revertedWithCustomError(gate, "ScoreBelowMinimum")
        .withArgs(UNRANKED_AGENT, 2000, 3000);
    });

    it("should revert for unscored agent", async function () {
      await expect(gate.requireTrust(UNSCORED_AGENT))
        .to.be.revertedWithCustomError(gate, "AgentNotScored")
        .withArgs(UNSCORED_AGENT);
    });
  });

  describe("isTrusted", function () {
    it("should return true for agents meeting threshold", async function () {
      expect(await gate.isTrusted(DIAMOND_AGENT)).to.be.true;
      expect(await gate.isTrusted(GOLD_AGENT)).to.be.true;
      expect(await gate.isTrusted(BRONZE_AGENT)).to.be.true;
    });

    it("should return false for unranked agent", async function () {
      expect(await gate.isTrusted(UNRANKED_AGENT)).to.be.false;
    });

    it("should return false for unscored agent", async function () {
      expect(await gate.isTrusted(UNSCORED_AGENT)).to.be.false;
    });
  });

  describe("checkAgent", function () {
    it("should return full assessment for diamond agent", async function () {
      const [score, tier, trusted, maxValue] = await gate.checkAgent(DIAMOND_AGENT);
      expect(score).to.equal(9500);
      expect(tier).to.equal(5);
      expect(trusted).to.be.true;
      expect(maxValue).to.equal(1_000_000_000_000n); // $1M
    });

    it("should return full assessment for unranked agent", async function () {
      const [score, tier, trusted, maxValue] = await gate.checkAgent(UNRANKED_AGENT);
      expect(score).to.equal(2000);
      expect(tier).to.equal(0);
      expect(trusted).to.be.false;
      expect(maxValue).to.equal(100_000_000n); // $100
    });
  });

  describe("Value gating", function () {
    it("should approve diamond agent for $500K", async function () {
      expect(await gate.isTrustedForValue(DIAMOND_AGENT, 500_000_000_000n)).to.be.true;
    });

    it("should reject bronze agent for $10K", async function () {
      expect(await gate.isTrustedForValue(BRONZE_AGENT, 10_000_000_000n)).to.be.false;
    });

    it("should approve bronze agent for $500", async function () {
      expect(await gate.isTrustedForValue(BRONZE_AGENT, 500_000_000n)).to.be.true;
    });

    it("should return correct max value per tier", async function () {
      expect(await gate.getMaxValue(DIAMOND_AGENT)).to.equal(1_000_000_000_000n);
      expect(await gate.getMaxValue(GOLD_AGENT)).to.equal(100_000_000_000n);
      expect(await gate.getMaxValue(BRONZE_AGENT)).to.equal(1_000_000_000n);
    });
  });

  describe("Collateral multiplier", function () {
    it("should return 50% for diamond", async function () {
      expect(await gate.getCollateralMultiplier(DIAMOND_AGENT)).to.equal(5000);
    });

    it("should return 75% for gold", async function () {
      expect(await gate.getCollateralMultiplier(GOLD_AGENT)).to.equal(7500);
    });

    it("should return 95% for bronze", async function () {
      expect(await gate.getCollateralMultiplier(BRONZE_AGENT)).to.equal(9500);
    });

    it("should return 100% for unranked", async function () {
      expect(await gate.getCollateralMultiplier(UNRANKED_AGENT)).to.equal(10000);
    });
  });

  describe("Batch operations", function () {
    it("should batch check trust", async function () {
      const results = await gate.batchCheckTrust([DIAMOND_AGENT, GOLD_AGENT, UNRANKED_AGENT, UNSCORED_AGENT]);
      expect(results[0]).to.be.true;   // diamond passes
      expect(results[1]).to.be.true;   // gold passes
      expect(results[2]).to.be.false;  // unranked fails
      expect(results[3]).to.be.false;  // unscored fails
    });

    it("should filter trusted agents", async function () {
      const [trusted, count] = await gate.filterTrusted([DIAMOND_AGENT, GOLD_AGENT, UNRANKED_AGENT, BRONZE_AGENT]);
      expect(count).to.equal(3);
      expect(trusted[0]).to.equal(DIAMOND_AGENT);
      expect(trusted[1]).to.equal(GOLD_AGENT);
      expect(trusted[2]).to.equal(BRONZE_AGENT);
    });
  });

  describe("Score freshness", function () {
    it("should reject stale scores when maxScoreAge is set", async function () {
      // Set maxScoreAge to 1 hour
      await gate.setThresholds(3000, 1, 3600);

      // Fast-forward 2 hours
      await time.increase(7200);

      await expect(gate.requireTrust(DIAMOND_AGENT))
        .to.be.revertedWithCustomError(gate, "ScoreExpired");

      expect(await gate.isTrusted(DIAMOND_AGENT)).to.be.false;
    });

    it("should accept fresh scores when maxScoreAge is set", async function () {
      await gate.setThresholds(3000, 1, 3600);

      // Update score (resets timestamp)
      await oracle.connect(oracleOperator).updateScore(DIAMOND_AGENT, 9500, 5);

      expect(await gate.isTrusted(DIAMOND_AGENT)).to.be.true;
    });
  });

  describe("Admin", function () {
    it("should update thresholds", async function () {
      await expect(gate.setThresholds(5000, 2, 7200))
        .to.emit(gate, "ThresholdsUpdated")
        .withArgs(5000, 2, 7200);

      expect(await gate.minScore()).to.equal(5000);
      expect(await gate.minTier()).to.equal(2);
      expect(await gate.maxScoreAge()).to.equal(7200);

      // Bronze agent now fails (tier 1 < minTier 2)
      expect(await gate.isTrusted(BRONZE_AGENT)).to.be.false;
    });

    it("should update oracle address", async function () {
      const newOracle = user.address; // just any address for testing
      await expect(gate.setOracle(newOracle))
        .to.emit(gate, "OracleUpdated");
      expect(await gate.oracle()).to.equal(newOracle);
    });

    it("should update tier value limits", async function () {
      await expect(gate.setTierValueLimit(3, 200_000_000_000n))
        .to.emit(gate, "TierValueLimitUpdated")
        .withArgs(3, 200_000_000_000n);
      expect(await gate.tierValueLimit(3)).to.equal(200_000_000_000n);
    });

    it("should reject non-owner threshold updates", async function () {
      await expect(
        gate.connect(user).setThresholds(5000, 2, 0)
      ).to.be.revertedWithCustomError(gate, "OwnableUnauthorizedAccount");
    });

    it("should reject invalid tier in setThresholds", async function () {
      await expect(gate.setThresholds(5000, 6, 0)).to.be.revertedWith("Tier out of range");
    });

    it("should reject invalid score in setThresholds", async function () {
      await expect(gate.setThresholds(10001, 1, 0)).to.be.revertedWith("Score out of range");
    });
  });
});
