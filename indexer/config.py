import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

AVALANCHE_RPC_URL = os.getenv("AVALANCHE_RPC_URL", "https://api.avax-test.network/ext/bc/C/rpc")

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

# Default starting block — ERC-8004 registries were deployed around block 77,000,000
# Avoids scanning from block 0 on first run
DEFAULT_START_BLOCK = int(os.getenv("INDEXER_DEFAULT_START_BLOCK", "77000000"))
