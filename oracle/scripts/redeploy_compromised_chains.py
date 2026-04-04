"""
Redeploy TrustScoreOracle on chains where the old wallet was compromised.

The attacker has a sweeper on the old wallet, so we can't call transferOwnership().
Instead, deploy fresh contracts from the new wallet on BSC, Celo, and Arbitrum.

Usage:
    python oracle/scripts/redeploy_compromised_chains.py
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

# Same contract source from deploy_trust_oracle.py
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

# Chains that need redeployment
CHAINS = [
    {"name": "optimism",  "chain_id": 10,      "rpc_env": "OPTIMISM_RPC_URL",  "addr_env": "OPTIMISM_ORACLE_ADDRESS",  "poa": False},
    {"name": "linea",     "chain_id": 59144,   "rpc_env": "LINEA_RPC_URL",    "addr_env": "LINEA_ORACLE_ADDRESS",     "poa": False},
]


def compile_contract():
    try:
        import solcx
    except ImportError:
        print("ERROR: py-solc-x not installed. Run: pip install py-solc-x")
        sys.exit(1)

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

    contract_key = next(k for k in compiled if k.endswith(":TrustScoreOracle"))
    contract = compiled[contract_key]
    print(f"Compiled. Bytecode size: {len(contract['bin']) // 2} bytes")
    return contract["abi"], contract["bin"]


def deploy_to_chain(chain: dict, private_key: str, abi: list, bytecode: str) -> str | None:
    name = chain["name"]
    rpc_url = os.getenv(chain["rpc_env"], "")
    if not rpc_url:
        print(f"  [{name}] SKIP - {chain['rpc_env']} not set")
        return None

    print(f"\n--- {name.upper()} (chain_id={chain['chain_id']}) ---")
    w3 = Web3(Web3.HTTPProvider(rpc_url))

    if chain.get("poa"):
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

    if not w3.is_connected():
        print(f"  [{name}] FAIL - cannot connect to RPC")
        return None

    account = w3.eth.account.from_key(private_key)
    balance = w3.eth.get_balance(account.address)
    balance_native = w3.from_wei(balance, "ether")
    print(f"  Wallet: {account.address}  Balance: {balance_native:.6f}")

    if balance == 0:
        print(f"  [{name}] FAIL - zero balance, fund wallet first")
        return None

    contract = w3.eth.contract(abi=abi, bytecode="0x" + bytecode)
    nonce = w3.eth.get_transaction_count(account.address)

    tx = contract.constructor().build_transaction({
        "from": account.address,
        "nonce": nonce,
        "chainId": chain["chain_id"],
    })

    try:
        gas_estimate = w3.eth.estimate_gas(tx)
        tx["gas"] = int(gas_estimate * 1.3)
    except Exception as e:
        print(f"  [{name}] FAIL - gas estimation: {e}")
        return None

    try:
        base_fee = w3.eth.gas_price
        if chain["chain_id"] == 137:
            priority_fee = max(w3.to_wei(30, "gwei"), base_fee)
        else:
            priority_fee = min(w3.to_wei(2, "gwei"), base_fee)
        tx["maxFeePerGas"] = base_fee * 2 + priority_fee
        tx["maxPriorityFeePerGas"] = priority_fee
    except Exception:
        tx["gasPrice"] = w3.eth.gas_price

    gas_cost = w3.from_wei(tx.get("maxFeePerGas", tx.get("gasPrice", 0)) * tx["gas"], "ether")
    print(f"  Gas estimate: {tx['gas']} (~{gas_cost:.6f} native)")

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"  TX sent: {tx_hash.hex()}")
    print(f"  Waiting for confirmation...")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    if receipt.status != 1:
        print(f"  [{name}] FAIL - deploy tx reverted")
        return None

    contract_address = receipt.contractAddress
    print(f"  [{name}] DEPLOYED: {contract_address}")

    deployed = w3.eth.contract(address=contract_address, abi=abi)
    owner = deployed.functions.owner().call()
    assert owner.lower() == account.address.lower(), f"Owner mismatch: {owner}"
    print(f"  Owner verified: {owner}")

    return contract_address


def main():
    private_key = os.getenv("ORACLE_PRIVATE_KEY", "")
    if not private_key:
        print("ERROR: ORACLE_PRIVATE_KEY not set in .env")
        sys.exit(1)

    w3 = Web3()
    account = w3.eth.account.from_key(private_key)

    print("=" * 60)
    print("  REDEPLOY TrustScoreOracle (compromised chains)")
    print("=" * 60)
    print(f"  New wallet: {account.address}")
    print(f"  Chains: BSC, Celo, Arbitrum")
    print("=" * 60)

    confirm = input("\nType YES to proceed: ")
    if confirm.strip() != "YES":
        print("Aborted.")
        sys.exit(0)

    abi, bytecode = compile_contract()

    results = {}
    for chain in CHAINS:
        try:
            addr = deploy_to_chain(chain, private_key, abi, bytecode)
            if addr:
                results[chain["name"]] = addr
        except Exception as e:
            print(f"  [{chain['name']}] ERROR: {e}")

    print("\n" + "=" * 60)
    print("  REDEPLOYMENT SUMMARY")
    print("=" * 60)

    if results:
        print("\n  Update these in .env and Railway:")
        for name, addr in results.items():
            env_key = next(c["addr_env"] for c in CHAINS if c["name"] == name)
            print(f"    {env_key}={addr}")
    else:
        print("  No deployments succeeded. Fund the new wallet on each chain first.")

    print("\n  Monad: already transferred (no redeploy needed)")
    print("=" * 60)


if __name__ == "__main__":
    main()
