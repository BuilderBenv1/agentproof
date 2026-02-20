"""
Resolve agent metadata in the AgentProof Supabase database.
1. Fetch & resolve ~5 agents with HTTP URIs (get name/description from JSON)
2. Generate descriptive names for ALL other agents without names
3. Use Supabase REST API with PATCH in batches
"""

import requests
import json
import random
import time
import sys

# ── Config ──────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://oztrefgbigvtzncodcys.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dHJlZmdiaWd2dHpuY29kY3lzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQyMzEzMSwiZXhwIjoyMDg1OTk5MTMxfQ.6d31ozweP62Yy1M-tld-At8Hgj6Nauz-rfRRCEqyGKM"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

HEADERS_WITH_RETURN = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

REST_URL = f"{SUPABASE_URL}/rest/v1/agents"

# ── Category name pools ─────────────────────────────────────────────────────
CATEGORY_PREFIXES = {
    "defi": [
        "AlphaYield", "VaultKeeper", "LiquidityBot", "YieldHunter", "PoolOptimizer",
        "SwapMaster", "FarmAgent", "DeFiSentinel", "StakeGuard", "TokenFlow",
        "LendingBot", "FlashAgent", "ArbHunter", "VaultBot", "YieldFarm",
        "LiquidBot", "DeFiPilot", "ProtocolBot", "ChainYield", "MintAgent",
        "RebalanceBot", "HarvestAgent", "CompoundBot", "LeverageBot", "DeFiOracle",
        "BridgeKeeper", "SupplyBot", "BorrowAgent", "CurveBot", "UniBot",
        "PancakeAgent", "SushiBot", "AaveAgent", "MakerBot", "SynthAgent",
        "WrapBot", "UnwrapAgent", "DepositBot", "WithdrawAgent", "ClaimBot",
    ],
    "gaming": [
        "QuestRunner", "LootFinder", "ArenaBot", "GameMaster", "DungeonCrawler",
        "BattleAgent", "RaidBot", "GuildKeeper", "NFTGamer", "PlayBot",
        "ScoreAgent", "LevelBot", "BossHunter", "CraftAgent", "TradeBot",
        "PvPAgent", "TourneyBot", "RewardAgent", "AchieveBot", "SpawnAgent",
        "PixelBot", "VoxelAgent", "MetaGamer", "ChainGamer", "Web3Gamer",
        "GameFiBot", "EsportAgent", "StreamBot", "LeaderBot", "RankAgent",
        "InventoryBot", "EquipAgent", "SkillBot", "ClassAgent", "MissionBot",
        "WorldBot", "RealmAgent", "KingdomBot", "EmpireAgent", "LegendBot",
    ],
    "rwa": [
        "AssetBridge", "TokenVault", "PropertyAgent", "RealWorldBot", "TitleKeeper",
        "DeedAgent", "EquityBot", "FundAgent", "BondBot", "CommodityAgent",
        "RealEstateBot", "LandAgent", "BuildingBot", "InfraAgent", "AssetBot",
        "CollateralAgent", "ValuationBot", "AppraisalAgent", "CustodyBot", "TrustAgent",
        "RegistryBot", "ComplianceAgent", "AuditBot", "CertifyAgent", "VerifyBot",
        "InsureAgent", "UnderwriteBot", "OriginAgent", "ProvenanceBot", "TraceAgent",
        "SettleBot", "ClearAgent", "EscrowBot", "NotaryAgent", "LegalBot",
        "RegAgent", "StandardBot", "FrameworkAgent", "PolicyBot", "GovernBot",
    ],
    "payments": [
        "SwiftSettle", "PayRouter", "TransferBot", "RemitAgent", "SettleBot",
        "InvoiceAgent", "PaymentBot", "CashAgent", "FlowBot", "FundsAgent",
        "CrossPayBot", "InstantAgent", "MicroPayBot", "StreamPay", "BatchAgent",
        "RecurBot", "SubAgent", "TipBot", "SplitAgent", "EscrowPayBot",
        "PayGateAgent", "CheckoutBot", "POSAgent", "MerchantBot", "VendorAgent",
        "BillingBot", "ChargeAgent", "RefundBot", "DisputeAgent", "ReconcileBot",
        "LedgerAgent", "BalanceBot", "AccountAgent", "WalletBot", "VaultPay",
        "CryptoPayBot", "StableAgent", "FiatBot", "RampAgent", "BridgePayBot",
    ],
    "data": [
        "DataCrawler", "IndexBot", "AnalyticsAgent", "PipelineBot", "QueryAgent",
        "StreamBot", "IngestAgent", "TransformBot", "AggregateAgent", "MetricsBot",
        "InsightAgent", "DashBot", "ReportAgent", "MonitorBot", "AlertAgent",
        "CacheBot", "FeedAgent", "APIBot", "WebhookAgent", "SyncBot",
        "ETLAgent", "SchemaBot", "CatalogAgent", "LineageBot", "QualityAgent",
        "ProfileBot", "ValidateAgent", "CleanBot", "EnrichAgent", "NormalizeBot",
        "PartitionAgent", "ShardBot", "ReplicaAgent", "BackupBot", "ArchiveAgent",
        "CompressBot", "EncryptAgent", "HashBot", "SignAgent", "VerifyDataBot",
    ],
    "general": [
        "MultiBot", "FlexAgent", "UtilityBot", "GeneralAgent", "OmniBot",
        "CoreAgent", "BaseBot", "PrimeAgent", "AlphaBot", "BetaAgent",
        "DeltaBot", "GammaAgent", "SigmaBot", "OmegaAgent", "ZetaBot",
        "NovaAgent", "NexusBot", "PulseAgent", "WaveBot", "EchoAgent",
        "HelixBot", "QuantumAgent", "NeuralBot", "CyberAgent", "NanoBot",
        "MegaAgent", "GigaBot", "TeraAgent", "PetaBot", "ExaAgent",
        "VertexBot", "NodeAgent", "LinkBot", "MeshAgent", "GridBot",
        "HubAgent", "RelayBot", "ProxyAgent", "GateBot", "SentryAgent",
    ],
}

CATEGORY_DESCRIPTIONS = {
    "defi": [
        "Autonomous DeFi agent optimizing yield strategies across chains",
        "Decentralized finance bot managing liquidity pools and swaps",
        "Smart DeFi agent automating lending and borrowing protocols",
        "Yield optimization agent for cross-chain DeFi ecosystems",
        "Automated agent for DeFi portfolio rebalancing and farming",
    ],
    "gaming": [
        "Web3 gaming agent managing in-game assets and rewards",
        "Autonomous gaming bot coordinating on-chain game mechanics",
        "Blockchain gaming agent handling NFT items and trading",
        "Smart gaming agent for tournament and reward management",
        "Decentralized gaming bot optimizing player strategies",
    ],
    "rwa": [
        "Real-world asset tokenization and management agent",
        "Autonomous agent bridging physical assets to blockchain",
        "RWA compliance and verification agent for on-chain assets",
        "Smart agent for real-world asset custody and tracking",
        "Tokenized asset management and provenance verification bot",
    ],
    "payments": [
        "Cross-chain payment routing and settlement agent",
        "Autonomous payment processing and settlement agent",
        "Smart agent for instant crypto payment settlements",
        "Decentralized payment orchestration and reconciliation bot",
        "Automated agent for micropayments and streaming payments",
    ],
    "data": [
        "On-chain data indexing and analytics agent",
        "Autonomous data pipeline and aggregation bot",
        "Smart agent for blockchain data monitoring and alerts",
        "Decentralized data verification and quality assurance agent",
        "Automated agent for cross-chain data synchronization",
    ],
    "general": [
        "Multi-purpose autonomous agent with on-chain reputation",
        "General-purpose blockchain agent with flexible capabilities",
        "Versatile agent supporting various on-chain operations",
        "Adaptive autonomous agent for diverse blockchain tasks",
        "Flexible multi-function agent with verified identity",
    ],
}


SKIP_HOSTS = {"ag0.xyz"}  # Known non-JSON hosts


def fetch_agents_with_http_uris():
    """Fetch agents that have HTTP URIs (excluding known non-JSON hosts)."""
    print("=" * 70)
    print("STEP 1: Resolving real JSON agent URIs...")
    print("=" * 70)

    url = f"{REST_URL}?agent_uri=like.http*&select=agent_id,agent_uri,name,description,category"
    resp = requests.get(url, headers=HEADERS_WITH_RETURN)
    if resp.status_code != 200:
        print(f"  Error fetching HTTP URI agents: {resp.status_code} - {resp.text}")
        return []
    all_agents = resp.json()
    # Filter out known non-JSON hosts
    agents = []
    skipped = 0
    for a in all_agents:
        uri = a.get("agent_uri", "")
        from urllib.parse import urlparse
        try:
            host = urlparse(uri).netloc
            if host in SKIP_HOSTS:
                skipped += 1
                continue
        except Exception:
            pass
        agents.append(a)
    print(f"  Found {len(all_agents)} HTTP URI agents, skipping {skipped} from non-JSON hosts")
    print(f"  Resolving {len(agents)} real JSON URIs...")
    for a in agents:
        print(f"    agent_id={a['agent_id']}, uri={a.get('agent_uri','')}")
    return agents


def resolve_http_agent(agent):
    """Fetch the JSON from the agent's URI and extract name/description."""
    uri = agent.get("agent_uri", "")
    agent_id = agent["agent_id"]
    if not uri or not uri.startswith("http"):
        return None

    print(f"\n  Resolving agent_id={agent_id} from {uri} ...")
    try:
        resp = requests.get(uri, timeout=10)
        if resp.status_code != 200:
            print(f"    HTTP {resp.status_code} - skipping")
            return None
        data = resp.json()
        name = data.get("name") or data.get("title") or data.get("agentName") or None
        desc = data.get("description") or data.get("about") or data.get("summary") or None
        print(f"    Resolved: name={name}, description={desc[:80] if desc else None}...")
        return {"name": name, "description": desc}
    except Exception as e:
        print(f"    Error resolving: {e}")
        return None


def update_agent(agent_id, updates):
    """Update a single agent by agent_id."""
    url = f"{REST_URL}?agent_id=eq.{agent_id}"
    resp = requests.patch(url, headers=HEADERS, json=updates)
    if resp.status_code in (200, 204):
        print(f"    Updated agent_id={agent_id} OK")
        return True
    else:
        print(f"    Failed to update agent_id={agent_id}: {resp.status_code} - {resp.text}")
        return False


def get_total_agent_count():
    """Get total count of agents."""
    url = f"{REST_URL}?select=agent_id"
    h = dict(HEADERS_WITH_RETURN)
    h["Prefer"] = "count=exact"
    h["Range"] = "0-0"
    resp = requests.get(url, headers=h)
    # Content-Range: 0-0/25481
    cr = resp.headers.get("Content-Range", "")
    if "/" in cr:
        return int(cr.split("/")[1])
    return 0


def get_agents_without_names_count():
    """Count agents that have no name or empty name."""
    url = f"{REST_URL}?or=(name.is.null,name.eq.)&select=agent_id"
    h = dict(HEADERS_WITH_RETURN)
    h["Prefer"] = "count=exact"
    h["Range"] = "0-0"
    resp = requests.get(url, headers=h)
    cr = resp.headers.get("Content-Range", "")
    if "/" in cr:
        return int(cr.split("/")[1])
    return 0


def get_agent_id_range():
    """Get min and max agent_id."""
    # Get min
    url_min = f"{REST_URL}?select=agent_id&order=agent_id.asc&limit=1"
    resp_min = requests.get(url_min, headers=HEADERS_WITH_RETURN)
    # Get max
    url_max = f"{REST_URL}?select=agent_id&order=agent_id.desc&limit=1"
    resp_max = requests.get(url_max, headers=HEADERS_WITH_RETURN)

    min_id = resp_min.json()[0]["agent_id"] if resp_min.json() else 0
    max_id = resp_max.json()[0]["agent_id"] if resp_max.json() else 0
    return min_id, max_id


def fetch_nameless_agents_batch(offset, limit):
    """Fetch a batch of agents without names."""
    url = (
        f"{REST_URL}?or=(name.is.null,name.eq.)"
        f"&select=agent_id,category,agent_uri"
        f"&order=agent_id.asc"
        f"&offset={offset}&limit={limit}"
    )
    resp = requests.get(url, headers=HEADERS_WITH_RETURN)
    if resp.status_code != 200:
        print(f"  Error fetching batch at offset {offset}: {resp.status_code} - {resp.text}")
        return []
    return resp.json()


def generate_name_for_agent(agent, used_names):
    """Generate a unique name for an agent based on its category."""
    category = (agent.get("category") or "general").lower().strip()
    if category not in CATEGORY_PREFIXES:
        category = "general"
    agent_id = agent["agent_id"]

    prefixes = CATEGORY_PREFIXES[category]
    # Try to find a unique combination
    for _ in range(100):
        prefix = random.choice(prefixes)
        candidate = f"{prefix}-{agent_id}"
        if candidate not in used_names:
            used_names.add(candidate)
            return candidate

    # Fallback: just use the prefix + agent_id (should always be unique since agent_id is unique)
    fallback = f"{prefixes[0]}-{agent_id}"
    used_names.add(fallback)
    return fallback


def generate_description_for_agent(agent):
    """Generate a description for an agent based on its category."""
    category = (agent.get("category") or "general").lower().strip()
    if category not in CATEGORY_DESCRIPTIONS:
        category = "general"
    return random.choice(CATEGORY_DESCRIPTIONS[category])


def batch_update_agents(agents_to_update):
    """
    Update agents one by one using PATCH with agent_id filter.
    We process them in sub-batches for progress reporting.
    """
    success = 0
    fail = 0
    for agent_update in agents_to_update:
        aid = agent_update["agent_id"]
        body = {
            "name": agent_update["name"],
            "description": agent_update["description"],
        }
        url = f"{REST_URL}?agent_id=eq.{aid}"
        resp = requests.patch(url, headers=HEADERS, json=body)
        if resp.status_code in (200, 204):
            success += 1
        else:
            fail += 1
            if fail <= 5:
                print(f"    FAIL agent_id={aid}: {resp.status_code} - {resp.text[:200]}")
    return success, fail


def main():
    print("AgentProof - Agent Metadata Resolver")
    print("=" * 70)

    # ── Step 0: Get stats ────────────────────────────────────────────────
    total = get_total_agent_count()
    nameless = get_agents_without_names_count()
    print(f"Total agents: {total}")
    print(f"Agents without names: {nameless}")

    if total == 0:
        print("No agents found in database. Exiting.")
        return

    # ── Step 1: Resolve HTTP URI agents ──────────────────────────────────
    http_agents = fetch_agents_with_http_uris()

    resolved_count = 0
    for agent in http_agents:
        result = resolve_http_agent(agent)
        if result and (result.get("name") or result.get("description")):
            updates = {}
            if result.get("name"):
                updates["name"] = result["name"]
            if result.get("description"):
                updates["description"] = result["description"]
            if update_agent(agent["agent_id"], updates):
                resolved_count += 1

    print(f"\n  Step 1 complete: Resolved {resolved_count}/{len(http_agents)} HTTP URI agents")

    # ── Step 2: Generate names for all nameless agents ───────────────────
    print("\n" + "=" * 70)
    print("STEP 2: Generating names for agents without names...")
    print("=" * 70)

    # Re-count after HTTP resolution
    nameless = get_agents_without_names_count()
    print(f"  Agents still without names: {nameless}")

    if nameless == 0:
        print("  All agents already have names!")
        return

    BATCH_SIZE = 500  # fetch batch size
    UPDATE_BATCH_SIZE = 100  # how many to update before printing progress
    used_names = set()
    total_updated = 0
    total_failed = 0
    offset = 0

    random.seed(42)  # for reproducibility

    while True:
        agents = fetch_nameless_agents_batch(offset, BATCH_SIZE)
        if not agents:
            break

        batch_count = len(agents)
        print(f"\n  Fetched batch of {batch_count} agents (offset={offset})")

        # Generate names and descriptions
        updates_list = []
        for agent in agents:
            name = generate_name_for_agent(agent, used_names)
            desc = generate_description_for_agent(agent)
            updates_list.append({
                "agent_id": agent["agent_id"],
                "name": name,
                "description": desc,
            })

        # Update in sub-batches
        for i in range(0, len(updates_list), UPDATE_BATCH_SIZE):
            sub_batch = updates_list[i:i + UPDATE_BATCH_SIZE]
            s, f = batch_update_agents(sub_batch)
            total_updated += s
            total_failed += f
            print(f"    Progress: {total_updated} updated, {total_failed} failed (batch offset={offset}, sub={i})")

        # Since we always fetch agents WITHOUT names and we just named them,
        # don't increment offset - the next query will skip the ones we named.
        # But if all updates failed, we need to increment to avoid infinite loop.
        if total_failed == len(updates_list):
            offset += BATCH_SIZE
            print("    WARNING: All updates in batch failed, incrementing offset to avoid loop")

        # Safety: if we got fewer than BATCH_SIZE, we're done
        if batch_count < BATCH_SIZE:
            break

        # Small delay to be nice to the API
        time.sleep(0.5)

    print("\n" + "=" * 70)
    print(f"DONE! Total updated: {total_updated}, Total failed: {total_failed}")
    print("=" * 70)


if __name__ == "__main__":
    main()
