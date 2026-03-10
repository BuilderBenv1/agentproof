const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TrustScoreOracle (V2 — Multi-Oracle)", function () {
  let oracle;
  let owner, oracle1, oracle2, user, other;
  const QUERY_FEE = ethers.parseEther("0.001");

  beforeEach(async function () {
    [owner, oracle1, oracle2, user, other] = await ethers.getSigners();

    const TrustScoreOracle = await ethers.getContractFactory("TrustScoreOracle");
    // Constructor registers oracle1 as initial oracle ("AgentProof")
    oracle = await TrustScoreOracle.deploy(oracle1.address, QUERY_FEE);
    await oracle.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set correct owner", async function () {
      expect(await oracle.owner()).to.equal(owner.address);
    });

    it("should register initial oracle", async function () {
      expect(await oracle.authorizedOracles(oracle1.address)).to.be.true;
      expect(await oracle.oracleCount()).to.equal(1);
      expect(await oracle.oracleNames(oracle1.address)).to.equal("AgentProof");
    });

    it("should set correct query fee", async function () {
      expect(await oracle.queryFee()).to.equal(QUERY_FEE);
    });

    it("should set default divergence threshold", async function () {
      expect(await oracle.divergenceThreshold()).to.equal(1000);
    });
  });

  describe("Score Updates (Single Oracle)", function () {
    it("should allow authorized oracle to update a score", async function () {
      await expect(oracle.connect(oracle1).updateScore(1380, 6741, 3))
        .to.emit(oracle, "ScoreUpdated")
        .withArgs(1380, 6741, 3, oracle1.address);

      const [score, tier, updatedAt] = await oracle.viewScore(1380);
      expect(score).to.equal(6741);
      // Consensus tier is auto-computed via _scoreTier: 6741 >= 6000 → silver (2)
      expect(tier).to.equal(2);
      expect(updatedAt).to.be.gt(0);
    });

    it("should store per-oracle score", async function () {
      await oracle.connect(oracle1).updateScore(42, 7500, 3);

      const [score, tier, updatedAt] = await oracle.getOracleScore(42, oracle1.address);
      expect(score).to.equal(7500);
      expect(tier).to.equal(3);
      expect(updatedAt).to.be.gt(0);
    });

    it("should reject updates from non-authorized address", async function () {
      await expect(oracle.connect(other).updateScore(1, 5000, 2))
        .to.be.revertedWithCustomError(oracle, "NotAuthorized");
    });

    it("should reject score > 10000", async function () {
      await expect(oracle.connect(oracle1).updateScore(1, 10001, 3))
        .to.be.revertedWithCustomError(oracle, "ScoreOutOfRange");
    });

    it("should reject tier > 5", async function () {
      await expect(oracle.connect(oracle1).updateScore(1, 5000, 6))
        .to.be.revertedWithCustomError(oracle, "InvalidTier");
    });

    it("should allow score of 0", async function () {
      await oracle.connect(oracle1).updateScore(999, 0, 0);
      const [score, tier] = await oracle.viewScore(999);
      expect(score).to.equal(0);
      expect(tier).to.equal(0);
    });

    it("should allow max score of 10000", async function () {
      await oracle.connect(oracle1).updateScore(1, 10000, 5);
      const [score, tier] = await oracle.viewScore(1);
      expect(score).to.equal(10000);
      expect(tier).to.equal(5); // diamond
    });

    it("should increment totalUpdates", async function () {
      await oracle.connect(oracle1).updateScore(1, 5000, 2);
      await oracle.connect(oracle1).updateScore(2, 7000, 3);
      expect(await oracle.totalUpdates()).to.equal(2);
    });
  });

  describe("Multi-Oracle Consensus", function () {
    beforeEach(async function () {
      // Add oracle2 as second oracle
      await oracle.connect(owner).addOracle(oracle2.address, "Agent402");
    });

    it("should compute consensus from two oracles", async function () {
      await oracle.connect(oracle1).updateScore(1, 7000, 3);
      await oracle.connect(oracle2).updateScore(1, 8000, 4);

      // Consensus = average = 7500
      const [score, tier] = await oracle.viewScore(1);
      expect(score).to.equal(7500);
      expect(tier).to.equal(3); // _scoreTier(7500) = gold

      // getConsensusScore gives detailed view
      const [avgScore, consensusTier, oracleCount, divergent] = await oracle.getConsensusScore(1);
      expect(avgScore).to.equal(7500);
      expect(oracleCount).to.equal(2);
      expect(divergent).to.be.false; // 1000 delta = threshold, not exceeded
    });

    it("should detect divergence when scores differ significantly", async function () {
      await oracle.connect(oracle1).updateScore(1, 3000, 0);

      // Second oracle gives very different score — delta = 5000 > threshold 1000
      await expect(oracle.connect(oracle2).updateScore(1, 8000, 4))
        .to.emit(oracle, "DivergenceDetected")
        .withArgs(1, 3000, 8000);

      const [, , , divergent] = await oracle.getConsensusScore(1);
      expect(divergent).to.be.true;
    });

    it("should not flag divergence within threshold", async function () {
      await oracle.connect(oracle1).updateScore(1, 7000, 3);
      // Delta = 900 < threshold 1000
      await expect(oracle.connect(oracle2).updateScore(1, 7900, 3))
        .to.not.emit(oracle, "DivergenceDetected");

      const [, , , divergent] = await oracle.getConsensusScore(1);
      expect(divergent).to.be.false;
    });

    it("should return zero consensus for unscored agent", async function () {
      const [avgScore, , oracleCount, divergent] = await oracle.getConsensusScore(99999);
      expect(avgScore).to.equal(0);
      expect(oracleCount).to.equal(0);
      expect(divergent).to.be.false;
    });

    it("should update consensus when single oracle updates", async function () {
      // Only oracle1 scores — consensus = oracle1's score
      await oracle.connect(oracle1).updateScore(1, 6500, 2);

      const [score] = await oracle.viewScore(1);
      expect(score).to.equal(6500);

      const [, , oracleCount] = await oracle.getConsensusScore(1);
      expect(oracleCount).to.equal(1);
    });

    it("should auto-compute tier from consensus average via _scoreTier", async function () {
      // oracle1=9500, oracle2=8500 → avg=9000 → diamond
      await oracle.connect(oracle1).updateScore(1, 9500, 5);
      await oracle.connect(oracle2).updateScore(1, 8500, 4);

      const [, consensusTier] = await oracle.getConsensusScore(1);
      expect(consensusTier).to.equal(5); // diamond (9000)
    });
  });

  describe("Batch Updates", function () {
    it("should batch update multiple agents", async function () {
      const ids = [1, 2, 3];
      const scores = [6741, 8000, 5500];
      const tiers = [3, 4, 2];

      await expect(oracle.connect(oracle1).batchUpdateScores(ids, scores, tiers))
        .to.emit(oracle, "BatchUpdated")
        .withArgs(3, oracle1.address);

      const [s1] = await oracle.viewScore(1);
      const [s2] = await oracle.viewScore(2);
      const [s3] = await oracle.viewScore(3);
      expect(s1).to.equal(6741);
      expect(s2).to.equal(8000);
      expect(s3).to.equal(5500);
    });

    it("should reject batch with mismatched lengths", async function () {
      await expect(
        oracle.connect(oracle1).batchUpdateScores([1, 2], [5000], [2, 3])
      ).to.be.revertedWithCustomError(oracle, "LengthMismatch");
    });

    it("should reject batch from non-authorized address", async function () {
      await expect(
        oracle.connect(other).batchUpdateScores([1], [5000], [2])
      ).to.be.revertedWithCustomError(oracle, "NotAuthorized");
    });

    it("should increment totalUpdates by batch size", async function () {
      await oracle.connect(oracle1).batchUpdateScores(
        [1, 2, 3, 4, 5], [5000, 6000, 7000, 8000, 9000], [2, 3, 3, 4, 5]
      );
      expect(await oracle.totalUpdates()).to.equal(5);
    });
  });

  describe("Score Queries", function () {
    beforeEach(async function () {
      await oracle.connect(oracle1).updateScore(1380, 6741, 3);
    });

    it("should return score when correct fee is paid", async function () {
      await oracle.connect(user).getScore(1380, { value: QUERY_FEE });
      const [score, tier] = await oracle.viewScore(1380);
      expect(score).to.equal(6741);
      expect(tier).to.equal(2); // _scoreTier(6741) = silver
    });

    it("should reject query with insufficient fee", async function () {
      const lowFee = QUERY_FEE - 1n;
      await expect(oracle.connect(user).getScore(1380, { value: lowFee }))
        .to.be.revertedWithCustomError(oracle, "InsufficientFee");
    });

    it("should accept overpayment", async function () {
      const highFee = QUERY_FEE * 2n;
      await oracle.connect(user).getScore(1380, { value: highFee });
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

  describe("Oracle Management", function () {
    it("should allow owner to add a new oracle", async function () {
      await expect(oracle.connect(owner).addOracle(oracle2.address, "Agent402"))
        .to.emit(oracle, "OracleAdded")
        .withArgs(oracle2.address, "Agent402");

      expect(await oracle.authorizedOracles(oracle2.address)).to.be.true;
      expect(await oracle.oracleCount()).to.equal(2);
      expect(await oracle.oracleNames(oracle2.address)).to.equal("Agent402");
    });

    it("should reject adding already authorized oracle", async function () {
      await expect(oracle.connect(owner).addOracle(oracle1.address, "Duplicate"))
        .to.be.revertedWithCustomError(oracle, "OracleAlreadyAuthorized");
    });

    it("should allow owner to remove an oracle", async function () {
      await oracle.connect(owner).addOracle(oracle2.address, "Agent402");

      await expect(oracle.connect(owner).removeOracle(oracle2.address))
        .to.emit(oracle, "OracleRemoved")
        .withArgs(oracle2.address);

      expect(await oracle.authorizedOracles(oracle2.address)).to.be.false;
      expect(await oracle.oracleCount()).to.equal(1);
    });

    it("should reject removing non-existent oracle", async function () {
      await expect(oracle.connect(owner).removeOracle(other.address))
        .to.be.revertedWithCustomError(oracle, "OracleNotFound");
    });

    it("removed oracle should not be able to update scores", async function () {
      await oracle.connect(owner).addOracle(oracle2.address, "Agent402");
      await oracle.connect(owner).removeOracle(oracle2.address);

      await expect(oracle.connect(oracle2).updateScore(1, 5000, 2))
        .to.be.revertedWithCustomError(oracle, "NotAuthorized");
    });

    it("should reject non-owner oracle management", async function () {
      await expect(oracle.connect(other).addOracle(other.address, "Rogue"))
        .to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount");
      await expect(oracle.connect(other).removeOracle(oracle1.address))
        .to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount");
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

    it("should allow owner to change divergence threshold", async function () {
      await expect(oracle.connect(owner).setDivergenceThreshold(500))
        .to.emit(oracle, "DivergenceThresholdChanged")
        .withArgs(1000, 500);
      expect(await oracle.divergenceThreshold()).to.equal(500);
    });

    it("should allow owner to withdraw fees", async function () {
      await oracle.connect(oracle1).updateScore(1, 5000, 2);
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
      await oracle.connect(oracle1).updateScore(1, 5000, 2);
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
      await oracle.connect(user).getScore(1, { value: QUERY_FEE });
    });

    it("should reject admin functions from non-owner", async function () {
      await expect(oracle.connect(other).setQueryFee(0))
        .to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount");
      await expect(oracle.connect(other).setDivergenceThreshold(0))
        .to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount");
      await expect(oracle.connect(other).withdraw())
        .to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount");
      await expect(oracle.connect(other).pause())
        .to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount");
    });
  });
});
