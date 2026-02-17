-- Anti-Identity-Mutation Reputation System — Supabase DDL
-- Run this in the Supabase SQL Editor for project oztrefgbigvtzncodcys

-- 1. deployer_reputation table
CREATE TABLE IF NOT EXISTS deployer_reputation (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_address text NOT NULL UNIQUE,
    total_agents int NOT NULL DEFAULT 0,
    active_agents int NOT NULL DEFAULT 0,
    abandoned_agents int NOT NULL DEFAULT 0,
    avg_agent_score decimal NOT NULL DEFAULT 0,
    best_agent_score decimal NOT NULL DEFAULT 0,
    oldest_agent_age_days int NOT NULL DEFAULT 0,
    deployer_score decimal NOT NULL DEFAULT 50,
    first_seen_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployer_reputation_score ON deployer_reputation(deployer_score DESC);
CREATE INDEX IF NOT EXISTS idx_deployer_reputation_address ON deployer_reputation(owner_address);

-- 2. agent_uri_changes table
CREATE TABLE IF NOT EXISTS agent_uri_changes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    agent_id bigint NOT NULL,
    old_uri text,
    new_uri text,
    changed_at timestamptz DEFAULT now(),
    tx_hash text,
    block_number bigint
);

CREATE INDEX IF NOT EXISTS idx_uri_changes_agent ON agent_uri_changes(agent_id);
CREATE INDEX IF NOT EXISTS idx_uri_changes_time ON agent_uri_changes(changed_at DESC);

-- 3. New columns on agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS deployer_score decimal DEFAULT 50;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS deployer_agent_count int DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS uri_change_count int DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS freshness_multiplier decimal DEFAULT 1.0;

-- 4. Enable RLS (same pattern as existing tables)
ALTER TABLE deployer_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_uri_changes ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access
CREATE POLICY "service_role_deployer_reputation" ON deployer_reputation
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_agent_uri_changes" ON agent_uri_changes
    FOR ALL USING (true) WITH CHECK (true);

-- Allow anon read access
CREATE POLICY "anon_read_deployer_reputation" ON deployer_reputation
    FOR SELECT USING (true);
CREATE POLICY "anon_read_agent_uri_changes" ON agent_uri_changes
    FOR SELECT USING (true);
