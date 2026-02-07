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

POLL_INTERVAL = int(os.getenv("INDEXER_POLL_INTERVAL", "10"))
CONFIRMATION_BLOCKS = int(os.getenv("INDEXER_CONFIRMATION_BLOCKS", "3"))
