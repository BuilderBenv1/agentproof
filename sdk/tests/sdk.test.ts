import { expect } from "chai";
import {
  AgentProof,
  encodeMetadataURI,
  decodeMetadataURI,
  hashTask,
  parseAvax,
  formatAvax,
  getAddresses,
  CHAIN_ADDRESSES,
  OFFICIAL_ERC8004,
  AGENTPROOF_CUSTOM,
} from "../src";

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
    it("should return official ERC-8004 addresses for Fuji (43113)", () => {
      const addrs = getAddresses(43113);
      expect(addrs.identityRegistry).to.equal(OFFICIAL_ERC8004.fuji.identityRegistry);
      expect(addrs.reputationRegistry).to.equal(OFFICIAL_ERC8004.fuji.reputationRegistry);
      expect(addrs.validationRegistry).to.equal(AGENTPROOF_CUSTOM.fuji.validationRegistry);
      expect(addrs.agentProofCore).to.equal(AGENTPROOF_CUSTOM.fuji.agentProofCore);
    });

    it("should return official ERC-8004 mainnet addresses for chain 43114", () => {
      const addrs = getAddresses(43114);
      expect(addrs.identityRegistry).to.equal(OFFICIAL_ERC8004.mainnet.identityRegistry);
      expect(addrs.reputationRegistry).to.equal(OFFICIAL_ERC8004.mainnet.reputationRegistry);
    });

    it("should throw for unknown chain", () => {
      expect(() => getAddresses(1)).to.throw("No contract addresses configured");
    });

    it("should export OFFICIAL_ERC8004 with correct structure", () => {
      expect(OFFICIAL_ERC8004.fuji.identityRegistry).to.match(/^0x8004/);
      expect(OFFICIAL_ERC8004.fuji.reputationRegistry).to.match(/^0x8004/);
      expect(OFFICIAL_ERC8004.mainnet.identityRegistry).to.match(/^0x8004/);
      expect(OFFICIAL_ERC8004.mainnet.reputationRegistry).to.match(/^0x8004/);
    });

    it("should export AGENTPROOF_CUSTOM with legacy addresses", () => {
      expect(AGENTPROOF_CUSTOM.fuji.validationRegistry).to.match(/^0x/);
      expect(AGENTPROOF_CUSTOM.fuji.agentProofCore).to.match(/^0x/);
      expect(AGENTPROOF_CUSTOM.fuji.legacyIdentityRegistry).to.match(/^0x/);
      expect(AGENTPROOF_CUSTOM.fuji.legacyReputationRegistry).to.match(/^0x/);
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
      expect(ap.addresses.identityRegistry).to.equal(OFFICIAL_ERC8004.fuji.identityRegistry);
      expect(ap.addresses.reputationRegistry).to.equal(OFFICIAL_ERC8004.fuji.reputationRegistry);
    });

    it("should call totalAgents (totalSupply) on official registry", async () => {
      // The official ERC-8004 contract may or may not support totalSupply
      // depending on whether it extends ERC721Enumerable
      try {
        const total = await ap.totalAgents();
        expect(typeof total).to.equal("bigint");
        expect(total >= 0n).to.be.true;
      } catch (e: any) {
        // totalSupply may not be available on the official contract
        expect(e.message).to.include("CALL_EXCEPTION");
      }
    });

    it("should throw on write without signer", async () => {
      try {
        await ap.registerAgent("test");
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.message).to.include("Signer required");
      }
    });

    it("should throw on giveFeedback without signer", async () => {
      try {
        await ap.giveFeedback(1, 85);
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.message).to.include("Signer required");
      }
    });
  });

  describe("AgentProof Client (with signer)", () => {
    it("should instantiate with private key", () => {
      const ap = new AgentProof({
        rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
        chainId: 43113,
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
      });
      expect(ap.signer).to.not.be.null;
    });
  });
});
