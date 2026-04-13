"""
Deploy AgentFactory to SKALE Base.

Compiles Solidity inline via py-solc-x, deploys via web3.py.
Gasless on SKALE — uses CREDIT (free) for gas.

Usage:
    pip install py-solc-x web3 python-dotenv
    python factory/deploy.py

Requires:
    PRIVATE_KEY or ORACLE_PRIVATE_KEY in .env
    SKALE_RPC_URL (defaults to SKALE Base mainnet)
"""

import os
import sys

from web3 import Web3
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# SKALE Base mainnet
SKALE_RPC = os.getenv("SKALE_RPC_URL", "https://skale-base.skalenodes.com/v1/base")
CHAIN_ID = 1187947933

# ERC-8004 Identity Registry (same CREATE2 address on all chains)
IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"

# TrustScoreOracle on SKALE Base (deployed earlier)
TRUST_ORACLE = os.getenv("SKALE_ORACLE_ADDRESS", "0xe4eBEf67D698C1b45A2aaacB9ce7c4B0B4E53682")

# Default minimum tier: 1 = bronze (agents must be at least bronze to transact)
DEFAULT_MIN_TIER = 1


def compile_factory():
    try:
        import solcx
    except ImportError:
        print("ERROR: pip install py-solc-x")
        sys.exit(1)

    target = "0.8.24"
    installed = [str(v) for v in solcx.get_installed_solc_versions()]
    if target not in installed:
        print(f"Installing solc {target}...")
        solcx.install_solc(target)

    source_path = os.path.join(os.path.dirname(__file__), "contracts", "AgentFactory.sol")
    with open(source_path) as f:
        source = f.read()

    print("Compiling AgentFactory...")
    compiled = solcx.compile_source(
        source,
        output_values=["abi", "bin"],
        solc_version=target,
        optimize=True,
        optimize_runs=200,
    )

    key = next(k for k in compiled if k.endswith(":AgentFactory"))
    contract = compiled[key]
    print(f"Compiled. Bytecode size: {len(contract['bin']) // 2} bytes")
    return contract["abi"], contract["bin"]


def deploy():
    private_key = os.getenv("PRIVATE_KEY") or os.getenv("ORACLE_PRIVATE_KEY", "")
    if not private_key:
        print("ERROR: Set PRIVATE_KEY or ORACLE_PRIVATE_KEY")
        sys.exit(1)

    w3 = Web3(Web3.HTTPProvider(SKALE_RPC))
    if not w3.is_connected():
        print("ERROR: Cannot connect to SKALE RPC")
        sys.exit(1)

    account = w3.eth.account.from_key(private_key)
    print(f"Wallet: {account.address}")
    print(f"Balance: {w3.from_wei(w3.eth.get_balance(account.address), 'ether')} CREDIT")

    abi, bytecode = compile_factory()

    # Build constructor args
    contract = w3.eth.contract(abi=abi, bytecode="0x" + bytecode)
    nonce = w3.eth.get_transaction_count(account.address)

    tx = contract.constructor(
        Web3.to_checksum_address(IDENTITY_REGISTRY),
        Web3.to_checksum_address(TRUST_ORACLE),
        DEFAULT_MIN_TIER,
    ).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "chainId": CHAIN_ID,
        "gasPrice": w3.eth.gas_price,
    })

    gas = w3.eth.estimate_gas(tx)
    tx["gas"] = int(gas * 1.3)
    print(f"Gas estimate: {gas}")

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"TX sent: {tx_hash.hex()}")
    print("Waiting for confirmation...")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    if receipt.status != 1:
        print("DEPLOY FAILED — tx reverted")
        sys.exit(1)

    factory_address = receipt.contractAddress
    print(f"\n=== AgentFactory Deployed ===")
    print(f"Address: {factory_address}")
    print(f"Explorer: https://skale-base-explorer.skalenodes.com/address/{factory_address}")
    print(f"\nRailway env:")
    print(f"  SKALE_FACTORY_ADDRESS={factory_address}")

    # Verify constructor args
    deployed = w3.eth.contract(address=factory_address, abi=abi)
    print(f"\nVerification:")
    print(f"  owner: {deployed.functions.owner().call()}")
    print(f"  identityRegistry: {deployed.functions.identityRegistry().call()}")
    print(f"  trustOracle: {deployed.functions.trustOracle().call()}")
    print(f"  defaultMinTier: {deployed.functions.defaultMinTier().call()}")
    print(f"  totalLaunched: {deployed.functions.totalLaunched().call()}")

    return factory_address


if __name__ == "__main__":
    print("=== AgentFactory — SKALE Base Deployment ===\n")
    deploy()
