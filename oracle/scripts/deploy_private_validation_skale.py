"""
Deploy PrivateValidationRegistry to a SKALE BITE-enabled chain.

The contract uses BITE precompiles for sealed-ballot validation. Validators
submit threshold-encrypted (TE) `isValid` votes; only the aggregate consensus
is revealed once quorum triggers a CTX-based threshold decryption.

CRITICAL build settings:
    - solc 0.8.24 (matches the rest of the AgentProof contracts)
    - evm_version = "istanbul" — required for BITE precompile compatibility

Usage:
    python oracle/scripts/deploy_private_validation_skale.py            # dry-run on SKALE Base
    python oracle/scripts/deploy_private_validation_skale.py --sepolia  # dry-run on SKALE Base Sepolia
    python oracle/scripts/deploy_private_validation_skale.py --deploy   # broadcast to SKALE Base

Requires PRIVATE_KEY or ORACLE_PRIVATE_KEY in .env.
On success, writes the deployed address to oracle/scripts/deployed_private_validation.json.
"""

import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from web3 import Web3
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


CHAINS = {
    "skale_base": {
        "rpc": os.getenv("SKALE_RPC_URL", "https://skale-base.skalenodes.com/v1/base"),
        "chain_id": 1187947933,
        "label": "SKALE Base (mainnet)",
    },
    "skale_base_sepolia": {
        "rpc": os.getenv(
            "SKALE_SEPOLIA_RPC_URL",
            "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha",
        ),
        "chain_id": 324705682,
        "label": "SKALE Base Sepolia",
    },
}

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CONTRACTS_DIR = os.path.join(REPO_ROOT, "contracts", "src")
SRC = os.path.join(CONTRACTS_DIR, "PrivateValidationRegistry.sol")
ARTIFACT_OUT = os.path.join(os.path.dirname(__file__), "deployed_private_validation.json")


def _solcx():
    try:
        import solcx
    except ImportError:
        print("ERROR: py-solc-x not installed. Run: pip install py-solc-x")
        sys.exit(1)
    target = "0.8.24"
    if target not in [str(v) for v in solcx.get_installed_solc_versions()]:
        print(f"Installing solc {target}...")
        solcx.install_solc(target)
    solcx.set_solc_version(target)
    return solcx, target


def compile_contract():
    solcx, target = _solcx()
    print("Compiling PrivateValidationRegistry (evm_version=istanbul)...")
    out = solcx.compile_files(
        [SRC],
        output_values=["abi", "bin"],
        solc_version=target,
        optimize=True,
        optimize_runs=200,
        evm_version="istanbul",
        allow_paths=[CONTRACTS_DIR],
    )
    key = next(k for k in out if k.endswith(":PrivateValidationRegistry"))
    return out[key]["abi"], out[key]["bin"]


def deploy(w3, account, abi, bytecode, chain_id, name="PrivateValidationRegistry"):
    contract = w3.eth.contract(abi=abi, bytecode="0x" + bytecode)
    nonce = w3.eth.get_transaction_count(account.address)

    tx = contract.constructor().build_transaction({
        "from": account.address,
        "nonce": nonce,
        "chainId": chain_id,
    })

    try:
        tx["gas"] = int(w3.eth.estimate_gas(tx) * 1.3)
    except Exception as e:
        print(f"  [{name}] FAIL — gas estimation: {e}")
        return None

    tx.pop("maxFeePerGas", None)
    tx.pop("maxPriorityFeePerGas", None)
    tx["gasPrice"] = w3.eth.gas_price

    signed = account.sign_transaction(tx)
    raw = signed.raw_transaction
    tx_hash = w3.eth.send_raw_transaction(raw)
    hex_hash = tx_hash.hex() if isinstance(tx_hash, (bytes, bytearray)) else tx_hash
    print(f"  [{name}] TX sent: 0x{hex_hash}")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=240)
    if receipt.status != 1:
        print(f"  [{name}] REVERTED")
        return None

    print(f"  [{name}] DEPLOYED: {receipt.contractAddress}")
    return receipt.contractAddress


def main():
    args = sys.argv[1:]
    dry_run = "--deploy" not in args
    chain_key = "skale_base_sepolia" if "--sepolia" in args else "skale_base"
    chain = CHAINS[chain_key]

    private_key = os.getenv("PRIVATE_KEY") or os.getenv("ORACLE_PRIVATE_KEY", "")
    if not private_key:
        print("ERROR: Set ORACLE_PRIVATE_KEY (or PRIVATE_KEY) in .env")
        sys.exit(1)

    w3 = Web3(Web3.HTTPProvider(chain["rpc"]))
    if not w3.is_connected():
        print(f"ERROR: Cannot connect to {chain['label']} at {chain['rpc']}")
        sys.exit(1)

    account = w3.eth.account.from_key(private_key)
    balance = w3.eth.get_balance(account.address)

    print("=" * 64)
    print("PrivateValidationRegistry — SKALE Deployment")
    print("=" * 64)
    print(f"Chain:    {chain['label']}  (id {chain['chain_id']})")
    print(f"RPC:      {chain['rpc']}")
    print(f"Wallet:   {account.address}")
    print(f"Balance:  {w3.from_wei(balance, 'ether')} sFUEL")
    print(f"Mode:     {'DRY RUN — pass --deploy to broadcast' if dry_run else 'LIVE DEPLOY'}")
    print()

    abi, bytecode = compile_contract()
    print(f"Bytecode: {len(bytecode) // 2} bytes")
    print()

    if dry_run:
        print("Dry-run complete. Re-run with --deploy to broadcast.")
        return

    address = deploy(w3, account, abi, bytecode, chain["chain_id"])
    if not address:
        sys.exit(1)

    artifact = {
        "address": address,
        "chain": chain_key,
        "chain_id": chain["chain_id"],
        "deployed_at": datetime.now(timezone.utc).isoformat(),
        "deployer": account.address,
        "abi": abi,
    }
    with open(ARTIFACT_OUT, "w") as f:
        json.dump(artifact, f, indent=2)
    print(f"\nWrote artifact to {ARTIFACT_OUT}")


if __name__ == "__main__":
    main()
