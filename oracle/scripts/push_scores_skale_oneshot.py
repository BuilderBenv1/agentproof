"""
One-shot score push to the SKALE TrustScoreOracle.

Populates on-chain scores NOW instead of waiting for the next autonomous
screener cycle. Pulls the top N scored agents from Supabase and batches
them through batchUpdateScores() on SKALE.

Usage:
    python oracle/scripts/push_scores_skale_oneshot.py               # dry-run, show what would push
    python oracle/scripts/push_scores_skale_oneshot.py --deploy      # actually broadcast
    python oracle/scripts/push_scores_skale_oneshot.py --limit 50 --deploy
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from web3 import Web3
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

SKALE_RPC = os.getenv("SKALE_RPC_URL", "https://skale-base.skalenodes.com/v1/base")
SKALE_CHAIN_ID = 1187947933
SKALE_ORACLE = os.getenv("SKALE_ORACLE_ADDRESS", "0xe4eBEf67D698C1b45A2aaacB9ce7c4B0B4E53682")

TIER_ENCODING = {
    "unranked": 0, "bronze": 1, "silver": 2, "gold": 3, "platinum": 4, "diamond": 5,
}

ORACLE_ABI = [
    {"inputs": [
        {"name": "agentIds", "type": "uint256[]"},
        {"name": "compositeScores", "type": "uint16[]"},
        {"name": "tiers", "type": "uint8[]"},
    ], "name": "batchUpdateScores", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "agentId", "type": "uint256"}], "name": "getScore", "outputs": [
        {"name": "", "type": "uint16"}, {"name": "", "type": "uint8"}, {"name": "", "type": "uint40"},
    ], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "owner", "outputs": [{"name": "", "type": "address"}], "stateMutability": "view", "type": "function"},
]

BATCH_SIZE = 20


def main():
    args = sys.argv[1:]
    dry_run = "--deploy" not in args
    limit = 100
    if "--limit" in args:
        limit = int(args[args.index("--limit") + 1])

    pk = os.getenv("ORACLE_PRIVATE_KEY") or os.getenv("PRIVATE_KEY")
    if not pk:
        print("ERROR: ORACLE_PRIVATE_KEY not set")
        sys.exit(1)

    # Supabase fetch
    from database import get_supabase
    db = get_supabase()
    result = (
        db.table("agents")
        .select("agent_id, composite_score, tier, name")
        .gt("composite_score", 0)
        .order("composite_score", desc=True)
        .limit(limit)
        .execute()
    )
    agents = result.data or []
    if not agents:
        print("No scored agents in Supabase — nothing to push.")
        return

    print(f"Fetched {len(agents)} top-scored agents from Supabase")

    # Web3 setup
    w3 = Web3(Web3.HTTPProvider(SKALE_RPC))
    account = w3.eth.account.from_key(pk)
    contract = w3.eth.contract(address=Web3.to_checksum_address(SKALE_ORACLE), abi=ORACLE_ABI)

    # Sanity: are we the oracle owner? batchUpdateScores is onlyOwner.
    try:
        current_owner = contract.functions.owner().call()
        if current_owner.lower() != account.address.lower():
            print(f"WARN: oracle owner = {current_owner}, wallet = {account.address}")
            print("     batchUpdateScores will revert with 'not owner'. Aborting.")
            sys.exit(1)
    except Exception as e:
        print(f"WARN: owner() read failed: {e}")

    # Encode
    encoded = []
    for a in agents:
        aid = int(a["agent_id"])
        score = float(a.get("composite_score") or 0)
        tier_name = a.get("tier", "unranked")
        score_uint16 = min(10000, max(0, int(score * 100)))
        tier_uint8 = TIER_ENCODING.get(tier_name, 0)
        encoded.append((aid, score_uint16, tier_uint8, a.get("name") or "", score))

    # Preview
    print()
    print(f"{'agent_id':>8}  {'score':>6}  {'tier':<8}  name")
    for aid, s, t, n, raw in encoded[:10]:
        tier_name = [k for k, v in TIER_ENCODING.items() if v == t][0]
        print(f"{aid:>8}  {raw:>6.2f}  {tier_name:<8}  {n[:40]}")
    if len(encoded) > 10:
        print(f"  ... +{len(encoded) - 10} more")
    print()

    if dry_run:
        print("Dry run — pass --deploy to broadcast.")
        return

    # Broadcast in batches
    pushed = 0
    for i in range(0, len(encoded), BATCH_SIZE):
        batch = encoded[i:i + BATCH_SIZE]
        ids = [b[0] for b in batch]
        scores = [b[1] for b in batch]
        tiers = [b[2] for b in batch]

        print(f"Batch {i // BATCH_SIZE + 1}: {len(batch)} agents...")
        call = contract.functions.batchUpdateScores(ids, scores, tiers)
        try:
            gas = int(call.estimate_gas({"from": account.address}) * 1.3)
        except Exception as e:
            print(f"  estimate_gas failed: {e}")
            continue

        tx = call.build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address, "pending"),
            "chainId": SKALE_CHAIN_ID,
            "gas": gas,
            "gasPrice": w3.eth.gas_price,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        txh = tx_hash.hex() if isinstance(tx_hash, bytes) else str(tx_hash)
        if not txh.startswith("0x"):
            txh = "0x" + txh
        print(f"  tx: {txh}")
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        if receipt.status == 1:
            pushed += len(batch)
            print(f"  OK — {len(batch)} scores written")
        else:
            print(f"  REVERTED")

    print()
    print(f"Done. Pushed {pushed}/{len(encoded)} scores to SKALE.")

    # Spot-check
    if pushed and encoded:
        top = encoded[0]
        on_chain = contract.functions.getScore(top[0]).call()
        print(f"Spot check agent {top[0]}: on-chain = score={on_chain[0]} tier={on_chain[1]} updated={on_chain[2]}")


if __name__ == "__main__":
    main()
