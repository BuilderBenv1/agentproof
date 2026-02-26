const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TrustScoreOracle", function () {
  let oracle;
  let owner, updater, user, other;
  const QUERY_FEE = ethers.parseEther("0.001"); // 0.001 AVAX

  beforeEach(async function () {
    [owner, updater, user, other] = await ethers.getSigners();

    const TrustScoreOracle = await ethers.getContractFactory("TrustScoreOracle");
    oracle = await TrustScoreOracle.deploy(updater.address, QUERY_FEE);
    await oracle.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set correct owner", async function () {
      expect(await oracle.owner()).to.equal(owner.address);
    });

    it("should set correct oracle updater", async function () {
      expect(await oracle.oracleUpdater()).to.equal(updater.address);
    });

    it("should set correct query fee", async function () {
      expect(await oracle.queryFee()).to.equal(QUERY_FEE);
    });
  });

  describe("Score Updates", function () {
    it("should allow oracle updater to update a score", async function () {
      await expect(oracle.connect(updater).updateScore(1380, 6741, 3))
        .to.emit(oracle, "ScoreUpdated")
        .withArgs(1380, 6741, 3);

      const [score, tier, updatedAt] = await oracle.viewScore(1380);
      expect(score).to.equal(6741);
      expect(tier).to.equal(3); // gold
      expect(updatedAt).to.be.gt(0);
    });

    it("should reject updates from non-updater", async function () {
      await expect(oracle.connect(other).updateScore(1, 5000, 2))
        .to.be.revertedWithCustomError(oracle, "NotAuthorized");
    });

    it("should reject score > 10000", async function () {
      await expect(oracle.connect(updater).updateScore(1, 10001, 3))
        .to.be.revertedWithCustomError(oracle, "ScoreOutOfRange");
    });

    it("should reject tier > 5", async function () {
      await expect(oracle.connect(updater).updateScore(1, 5000, 6))
        .to.be.revertedWithCustomError(oracle, "InvalidTier");
    });

    it("should allow score of 0", async function () {
      await oracle.connect(updater).updateScore(999, 0, 0);
      const [score, tier] = await oracle.viewScore(999);
      expect(score).to.equal(0);
      expect(tier).to.equal(0);
    });

    it("should allow max score of 10000", async function () {
      await oracle.connect(updater).updateScore(1, 10000, 5);
      const [score, tier] = await oracle.viewScore(1);
      expect(score).to.equal(10000);
      expect(tier).to.equal(5); // diamond
    });

    it("should increment totalUpdates", async function () {
      await oracle.connect(updater).updateScore(1, 5000, 2);
      await oracle.connect(updater).updateScore(2, 7000, 3);
      expect(await oracle.totalUpdates()).to.equal(2);
    });
  });

  describe("Batch Updates", function () {
    it("should batch update multiple agents", async function () {
      const ids = [1, 2, 3];
      const scores = [6741, 8000, 5500];
      const tiers = [3, 4, 2];

      await expect(oracle.connect(updater).batchUpdateScores(ids, scores, tiers))
        .to.emit(oracle, "BatchUpdated")
        .withArgs(3);

      const [s1] = await oracle.viewScore(1);
      const [s2] = await oracle.viewScore(2);
      const [s3] = await oracle.viewScore(3);
      expect(s1).to.equal(6741);
      expect(s2).to.equal(8000);
      expect(s3).to.equal(5500);
    });

    it("should reject batch with mismatched lengths", async function () {
      await expect(
        oracle.connect(updater).batchUpdateScores([1, 2], [5000], [2, 3])
      ).to.be.revertedWithCustomError(oracle, "LengthMismatch");
    });

    it("should reject batch from non-updater", async function () {
      await expect(
        oracle.connect(other).batchUpdateScores([1], [5000], [2])
      ).to.be.revertedWithCustomError(oracle, "NotAuthorized");
    });

    it("should increment totalUpdates by batch size", async function () {
      await oracle.connect(updater).batchUpdateScores([1, 2, 3, 4, 5], [5000, 6000, 7000, 8000, 9000], [2, 3, 3, 4, 5]);
      expect(await oracle.totalUpdates()).to.equal(5);
    });
  });

  describe("Score Queries", function () {
    beforeEach(async function () {
      await oracle.connect(updater).updateScore(1380, 6741, 3);
    });

    it("should return score when correct fee is paid", async function () {
      const tx = await oracle.connect(user).getScore(1380, { value: QUERY_FEE });
      // getScore is not a view, so we verify via viewScore
      const [score, tier] = await oracle.viewScore(1380);
      expect(score).to.equal(6741);
      expect(tier).to.equal(3);
    });

    it("should reject query with insufficient fee", async function () {
      const lowFee = QUERY_FEE - 1n;
      await expect(oracle.connect(user).getScore(1380, { value: lowFee }))
        .to.be.revertedWithCustomError(oracle, "InsufficientFee");
    });

    it("should accept overpayment", async function () {
      const highFee = QUERY_FEE * 2n;
      await oracle.connect(user).getScore(1380, { value: highFee });
      // Should not revert
    });

    it("should return zero for non-existent agent", async function () {
      const [score, tier, updatedAt] = await oracle.viewScore(99999);
      expect(score).to.equal(0);
      expect(tier).to.equal(0);
      expect(updatedAt).to.equal(0);
    });

    it("hasScore should return true for existing agent", async function () {
      expect(await oracle.hasScore(1380)).to.be.true;
    });

    it("hasScore should return false for non-existent agent", async function () {
      expect(await oracle.hasScore(99999)).to.be.false;
    });

    it("should increment totalQueries", async function () {
      await oracle.connect(user).getScore(1380, { value: QUERY_FEE });
      await oracle.connect(user).getScore(1380, { value: QUERY_FEE });
      expect(await oracle.totalQueries()).to.equal(2);
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to change query fee", async function () {
      const newFee = ethers.parseEther("0.01");
      await expect(oracle.connect(owner).setQueryFee(newFee))
        .to.emit(oracle, "QueryFeeChanged")
        .withArgs(QUERY_FEE, newFee);
      expect(await oracle.queryFee()).to.equal(newFee);
    });

    it("should allow owner to change oracle updater", async function () {
      await expect(oracle.connect(owner).setOracleUpdater(other.address))
        .to.emit(oracle, "OracleUpdaterChanged")
        .withArgs(updater.address, other.address);
      expect(await oracle.oracleUpdater()).to.equal(other.address);

      // Old updater should be rejected now
      await expect(oracle.connect(updater).updateScore(1, 5000, 2))
        .to.be.revertedWithCustomError(oracle, "NotAuthorized");

      // New updater should work
      await oracle.connect(other).updateScore(1, 5000, 2);
    });

    it("should allow owner to withdraw fees", async function () {
      // Generate some fees
      await oracle.connect(updater).updateScore(1, 5000, 2);
      await oracle.connect(user).getScore(1, { value: QUERY_FEE });
      await oracle.connect(user).getScore(1, { value: QUERY_FEE });

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await oracle.connect(owner).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      expect(balanceAfter + gasUsed - balanceBefore).to.equal(QUERY_FEE * 2n);
    });

    it("should allow owner to withdrawTo", async function () {
      await oracle.connect(updater).updateScore(1, 5000, 2);
      await oracle.connect(user).getScore(1, { value: QUERY_FEE });

      const balanceBefore = await ethers.provider.getBalance(other.address);
      await oracle.connect(owner).withdrawTo(other.address);
      const balanceAfter = await ethers.provider.getBalance(other.address);

      expect(balanceAfter - balanceBefore).to.equal(QUERY_FEE);
    });

    it("should allow owner to pause/unpause", async function () {
      await oracle.connect(owner).pause();
      await expect(oracle.connect(user).getScore(1, { value: QUERY_FEE }))
        .to.be.revertedWithCustomError(oracle, "EnforcedPause");

      await oracle.connect(owner).unpause();
      // Should work again (even if no score exists)
      await oracle.connect(user).getScore(1, { value: QUERY_FEE });
    });

    it("should reject admin functions from non-owner", async function () {
      await expect(oracle.connect(other).setQueryFee(0))
        .to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount");
      await expect(oracle.connect(other).setOracleUpdater(other.address))
        .to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount");
      await expect(oracle.connect(other).withdraw())
        .to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount");
      await expect(oracle.connect(other).pause())
        .to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount");
    });
  });
});
