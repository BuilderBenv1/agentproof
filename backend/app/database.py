from supabase import create_client, Client
from app.config import get_settings

_client: Client | None = None


def get_supabase() -> Client:
    """Get or create a Supabase client singleton."""
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_key:
            raise RuntimeError(
                "Supabase URL and key must be configured. "
                "Set SUPABASE_URL and SUPABASE_KEY environment variables."
            )
        _client = create_client(settings.supabase_url, settings.supabase_key)
    return _client


def get_service_client() -> Client:
    """Get a Supabase client with service role key for admin operations."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError(
            "Supabase service key must be configured. "
            "Set SUPABASE_SERVICE_KEY environment variable."
        )
    return create_client(settings.supabase_url, settings.supabase_service_key)


# SQL schema for reference — run this in your Supabase SQL editor
SCHEMA_SQL = """
-- Agents table (synced from onchain)
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER UNIQUE NOT NULL,
    owner_address TEXT NOT NULL,
    agent_uri TEXT NOT NULL,
    name TEXT,
    description TEXT,
    category TEXT DEFAULT 'general',
    image_url TEXT,
    endpoints JSONB DEFAULT '[]',
    registered_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    total_feedback INTEGER DEFAULT 0,
    average_rating DECIMAL(5,2) DEFAULT 0,
    composite_score DECIMAL(5,2) DEFAULT 0,
    validation_success_rate DECIMAL(5,2) DEFAULT 0,
    rank INTEGER,
    tier TEXT DEFAULT 'unranked'
);

-- Reputation events (synced from onchain)
CREATE TABLE IF NOT EXISTS reputation_events (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    reviewer_address TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 100),
    feedback_uri TEXT,
    task_hash TEXT,
    tx_hash TEXT UNIQUE NOT NULL,
    block_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

-- Validation records (synced from onchain)
CREATE TABLE IF NOT EXISTS validation_records (
    id SERIAL PRIMARY KEY,
    validation_id INTEGER UNIQUE NOT NULL,
    agent_id INTEGER NOT NULL,
    task_hash TEXT NOT NULL,
    task_uri TEXT,
    requester_address TEXT NOT NULL,
    validator_address TEXT,
    is_valid BOOLEAN,
    proof_uri TEXT,
    requested_at TIMESTAMPTZ NOT NULL,
    validated_at TIMESTAMPTZ,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL
);

-- Leaderboard cache (refreshed periodically)
CREATE TABLE IF NOT EXISTS leaderboard_cache (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    agent_id INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    composite_score DECIMAL(5,2) NOT NULL,
    trend TEXT DEFAULT 'stable',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent categories
CREATE TABLE IF NOT EXISTS agent_categories (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT
);

-- Score history (daily snapshots)
CREATE TABLE IF NOT EXISTS score_history (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    composite_score DECIMAL(5,2) NOT NULL,
    average_rating DECIMAL(5,2) NOT NULL,
    total_feedback INTEGER NOT NULL,
    validation_success_rate DECIMAL(5,2) DEFAULT 0,
    snapshot_date DATE NOT NULL,
    UNIQUE(agent_id, snapshot_date)
);

-- Indexer state tracking
CREATE TABLE IF NOT EXISTS indexer_state (
    id SERIAL PRIMARY KEY,
    contract_name TEXT UNIQUE NOT NULL,
    last_block INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed categories
INSERT INTO agent_categories (slug, name, description, icon) VALUES
('defi', 'DeFi Agents', 'Trading, yield, and financial automation agents', '💰'),
('gaming', 'Gaming Agents', 'In-game economy, NPC, and gaming infrastructure agents', '🎮'),
('rwa', 'RWA Agents', 'Real-world asset tokenization and management agents', '🏛️'),
('payments', 'Payment Agents', 'Settlement, remittance, and payment processing agents', '💳'),
('data', 'Data Agents', 'Analytics, indexing, and data pipeline agents', '📊'),
('general', 'General Agents', 'Multi-purpose and uncategorised agents', '🤖')
ON CONFLICT (slug) DO NOTHING;
"""
