"""
Deploy TrustScoreOracle to multiple EVM chains.

Compiles Solidity inline via py-solc-x, then deploys via web3.py.
No external Solidity tooling required — just: pip install py-solc-x web3

Usage:
    pip install py-solc-x
    python oracle/scripts/deploy_trust_oracle.py

Requires PRIVATE_KEY and chain RPC URLs in .env or environment.
Only deploys to chains that have an RPC URL but no oracle address configured yet.
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

SOLIDITY_SOURCE = """
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TrustScoreOracle {
    address public owner;

    struct Score {
        uint16 compositeScore;  // 0-10000 (score * 100)
        uint8 tier;             // 0=unranked,1=bronze,2=silver,3=gold,4=platinum,5=diamond
        uint40 updatedAt;
    }

    mapping(uint256 => Score) public scores;

    event ScoreUpdated(uint256 indexed agentId, uint16 compositeScore, uint8 tier);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function updateScore(uint256 agentId, uint16 compositeScore, uint8 tier) external onlyOwner {
        scores[agentId] = Score(compositeScore, tier, uint40(block.timestamp));
        emit ScoreUpdated(agentId, compositeScore, tier);
    }

    function batchUpdateScores(
        uint256[] calldata agentIds,
        uint16[] calldata compositeScores,
        uint8[] calldata tiers
    ) external onlyOwner {
        require(agentIds.length == compositeScores.length && agentIds.length == tiers.length, "len");
        for (uint256 i = 0; i < agentIds.length; i++) {
            scores[agentIds[i]] = Score(compositeScores[i], tiers[i], uint40(block.timestamp));
            emit ScoreUpdated(agentIds[i], compositeScores[i], tiers[i]);
        }
    }

    function getScore(uint256 agentId) external view returns (uint16, uint8, uint40) {
        Score memory s = scores[agentId];
        return (s.compositeScore, s.tier, s.updatedAt);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
"""

# Chains to deploy to
CHAINS = [
    {"name": "bsc",       "chain_id": 56,     "rpc_env": "BSC_RPC_URL",       "addr_env": "BSC_ORACLE_ADDRESS",       "poa": True},
    {"name": "polygon",   "chain_id": 137,    "rpc_env": "POLYGON_RPC_URL",   "addr_env": "POLYGON_ORACLE_ADDRESS",   "poa": True},
    {"name": "celo",      "chain_id": 42220,  "rpc_env": "CELO_RPC_URL",      "addr_env": "CELO_ORACLE_ADDRESS",      "poa": False},
    {"name": "arbitrum",  "chain_id": 42161,  "rpc_env": "ARBITRUM_RPC_URL",  "addr_env": "ARBITRUM_ORACLE_ADDRESS",  "poa": False},
    {"name": "monad",     "chain_id": 143,    "rpc_env": "MONAD_RPC_URL",     "addr_env": "MONAD_ORACLE_ADDRESS",     "poa": False},
]


def compile_contract():
    """Compile Solidity source using py-solc-x. Installs solc 0.8.24 if needed."""
    try:
        import solcx
    except ImportError:
        print("ERROR: py-solc-x not installed. Run: pip install py-solc-x")
        sys.exit(1)

    # Install solc if not present
    target = "0.8.24"
    installed = [str(v) for v in solcx.get_installed_solc_versions()]
    if target not in installed:
        print(f"Installing solc {target}...")
        solcx.install_solc(target)

    print("Compiling TrustScoreOracle...")
    compiled = solcx.compile_source(
        SOLIDITY_SOURCE,
        output_values=["abi", "bin"],
        solc_version=target,
        optimize=True,
        optimize_runs=200,
    )

    # Extract contract
    contract_key = next(k for k in compiled if k.endswith(":TrustScoreOracle"))
    contract = compiled[contract_key]

    print(f"Compiled. Bytecode size: {len(contract['bin']) // 2} bytes")
    return contract["abi"], contract["bin"]


def deploy_to_chain(chain: dict, private_key: str, abi: list, bytecode: str) -> str | None:
    """Deploy TrustScoreOracle to a single chain. Returns contract address or None."""
    name = chain["name"]
    rpc_url = os.getenv(chain["rpc_env"], "")
    if not rpc_url:
        print(f"  [{name}] SKIP — {chain['rpc_env']} not set")
        return None

    existing = os.getenv(chain["addr_env"], "")
    if existing:
        print(f"  [{name}] SKIP — already deployed at {existing}")
        return existing

    print(f"  [{name}] Connecting...")
    w3 = Web3(Web3.HTTPProvider(rpc_url))

    if chain.get("poa"):
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

    if not w3.is_connected():
        print(f"  [{name}] FAIL — cannot connect to RPC")
        return None

    account = w3.eth.account.from_key(private_key)
    balance = w3.eth.get_balance(account.address)
    balance_native = w3.from_wei(balance, "ether")
    print(f"  [{name}] Wallet: {account.address}  Balance: {balance_native:.6f}")

    if balance == 0:
        print(f"  [{name}] FAIL — zero balance")
        return None

    # Build deploy tx
    contract = w3.eth.contract(abi=abi, bytecode="0x" + bytecode)
    nonce = w3.eth.get_transaction_count(account.address)

    tx = contract.constructor().build_transaction({
        "from": account.address,
        "nonce": nonce,
        "chainId": chain["chain_id"],
    })

    # Estimate gas
    try:
        gas_estimate = w3.eth.estimate_gas(tx)
        tx["gas"] = int(gas_estimate * 1.3)
    except Exception as e:
        print(f"  [{name}] FAIL — gas estimation: {e}")
        return None

    # Gas pricing — Polygon needs high priority fee (25+ gwei)
    try:
        base_fee = w3.eth.gas_price
        if chain["chain_id"] == 137:  # Polygon
            priority_fee = max(w3.to_wei(30, "gwei"), base_fee)
        else:
            priority_fee = min(w3.to_wei(2, "gwei"), base_fee)
        tx["maxFeePerGas"] = base_fee * 2 + priority_fee
        tx["maxPriorityFeePerGas"] = priority_fee
    except Exception:
        tx["gasPrice"] = w3.eth.gas_price

    gas_cost = w3.from_wei(tx.get("maxFeePerGas", tx.get("gasPrice", 0)) * tx["gas"], "ether")
    print(f"  [{name}] Gas estimate: {tx['gas']} (~{gas_cost:.6f} native)")

    # Sign and send
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"  [{name}] TX sent: {tx_hash.hex()}")
    print(f"  [{name}] Waiting for confirmation...")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    if receipt.status != 1:
        print(f"  [{name}] FAIL — deploy tx reverted")
        return None

    contract_address = receipt.contractAddress
    print(f"  [{name}] DEPLOYED: {contract_address}")

    # Verify owner
    deployed = w3.eth.contract(address=contract_address, abi=abi)
    owner = deployed.functions.owner().call()
    assert owner.lower() == account.address.lower(), f"Owner mismatch: {owner}"
    print(f"  [{name}] Owner verified: {owner}")

    return contract_address


def main():
    private_key = os.getenv("PRIVATE_KEY") or os.getenv("ORACLE_PRIVATE_KEY", "")
    if not private_key:
        print("ERROR: Set PRIVATE_KEY or ORACLE_PRIVATE_KEY env var")
        sys.exit(1)

    print("=== TrustScoreOracle Multi-Chain Deployment ===\n")

    abi, bytecode = compile_contract()

    results = {}
    for chain in CHAINS:
        print(f"\n--- {chain['name'].upper()} (chain_id={chain['chain_id']}) ---")
        try:
            addr = deploy_to_chain(chain, private_key, abi, bytecode)
            if addr:
                results[chain["name"]] = addr
        except Exception as e:
            print(f"  [{chain['name']}] ERROR: {e}")

    print("\n\n=== Deployment Summary ===")
    if not results:
        print("No new deployments.")
    else:
        print("\nAdd these to Railway environment variables:")
        print()
        for name, addr in results.items():
            env_key = next(c["addr_env"] for c in CHAINS if c["name"] == name)
            print(f"  {env_key}={addr}")

    print("\nDone.")


if __name__ == "__main__":
    main()
