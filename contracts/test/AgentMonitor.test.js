const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentMonitor", function () {
  let identityRegistry, agentMonitor;
  let owner, agent1Owner, agent2Owner, monitor1;
  const BOND = ethers.parseEther("0.1");
  const URI = "https://example.com/agent.json";

  beforeEach(async function () {
    [owner, agent1Owner, agent2Owner, monitor1] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.waitForDeployment();

    const AgentMonitor = await ethers.getContractFactory("AgentMonitor");
    agentMonitor = await AgentMonitor.deploy(await identityRegistry.getAddress());
    await agentMonitor.waitForDeployment();

    // Register two agents
    await identityRegistry.connect(agent1Owner).registerAgent(URI, { value: BOND });
    await identityRegistry.connect(agent2Owner).registerAgent(URI, { value: BOND });
  });

  describe("Endpoint Registration", function () {
    it("should register an endpoint", async function () {
      await agentMonitor.connect(agent1Owner).registerEndpoint(1, "https://api.agent1.com", "https");

      const endpoints = await agentMonitor.getEndpoints(1);
      expect(endpoints.length).to.equal(1);
      expect(endpoints[0].url).to.equal("https://api.agent1.com");
      expect(endpoints[0].endpointType).to.equal("https");
      expect(endpoints[0].isActive).to.be.true;
    });

    it("should register multiple endpoints", async function () {
      await agentMonitor.connect(agent1Owner).registerEndpoint(1, "https://api.agent1.com", "https");
      await agentMonitor.connect(agent1Owner).registerEndpoint(1, "wss://ws.agent1.com", "websocket");

      const endpoints = await agentMonitor.getEndpoints(1);
      expect(endpoints.length).to.equal(2);
      expect(endpoints[1].endpointType).to.equal("websocket");
    });

    it("should emit EndpointRegistered event", async function () {
      await expect(
        agentMonitor.connect(agent1Owner).registerEndpoint(1, "https://api.agent1.com", "https")
      ).to.emit(agentMonitor, "EndpointRegistered")
        .withArgs(1, 0, "https://api.agent1.com", "https");
    });

    it("should revert if not agent owner", async function () {
      await expect(
        agentMonitor.connect(agent2Owner).registerEndpoint(1, "https://api.agent1.com", "https")
      ).to.be.revertedWith("Not agent owner");
    });

    it("should revert on empty URL", async function () {
      await expect(
        agentMonitor.connect(agent1Owner).registerEndpoint(1, "", "https")
      ).to.be.revertedWith("URL cannot be empty");
    });

    it("should revert on empty type", async function () {
      await expect(
        agentMonitor.connect(agent1Owner).registerEndpoint(1, "https://api.agent1.com", "")
      ).to.be.revertedWith("Type cannot be empty");
    });

    it("should enforce max 10 endpoints", async function () {
      for (let i = 0; i < 10; i++) {
        await agentMonitor.connect(agent1Owner).registerEndpoint(1, `https://ep${i}.com`, "https");
      }
      await expect(
        agentMonitor.connect(agent1Owner).registerEndpoint(1, "https://ep10.com", "https")
      ).to.be.revertedWith("Max 10 endpoints");
    });
  });

  describe("Endpoint Removal", function () {
    beforeEach(async function () {
      await agentMonitor.connect(agent1Owner).registerEndpoint(1, "https://api.agent1.com", "https");
    });

    it("should remove an endpoint", async function () {
      await agentMonitor.connect(agent1Owner).removeEndpoint(1, 0);

      const endpoints = await agentMonitor.getEndpoints(1);
      expect(endpoints[0].isActive).to.be.false;
    });

    it("should emit EndpointRemoved event", async function () {
      await expect(
        agentMonitor.connect(agent1Owner).removeEndpoint(1, 0)
      ).to.emit(agentMonitor, "EndpointRemoved")
        .withArgs(1, 0);
    });

    it("should revert removing already removed endpoint", async function () {
      await agentMonitor.connect(agent1Owner).removeEndpoint(1, 0);
      await expect(
        agentMonitor.connect(agent1Owner).removeEndpoint(1, 0)
      ).to.be.revertedWith("Already removed");
    });

    it("should revert with invalid endpoint index", async function () {
      await expect(
        agentMonitor.connect(agent1Owner).removeEndpoint(1, 5)
      ).to.be.revertedWith("Invalid endpoint index");
    });
  });

  describe("Uptime Logging", function () {
    beforeEach(async function () {
      await agentMonitor.connect(agent1Owner).registerEndpoint(1, "https://api.agent1.com", "https");
    });

    it("should log uptime check (owner is default monitor)", async function () {
      await agentMonitor.connect(owner).logUptimeCheck(1, 0, true, 120);

      const checks = await agentMonitor.getLatestChecks(1);
      expect(checks.length).to.equal(1);
      expect(checks[0].isUp).to.be.true;
      expect(checks[0].latencyMs).to.equal(120);
    });

    it("should emit UptimeCheckLogged event", async function () {
      await expect(
        agentMonitor.connect(owner).logUptimeCheck(1, 0, true, 150)
      ).to.emit(agentMonitor, "UptimeCheckLogged")
        .withArgs(1, 0, true, 150);
    });

    it("should track cumulative uptime counts", async function () {
      await agentMonitor.connect(owner).logUptimeCheck(1, 0, true, 100);
      await agentMonitor.connect(owner).logUptimeCheck(1, 0, true, 110);
      await agentMonitor.connect(owner).logUptimeCheck(1, 0, false, 0);

      const [total, successful] = await agentMonitor.getUptimeCounts(1);
      expect(total).to.equal(3);
      expect(successful).to.equal(2);
    });

    it("should calculate uptime rate", async function () {
      await agentMonitor.connect(owner).logUptimeCheck(1, 0, true, 100);
      await agentMonitor.connect(owner).logUptimeCheck(1, 0, true, 100);
      await agentMonitor.connect(owner).logUptimeCheck(1, 0, false, 0);
      await agentMonitor.connect(owner).logUptimeCheck(1, 0, true, 100);

      const rate = await agentMonitor.getUptimeRate(1);
      expect(rate).to.equal(7500); // 3/4 = 75% = 7500 BPS
    });

    it("should return 0 rate with no checks", async function () {
      const rate = await agentMonitor.getUptimeRate(1);
      expect(rate).to.equal(0);
    });

    it("should revert for unauthorized monitor", async function () {
      await expect(
        agentMonitor.connect(agent1Owner).logUptimeCheck(1, 0, true, 100)
      ).to.be.revertedWith("Not authorized monitor");
    });

    it("should revert for inactive endpoint", async function () {
      await agentMonitor.connect(agent1Owner).removeEndpoint(1, 0);
      await expect(
        agentMonitor.connect(owner).logUptimeCheck(1, 0, true, 100)
      ).to.be.revertedWith("Endpoint inactive");
    });
  });

  describe("Batch Uptime Logging", function () {
    beforeEach(async function () {
      await agentMonitor.connect(agent1Owner).registerEndpoint(1, "https://api.agent1.com", "https");
      await agentMonitor.connect(agent2Owner).registerEndpoint(2, "https://api.agent2.com", "https");
    });

    it("should batch log uptime checks", async function () {
      await agentMonitor.connect(owner).batchLogUptimeChecks(
        [1, 2],
        [0, 0],
        [true, false],
        [100, 0]
      );

      const [total1, success1] = await agentMonitor.getUptimeCounts(1);
      expect(total1).to.equal(1);
      expect(success1).to.equal(1);

      const [total2, success2] = await agentMonitor.getUptimeCounts(2);
      expect(total2).to.equal(1);
      expect(success2).to.equal(0);
    });

    it("should revert on array length mismatch", async function () {
      await expect(
        agentMonitor.connect(owner).batchLogUptimeChecks(
          [1, 2],
          [0],
          [true, false],
          [100, 0]
        )
      ).to.be.revertedWith("Array length mismatch");
    });

    it("should revert on batch too large", async function () {
      const ids = Array(51).fill(1);
      const idxs = Array(51).fill(0);
      const ups = Array(51).fill(true);
      const lats = Array(51).fill(100);

      await expect(
        agentMonitor.connect(owner).batchLogUptimeChecks(ids, idxs, ups, lats)
      ).to.be.revertedWith("Batch too large");
    });

    it("should skip inactive endpoints in batch", async function () {
      await agentMonitor.connect(agent1Owner).removeEndpoint(1, 0);

      // Should not revert — just skips inactive
      await agentMonitor.connect(owner).batchLogUptimeChecks(
        [1, 2],
        [0, 0],
        [true, true],
        [100, 100]
      );

      const [total1] = await agentMonitor.getUptimeCounts(1);
      expect(total1).to.equal(0); // Skipped

      const [total2] = await agentMonitor.getUptimeCounts(2);
      expect(total2).to.equal(1); // Logged
    });
  });

  describe("Monitor Authorization", function () {
    it("should authorize a monitor", async function () {
      await agentMonitor.addMonitor(monitor1.address);
      expect(await agentMonitor.authorizedMonitors(monitor1.address)).to.be.true;
    });

    it("should emit MonitorAuthorized event", async function () {
      await expect(agentMonitor.addMonitor(monitor1.address))
        .to.emit(agentMonitor, "MonitorAuthorized")
        .withArgs(monitor1.address);
    });

    it("should revoke a monitor", async function () {
      await agentMonitor.addMonitor(monitor1.address);
      await agentMonitor.removeMonitor(monitor1.address);
      expect(await agentMonitor.authorizedMonitors(monitor1.address)).to.be.false;
    });

    it("should emit MonitorRevoked event", async function () {
      await agentMonitor.addMonitor(monitor1.address);
      await expect(agentMonitor.removeMonitor(monitor1.address))
        .to.emit(agentMonitor, "MonitorRevoked")
        .withArgs(monitor1.address);
    });

    it("should revert adding zero address", async function () {
      await expect(
        agentMonitor.addMonitor(ethers.ZeroAddress)
      ).to.be.revertedWith("Zero address");
    });

    it("should revert adding already authorized", async function () {
      await agentMonitor.addMonitor(monitor1.address);
      await expect(
        agentMonitor.addMonitor(monitor1.address)
      ).to.be.revertedWith("Already authorized");
    });

    it("should revert removing non-monitor", async function () {
      await expect(
        agentMonitor.removeMonitor(monitor1.address)
      ).to.be.revertedWith("Not a monitor");
    });

    it("should allow authorized monitor to log", async function () {
      await agentMonitor.addMonitor(monitor1.address);
      await agentMonitor.connect(agent1Owner).registerEndpoint(1, "https://api.test.com", "https");
      await agentMonitor.connect(monitor1).logUptimeCheck(1, 0, true, 50);

      const checks = await agentMonitor.getLatestChecks(1);
      expect(checks.length).to.equal(1);
    });
  });

  describe("Pausable", function () {
    it("should pause and unpause", async function () {
      await agentMonitor.pause();
      await expect(
        agentMonitor.connect(agent1Owner).registerEndpoint(1, "https://api.test.com", "https")
      ).to.be.reverted;

      await agentMonitor.unpause();
      await agentMonitor.connect(agent1Owner).registerEndpoint(1, "https://api.test.com", "https");
    });

    it("should revert pause from non-owner", async function () {
      await expect(
        agentMonitor.connect(agent1Owner).pause()
      ).to.be.reverted;
    });
  });
});
