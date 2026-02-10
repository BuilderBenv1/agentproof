-- ============================================================
-- Agent402 — Supabase Schema
-- Run in Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- 1. Core agents table
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
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    total_feedback INTEGER DEFAULT 0,
    average_rating DECIMAL(5,2) DEFAULT 0,
    composite_score DECIMAL(5,2) DEFAULT 0,
    validation_success_rate DECIMAL(5,2) DEFAULT 0,
    rank INTEGER,
    tier TEXT DEFAULT 'unranked',
    oracle_last_screened TIMESTAMPTZ,
    last_verified TIMESTAMPTZ,
    last_verified_reachable BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_composite_score ON agents(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
CREATE INDEX IF NOT EXISTS idx_agents_tier ON agents(tier);

-- 2. Reputation events (feedback)
CREATE TABLE IF NOT EXISTS reputation_events (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    reviewer_address TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 100),
    feedback_uri TEXT,
    task_hash TEXT,
    tx_hash TEXT,
    block_number INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_agent ON reputation_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_reputation_reviewer ON reputation_events(reviewer_address);
CREATE INDEX IF NOT EXISTS idx_reputation_created ON reputation_events(created_at DESC);

-- 3. Validation records
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
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    validated_at TIMESTAMPTZ,
    tx_hash TEXT,
    block_number INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_validations_agent ON validation_records(agent_id);

-- 4. Score history (daily snapshots)
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

CREATE INDEX IF NOT EXISTS idx_score_history_agent ON score_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_score_history_date ON score_history(snapshot_date DESC);

-- 5. Uptime monitoring
CREATE TABLE IF NOT EXISTS uptime_daily_summary (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    summary_date DATE NOT NULL,
    total_checks INTEGER DEFAULT 0,
    successful_checks INTEGER DEFAULT 0,
    uptime_pct DECIMAL(5,2) DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    UNIQUE(agent_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_uptime_daily_agent ON uptime_daily_summary(agent_id);
CREATE INDEX IF NOT EXISTS idx_uptime_daily_date ON uptime_daily_summary(summary_date DESC);

-- 6. Oracle screenings
CREATE TABLE IF NOT EXISTS oracle_screenings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    risk_level TEXT NOT NULL DEFAULT 'low',
    flags JSONB NOT NULL DEFAULT '[]',
    screened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screenings_agent ON oracle_screenings(agent_id);
CREATE INDEX IF NOT EXISTS idx_screenings_date ON oracle_screenings(screened_at DESC);

-- 7. x402 Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tx_hash TEXT,
    network TEXT NOT NULL,
    payer_address TEXT NOT NULL,
    amount_usd DECIMAL(10,6) NOT NULL,
    endpoint TEXT NOT NULL,
    http_method TEXT NOT NULL DEFAULT 'GET',
    http_path TEXT NOT NULL,
    agent_id_queried INTEGER,
    oracle_address TEXT NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    facilitator_response JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer_address);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_endpoint ON payments(endpoint);

-- 8. Leaderboard cache
CREATE TABLE IF NOT EXISTS leaderboard_cache (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    agent_id INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    composite_score DECIMAL(5,2) NOT NULL,
    trend TEXT DEFAULT 'stable',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_category ON leaderboard_cache(category);

-- 9. Agent categories
CREATE TABLE IF NOT EXISTS agent_categories (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT
);

INSERT INTO agent_categories (slug, name, description, icon) VALUES
('defi', 'DeFi Agents', 'Trading, yield, and financial automation agents', 'coin'),
('gaming', 'Gaming Agents', 'In-game economy, NPC, and gaming infrastructure agents', 'gamepad'),
('rwa', 'RWA Agents', 'Real-world asset tokenization and management agents', 'building'),
('payments', 'Payment Agents', 'Settlement, remittance, and payment processing agents', 'credit-card'),
('data', 'Data Agents', 'Analytics, indexing, and data pipeline agents', 'bar-chart'),
('general', 'General Agents', 'Multi-purpose and uncategorised agents', 'bot')
ON CONFLICT (slug) DO NOTHING;

-- 10. Oracle alerts
CREATE TABLE IF NOT EXISTS oracle_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id INTEGER,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    details TEXT,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_agent ON oracle_alerts(agent_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON oracle_alerts(created_at DESC);

-- 11. Oracle reports
CREATE TABLE IF NOT EXISTS oracle_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_data JSONB NOT NULL DEFAULT '{}',
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_created ON oracle_reports(created_at DESC);

-- ─── Row Level Security ──────────────────────────────────────────────

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE uptime_daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_reports ENABLE ROW LEVEL SECURITY;

-- Public read
DO $$ BEGIN CREATE POLICY "public_read_agents" ON agents FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_reputation" ON reputation_events FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_validations" ON validation_records FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_scores" ON score_history FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_uptime" ON uptime_daily_summary FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_screenings" ON oracle_screenings FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_payments" ON payments FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_leaderboard" ON leaderboard_cache FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_categories" ON agent_categories FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_alerts" ON oracle_alerts FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_reports" ON oracle_reports FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service write
DO $$ BEGIN CREATE POLICY "service_write_agents" ON agents FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_write_reputation" ON reputation_events FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_write_validations" ON validation_records FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_write_scores" ON score_history FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_write_uptime" ON uptime_daily_summary FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_write_screenings" ON oracle_screenings FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_write_payments" ON payments FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_write_leaderboard" ON leaderboard_cache FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_write_categories" ON agent_categories FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_write_alerts" ON oracle_alerts FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_write_reports" ON oracle_reports FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
