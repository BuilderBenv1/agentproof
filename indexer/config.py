import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

AVALANCHE_RPC_URL = os.getenv("AVALANCHE_RPC_URL", "https://api.avax-test.network/ext/bc/C/rpc")

# ─── Multi-chain RPC URLs ────────────────────────────────────────────────────
# All chains use the same CREATE2-deployed ERC-8004 contracts.
# Only chains with a configured RPC URL will be indexed.
CHAIN_RPC_URLS = {
    "avalanche": os.getenv("AVALANCHE_RPC_URL", "https://api.avax.network/ext/bc/C/rpc"),
    "base": os.getenv("BASE_RPC_URL", ""),
    "ethereum": os.getenv("ETHEREUM_RPC_URL", ""),
    "linea": os.getenv("LINEA_RPC_URL", ""),
    "polygon": os.getenv("POLYGON_RPC_URL", ""),
    "bsc": os.getenv("BSC_RPC_URL", ""),
    "gnosis": os.getenv("GNOSIS_RPC_URL", ""),
    "celo": os.getenv("CELO_RPC_URL", ""),
    "mantle": os.getenv("MANTLE_RPC_URL", ""),
    "scroll": os.getenv("SCROLL_RPC_URL", ""),
    "arbitrum": os.getenv("ARBITRUM_RPC_URL", ""),
    "optimism": os.getenv("OPTIMISM_RPC_URL", ""),
    "monad": os.getenv("MONAD_RPC_URL", ""),
    "abstract": os.getenv("ABSTRACT_RPC_URL", ""),
    "taiko": os.getenv("TAIKO_RPC_URL", ""),
    "megaeth": os.getenv("MEGAETH_RPC_URL", ""),
    "skale": os.getenv("SKALE_RPC_URL", ""),
    "xlayer": os.getenv("XLAYER_RPC_URL", ""),
    "soneium": os.getenv("SONEIUM_RPC_URL", ""),
    "metis": os.getenv("METIS_RPC_URL", ""),
    "shape": os.getenv("SHAPE_RPC_URL", ""),
}

# Filter to only chains with configured RPCs
ACTIVE_CHAINS = {name: url for name, url in CHAIN_RPC_URLS.items() if url}

# Official ERC-8004 registries
ERC8004_IDENTITY_REGISTRY = os.getenv("ERC8004_IDENTITY_REGISTRY", "")
ERC8004_REPUTATION_REGISTRY = os.getenv("ERC8004_REPUTATION_REGISTRY", "")

# AgentProof custom contracts (legacy identity/reputation kept for fallback)
IDENTITY_REGISTRY_ADDRESS = os.getenv("IDENTITY_REGISTRY_ADDRESS", "")
REPUTATION_REGISTRY_ADDRESS = os.getenv("REPUTATION_REGISTRY_ADDRESS", "")
VALIDATION_REGISTRY_ADDRESS = os.getenv("VALIDATION_REGISTRY_ADDRESS", "")

# Flag to use official ERC-8004 or custom registries
USE_OFFICIAL_ERC8004 = os.getenv("USE_OFFICIAL_ERC8004", "True").lower() in ("true", "1", "yes")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "") or os.getenv("SUPABASE_KEY", "")

# Phase 4 contracts
AGENT_MONITOR_ADDRESS = os.getenv("AGENT_MONITOR_ADDRESS", "")
AGENT_SPLITS_ADDRESS = os.getenv("AGENT_SPLITS_ADDRESS", "")

POLL_INTERVAL = int(os.getenv("INDEXER_POLL_INTERVAL", "10"))
CONFIRMATION_BLOCKS = int(os.getenv("INDEXER_CONFIRMATION_BLOCKS", "3"))

# Avalanche RPC limits get_logs to 2048 blocks per request; use 2000 for safety
MAX_BLOCK_RANGE = int(os.getenv("INDEXER_MAX_BLOCK_RANGE", "2000"))

# Default starting block — Avalanche-specific (ERC-8004 deployed ~block 77M).
# Other chains start from a recent block to avoid scanning from genesis.
DEFAULT_START_BLOCK = int(os.getenv("INDEXER_DEFAULT_START_BLOCK", "77000000"))

# Per-chain start blocks — prevents scanning millions of irrelevant blocks.
# Set to approximate block when ERC-8004 contracts were deployed on each chain.
# Chains not listed here will query their current block and start from recent history.
# All ERC-8004 contracts deployed ~Feb 3 2026 via CREATE2.
# Confirmed blocks: Avalanche 77000000, Base 41663783, BSC 79027268.
# Others estimated from approximate block times around that date.
# Override any via env var (e.g. BASE_START_BLOCK=41663783).
CHAIN_START_BLOCKS = {
    "avalanche": int(os.getenv("AVALANCHE_START_BLOCK", str(DEFAULT_START_BLOCK))),
    "base": int(os.getenv("BASE_START_BLOCK", "41663783")),
    "ethereum": int(os.getenv("ETHEREUM_START_BLOCK", "21770000")),
    "linea": int(os.getenv("LINEA_START_BLOCK", "16000000")),
    "polygon": int(os.getenv("POLYGON_START_BLOCK", "67800000")),
    "bsc": int(os.getenv("BSC_START_BLOCK", "79027268")),
    "gnosis": int(os.getenv("GNOSIS_START_BLOCK", "38000000")),
    "celo": int(os.getenv("CELO_START_BLOCK", "30000000")),
    "mantle": int(os.getenv("MANTLE_START_BLOCK", "73000000")),
    "scroll": int(os.getenv("SCROLL_START_BLOCK", "12000000")),
    "arbitrum": int(os.getenv("ARBITRUM_START_BLOCK", "290000000")),
    "optimism": int(os.getenv("OPTIMISM_START_BLOCK", "131000000")),
    "monad": int(os.getenv("MONAD_START_BLOCK", "0")),
    "abstract": int(os.getenv("ABSTRACT_START_BLOCK", "0")),
    "taiko": int(os.getenv("TAIKO_START_BLOCK", "600000")),
    "megaeth": int(os.getenv("MEGAETH_START_BLOCK", "0")),
    "skale": int(os.getenv("SKALE_START_BLOCK", "0")),
    "xlayer": int(os.getenv("XLAYER_START_BLOCK", "24000000")),
    "soneium": int(os.getenv("SONEIUM_START_BLOCK", "0")),
    "metis": int(os.getenv("METIS_START_BLOCK", "19000000")),
    "shape": int(os.getenv("SHAPE_START_BLOCK", "0")),
}
