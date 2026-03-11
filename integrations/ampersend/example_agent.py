"""
Example: LangChain buyer agent with AgentProof reputation-gated payments.

Demonstrates the Discover → Verify → Transact loop:
  1. DISCOVER  — Connect to a remote A2A seller agent
  2. VERIFY    — Before paying, check the seller's AgentProof reputation
  3. TRANSACT  — If trusted, sign the x402 payment and get the response

Usage:
    # Set env vars (see .env.example)
    export AGENTPROOF_API_KEY="ap_live_..."
    export SMART_ACCOUNT_ADDRESS="0x..."
    export SESSION_KEY_PRIVATE_KEY="0x..."
    export SELLER_AGENT_URL="https://..."
    export OPENAI_API_KEY="sk-..."

    # Run
    uv run python example_agent.py

The agent will query the seller, and the ReputationGatedTreasurer will
automatically gate any x402 payment on the seller's AgentProof score.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys

from reputation_gated_treasurer import (
    AgentNotRegistered,
    ReputationGatedException,
    ReputationGatedTreasurer,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("agentproof.example")


async def run_with_langchain():
    """Full LangChain A2A buyer with reputation-gated payments."""
    from ampersend_sdk.x402.wallets.account import AccountWallet
    from eth_account import Account
    from langchain.agents import create_tool_calling_agent, AgentExecutor
    from langchain_ampersend import A2AToolkit
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_openai import ChatOpenAI

    # ── Config ──────────────────────────────────────────────
    private_key = os.environ["SESSION_KEY_PRIVATE_KEY"]
    seller_url = os.environ.get(
        "SELLER_AGENT_URL",
        "https://subgraph-a2a.x402.staging.thegraph.com",
    )
    min_score = float(os.environ.get("MIN_SCORE", "30"))
    min_tier = os.environ.get("MIN_TIER", "bronze")

    # ── Wallet + Treasurer ──────────────────────────────────
    wallet = AccountWallet(Account.from_key(private_key))

    treasurer = ReputationGatedTreasurer(
        wallet=wallet,
        agentproof_api_key=os.environ["AGENTPROOF_API_KEY"],
        min_score=min_score,
        min_tier=min_tier,
        chain=os.environ.get("CHAIN", "base"),
    )

    # ── Discover: connect to remote agent ───────────────────
    logger.info("Discovering seller at %s", seller_url)
    toolkit = A2AToolkit(
        remote_agent_url=seller_url,
        treasurer=treasurer,
    )
    await toolkit.initialize()
    tools = toolkit.get_tools()
    logger.info("Discovered %d tools from seller", len(tools))

    # ── LangChain agent ─────────────────────────────────────
    llm = ChatOpenAI(model="gpt-4o-mini")
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are a buyer agent. Use the available tools to interact "
            "with remote seller agents. All payments are automatically "
            "gated on the seller's AgentProof reputation score."
        )),
        ("human", "{input}"),
        ("placeholder", "{agent_scratchpad}"),
    ])
    agent = create_tool_calling_agent(llm, tools, prompt)
    executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

    # ── Transact: send a query (payment auto-gated) ─────────
    query = os.environ.get(
        "QUERY",
        "What subgraphs are available for Uniswap on Base?",
    )
    logger.info("Sending query: %s", query)

    try:
        result = await executor.ainvoke({"input": query})
        print("\n" + "=" * 60)
        print("RESULT:", result.get("output", result))
        print("=" * 60)
    except ReputationGatedException as e:
        print(f"\nBLOCKED: {e}")
    except AgentNotRegistered as e:
        print(f"\nBLOCKED: {e}")

    # ── Stats ───────────────────────────────────────────────
    print(f"\nTreasurer stats: {treasurer.stats}")
    await treasurer.close()


async def run_standalone_check():
    """
    Standalone reputation check — no wallet or Ampersend account needed.
    Demonstrates the Verify step in isolation.
    """
    from reputation_gated_treasurer import ReputationGatedTreasurer

    # Minimal treasurer just for trust resolution
    # (wallet not needed for read-only checks)
    class ReadOnlyWallet:
        def create_payment(self, requirements):
            raise NotImplementedError("Read-only mode")

    treasurer = ReputationGatedTreasurer(
        wallet=ReadOnlyWallet(),
        agentproof_api_key=os.environ["AGENTPROOF_API_KEY"],
        min_score=float(os.environ.get("MIN_SCORE", "30")),
        min_tier=os.environ.get("MIN_TIER", "bronze"),
    )

    address = os.environ.get(
        "CHECK_ADDRESS",
        "0x0000000000000000000000000000000000000001",
    )

    print(f"Resolving AgentProof trust for {address}...")
    try:
        result = await treasurer.resolve_trust(address)
        print(f"  Agent ID:   {result.agent_id}")
        print(f"  Score:      {result.score}")
        print(f"  Tier:       {result.tier} ({result.tier_num})")
        print(f"  Updated:    {result.updated_at}")

        gate_score = float(os.environ.get("MIN_SCORE", "30"))
        gate_tier = os.environ.get("MIN_TIER", "bronze")
        passed = result.score >= gate_score
        print(f"\n  Gate (min_score={gate_score}, min_tier={gate_tier}): "
              f"{'PASS' if passed else 'FAIL'}")
    except AgentNotRegistered:
        print(f"  NOT REGISTERED — no ERC-8004 identity for {address}")
    except Exception as e:
        print(f"  ERROR: {e}")

    await treasurer.close()


async def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"

    if mode == "agent":
        await run_with_langchain()
    elif mode == "check":
        await run_standalone_check()
    else:
        print(f"Usage: {sys.argv[0]} [check|agent]")
        print("  check  — Standalone reputation lookup (default)")
        print("  agent  — Full LangChain buyer with gated payments")


if __name__ == "__main__":
    asyncio.run(main())
