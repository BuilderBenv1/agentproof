-- ============================================
-- AgentProof Phase 4: Marketplace & Revenue Sharing
-- Migration SQL for Supabase
-- ============================================

-- ─── Module 1: Agent Monitoring & Uptime ─────────────────────────────

CREATE TABLE IF NOT EXISTS agent_monitoring_endpoints (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    endpoint_index INTEGER NOT NULL,
    url TEXT NOT NULL,
    endpoint_type TEXT NOT NULL DEFAULT 'https',
    is_active BOOLEAN DEFAULT true,
    registered_at TIMESTAMPTZ NOT NULL,
    tx_hash TEXT,
    block_number INTEGER,
    UNIQUE(agent_id, endpoint_index)
);

CREATE TABLE IF NOT EXISTS uptime_checks (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    endpoint_index INTEGER NOT NULL,
    is_up BOOLEAN NOT NULL,
    latency_ms INTEGER,
    response_code INTEGER,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT DEFAULT 'monitor',
    tx_hash TEXT,
    block_number INTEGER
);

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

CREATE INDEX IF NOT EXISTS idx_monitoring_endpoints_agent ON agent_monitoring_endpoints(agent_id);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_agent ON uptime_checks(agent_id);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_checked_at ON uptime_checks(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_daily_agent ON uptime_daily_summary(agent_id);
CREATE INDEX IF NOT EXISTS idx_uptime_daily_date ON uptime_daily_summary(summary_date DESC);

-- ─── Module 2: Agent Marketplace ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace_listings (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    skills JSONB DEFAULT '[]',
    price_avax DECIMAL(20,8),
    price_type TEXT DEFAULT 'fixed',
    min_tier TEXT DEFAULT 'unranked',
    is_active BOOLEAN DEFAULT true,
    max_concurrent_tasks INTEGER DEFAULT 5,
    avg_completion_time_hours INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_tasks (
    id SERIAL PRIMARY KEY,
    task_id TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    listing_id INTEGER REFERENCES marketplace_listings(id),
    agent_id INTEGER NOT NULL,
    client_agent_id INTEGER,
    client_address TEXT NOT NULL,
    payment_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    task_hash TEXT,
    status TEXT DEFAULT 'pending',
    price_avax DECIMAL(20,8) NOT NULL,
    deliverables_uri TEXT,
    deadline TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_reviews (
    id SERIAL PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES marketplace_tasks(task_id),
    reviewer_address TEXT NOT NULL,
    agent_id INTEGER NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 100),
    review_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, reviewer_address)
);

CREATE INDEX IF NOT EXISTS idx_listings_agent ON marketplace_listings(agent_id);
CREATE INDEX IF NOT EXISTS idx_listings_active ON marketplace_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_listings_skills ON marketplace_listings USING gin(skills);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON marketplace_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client ON marketplace_tasks(client_address);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON marketplace_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_listing ON marketplace_tasks(listing_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON marketplace_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_task ON marketplace_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_reviews_agent ON marketplace_reviews(agent_id);

-- ─── Module 3: Revenue Splits ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS revenue_splits (
    id SERIAL PRIMARY KEY,
    split_id INTEGER UNIQUE NOT NULL,
    creator_agent_id INTEGER NOT NULL,
    agent_ids JSONB NOT NULL,
    shares_bps JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS split_payments (
    id SERIAL PRIMARY KEY,
    split_payment_id INTEGER UNIQUE NOT NULL,
    split_id INTEGER NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    token_address TEXT NOT NULL,
    task_hash TEXT,
    payer_address TEXT NOT NULL,
    distributed BOOLEAN DEFAULT false,
    distribution_amounts JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    distributed_at TIMESTAMPTZ,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_splits_creator ON revenue_splits(creator_agent_id);
CREATE INDEX IF NOT EXISTS idx_splits_active ON revenue_splits(is_active);
CREATE INDEX IF NOT EXISTS idx_split_payments_split ON split_payments(split_id);
CREATE INDEX IF NOT EXISTS idx_split_payments_distributed ON split_payments(distributed);

-- ─── Module 4: Enhanced Agent Profiles ───────────────────────────────

CREATE TABLE IF NOT EXISTS agent_profiles_extended (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER UNIQUE NOT NULL,
    skills JSONB DEFAULT '[]',
    pricing JSONB DEFAULT '{}',
    availability TEXT DEFAULT 'available',
    task_types JSONB DEFAULT '[]',
    portfolio_uris JSONB DEFAULT '[]',
    social_links JSONB DEFAULT '{}',
    custom_metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS uptime_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_earned DECIMAL(20,8) DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_tasks_completed INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'available';

CREATE INDEX IF NOT EXISTS idx_agent_profiles_ext_agent ON agent_profiles_extended(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_ext_availability ON agent_profiles_extended(availability);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_ext_skills ON agent_profiles_extended USING gin(skills);

-- ─── Module 5: Compliance & Audit Trail ──────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    actor_address TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    tx_hash TEXT,
    block_number INTEGER,
    source TEXT DEFAULT 'indexer',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_events (
    id SERIAL PRIMARY KEY,
    task_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    actor_address TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_address);
CREATE INDEX IF NOT EXISTS idx_audit_tx ON audit_logs(tx_hash);
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_type ON task_events(event_type);
CREATE INDEX IF NOT EXISTS idx_task_events_created ON task_events(created_at DESC);

-- ─── Row Level Security ──────────────────────────────────────────────

ALTER TABLE agent_monitoring_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE uptime_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE uptime_daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_profiles_extended ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_events ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Allow public read on agent_monitoring_endpoints" ON agent_monitoring_endpoints FOR SELECT USING (true);
CREATE POLICY "Allow public read on uptime_checks" ON uptime_checks FOR SELECT USING (true);
CREATE POLICY "Allow public read on uptime_daily_summary" ON uptime_daily_summary FOR SELECT USING (true);
CREATE POLICY "Allow public read on marketplace_listings" ON marketplace_listings FOR SELECT USING (true);
CREATE POLICY "Allow public read on marketplace_tasks" ON marketplace_tasks FOR SELECT USING (true);
CREATE POLICY "Allow public read on marketplace_reviews" ON marketplace_reviews FOR SELECT USING (true);
CREATE POLICY "Allow public read on revenue_splits" ON revenue_splits FOR SELECT USING (true);
CREATE POLICY "Allow public read on split_payments" ON split_payments FOR SELECT USING (true);
CREATE POLICY "Allow public read on agent_profiles_extended" ON agent_profiles_extended FOR SELECT USING (true);
CREATE POLICY "Allow public read on audit_logs" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow public read on task_events" ON task_events FOR SELECT USING (true);

-- Service write policies
CREATE POLICY "Allow service write on agent_monitoring_endpoints" ON agent_monitoring_endpoints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on uptime_checks" ON uptime_checks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on uptime_daily_summary" ON uptime_daily_summary FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on marketplace_listings" ON marketplace_listings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on marketplace_tasks" ON marketplace_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on marketplace_reviews" ON marketplace_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on revenue_splits" ON revenue_splits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on split_payments" ON split_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on agent_profiles_extended" ON agent_profiles_extended FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on task_events" ON task_events FOR ALL USING (true) WITH CHECK (true);

-- ─── Indexer State for New Contracts ─────────────────────────────────

INSERT INTO indexer_state (contract_name, last_block) VALUES ('agent_monitor', 0) ON CONFLICT (contract_name) DO NOTHING;
INSERT INTO indexer_state (contract_name, last_block) VALUES ('agent_splits', 0) ON CONFLICT (contract_name) DO NOTHING;
