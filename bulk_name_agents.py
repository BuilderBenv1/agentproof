"""
Bulk name generation for nameless agents in AgentProof Supabase.
Uses category-based prefixes + agent_id for unique names.
Updates in batches of 50 agents per PATCH call for speed.
"""
import requests
import random
import time
import sys

SUPABASE_URL = "https://oztrefgbigvtzncodcys.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dHJlZmdiaWd2dHpuY29kY3lzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQyMzEzMSwiZXhwIjoyMDg1OTk5MTMxfQ.6d31ozweP62Yy1M-tld-At8Hgj6Nauz-rfRRCEqyGKM"
REST_URL = f"{SUPABASE_URL}/rest/v1/agents"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}
HEADERS_COUNT = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "count=exact",
    "Range": "0-0",
}

CATEGORY_PREFIXES = {
    "defi": ["AlphaYield", "VaultKeeper", "LiquidityBot", "YieldHunter", "PoolOptimizer",
             "SwapMaster", "FarmAgent", "DeFiSentinel", "StakeGuard", "TokenFlow",
             "LendingBot", "FlashAgent", "ArbHunter", "VaultBot", "YieldFarm",
             "LiquidBot", "DeFiPilot", "ProtocolBot", "ChainYield", "MintAgent"],
    "gaming": ["QuestRunner", "LootFinder", "ArenaBot", "GameMaster", "DungeonCrawler",
               "BattleAgent", "RaidBot", "GuildKeeper", "NFTGamer", "PlayBot",
               "ScoreAgent", "LevelBot", "BossHunter", "CraftAgent", "TradeBot",
               "PvPAgent", "TourneyBot", "RewardAgent", "AchieveBot", "SpawnAgent"],
    "rwa": ["AssetBridge", "TokenVault", "PropertyAgent", "RealWorldBot", "TitleKeeper",
            "DeedAgent", "EquityBot", "FundAgent", "BondBot", "CommodityAgent",
            "RealEstateBot", "LandAgent", "BuildingBot", "InfraAgent", "AssetBot",
            "CollateralAgent", "ValuationBot", "AppraisalAgent", "CustodyBot", "TrustAgent"],
    "payments": ["SwiftSettle", "PayRouter", "TransferBot", "RemitAgent", "SettleBot",
                 "InvoiceAgent", "PaymentBot", "CashAgent", "FlowBot", "FundsAgent",
                 "CrossPayBot", "InstantAgent", "MicroPayBot", "StreamPay", "BatchAgent",
                 "RecurBot", "SubAgent", "TipBot", "SplitAgent", "EscrowPayBot"],
    "data": ["DataCrawler", "IndexBot", "AnalyticsAgent", "PipelineBot", "QueryAgent",
             "StreamBot", "IngestAgent", "TransformBot", "AggregateAgent", "MetricsBot",
             "InsightAgent", "DashBot", "ReportAgent", "MonitorBot", "AlertAgent",
             "CacheBot", "FeedAgent", "APIBot", "WebhookAgent", "SyncBot"],
    "general": ["MultiBot", "FlexAgent", "UtilityBot", "GeneralAgent", "OmniBot",
                "CoreAgent", "BaseBot", "PrimeAgent", "AlphaBot", "BetaAgent",
                "DeltaBot", "GammaAgent", "SigmaBot", "OmegaAgent", "ZetaBot",
                "NovaAgent", "NexusBot", "PulseAgent", "WaveBot", "EchoAgent"],
}

CATEGORY_DESCRIPTIONS = {
    "defi": "Autonomous DeFi agent on Avalanche",
    "gaming": "Web3 gaming agent on Avalanche",
    "rwa": "Real-world asset agent on Avalanche",
    "payments": "Payment routing agent on Avalanche",
    "data": "Data intelligence agent on Avalanche",
    "general": "Multi-purpose agent on Avalanche",
}

random.seed(42)


def get_count(filter_qs=""):
    resp = requests.get(f"{REST_URL}?select=agent_id{filter_qs}", headers=HEADERS_COUNT)
    cr = resp.headers.get("Content-Range", "")
    return int(cr.split("/")[1]) if "/" in cr else 0


def fetch_batch(offset, limit):
    url = f"{REST_URL}?or=(name.is.null,name.eq.)&select=agent_id,category&order=agent_id.asc&offset={offset}&limit={limit}"
    resp = requests.get(url, headers={**HEADERS, "Prefer": "return=representation"})
    return resp.json() if resp.status_code == 200 else []


def main():
    total = get_count()
    nameless = get_count("&or=(name.is.null,name.eq.)")
    print(f"Total agents: {total}")
    print(f"Nameless agents: {nameless}")
    if nameless == 0:
        print("All agents have names!")
        return

    BATCH = 500
    updated = 0
    failed = 0

    while True:
        # Always fetch from offset 0 since we're naming them (they drop out of the filter)
        agents = fetch_batch(0, BATCH)
        if not agents:
            break

        print(f"\nBatch of {len(agents)} nameless agents (total updated so far: {updated})")

        for agent in agents:
            aid = agent["agent_id"]
            cat = (agent.get("category") or "general").lower()
            if cat not in CATEGORY_PREFIXES:
                cat = "general"
            prefix = random.choice(CATEGORY_PREFIXES[cat])
            name = f"{prefix}-{aid}"
            desc = CATEGORY_DESCRIPTIONS.get(cat, "Autonomous agent on Avalanche")

            url = f"{REST_URL}?agent_id=eq.{aid}"
            resp = requests.patch(url, headers=HEADERS, json={"name": name, "description": desc})
            if resp.status_code in (200, 204):
                updated += 1
            else:
                failed += 1
                if failed <= 3:
                    print(f"  FAIL agent_id={aid}: {resp.status_code}")

        print(f"  Progress: {updated} updated, {failed} failed")

        if len(agents) < BATCH:
            break
        time.sleep(0.3)

    print(f"\nDONE: {updated} updated, {failed} failed")


if __name__ == "__main__":
    # Flush output immediately for background monitoring
    import functools
    print = functools.partial(print, flush=True)
    main()
