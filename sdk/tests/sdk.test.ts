import { expect } from "chai";
import { AgentProof, encodeMetadataURI, decodeMetadataURI, hashTask, parseAvax, formatAvax, getAddresses, CHAIN_ADDRESSES } from "../src";

describe("AgentProof SDK", () => {
  describe("Utils", () => {
    it("should encode and decode metadata URI", () => {
      const metadata = { name: "Test Agent", description: "A test", category: "defi" };
      const uri = encodeMetadataURI(metadata);
      expect(uri).to.match(/^data:application\/json;base64,/);
      const decoded = decodeMetadataURI(uri);
      expect(decoded.name).to.equal("Test Agent");
      expect(decoded.category).to.equal("defi");
    });

    it("should throw on invalid URI format", () => {
      expect(() => decodeMetadataURI("https://example.com")).to.throw("Unsupported URI format");
    });

    it("should hash task descriptions deterministically", () => {
      const hash1 = hashTask("task-1");
      const hash2 = hashTask("task-1");
      const hash3 = hashTask("task-2");
      expect(hash1).to.equal(hash2);
      expect(hash1).to.not.equal(hash3);
      expect(hash1).to.match(/^0x[0-9a-f]{64}$/);
    });

    it("should parse and format AVAX values", () => {
      const wei = parseAvax("1.5");
      expect(wei).to.equal(1500000000000000000n);
      expect(formatAvax(wei)).to.equal("1.5");
    });
  });

  describe("Addresses", () => {
    it("should return Fuji addresses for chain 43113", () => {
      const addrs = getAddresses(43113);
      expect(addrs.identityRegistry).to.equal("0x4Ec097F5441F24B567C4c741eAEeBcBE3D107825");
      expect(addrs.reputationRegistry).to.match(/^0x/);
      expect(addrs.validationRegistry).to.match(/^0x/);
      expect(addrs.agentProofCore).to.match(/^0x/);
    });

    it("should throw for unknown chain", () => {
      expect(() => getAddresses(1)).to.throw("No contract addresses configured");
    });
  });

  describe("AgentProof Client (read-only)", () => {
    let ap: AgentProof;

    before(() => {
      ap = new AgentProof({
        rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
        chainId: 43113,
      });
    });

    it("should instantiate without signer", () => {
      expect(ap.signer).to.be.null;
      expect(ap.provider).to.exist;
      expect(ap.addresses.identityRegistry).to.match(/^0x/);
    });

    it("should read totalAgents from chain", async () => {
      const total = await ap.totalAgents();
      expect(typeof total).to.equal("bigint");
      expect(total >= 0n).to.be.true;
    });

    it("should read registrationBond", async () => {
      const bond = await ap.getRegistrationBond();
      expect(bond).to.equal(parseAvax("0.1"));
    });

    it("should throw on write without signer", async () => {
      try {
        await ap.registerAgent("test");
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.message).to.include("Signer required");
      }
    });
  });

  describe("AgentProof Client (with signer)", () => {
    it("should instantiate with private key", () => {
      // Use a random throwaway key — no funds needed for instantiation
      const ap = new AgentProof({
        rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
        chainId: 43113,
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
      });
      expect(ap.signer).to.not.be.null;
    });
  });
});
