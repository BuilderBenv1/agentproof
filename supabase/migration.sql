-- ===========================================
-- AgentProof Database Migration
-- ===========================================
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/oztrefgbigvtzncodcys/sql
-- ===========================================

-- 1. Agents table (synced from onchain)
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

-- 2. Reputation events (synced from onchain)
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

-- 3. Validation records (synced from onchain)
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

-- 4. Leaderboard cache (refreshed periodically)
CREATE TABLE IF NOT EXISTS leaderboard_cache (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    agent_id INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    composite_score DECIMAL(5,2) NOT NULL,
    trend TEXT DEFAULT 'stable',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Agent categories
CREATE TABLE IF NOT EXISTS agent_categories (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT
);

-- 6. Score history (daily snapshots)
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

-- 7. Indexer state tracking
CREATE TABLE IF NOT EXISTS indexer_state (
    id SERIAL PRIMARY KEY,
    contract_name TEXT UNIQUE NOT NULL,
    last_block INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
CREATE INDEX IF NOT EXISTS idx_agents_composite_score ON agents(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_agents_tier ON agents(tier);
CREATE INDEX IF NOT EXISTS idx_reputation_events_agent_id ON reputation_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_reputation_events_created_at ON reputation_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_records_agent_id ON validation_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_category ON leaderboard_cache(category);
CREATE INDEX IF NOT EXISTS idx_score_history_agent_date ON score_history(agent_id, snapshot_date);

-- 9. Enable Row Level Security (allow all for service role, read for anon)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexer_state ENABLE ROW LEVEL SECURITY;

-- Policies: anon can read all tables, service_role can do everything
CREATE POLICY "Allow public read on agents" ON agents FOR SELECT USING (true);
CREATE POLICY "Allow service write on agents" ON agents FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on reputation_events" ON reputation_events FOR SELECT USING (true);
CREATE POLICY "Allow service write on reputation_events" ON reputation_events FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on validation_records" ON validation_records FOR SELECT USING (true);
CREATE POLICY "Allow service write on validation_records" ON validation_records FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on leaderboard_cache" ON leaderboard_cache FOR SELECT USING (true);
CREATE POLICY "Allow service write on leaderboard_cache" ON leaderboard_cache FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on agent_categories" ON agent_categories FOR SELECT USING (true);
CREATE POLICY "Allow service write on agent_categories" ON agent_categories FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on score_history" ON score_history FOR SELECT USING (true);
CREATE POLICY "Allow service write on score_history" ON score_history FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on indexer_state" ON indexer_state FOR SELECT USING (true);
CREATE POLICY "Allow service write on indexer_state" ON indexer_state FOR ALL USING (true) WITH CHECK (true);

-- 10. Seed categories
INSERT INTO agent_categories (slug, name, description, icon) VALUES
('defi', 'DeFi Agents', 'Trading, yield, and financial automation agents', '💰'),
('gaming', 'Gaming Agents', 'In-game economy, NPC, and gaming infrastructure agents', '🎮'),
('rwa', 'RWA Agents', 'Real-world asset tokenization and management agents', '🏛️'),
('payments', 'Payment Agents', 'Settlement, remittance, and payment processing agents', '💳'),
('data', 'Data Agents', 'Analytics, indexing, and data pipeline agents', '📊'),
('general', 'General Agents', 'Multi-purpose and uncategorised agents', '🤖')
ON CONFLICT (slug) DO NOTHING;
