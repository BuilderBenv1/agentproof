"""
Deploy AgentProofHook + ReputationGate across every EVM chain we index.

For each chain:
  1. Pre-flight: RPC reachable? wallet has balance (or gasless)?
     ERC-8004 registries deployed at CREATE2 address? TrustScoreOracle address known/deployed?
  2. Deploy TrustScoreOracle if no existing address in env
  3. Deploy AgentProofHook(oracle, identityRegistry, minScore, minTier, maxScoreAge, acp=0)
  4. Deploy ReputationGate(reputationRegistry, signer=deployer)

Usage:
    python oracle/scripts/deploy_hook_gate_multichain.py              # dry-run
    python oracle/scripts/deploy_hook_gate_multichain.py --deploy     # broadcast
    python oracle/scripts/deploy_hook_gate_multichain.py --chain base --deploy   # single chain

Requires ORACLE_PRIVATE_KEY + each chain's RPC URL in .env / Railway.
Existing TrustScoreOracle addresses (per-chain) are read from
`<CHAIN>_ORACLE_ADDRESS` env vars — the oracle contract is not re-deployed
if that env var points to live on-chain bytecode.
"""

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

# ─── Per-chain configuration ───────────────────────────────────────

# Same CREATE2 address on every chain where ERC-8004 is deployed
ERC8004_IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
ERC8004_REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"

# Hook gate defaults — match oracle/routes/hook.py::HOOK_DEFAULTS
HOOK_MIN_SCORE = 3000     # 30.00 (uint16, 0-10000)
HOOK_MIN_TIER = 1         # bronze (uint8, 0-5)
HOOK_MAX_SCORE_AGE = 3600 # 1 hour (uint40 seconds)
HOOK_ACP_ADDRESS = "0x0000000000000000000000000000000000000000"

# Full list of chains to attempt. `gasless=True` skips balance requirement.
# `poa=True` injects ExtraDataToPOAMiddleware for chains with extraData > 32 bytes.
CHAINS = [
    {"name": "skale",     "chain_id": 1187947933, "rpc_env": "SKALE_RPC_URL",    "rpc_default": "https://skale-base.skalenodes.com/v1/base", "oracle_env": "SKALE_ORACLE_ADDRESS",    "hook_env": "AGENTPROOF_HOOK_SKALE",    "gate_env": "REPUTATION_GATE_SKALE",    "gasless": True,  "poa": False},
    {"name": "base",      "chain_id": 8453,       "rpc_env": "BASE_RPC_URL",     "rpc_default": "https://mainnet.base.org",                  "oracle_env": "BASE_ORACLE_ADDRESS",     "hook_env": "AGENTPROOF_HOOK_BASE",     "gate_env": "REPUTATION_GATE_BASE",     "gasless": False, "poa": False},
    {"name": "avalanche", "chain_id": 43114,      "rpc_env": "AVALANCHE_RPC_URL","rpc_default": "https://api.avax.network/ext/bc/C/rpc",     "oracle_env": "AVAX_ORACLE_ADDRESS",     "hook_env": "AGENTPROOF_HOOK_AVALANCHE","gate_env": "REPUTATION_GATE_AVALANCHE","gasless": False, "poa": True},
    {"name": "ethereum", "chain_id": 1,           "rpc_env": "ETHEREUM_RPC_URL", "rpc_default": "",                                          "oracle_env": "ETHEREUM_ORACLE_ADDRESS", "hook_env": "AGENTPROOF_HOOK_ETHEREUM", "gate_env": "REPUTATION_GATE_ETHEREUM", "gasless": False, "poa": False},
    {"name": "arbitrum", "chain_id": 42161,       "rpc_env": "ARBITRUM_RPC_URL", "rpc_default": "https://arb1.arbitrum.io/rpc",              "oracle_env": "ARBITRUM_ORACLE_ADDRESS", "hook_env": "AGENTPROOF_HOOK_ARBITRUM", "gate_env": "REPUTATION_GATE_ARBITRUM", "gasless": False, "poa": False},
    {"name": "optimism", "chain_id": 10,          "rpc_env": "OPTIMISM_RPC_URL", "rpc_default": "https://mainnet.optimism.io",               "oracle_env": "OPTIMISM_ORACLE_ADDRESS", "hook_env": "AGENTPROOF_HOOK_OPTIMISM", "gate_env": "REPUTATION_GATE_OPTIMISM", "gasless": False, "poa": False},
    {"name": "polygon",  "chain_id": 137,         "rpc_env": "POLYGON_RPC_URL",  "rpc_default": "https://polygon-bor-rpc.publicnode.com",    "oracle_env": "POLYGON_ORACLE_ADDRESS",  "hook_env": "AGENTPROOF_HOOK_POLYGON",  "gate_env": "REPUTATION_GATE_POLYGON",  "gasless": False, "poa": True},
    {"name": "bsc",      "chain_id": 56,          "rpc_env": "BSC_RPC_URL",      "rpc_default": "https://bsc-dataseed.binance.org",          "oracle_env": "BSC_ORACLE_ADDRESS",      "hook_env": "AGENTPROOF_HOOK_BSC",      "gate_env": "REPUTATION_GATE_BSC",      "gasless": False, "poa": True, "deploy_gas_fallback": 8_000_000},
    {"name": "linea",    "chain_id": 59144,       "rpc_env": "LINEA_RPC_URL",    "rpc_default": "https://rpc.linea.build",                   "oracle_env": "LINEA_ORACLE_ADDRESS",    "hook_env": "AGENTPROOF_HOOK_LINEA",    "gate_env": "REPUTATION_GATE_LINEA",    "gasless": False, "poa": False},
    {"name": "celo",     "chain_id": 42220,       "rpc_env": "CELO_RPC_URL",     "rpc_default": "https://forno.celo.org",                    "oracle_env": "CELO_ORACLE_ADDRESS",     "hook_env": "AGENTPROOF_HOOK_CELO",     "gate_env": "REPUTATION_GATE_CELO",     "gasless": False, "poa": False},
]

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CONTRACTS_DIR = os.path.join(REPO_ROOT, "contracts", "src")
HOOK_SRC = os.path.join(CONTRACTS_DIR, "AgentProofHook.sol")
GATE_SRC = os.path.join(REPO_ROOT, "factory", "contracts", "ReputationGate.sol")


# ─── Compilation (done once, shared across chains) ─────────────────


def compile_all():
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

    print("Compiling AgentProofHook...")
    hook_out = solcx.compile_files(
        [HOOK_SRC], output_values=["abi", "bin"],
        solc_version=target, optimize=True, optimize_runs=200,
        allow_paths=[CONTRACTS_DIR],
    )
    hook_key = next(k for k in hook_out if k.endswith(":AgentProofHook"))

    print("Compiling ReputationGate...")
    gate_out = solcx.compile_files(
        [GATE_SRC], output_values=["abi", "bin"],
        solc_version=target, optimize=True, optimize_runs=200,
    )
    gate_key = next(k for k in gate_out if k.endswith(":ReputationGate"))

    print("Compiling TrustScoreOracle...")
    from deploy_trust_oracle import SOLIDITY_SOURCE as TSO_SOURCE
    tso_out = solcx.compile_source(
        TSO_SOURCE, output_values=["abi", "bin"],
        solc_version=target, optimize=True, optimize_runs=200,
    )
    tso_key = next(k for k in tso_out if k.endswith(":TrustScoreOracle"))

    return {
        "hook": (hook_out[hook_key]["abi"], hook_out[hook_key]["bin"]),
        "gate": (gate_out[gate_key]["abi"], gate_out[gate_key]["bin"]),
        "oracle": (tso_out[tso_key]["abi"], tso_out[tso_key]["bin"]),
    }


# ─── Deploy helper ─────────────────────────────────────────────────


def deploy_contract(w3, account, chain, abi, bytecode, args, name, nonce_override=None):
    contract = w3.eth.contract(abi=abi, bytecode="0x" + bytecode)
    if nonce_override is not None:
        nonce = nonce_override
    else:
        # 'pending' includes the just-sent tx waiting in the mempool —
        # avoids "nonce too low" when the receipt node lags behind the sender node.
        nonce = w3.eth.get_transaction_count(account.address, "pending")
    tx = contract.constructor(*args).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "chainId": chain["chain_id"],
    })
    try:
        tx["gas"] = int(w3.eth.estimate_gas(tx) * 1.3)
    except Exception as e:
        # Some chains (notably BSC) cap eth_estimateGas below the actual
        # deploy cost. Fall back to a hardcoded high gas limit so the tx
        # can still go through if the chain's own gas limit allows it.
        if "out of gas" in str(e).lower() or "gas required exceeds" in str(e).lower():
            tx["gas"] = chain.get("deploy_gas_fallback", 6_000_000)
            print(f"      [{name}] estimator failed ({e.args[0].get('message') if hasattr(e, 'args') and e.args and hasattr(e.args[0], 'get') else e}); falling back to gas={tx['gas']}")
        else:
            print(f"      FAIL — gas estimation: {e}")
            return None

    if chain.get("gasless"):
        tx.pop("maxFeePerGas", None); tx.pop("maxPriorityFeePerGas", None)
        tx["gasPrice"] = w3.eth.gas_price
    else:
        try:
            base_fee = w3.eth.gas_price
            if chain["chain_id"] == 137:
                priority = max(w3.to_wei(30, "gwei"), base_fee)
            else:
                priority = min(w3.to_wei(2, "gwei"), base_fee)
            tx["maxFeePerGas"] = base_fee * 2 + priority
            tx["maxPriorityFeePerGas"] = priority
        except Exception:
            tx["gasPrice"] = w3.eth.gas_price

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    txh = tx_hash.hex() if isinstance(tx_hash, bytes) else str(tx_hash)
    if not txh.startswith("0x"):
        txh = "0x" + txh
    print(f"      [{name}] tx: {txh}")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=240)
    if receipt.status != 1:
        print(f"      [{name}] REVERTED")
        return None
    print(f"      [{name}] deployed: {receipt.contractAddress}")
    return receipt.contractAddress


# ─── Per-chain preflight + deploy ──────────────────────────────────


def preflight(chain, account):
    """Return (status, w3_or_None, existing_oracle_or_empty). status ∈ {'ready','skip_done','blocked'}."""
    rpc = os.getenv(chain["rpc_env"]) or chain["rpc_default"]
    if not rpc:
        return "blocked", "no RPC configured", None, None
    try:
        w3 = Web3(Web3.HTTPProvider(rpc))
        if chain.get("poa"):
            w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        if not w3.is_connected():
            return "blocked", "RPC unreachable", None, None
    except Exception as e:
        return "blocked", f"web3 init failed: {e}", None, None

    # ERC-8004 registries must exist on this chain
    for label, addr in [("identityRegistry", ERC8004_IDENTITY_REGISTRY),
                         ("reputationRegistry", ERC8004_REPUTATION_REGISTRY)]:
        try:
            code = w3.eth.get_code(Web3.to_checksum_address(addr))
            if len(code) == 0:
                return "blocked", f"ERC-8004 {label} not deployed at {addr}", w3, None
        except Exception as e:
            return "blocked", f"get_code({label}) failed: {e}", w3, None

    # Balance (skip for gasless)
    if not chain.get("gasless"):
        try:
            bal = w3.eth.get_balance(account.address)
            if bal == 0:
                return "blocked", "wallet balance = 0", w3, None
        except Exception as e:
            return "blocked", f"balance check failed: {e}", w3, None

    # Existing oracle?  Check env var first, then fall back to the "canonical"
    # address 0xe4eBEf67... which the user has deployed at the same address
    # across many chains. Without this fallback, running this script without
    # Railway env present would silently deploy duplicate oracles.
    CANONICAL_ORACLE = "0xe4eBEf67D698C1b45A2aaacB9ce7c4B0B4E53682"
    existing_oracle = (os.getenv(chain["oracle_env"]) or "").strip()
    if existing_oracle.lower() in ("", "skip"):
        existing_oracle = ""
    else:
        try:
            code = w3.eth.get_code(Web3.to_checksum_address(existing_oracle))
            if len(code) == 0:
                return "blocked", f"{chain['oracle_env']} {existing_oracle} has no code on this chain", w3, None
        except Exception:
            existing_oracle = ""
    if not existing_oracle:
        try:
            code = w3.eth.get_code(Web3.to_checksum_address(CANONICAL_ORACLE))
            if len(code) > 0:
                existing_oracle = CANONICAL_ORACLE
        except Exception:
            pass

    # Existing hook/gate? if both present already → skip_done
    existing_hook = (os.getenv(chain["hook_env"]) or "").strip()
    existing_gate = (os.getenv(chain["gate_env"]) or "").strip()
    if existing_hook and existing_gate:
        return "skip_done", f"hook+gate already set ({existing_hook}, {existing_gate})", w3, existing_oracle

    return "ready", None, w3, existing_oracle


def deploy_chain(chain, w3, account, existing_oracle, artifacts):
    results = {}
    hook_abi, hook_bin = artifacts["hook"]
    gate_abi, gate_bin = artifacts["gate"]
    tso_abi, tso_bin = artifacts["oracle"]

    # 1. Oracle
    if existing_oracle:
        oracle_addr = existing_oracle
        print(f"   [oracle] existing: {oracle_addr}")
    else:
        oracle_addr = deploy_contract(w3, account, chain, tso_abi, tso_bin, [], "TrustScoreOracle")
        if not oracle_addr:
            return None
        results[chain["oracle_env"]] = oracle_addr
        time.sleep(1)

    # 2. Hook
    existing_hook = (os.getenv(chain["hook_env"]) or "").strip()
    if existing_hook:
        hook_addr = existing_hook
        print(f"   [hook] existing: {hook_addr}")
    else:
        hook_addr = deploy_contract(
            w3, account, chain, hook_abi, hook_bin,
            [oracle_addr, ERC8004_IDENTITY_REGISTRY, HOOK_MIN_SCORE, HOOK_MIN_TIER, HOOK_MAX_SCORE_AGE, HOOK_ACP_ADDRESS],
            "AgentProofHook",
        )
        if not hook_addr:
            return None
        results[chain["hook_env"]] = hook_addr
        time.sleep(1)

    # 3. Gate
    existing_gate = (os.getenv(chain["gate_env"]) or "").strip()
    if existing_gate:
        print(f"   [gate] existing: {existing_gate}")
    else:
        gate_addr = deploy_contract(
            w3, account, chain, gate_abi, gate_bin,
            [ERC8004_REPUTATION_REGISTRY, account.address],
            "ReputationGate",
        )
        if gate_addr:
            results[chain["gate_env"]] = gate_addr
        time.sleep(1)

    return results


# ─── Main ──────────────────────────────────────────────────────────


def main():
    args = sys.argv[1:]
    dry_run = "--deploy" not in args
    single_chain = None
    if "--chain" in args:
        idx = args.index("--chain")
        if idx + 1 < len(args):
            single_chain = args[idx + 1].lower()

    pk = os.getenv("PRIVATE_KEY") or os.getenv("ORACLE_PRIVATE_KEY", "")
    if not pk:
        print("ERROR: Set ORACLE_PRIVATE_KEY (or PRIVATE_KEY) in .env")
        sys.exit(1)

    account = Web3().eth.account.from_key(pk)
    chains = [c for c in CHAINS if single_chain is None or c["name"] == single_chain]
    if not chains:
        print(f"ERROR: no chain matching '{single_chain}'")
        sys.exit(1)

    print("=" * 72)
    print("Multi-chain Hook + Gate Deployment")
    print("=" * 72)
    print(f"Wallet:  {account.address}")
    print(f"Mode:    {'DRY RUN — pass --deploy to broadcast' if dry_run else 'LIVE DEPLOY'}")
    print(f"Chains:  {', '.join(c['name'] for c in chains)}")
    print()

    # Preflight every chain first
    plan = []  # list of (chain, status, reason, w3, existing_oracle)
    for chain in chains:
        status, reason, w3, existing_oracle = preflight(chain, account)
        plan.append((chain, status, reason, w3, existing_oracle))

    print("Pre-flight results:")
    print(f"  {'chain':<12} {'status':<12} notes")
    for chain, status, reason, _, existing_oracle in plan:
        notes = reason or ""
        if status == "ready":
            notes = f"oracle={'existing '+existing_oracle[:10]+'...' if existing_oracle else 'will deploy'}"
        print(f"  {chain['name']:<12} {status:<12} {notes}")
    print()

    ready_chains = [(c, _w3, _eo) for (c, s, _r, _w3, _eo) in plan if s == "ready"]
    if not ready_chains:
        print("Nothing to deploy.")
        return

    artifacts = compile_all()
    print()
    print(f"Hook bytecode:   {len(artifacts['hook'][1]) // 2:>6} bytes")
    print(f"Gate bytecode:   {len(artifacts['gate'][1]) // 2:>6} bytes")
    print(f"Oracle bytecode: {len(artifacts['oracle'][1]) // 2:>6} bytes")
    print()

    if dry_run:
        print(f"Dry run complete. {len(ready_chains)} chain(s) ready. Pass --deploy to broadcast.")
        return

    # ── Broadcast ──────────────────────────────────────────────────

    all_results = {}
    for chain, w3, existing_oracle in ready_chains:
        print()
        print(f"-- {chain['name'].upper()} (chain_id={chain['chain_id']}) --")
        try:
            r = deploy_chain(chain, w3, account, existing_oracle, artifacts)
            if r:
                all_results[chain["name"]] = r
        except Exception as e:
            print(f"  ERROR on {chain['name']}: {e}")
            continue

    # Emit final env block
    print()
    print("=" * 72)
    print("DEPLOYMENT SUMMARY — add to Railway / .env")
    print("=" * 72)
    for chain_name, results in all_results.items():
        print(f"\n# {chain_name}")
        for env_key, addr in results.items():
            print(f"{env_key}={addr}")


if __name__ == "__main__":
    main()
