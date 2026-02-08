const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentSplits", function () {
  let identityRegistry, agentSplits;
  let owner, agent1Owner, agent2Owner, agent3Owner, payer;
  const BOND = ethers.parseEther("0.1");
  const URI = "https://example.com/agent.json";
  const TASK_HASH = ethers.keccak256(ethers.toUtf8Bytes("task-split"));

  beforeEach(async function () {
    [owner, agent1Owner, agent2Owner, agent3Owner, payer] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.waitForDeployment();

    const AgentSplits = await ethers.getContractFactory("AgentSplits");
    agentSplits = await AgentSplits.deploy(await identityRegistry.getAddress());
    await agentSplits.waitForDeployment();

    // Register three agents
    await identityRegistry.connect(agent1Owner).registerAgent(URI, { value: BOND });
    await identityRegistry.connect(agent2Owner).registerAgent(URI, { value: BOND });
    await identityRegistry.connect(agent3Owner).registerAgent(URI, { value: BOND });
  });

  describe("Create Split", function () {
    it("should create a 50/50 split", async function () {
      const tx = await agentSplits.connect(agent1Owner).createSplit(
        1, [1, 2], [5000, 5000]
      );
      await tx.wait();

      const [splitId, creator, agentIds, sharesBps, isActive, createdAt] =
        await agentSplits.getSplit(1);
      expect(splitId).to.equal(1);
      expect(creator).to.equal(1);
      expect(agentIds.length).to.equal(2);
      expect(sharesBps[0]).to.equal(5000);
      expect(sharesBps[1]).to.equal(5000);
      expect(isActive).to.be.true;
    });

    it("should create a 3-way split", async function () {
      await agentSplits.connect(agent1Owner).createSplit(
        1, [1, 2, 3], [5000, 3000, 2000]
      );

      const [, , agentIds, sharesBps] = await agentSplits.getSplit(1);
      expect(agentIds.length).to.equal(3);
      expect(sharesBps[0]).to.equal(5000);
      expect(sharesBps[1]).to.equal(3000);
      expect(sharesBps[2]).to.equal(2000);
    });

    it("should emit SplitCreated event", async function () {
      await expect(
        agentSplits.connect(agent1Owner).createSplit(1, [1, 2], [6000, 4000])
      ).to.emit(agentSplits, "SplitCreated")
        .withArgs(1, 1, [1, 2], [6000, 4000]);
    });

    it("should track agent splits", async function () {
      await agentSplits.connect(agent1Owner).createSplit(1, [1, 2], [5000, 5000]);

      const splits1 = await agentSplits.getAgentSplits(1);
      const splits2 = await agentSplits.getAgentSplits(2);
      expect(splits1.length).to.equal(1);
      expect(splits2.length).to.equal(1);
    });

    it("should revert if not agent owner", async function () {
      await expect(
        agentSplits.connect(agent2Owner).createSplit(1, [1, 2], [5000, 5000])
      ).to.be.revertedWith("Not agent owner");
    });

    it("should revert with less than 2 agents", async function () {
      await expect(
        agentSplits.connect(agent1Owner).createSplit(1, [1], [10000])
      ).to.be.revertedWith("2-10 agents required");
    });

    it("should revert if shares don't sum to 10000", async function () {
      await expect(
        agentSplits.connect(agent1Owner).createSplit(1, [1, 2], [5000, 4000])
      ).to.be.revertedWith("Shares must sum to 10000 BPS");
    });

    it("should revert on duplicate agents", async function () {
      await expect(
        agentSplits.connect(agent1Owner).createSplit(1, [1, 1], [5000, 5000])
      ).to.be.revertedWith("Duplicate agent");
    });

    it("should revert if creator not a participant", async function () {
      await expect(
        agentSplits.connect(agent1Owner).createSplit(1, [2, 3], [5000, 5000])
      ).to.be.revertedWith("Creator must be a participant");
    });

    it("should revert with zero share", async function () {
      await expect(
        agentSplits.connect(agent1Owner).createSplit(1, [1, 2], [0, 10000])
      ).to.be.revertedWith("Share must be > 0");
    });

    it("should revert on array length mismatch", async function () {
      await expect(
        agentSplits.connect(agent1Owner).createSplit(1, [1, 2], [5000])
      ).to.be.revertedWith("Array length mismatch");
    });
  });

  describe("Deactivate Split", function () {
    beforeEach(async function () {
      await agentSplits.connect(agent1Owner).createSplit(1, [1, 2], [5000, 5000]);
    });

    it("should deactivate a split", async function () {
      await agentSplits.connect(agent1Owner).deactivateSplit(1);

      const [, , , , isActive] = await agentSplits.getSplit(1);
      expect(isActive).to.be.false;
    });

    it("should emit SplitDeactivated event", async function () {
      await expect(agentSplits.connect(agent1Owner).deactivateSplit(1))
        .to.emit(agentSplits, "SplitDeactivated")
        .withArgs(1);
    });

    it("should revert if not creator", async function () {
      await expect(
        agentSplits.connect(agent2Owner).deactivateSplit(1)
      ).to.be.revertedWith("Not split creator");
    });

    it("should revert deactivating already inactive", async function () {
      await agentSplits.connect(agent1Owner).deactivateSplit(1);
      await expect(
        agentSplits.connect(agent1Owner).deactivateSplit(1)
      ).to.be.revertedWith("Already inactive");
    });

    it("should revert for nonexistent split", async function () {
      await expect(
        agentSplits.connect(agent1Owner).deactivateSplit(99)
      ).to.be.revertedWith("Split does not exist");
    });
  });

  describe("Pay to Split", function () {
    beforeEach(async function () {
      await agentSplits.connect(agent1Owner).createSplit(1, [1, 2], [5000, 5000]);
    });

    it("should accept AVAX payment", async function () {
      const amount = ethers.parseEther("2");
      const tx = await agentSplits.connect(payer).payToSplit(
        1, 0, ethers.ZeroAddress, TASK_HASH,
        { value: amount }
      );
      await tx.wait();

      const payment = await agentSplits.getSplitPayment(1);
      expect(payment.splitId).to.equal(1);
      expect(payment.amount).to.equal(amount);
      expect(payment.payer).to.equal(payer.address);
      expect(payment.distributed).to.be.false;
    });

    it("should emit SplitPaymentReceived event", async function () {
      const amount = ethers.parseEther("1");
      await expect(
        agentSplits.connect(payer).payToSplit(1, 0, ethers.ZeroAddress, TASK_HASH, { value: amount })
      ).to.emit(agentSplits, "SplitPaymentReceived")
        .withArgs(1, 1, amount, ethers.ZeroAddress, payer.address);
    });

    it("should revert paying inactive split", async function () {
      await agentSplits.connect(agent1Owner).deactivateSplit(1);
      await expect(
        agentSplits.connect(payer).payToSplit(1, 0, ethers.ZeroAddress, TASK_HASH, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Split inactive");
    });

    it("should revert paying nonexistent split", async function () {
      await expect(
        agentSplits.connect(payer).payToSplit(99, 0, ethers.ZeroAddress, TASK_HASH, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Split does not exist");
    });

    it("should revert AVAX payment with no value", async function () {
      await expect(
        agentSplits.connect(payer).payToSplit(1, 0, ethers.ZeroAddress, TASK_HASH)
      ).to.be.revertedWith("No AVAX sent");
    });
  });

  describe("Distribute Split", function () {
    beforeEach(async function () {
      await agentSplits.connect(agent1Owner).createSplit(1, [1, 2], [6000, 4000]);
      await agentSplits.connect(payer).payToSplit(
        1, 0, ethers.ZeroAddress, TASK_HASH,
        { value: ethers.parseEther("10") }
      );
    });

    it("should distribute AVAX to participants", async function () {
      const bal1Before = await ethers.provider.getBalance(agent1Owner.address);
      const bal2Before = await ethers.provider.getBalance(agent2Owner.address);

      await agentSplits.connect(payer).distributeSplit(1);

      const bal1After = await ethers.provider.getBalance(agent1Owner.address);
      const bal2After = await ethers.provider.getBalance(agent2Owner.address);

      // 10 AVAX - 0.5% fee = 9.95 AVAX distributable
      // Agent 1: 60% of 9.95 = 5.97
      // Agent 2: 40% of 9.95 = 3.98
      const received1 = bal1After - bal1Before;
      const received2 = bal2After - bal2Before;

      expect(received1).to.be.gt(ethers.parseEther("5.9"));
      expect(received2).to.be.gt(ethers.parseEther("3.9"));
    });

    it("should collect protocol fee", async function () {
      const treasuryBal = await ethers.provider.getBalance(owner.address);
      await agentSplits.connect(payer).distributeSplit(1);
      const treasuryBalAfter = await ethers.provider.getBalance(owner.address);

      // 0.5% of 10 AVAX = 0.05 AVAX
      expect(treasuryBalAfter - treasuryBal).to.be.gt(ethers.parseEther("0.04"));
    });

    it("should emit SplitDistributed event", async function () {
      await expect(
        agentSplits.connect(payer).distributeSplit(1)
      ).to.emit(agentSplits, "SplitDistributed");
    });

    it("should mark payment as distributed", async function () {
      await agentSplits.connect(payer).distributeSplit(1);

      const payment = await agentSplits.getSplitPayment(1);
      expect(payment.distributed).to.be.true;
      expect(payment.distributedAt).to.be.gt(0);
    });

    it("should revert double distribution", async function () {
      await agentSplits.connect(payer).distributeSplit(1);
      await expect(
        agentSplits.connect(payer).distributeSplit(1)
      ).to.be.revertedWith("Already distributed");
    });

    it("should revert for nonexistent payment", async function () {
      await expect(
        agentSplits.connect(payer).distributeSplit(99)
      ).to.be.revertedWith("Payment does not exist");
    });

    it("should distribute 3-way split correctly", async function () {
      // Create a 3-way split
      await agentSplits.connect(agent1Owner).createSplit(1, [1, 2, 3], [5000, 3000, 2000]);
      await agentSplits.connect(payer).payToSplit(
        2, 0, ethers.ZeroAddress, TASK_HASH,
        { value: ethers.parseEther("10") }
      );

      const bal1Before = await ethers.provider.getBalance(agent1Owner.address);
      const bal2Before = await ethers.provider.getBalance(agent2Owner.address);
      const bal3Before = await ethers.provider.getBalance(agent3Owner.address);

      await agentSplits.connect(payer).distributeSplit(2);

      const bal1After = await ethers.provider.getBalance(agent1Owner.address);
      const bal2After = await ethers.provider.getBalance(agent2Owner.address);
      const bal3After = await ethers.provider.getBalance(agent3Owner.address);

      expect(bal1After - bal1Before).to.be.gt(ethers.parseEther("4.9")); // ~50%
      expect(bal2After - bal2Before).to.be.gt(ethers.parseEther("2.9")); // ~30%
      expect(bal3After - bal3Before).to.be.gt(ethers.parseEther("1.9")); // ~20%
    });
  });

  describe("Views", function () {
    beforeEach(async function () {
      await agentSplits.connect(agent1Owner).createSplit(1, [1, 2], [7000, 3000]);
    });

    it("should get split participants", async function () {
      const [agentIds, sharesBps] = await agentSplits.getSplitParticipants(1);
      expect(agentIds.length).to.equal(2);
      expect(sharesBps[0]).to.equal(7000);
      expect(sharesBps[1]).to.equal(3000);
    });

    it("should get agent splits", async function () {
      const splits1 = await agentSplits.getAgentSplits(1);
      expect(splits1.length).to.equal(1);
      expect(splits1[0]).to.equal(1);
    });
  });

  describe("Admin", function () {
    it("should set protocol fee", async function () {
      await agentSplits.setProtocolFee(100); // 1%
      expect(await agentSplits.protocolFeeBps()).to.equal(100);
    });

    it("should revert fee too high", async function () {
      await expect(
        agentSplits.setProtocolFee(1001)
      ).to.be.revertedWith("Fee too high");
    });

    it("should set treasury", async function () {
      await agentSplits.setTreasury(agent1Owner.address);
      expect(await agentSplits.treasury()).to.equal(agent1Owner.address);
    });

    it("should revert setting zero treasury", async function () {
      await expect(
        agentSplits.setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("Zero address");
    });

    it("should revert admin calls from non-owner", async function () {
      await expect(
        agentSplits.connect(agent1Owner).setProtocolFee(100)
      ).to.be.reverted;
    });
  });

  describe("Pausable", function () {
    it("should pause and block split creation", async function () {
      await agentSplits.pause();
      await expect(
        agentSplits.connect(agent1Owner).createSplit(1, [1, 2], [5000, 5000])
      ).to.be.reverted;
    });

    it("should unpause and allow operations", async function () {
      await agentSplits.pause();
      await agentSplits.unpause();
      await agentSplits.connect(agent1Owner).createSplit(1, [1, 2], [5000, 5000]);
    });
  });
});
