const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AgentProof", function () {
  let identityRegistry, reputationRegistry, validationRegistry, agentProofCore;
  let owner, addr1, addr2, addr3, addr4;
  const BOND = ethers.parseEther("0.1");
  const AGENT_URI = "https://example.com/agent1.json";
  const AGENT_URI_2 = "https://example.com/agent2.json";
  const FEEDBACK_URI = "https://example.com/feedback1.json";
  const TASK_HASH = ethers.keccak256(ethers.toUtf8Bytes("task-1"));
  const TASK_URI = "https://example.com/task1.json";

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

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
  });

  // ============================================================
  //  IDENTITY REGISTRY TESTS
  // ============================================================
  describe("IdentityRegistry", function () {
    it("should register an agent with correct bond", async function () {
      const tx = await identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: BOND });
      const receipt = await tx.wait();

      expect(await identityRegistry.totalAgents()).to.equal(1);
      expect(await identityRegistry.isRegistered(addr1.address)).to.be.true;
      expect(await identityRegistry.getAgentOwner(1)).to.equal(addr1.address);
      expect(await identityRegistry.getAgentURI(1)).to.equal(AGENT_URI);

      await expect(tx)
        .to.emit(identityRegistry, "AgentRegistered")
        .withArgs(1, addr1.address, AGENT_URI);
    });

    it("should reject registration with insufficient bond", async function () {
      await expect(
        identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Insufficient bond");
    });

    it("should reject duplicate registration from same address", async function () {
      await identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: BOND });
      await expect(
        identityRegistry.connect(addr1).registerAgent("https://other.json", { value: BOND })
      ).to.be.revertedWith("Already registered");
    });

    it("should reject empty URI", async function () {
      await expect(
        identityRegistry.connect(addr1).registerAgent("", { value: BOND })
      ).to.be.revertedWith("URI cannot be empty");
    });

    it("should refund excess bond payment", async function () {
      const excessBond = ethers.parseEther("0.5");
      const balanceBefore = await ethers.provider.getBalance(addr1.address);

      const tx = await identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: excessBond });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(addr1.address);
      // Balance should decrease by bond + gas, not by excessBond + gas
      const expectedBalance = balanceBefore - BOND - gasCost;
      expect(balanceAfter).to.equal(expectedBalance);
    });

    it("should allow only owner to update URI", async function () {
      await identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: BOND });

      const newURI = "https://example.com/updated.json";
      await identityRegistry.connect(addr1).updateAgentURI(1, newURI);
      expect(await identityRegistry.getAgentURI(1)).to.equal(newURI);

      await expect(
        identityRegistry.connect(addr2).updateAgentURI(1, "https://hack.json")
      ).to.be.revertedWith("Not agent owner");
    });

    it("should reject empty URI update", async function () {
      await identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: BOND });
      await expect(
        identityRegistry.connect(addr1).updateAgentURI(1, "")
      ).to.be.revertedWith("URI cannot be empty");
    });

    it("should allow multiple different addresses to register", async function () {
      await identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: BOND });
      await identityRegistry.connect(addr2).registerAgent(AGENT_URI_2, { value: BOND });

      expect(await identityRegistry.totalAgents()).to.equal(2);
      expect(await identityRegistry.getAgentOwner(1)).to.equal(addr1.address);
      expect(await identityRegistry.getAgentOwner(2)).to.equal(addr2.address);
    });

    it("should return agent ID by owner", async function () {
      await identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: BOND });
      expect(await identityRegistry.getAgentIdByOwner(addr1.address)).to.equal(1);
    });

    it("should support pause/unpause", async function () {
      await identityRegistry.connect(owner).pause();
      await expect(
        identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: BOND })
      ).to.be.reverted;

      await identityRegistry.connect(owner).unpause();
      await identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: BOND });
      expect(await identityRegistry.totalAgents()).to.equal(1);
    });

    it("should allow owner to withdraw bonds", async function () {
      await identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: BOND });
      await identityRegistry.connect(addr2).registerAgent(AGENT_URI_2, { value: BOND });

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await identityRegistry.connect(owner).withdrawBonds(owner.address);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.equal(balanceBefore + ethers.parseEther("0.2") - gasCost);
    });

    it("should allow owner to update registration bond", async function () {
      const newBond = ethers.parseEther("0.2");
      await identityRegistry.connect(owner).setRegistrationBond(newBond);
      expect(await identityRegistry.registrationBond()).to.equal(newBond);

      await expect(
        identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: BOND })
      ).to.be.revertedWith("Insufficient bond");

      await identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: newBond });
      expect(await identityRegistry.totalAgents()).to.equal(1);
    });
  });

  // ============================================================
  //  REPUTATION REGISTRY TESTS
  // ============================================================
  describe("ReputationRegistry", function () {
    beforeEach(async function () {
      await identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: BOND });
    });

    it("should allow submitting feedback", async function () {
      const tx = await reputationRegistry.connect(addr2).submitFeedback(1, 85, FEEDBACK_URI, TASK_HASH);

      await expect(tx)
        .to.emit(reputationRegistry, "FeedbackSubmitted")
        .withArgs(1, addr2.address, 85, TASK_HASH);

      expect(await reputationRegistry.getFeedbackCount(1)).to.equal(1);
      expect(await reputationRegistry.getAverageRating(1)).to.equal(85);
    });

    it("should prevent self-rating", async function () {
      await expect(
        reputationRegistry.connect(addr1).submitFeedback(1, 90, FEEDBACK_URI, TASK_HASH)
      ).to.be.revertedWith("Cannot rate own agent");
    });

    it("should enforce rating bounds", async function () {
      await expect(
        reputationRegistry.connect(addr2).submitFeedback(1, 0, FEEDBACK_URI, TASK_HASH)
      ).to.be.revertedWith("Rating must be 1-100");

      await expect(
        reputationRegistry.connect(addr2).submitFeedback(1, 101, FEEDBACK_URI, TASK_HASH)
      ).to.be.revertedWith("Rating must be 1-100");
    });

    it("should enforce 24h rate limiting", async function () {
      await reputationRegistry.connect(addr2).submitFeedback(1, 85, FEEDBACK_URI, TASK_HASH);

      await expect(
        reputationRegistry.connect(addr2).submitFeedback(1, 90, FEEDBACK_URI, TASK_HASH)
      ).to.be.revertedWith("Rate limit: wait 24h between feedback");

      // Advance time by 24 hours
      await time.increase(86401);

      await reputationRegistry.connect(addr2).submitFeedback(1, 90, FEEDBACK_URI, TASK_HASH);
      expect(await reputationRegistry.getFeedbackCount(1)).to.equal(2);
    });

    it("should calculate average rating correctly", async function () {
      await reputationRegistry.connect(addr2).submitFeedback(1, 80, FEEDBACK_URI, TASK_HASH);
      await reputationRegistry.connect(addr3).submitFeedback(1, 60, FEEDBACK_URI, TASK_HASH);
      await reputationRegistry.connect(addr4).submitFeedback(1, 100, FEEDBACK_URI, TASK_HASH);

      expect(await reputationRegistry.getAverageRating(1)).to.equal(80); // (80+60+100)/3 = 80
      expect(await reputationRegistry.getFeedbackCount(1)).to.equal(3);
      expect(await reputationRegistry.getRatingSum(1)).to.equal(240);
    });

    it("should return individual feedback records", async function () {
      await reputationRegistry.connect(addr2).submitFeedback(1, 85, FEEDBACK_URI, TASK_HASH);

      const feedback = await reputationRegistry.getFeedback(1, 0);
      expect(feedback.reviewer).to.equal(addr2.address);
      expect(feedback.rating).to.equal(85);
      expect(feedback.feedbackURI).to.equal(FEEDBACK_URI);
      expect(feedback.taskHash).to.equal(TASK_HASH);
    });

    it("should revert on out-of-bounds feedback index", async function () {
      await expect(
        reputationRegistry.getFeedback(1, 0)
      ).to.be.revertedWith("Index out of bounds");
    });

    it("should return 0 for agents with no feedback", async function () {
      expect(await reputationRegistry.getAverageRating(1)).to.equal(0);
      expect(await reputationRegistry.getFeedbackCount(1)).to.equal(0);
    });

    it("should support pause/unpause", async function () {
      await reputationRegistry.connect(owner).pause();
      await expect(
        reputationRegistry.connect(addr2).submitFeedback(1, 85, FEEDBACK_URI, TASK_HASH)
      ).to.be.reverted;

      await reputationRegistry.connect(owner).unpause();
      await reputationRegistry.connect(addr2).submitFeedback(1, 85, FEEDBACK_URI, TASK_HASH);
      expect(await reputationRegistry.getFeedbackCount(1)).to.equal(1);
    });
  });

  // ============================================================
  //  VALIDATION REGISTRY TESTS
  // ============================================================
  describe("ValidationRegistry", function () {
    beforeEach(async function () {
      await identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: BOND });
    });

    it("should create validation request", async function () {
      const tx = await validationRegistry.connect(addr2).requestValidation(1, TASK_HASH, TASK_URI);

      await expect(tx)
        .to.emit(validationRegistry, "ValidationRequested")
        .withArgs(1, 1, TASK_HASH);

      const validation = await validationRegistry.getValidation(1);
      expect(validation.agentId).to.equal(1);
      expect(validation.taskHash).to.equal(TASK_HASH);
      expect(validation.requester).to.equal(addr2.address);
      expect(validation.isCompleted).to.be.false;
    });

    it("should submit validation response", async function () {
      await validationRegistry.connect(addr2).requestValidation(1, TASK_HASH, TASK_URI);

      const proofURI = "https://example.com/proof.json";
      const tx = await validationRegistry.connect(addr3).submitValidation(1, true, proofURI);

      await expect(tx)
        .to.emit(validationRegistry, "ValidationSubmitted")
        .withArgs(1, addr3.address, true);

      const response = await validationRegistry.getValidationResponse(1);
      expect(response.validator).to.equal(addr3.address);
      expect(response.isValid).to.be.true;
      expect(response.proofURI).to.equal(proofURI);
    });

    it("should prevent requester from validating own request", async function () {
      await validationRegistry.connect(addr2).requestValidation(1, TASK_HASH, TASK_URI);

      await expect(
        validationRegistry.connect(addr2).submitValidation(1, true, "proof")
      ).to.be.revertedWith("Requester cannot validate own request");
    });

    it("should prevent double validation", async function () {
      await validationRegistry.connect(addr2).requestValidation(1, TASK_HASH, TASK_URI);
      await validationRegistry.connect(addr3).submitValidation(1, true, "proof");

      await expect(
        validationRegistry.connect(addr4).submitValidation(1, false, "proof2")
      ).to.be.revertedWith("Already validated");
    });

    it("should track validation counts and success rate", async function () {
      // Create 3 validation requests
      await validationRegistry.connect(addr2).requestValidation(1, TASK_HASH, TASK_URI);
      await validationRegistry.connect(addr2).requestValidation(1, ethers.keccak256(ethers.toUtf8Bytes("task-2")), TASK_URI);
      await validationRegistry.connect(addr2).requestValidation(1, ethers.keccak256(ethers.toUtf8Bytes("task-3")), TASK_URI);

      // Submit: 2 valid, 1 invalid
      await validationRegistry.connect(addr3).submitValidation(1, true, "proof1");
      await validationRegistry.connect(addr3).submitValidation(2, true, "proof2");
      await validationRegistry.connect(addr3).submitValidation(3, false, "proof3");

      const [total, completed, successful] = await validationRegistry.getValidationCounts(1);
      expect(total).to.equal(3);
      expect(completed).to.equal(3);
      expect(successful).to.equal(2);

      // Success rate: 2/3 * 100 = 66 (integer division)
      expect(await validationRegistry.getSuccessRate(1)).to.equal(66);
    });

    it("should return all validation IDs for an agent", async function () {
      await validationRegistry.connect(addr2).requestValidation(1, TASK_HASH, TASK_URI);
      await validationRegistry.connect(addr2).requestValidation(1, ethers.keccak256(ethers.toUtf8Bytes("task-2")), TASK_URI);

      const ids = await validationRegistry.getValidationsForAgent(1);
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(1);
      expect(ids[1]).to.equal(2);
    });

    it("should revert for non-existent validation", async function () {
      await expect(
        validationRegistry.getValidation(999)
      ).to.be.revertedWith("Validation not found");
    });

    it("should report total validations", async function () {
      expect(await validationRegistry.totalValidations()).to.equal(0);
      await validationRegistry.connect(addr2).requestValidation(1, TASK_HASH, TASK_URI);
      expect(await validationRegistry.totalValidations()).to.equal(1);
    });

    it("should support pause/unpause", async function () {
      await validationRegistry.connect(owner).pause();
      await expect(
        validationRegistry.connect(addr2).requestValidation(1, TASK_HASH, TASK_URI)
      ).to.be.reverted;

      await validationRegistry.connect(owner).unpause();
      await validationRegistry.connect(addr2).requestValidation(1, TASK_HASH, TASK_URI);
      expect(await validationRegistry.totalValidations()).to.equal(1);
    });
  });

  // ============================================================
  //  AGENTPROOF CORE TESTS
  // ============================================================
  describe("AgentProofCore", function () {
    beforeEach(async function () {
      // Register 3 agents
      await identityRegistry.connect(addr1).registerAgent(AGENT_URI, { value: BOND });
      await identityRegistry.connect(addr2).registerAgent(AGENT_URI_2, { value: BOND });
      await identityRegistry.connect(addr3).registerAgent("https://example.com/agent3.json", { value: BOND });
    });

    it("should return complete agent profile", async function () {
      // Add some reputation
      await reputationRegistry.connect(addr2).submitFeedback(1, 85, FEEDBACK_URI, TASK_HASH);
      await reputationRegistry.connect(addr3).submitFeedback(1, 75, FEEDBACK_URI, TASK_HASH);

      // Add validation
      await validationRegistry.connect(addr2).requestValidation(1, TASK_HASH, TASK_URI);
      await validationRegistry.connect(addr3).submitValidation(1, true, "proof");

      const profile = await agentProofCore.getAgentProfile(1);
      expect(profile.agentId).to.equal(1);
      expect(profile.owner).to.equal(addr1.address);
      expect(profile.agentURI).to.equal(AGENT_URI);
      expect(profile.feedbackCount).to.equal(2);
      expect(profile.averageRating).to.equal(80); // (85+75)/2
      expect(profile.validationSuccessRate).to.equal(100);
      expect(profile.totalValidations).to.equal(1);
      expect(profile.completedValidations).to.equal(1);
      expect(profile.successfulValidations).to.equal(1);
    });

    it("should return top agents by rating", async function () {
      // Agent 1: rating 85
      await reputationRegistry.connect(addr2).submitFeedback(1, 85, FEEDBACK_URI, TASK_HASH);
      // Agent 2: rating 95
      await reputationRegistry.connect(addr1).submitFeedback(2, 95, FEEDBACK_URI, TASK_HASH);
      // Agent 3: rating 70
      await reputationRegistry.connect(addr1).submitFeedback(3, 70, FEEDBACK_URI, TASK_HASH);

      const [agentIds, ratings] = await agentProofCore.getTopAgents(3);
      expect(agentIds[0]).to.equal(2); // Highest
      expect(ratings[0]).to.equal(95);
      expect(agentIds[1]).to.equal(1);
      expect(ratings[1]).to.equal(85);
      expect(agentIds[2]).to.equal(3); // Lowest
      expect(ratings[2]).to.equal(70);
    });

    it("should handle getTopAgents with count > totalAgents", async function () {
      const [agentIds, ratings] = await agentProofCore.getTopAgents(100);
      expect(agentIds.length).to.equal(3);
    });

    it("should manage agent categories", async function () {
      await agentProofCore.connect(addr1).setAgentCategory(1, "defi");
      await agentProofCore.connect(addr2).setAgentCategory(2, "defi");
      await agentProofCore.connect(addr3).setAgentCategory(3, "gaming");

      expect(await agentProofCore.getAgentCategory(1)).to.equal("defi");

      const defiAgents = await agentProofCore.getAgentsByCategory("defi");
      expect(defiAgents.length).to.equal(2);

      const gamingAgents = await agentProofCore.getAgentsByCategory("gaming");
      expect(gamingAgents.length).to.equal(1);
    });

    it("should allow changing agent category", async function () {
      await agentProofCore.connect(addr1).setAgentCategory(1, "defi");
      expect((await agentProofCore.getAgentsByCategory("defi")).length).to.equal(1);

      await agentProofCore.connect(addr1).setAgentCategory(1, "gaming");
      expect((await agentProofCore.getAgentsByCategory("defi")).length).to.equal(0);
      expect((await agentProofCore.getAgentsByCategory("gaming")).length).to.equal(1);
    });

    it("should prevent non-owners from setting category", async function () {
      await expect(
        agentProofCore.connect(addr2).setAgentCategory(1, "defi")
      ).to.be.revertedWith("Not agent owner");
    });

    it("should allow owner to update registries", async function () {
      const newAddr = addr4.address;
      // Just testing the function doesn't revert with valid addresses
      await agentProofCore.connect(owner).updateRegistries(
        await identityRegistry.getAddress(),
        await reputationRegistry.getAddress(),
        await validationRegistry.getAddress()
      );
    });

    it("should reject zero address for registry updates", async function () {
      await expect(
        agentProofCore.connect(owner).updateRegistries(
          ethers.ZeroAddress,
          await reputationRegistry.getAddress(),
          await validationRegistry.getAddress()
        )
      ).to.be.revertedWith("Invalid identity registry");
    });

    it("should support pause/unpause", async function () {
      await agentProofCore.connect(owner).pause();
      // View functions still work when paused
      const profile = await agentProofCore.getAgentProfile(1);
      expect(profile.agentId).to.equal(1);
    });
  });
});
