const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReputationBridge", function () {
  let reputationBridge, reputationSource, agentProofCore;
  let identityRegistry, reputationRegistry, validationRegistry;
  let owner, user;
  const BOND = ethers.parseEther("0.1");
  const URI = "https://example.com/agent.json";
  const MOCK_CHAIN_ID = ethers.keccak256(ethers.toUtf8Bytes("test-l1-chain"));

  // Mock Teleporter that simply routes messages
  let mockTeleporter;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy core contracts
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

    // For testing, we'll directly call receiveTeleporterMessage
    // to simulate ICM message delivery (no real Teleporter needed for unit tests)

    // Deploy ReputationSource (C-Chain side)
    const ReputationSource = await ethers.getContractFactory("ReputationSource");
    reputationSource = await ReputationSource.deploy(
      await agentProofCore.getAddress(),
      owner.address // Mock teleporter = owner for testing
    );
    await reputationSource.waitForDeployment();

    // Deploy ReputationBridge (L1 side)
    const ReputationBridge = await ethers.getContractFactory("ReputationBridge");
    reputationBridge = await ReputationBridge.deploy(
      owner.address,   // Mock teleporter = owner
      MOCK_CHAIN_ID,
      await reputationSource.getAddress()
    );
    await reputationBridge.waitForDeployment();

    // Allow the test chain in source
    await reputationSource.allowChain(MOCK_CHAIN_ID);

    // Register an agent with some data
    await identityRegistry.connect(user).registerAgent(URI, { value: BOND });
  });

  describe("ReputationBridge - Receive", function () {
    it("should cache reputation data from ICM message", async function () {
      // Simulate receiving reputation data from C-Chain
      const message = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "string", "uint256", "uint256"],
        [1, 75, "gold", 25, 90]
      );

      await reputationBridge.connect(owner).receiveTeleporterMessage(
        MOCK_CHAIN_ID,
        await reputationSource.getAddress(),
        message
      );

      const rep = await reputationBridge.getReputation(1);
      expect(rep.compositeScore).to.equal(75);
      expect(rep.tier).to.equal("gold");
      expect(rep.totalFeedback).to.equal(25);
      expect(rep.validationSuccessRate).to.equal(90);
      expect(rep.exists).to.be.true;
    });

    it("should reject messages from wrong source", async function () {
      const message = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "string", "uint256", "uint256"],
        [1, 75, "gold", 25, 90]
      );

      await expect(
        reputationBridge.connect(owner).receiveTeleporterMessage(
          MOCK_CHAIN_ID,
          user.address, // Wrong source
          message
        )
      ).to.be.revertedWith("Invalid source address");
    });

    it("should reject messages from wrong chain", async function () {
      const wrongChain = ethers.keccak256(ethers.toUtf8Bytes("wrong-chain"));
      const message = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "string", "uint256", "uint256"],
        [1, 75, "gold", 25, 90]
      );

      await expect(
        reputationBridge.connect(owner).receiveTeleporterMessage(
          wrongChain,
          await reputationSource.getAddress(),
          message
        )
      ).to.be.revertedWith("Invalid source chain");
    });
  });

  describe("ReputationBridge - Read", function () {
    beforeEach(async function () {
      const message = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "string", "uint256", "uint256"],
        [1, 85, "platinum", 35, 95]
      );
      await reputationBridge.connect(owner).receiveTeleporterMessage(
        MOCK_CHAIN_ID,
        await reputationSource.getAddress(),
        message
      );
    });

    it("should get tier", async function () {
      expect(await reputationBridge.getTier(1)).to.equal("platinum");
    });

    it("should get score", async function () {
      expect(await reputationBridge.getScore(1)).to.equal(85);
    });

    it("should check minimum tier", async function () {
      expect(await reputationBridge.isMinimumTier(1, "gold")).to.be.true;
      expect(await reputationBridge.isMinimumTier(1, "diamond")).to.be.false;
    });

    it("should check freshness", async function () {
      expect(await reputationBridge.isReputationFresh(1, 3600)).to.be.true; // Within 1 hour
    });

    it("should revert for non-existent agent", async function () {
      await expect(reputationBridge.getReputation(999)).to.be.revertedWith("No cached reputation");
    });
  });

  describe("ReputationSource", function () {
    it("should allow chain management", async function () {
      const newChain = ethers.keccak256(ethers.toUtf8Bytes("new-chain"));
      await reputationSource.allowChain(newChain);
      expect(await reputationSource.allowedChains(newChain)).to.be.true;
      await reputationSource.disallowChain(newChain);
      expect(await reputationSource.allowedChains(newChain)).to.be.false;
    });

    it("should reject messages from disallowed chains", async function () {
      const disallowedChain = ethers.keccak256(ethers.toUtf8Bytes("bad-chain"));
      const message = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint256"],
        ["REQUEST", 1]
      );

      await expect(
        reputationSource.connect(owner).receiveTeleporterMessage(
          disallowedChain,
          user.address,
          message
        )
      ).to.be.revertedWith("Chain not allowed");
    });
  });
});
