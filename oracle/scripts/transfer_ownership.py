"""
Emergency ownership transfer for TrustScoreOracle contracts.

Transfers ownership from the compromised wallet to a new wallet on all chains.
Uses the OLD private key to sign transferOwnership() transactions.

Usage:
    python oracle/scripts/transfer_ownership.py

Requires OLD_PRIVATE_KEY and NEW_PRIVATE_KEY env vars (or hardcoded below).
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

# --- CONFIGURATION ---
# Old (compromised) key — used to SIGN the transferOwnership tx
OLD_PRIVATE_KEY = os.getenv("ORACLE_PRIVATE_KEY", "")

# New wallet address — ownership transfers TO this address
NEW_OWNER_ADDRESS = os.getenv("NEW_OWNER_ADDRESS", "0xC71A15Fcb1149254F97059F6cf3f6Ed43990ebd4")

# Minimal ABI for transferOwnership + owner
ORACLE_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "newOwner", "type": "address"}],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# Deployed oracle contracts
CHAINS = [
    {
        "name": "BSC",
        "chain_id": 56,
        "rpc_url": os.getenv("BSC_RPC_URL", "https://bsc-dataseed.binance.org"),
        "oracle_address": os.getenv("BSC_ORACLE_ADDRESS", "0xE6D5ad50e7bb5A13b8E2F674FCDEB48f98849371"),
        "poa": True,
    },
    {
        "name": "Celo",
        "chain_id": 42220,
        "rpc_url": os.getenv("CELO_RPC_URL", "https://forno.celo.org"),
        "oracle_address": os.getenv("CELO_ORACLE_ADDRESS", "0x7471C0fD57658ABBf8065Ee816080D42F67DBB1c"),
        "poa": False,
    },
    {
        "name": "Arbitrum",
        "chain_id": 42161,
        "rpc_url": os.getenv("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc"),
        "oracle_address": os.getenv("ARBITRUM_ORACLE_ADDRESS", "0x7471C0fD57658ABBf8065Ee816080D42F67DBB1c"),
        "poa": False,
    },
    {
        "name": "Monad",
        "chain_id": 143,
        "rpc_url": os.getenv("MONAD_RPC_URL", "https://rpc.monad.xyz"),
        "oracle_address": os.getenv("MONAD_ORACLE_ADDRESS", "0xB5Be2426f3b930AdD6Bc4e4A277a76b9cE4855e1"),
        "poa": False,
    },
]


def transfer_on_chain(chain: dict, old_key: str, new_address: str) -> bool:
    """Call transferOwnership on a single chain. Returns True on success."""
    name = chain["name"]
    rpc_url = chain["rpc_url"]
    oracle_addr = chain["oracle_address"]

    if not rpc_url or not oracle_addr:
        print(f"  [{name}] SKIP — missing RPC or oracle address")
        return False

    print(f"\n--- {name} (chain_id={chain['chain_id']}) ---")
    print(f"  Oracle: {oracle_addr}")

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if chain.get("poa"):
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

    if not w3.is_connected():
        print(f"  [{name}] FAIL — cannot connect to RPC")
        return False

    old_account = w3.eth.account.from_key(old_key)
    print(f"  Old owner: {old_account.address}")
    print(f"  New owner: {new_address}")

    contract = w3.eth.contract(address=Web3.to_checksum_address(oracle_addr), abi=ORACLE_ABI)

    # Verify current owner matches old wallet
    current_owner = contract.functions.owner().call()
    if current_owner.lower() != old_account.address.lower():
        print(f"  [{name}] FAIL — current owner is {current_owner}, not our wallet!")
        return False

    print(f"  Current owner verified: {current_owner}")

    # Build transferOwnership tx
    nonce = w3.eth.get_transaction_count(old_account.address)
    tx = contract.functions.transferOwnership(
        Web3.to_checksum_address(new_address)
    ).build_transaction({
        "from": old_account.address,
        "nonce": nonce,
        "chainId": chain["chain_id"],
    })

    # Gas estimation
    try:
        gas_estimate = w3.eth.estimate_gas(tx)
        tx["gas"] = int(gas_estimate * 1.3)
    except Exception as e:
        print(f"  [{name}] FAIL — gas estimation: {e}")
        return False

    # Gas pricing
    try:
        base_fee = w3.eth.gas_price
        priority_fee = min(w3.to_wei(2, "gwei"), base_fee)
        tx["maxFeePerGas"] = base_fee * 2 + priority_fee
        tx["maxPriorityFeePerGas"] = priority_fee
    except Exception:
        tx["gasPrice"] = w3.eth.gas_price

    # Sign and send
    signed = old_account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"  TX sent: {tx_hash.hex()}")
    print(f"  Waiting for confirmation...")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    if receipt.status != 1:
        print(f"  [{name}] FAIL — tx reverted!")
        return False

    # Verify new owner
    new_owner = contract.functions.owner().call()
    if new_owner.lower() == new_address.lower():
        print(f"  [{name}] SUCCESS — ownership transferred to {new_owner}")
        return True
    else:
        print(f"  [{name}] WARNING — owner is now {new_owner}, expected {new_address}")
        return False


def main():
    if not OLD_PRIVATE_KEY:
        print("ERROR: ORACLE_PRIVATE_KEY not set in .env")
        sys.exit(1)
    if not NEW_OWNER_ADDRESS:
        print("ERROR: NEW_OWNER_ADDRESS not set")
        sys.exit(1)

    w3 = Web3()
    new_address = Web3.to_checksum_address(NEW_OWNER_ADDRESS)
    old_account = w3.eth.account.from_key(OLD_PRIVATE_KEY)

    print("=" * 60)
    print("  EMERGENCY OWNERSHIP TRANSFER")
    print("=" * 60)
    print(f"  Old wallet: {old_account.address}")
    print(f"  New wallet: {new_address}")
    print(f"  Chains: {len(CHAINS)}")
    print("=" * 60)

    # Confirmation
    confirm = input("\nType YES to proceed: ")
    if confirm.strip() != "YES":
        print("Aborted.")
        sys.exit(0)

    results = {}
    for chain in CHAINS:
        try:
            success = transfer_on_chain(chain, OLD_PRIVATE_KEY, new_address)
            results[chain["name"]] = "OK" if success else "FAILED"
        except Exception as e:
            print(f"  [{chain['name']}] ERROR: {e}")
            results[chain["name"]] = f"ERROR: {e}"

    print("\n" + "=" * 60)
    print("  TRANSFER SUMMARY")
    print("=" * 60)
    for name, status in results.items():
        icon = "+" if status == "OK" else "X"
        print(f"  [{icon}] {name}: {status}")

    print("\n  NEXT STEPS:")
    print("  1. Update .env: replace ORACLE_PRIVATE_KEY with the new key")
    print("  2. Update Railway/deployment env vars")
    print("  3. Drain any remaining funds from the old wallet")
    print("  4. Monitor for unauthorized tx from the old address")
    print("=" * 60)


if __name__ == "__main__":
    main()
