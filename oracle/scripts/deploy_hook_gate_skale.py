"""
Deploy AgentProofHook + ReputationGate to SKALE (chain_id 1187947933).

Dependency order:
    1. TrustScoreOracle  — the hook reads scores from this (skipped if SKALE_ORACLE_ADDRESS set)
    2. AgentProofHook    — gates provider selection, records JobOutcomeRecorded events
    3. ReputationGate    — wraps ERC-8004 giveFeedback, requires oracle-signed job attestation

Usage:
    python oracle/scripts/deploy_hook_gate_skale.py             # dry-run (default)
    python oracle/scripts/deploy_hook_gate_skale.py --deploy    # broadcast for real

Requires PRIVATE_KEY or ORACLE_PRIVATE_KEY in .env.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from web3 import Web3
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

# ─── Constants ─────────────────────────────────────────────────────

SKALE_RPC = os.getenv("SKALE_RPC_URL", "https://skale-base.skalenodes.com/v1/base")
SKALE_CHAIN_ID = 1187947933

# Official ERC-8004 CREATE2 addresses (same on every EVM chain that has the deployment)
ERC8004_IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
ERC8004_REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"

# Hook gate defaults — match oracle/routes/hook.py::HOOK_DEFAULTS
HOOK_MIN_SCORE = 3000     # 30.00 (uint16, 0-10000)
HOOK_MIN_TIER = 1         # bronze (uint8, 0-5)
HOOK_MAX_SCORE_AGE = 3600 # 1 hour (uint40 seconds)
HOOK_ACP_ADDRESS = "0x0000000000000000000000000000000000000000"  # cache-only mode

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CONTRACTS_DIR = os.path.join(REPO_ROOT, "contracts", "src")
HOOK_SRC = os.path.join(CONTRACTS_DIR, "AgentProofHook.sol")
GATE_SRC = os.path.join(REPO_ROOT, "factory", "contracts", "ReputationGate.sol")


# ─── Compilation ───────────────────────────────────────────────────


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


def compile_all():
    """Return {name: (abi, bin_hex)} for hook, gate, oracle."""
    solcx, target = _solcx()

    print("Compiling AgentProofHook...")
    hook_compiled = solcx.compile_files(
        [HOOK_SRC],
        output_values=["abi", "bin"],
        solc_version=target,
        optimize=True,
        optimize_runs=200,
        allow_paths=[CONTRACTS_DIR],
    )
    hook_key = next(k for k in hook_compiled if k.endswith(":AgentProofHook"))

    print("Compiling ReputationGate...")
    gate_compiled = solcx.compile_files(
        [GATE_SRC],
        output_values=["abi", "bin"],
        solc_version=target,
        optimize=True,
        optimize_runs=200,
    )
    gate_key = next(k for k in gate_compiled if k.endswith(":ReputationGate"))

    print("Compiling TrustScoreOracle...")
    # Pull the inline source from the existing deploy script to stay in sync.
    from deploy_trust_oracle import SOLIDITY_SOURCE as TSO_SOURCE
    tso_compiled = solcx.compile_source(
        TSO_SOURCE,
        output_values=["abi", "bin"],
        solc_version=target,
        optimize=True,
        optimize_runs=200,
    )
    tso_key = next(k for k in tso_compiled if k.endswith(":TrustScoreOracle"))

    return {
        "hook": (hook_compiled[hook_key]["abi"], hook_compiled[hook_key]["bin"]),
        "gate": (gate_compiled[gate_key]["abi"], gate_compiled[gate_key]["bin"]),
        "oracle": (tso_compiled[tso_key]["abi"], tso_compiled[tso_key]["bin"]),
    }


# ─── Deployment ────────────────────────────────────────────────────


def deploy_contract(w3, account, abi, bytecode, constructor_args, name):
    """Deploy a single contract and wait for confirmation. Returns address or None."""
    contract = w3.eth.contract(abi=abi, bytecode="0x" + bytecode)
    nonce = w3.eth.get_transaction_count(account.address)

    tx = contract.constructor(*constructor_args).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "chainId": SKALE_CHAIN_ID,
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
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"  [{name}] TX sent: 0x{tx_hash.hex() if isinstance(tx_hash, bytes) else tx_hash}")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
    if receipt.status != 1:
        print(f"  [{name}] REVERTED")
        return None

    addr = receipt.contractAddress
    print(f"  [{name}] DEPLOYED: {addr}")
    return addr


# ─── Main ──────────────────────────────────────────────────────────


def main():
    dry_run = "--deploy" not in sys.argv

    private_key = os.getenv("PRIVATE_KEY") or os.getenv("ORACLE_PRIVATE_KEY", "")
    if not private_key:
        print("ERROR: Set ORACLE_PRIVATE_KEY (or PRIVATE_KEY) in .env")
        sys.exit(1)

    w3 = Web3(Web3.HTTPProvider(SKALE_RPC))
    if not w3.is_connected():
        print(f"ERROR: Cannot connect to SKALE RPC at {SKALE_RPC}")
        sys.exit(1)

    account = w3.eth.account.from_key(private_key)
    balance = w3.eth.get_balance(account.address)

    existing_oracle = (os.getenv("SKALE_ORACLE_ADDRESS", "") or "").strip()
    if existing_oracle.lower() == "skip":
        existing_oracle = ""

    print("=" * 64)
    print("SKALE Hook + Gate Deployment")
    print("=" * 64)
    print(f"RPC:       {SKALE_RPC}")
    print(f"Chain ID:  {SKALE_CHAIN_ID}")
    print(f"Wallet:    {account.address}")
    print(f"Balance:   {w3.from_wei(balance, 'ether')} sFUEL (gasless chain — balance can be 0)")
    print(f"Mode:      {'DRY RUN — pass --deploy to broadcast' if dry_run else 'LIVE DEPLOY'}")
    print()

    artifacts = compile_all()
    hook_abi, hook_bin = artifacts["hook"]
    gate_abi, gate_bin = artifacts["gate"]
    tso_abi, tso_bin = artifacts["oracle"]

    print()
    print(f"Hook bytecode:    {len(hook_bin) // 2:>6} bytes")
    print(f"Gate bytecode:    {len(gate_bin) // 2:>6} bytes")
    print(f"Oracle bytecode:  {len(tso_bin) // 2:>6} bytes")
    print()

    need_oracle = not existing_oracle

    print("Deployment plan:")
    if need_oracle:
        print("  (1) TrustScoreOracle()")
    else:
        print(f"  (skip TrustScoreOracle — existing {existing_oracle})")
    print(
        f"  ({2 if need_oracle else 1}) AgentProofHook("
        f"oracle, {ERC8004_IDENTITY_REGISTRY}, minScore={HOOK_MIN_SCORE}, "
        f"minTier={HOOK_MIN_TIER}, maxScoreAge={HOOK_MAX_SCORE_AGE}, acp=0x0)"
    )
    print(
        f"  ({3 if need_oracle else 2}) ReputationGate("
        f"{ERC8004_REPUTATION_REGISTRY}, signer={account.address})"
    )
    print()

    if dry_run:
        print("Dry run complete. Re-run with --deploy to broadcast.")
        return

    # ── Broadcast ──────────────────────────────────────────────────

    print("--- Broadcasting ---")

    if need_oracle:
        oracle_addr = deploy_contract(
            w3, account, tso_abi, tso_bin, [], "TrustScoreOracle"
        )
        if not oracle_addr:
            print("Aborting — TrustScoreOracle deploy failed.")
            sys.exit(1)
    else:
        oracle_addr = existing_oracle
        print(f"  [TrustScoreOracle] Using existing: {oracle_addr}")

    hook_addr = deploy_contract(
        w3,
        account,
        hook_abi,
        hook_bin,
        [
            oracle_addr,
            ERC8004_IDENTITY_REGISTRY,
            HOOK_MIN_SCORE,
            HOOK_MIN_TIER,
            HOOK_MAX_SCORE_AGE,
            HOOK_ACP_ADDRESS,
        ],
        "AgentProofHook",
    )
    if not hook_addr:
        print("Aborting — AgentProofHook deploy failed.")
        sys.exit(1)

    gate_addr = deploy_contract(
        w3,
        account,
        gate_abi,
        gate_bin,
        [ERC8004_REPUTATION_REGISTRY, account.address],
        "ReputationGate",
    )
    if not gate_addr:
        print("Warning — ReputationGate deploy failed. Hook is still live.")

    print()
    print("=" * 64)
    print("DEPLOYMENT SUMMARY — add to .env / Railway")
    print("=" * 64)
    print(f"SKALE_ORACLE_ADDRESS={oracle_addr}")
    print(f"AGENTPROOF_HOOK_SKALE={hook_addr}")
    if gate_addr:
        print(f"REPUTATION_GATE_SKALE={gate_addr}")
    print()
    print("Next: set FEEDBACK_REQUIRE_JOB_ID=true once integrators include job_id.")


if __name__ == "__main__":
    main()
