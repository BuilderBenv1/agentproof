const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AgentPayments", function () {
  let identityRegistry, validationRegistry, agentPayments;
  let owner, agent1Owner, agent2Owner;
  const BOND = ethers.parseEther("0.1");
  const URI = "https://example.com/agent.json";
  const TASK_HASH = ethers.keccak256(ethers.toUtf8Bytes("task-payment"));

  beforeEach(async function () {
    [owner, agent1Owner, agent2Owner] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.waitForDeployment();

    const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
    validationRegistry = await ValidationRegistry.deploy(await identityRegistry.getAddress());
    await validationRegistry.waitForDeployment();

    const AgentPayments = await ethers.getContractFactory("AgentPayments");
    agentPayments = await AgentPayments.deploy(
      await identityRegistry.getAddress(),
      await validationRegistry.getAddress()
    );
    await agentPayments.waitForDeployment();

    // Register two agents
    await identityRegistry.connect(agent1Owner).registerAgent(URI, { value: BOND });
    await identityRegistry.connect(agent2Owner).registerAgent(URI, { value: BOND });
  });

  describe("Create Payment", function () {
    it("should create an AVAX payment", async function () {
      const amount = ethers.parseEther("1");
      const tx = await agentPayments.connect(agent1Owner).createPayment(
        1, 2, amount, ethers.ZeroAddress, TASK_HASH, false,
        { value: amount }
      );
      await tx.wait();

      const payment = await agentPayments.getPayment(1);
      expect(payment.fromAgentId).to.equal(1);
      expect(payment.toAgentId).to.equal(2);
      expect(payment.amount).to.equal(amount);
      expect(payment.status).to.equal(0); // Escrowed
    });

    it("should revert if not from-agent owner", async function () {
      await expect(
        agentPayments.connect(agent2Owner).createPayment(
          1, 2, ethers.parseEther("1"), ethers.ZeroAddress, TASK_HASH, false,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWith("Not from-agent owner");
    });

    it("should revert on self-payment", async function () {
      await expect(
        agentPayments.connect(agent1Owner).createPayment(
          1, 1, ethers.parseEther("1"), ethers.ZeroAddress, TASK_HASH, false,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWith("Cannot pay self");
    });

    it("should revert on wrong AVAX amount", async function () {
      await expect(
        agentPayments.connect(agent1Owner).createPayment(
          1, 2, ethers.parseEther("1"), ethers.ZeroAddress, TASK_HASH, false,
          { value: ethers.parseEther("0.5") }
        )
      ).to.be.revertedWith("Incorrect AVAX amount");
    });
  });

  describe("Release Payment", function () {
    beforeEach(async function () {
      await agentPayments.connect(agent1Owner).createPayment(
        1, 2, ethers.parseEther("1"), ethers.ZeroAddress, TASK_HASH, false,
        { value: ethers.parseEther("1") }
      );
    });

    it("should release payment to toAgent", async function () {
      const balBefore = await ethers.provider.getBalance(agent2Owner.address);
      await agentPayments.connect(agent1Owner).releasePayment(1);
      const balAfter = await ethers.provider.getBalance(agent2Owner.address);

      // Should receive ~0.995 AVAX (minus 0.5% fee)
      const received = balAfter - balBefore;
      expect(received).to.be.gt(ethers.parseEther("0.99"));

      const payment = await agentPayments.getPayment(1);
      expect(payment.status).to.equal(1); // Released
    });

    it("should collect protocol fee", async function () {
      const treasuryBal = await ethers.provider.getBalance(owner.address);
      await agentPayments.connect(agent1Owner).releasePayment(1);
      const treasuryBalAfter = await ethers.provider.getBalance(owner.address);
      // 0.5% of 1 AVAX = 0.005
      expect(treasuryBalAfter - treasuryBal).to.be.gt(ethers.parseEther("0.004"));
    });

    it("should revert double release", async function () {
      await agentPayments.connect(agent1Owner).releasePayment(1);
      await expect(
        agentPayments.connect(agent1Owner).releasePayment(1)
      ).to.be.revertedWith("Not escrowed");
    });

    it("should track earnings", async function () {
      await agentPayments.connect(agent1Owner).releasePayment(1);
      const [earned, paid] = await agentPayments.getAgentEarnings(2);
      expect(earned).to.be.gt(0);
      const [earned1, paid1] = await agentPayments.getAgentEarnings(1);
      expect(paid1).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Refund Payment", function () {
    beforeEach(async function () {
      await agentPayments.connect(agent1Owner).createPayment(
        1, 2, ethers.parseEther("1"), ethers.ZeroAddress, TASK_HASH, false,
        { value: ethers.parseEther("1") }
      );
    });

    it("should refund after timeout", async function () {
      await time.increase(7 * 24 * 60 * 60 + 1);
      const balBefore = await ethers.provider.getBalance(agent1Owner.address);
      await agentPayments.connect(agent1Owner).refundPayment(1);
      const balAfter = await ethers.provider.getBalance(agent1Owner.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("should revert refund before timeout", async function () {
      await expect(
        agentPayments.connect(agent1Owner).refundPayment(1)
      ).to.be.revertedWith("Timeout not reached");
    });
  });

  describe("Cancel Payment", function () {
    beforeEach(async function () {
      await agentPayments.connect(agent1Owner).createPayment(
        1, 2, ethers.parseEther("1"), ethers.ZeroAddress, TASK_HASH, false,
        { value: ethers.parseEther("1") }
      );
    });

    it("should cancel with mutual agreement", async function () {
      await agentPayments.connect(agent1Owner).cancelPayment(1);
      let payment = await agentPayments.getPayment(1);
      expect(payment.status).to.equal(0); // Still escrowed (only one party)

      const balBefore = await ethers.provider.getBalance(agent1Owner.address);
      await agentPayments.connect(agent2Owner).cancelPayment(1);
      const balAfter = await ethers.provider.getBalance(agent1Owner.address);

      payment = await agentPayments.getPayment(1);
      expect(payment.status).to.equal(3); // Cancelled
      expect(balAfter).to.be.gt(balBefore);
    });

    it("should revert cancel from unauthorized address", async function () {
      const [, , , stranger] = await ethers.getSigners();
      await expect(
        agentPayments.connect(stranger).cancelPayment(1)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Admin", function () {
    it("should allow owner to update fee", async function () {
      await agentPayments.setProtocolFee(100); // 1%
      expect(await agentPayments.protocolFeeBps()).to.equal(100);
    });

    it("should revert fee too high", async function () {
      await expect(agentPayments.setProtocolFee(1001)).to.be.revertedWith("Fee too high");
    });
  });
});
