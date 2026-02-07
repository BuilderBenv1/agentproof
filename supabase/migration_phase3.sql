-- ================================================================
-- AgentProof Phase 3: Supabase Migration
-- Run this AFTER the base migration.sql has been applied.
-- ================================================================

-- Insurance stakes
CREATE TABLE IF NOT EXISTS insurance_stakes (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    staker_address TEXT NOT NULL,
    stake_amount DECIMAL(20,8) NOT NULL,
    tier TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    staked_at TIMESTAMPTZ NOT NULL,
    unstake_requested_at TIMESTAMPTZ,
    tx_hash TEXT UNIQUE NOT NULL,
    block_number INTEGER NOT NULL
);

-- Insurance claims
CREATE TABLE IF NOT EXISTS insurance_claims (
    id SERIAL PRIMARY KEY,
    claim_id INTEGER UNIQUE NOT NULL,
    agent_id INTEGER NOT NULL,
    claimant_address TEXT NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    validation_id INTEGER,
    evidence_uri TEXT,
    dispute_uri TEXT,
    status TEXT DEFAULT 'pending',
    filed_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    in_favor_of_claimant BOOLEAN,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER UNIQUE NOT NULL,
    from_agent_id INTEGER NOT NULL,
    to_agent_id INTEGER NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    token_address TEXT NOT NULL,
    task_hash TEXT NOT NULL,
    requires_validation BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'escrowed',
    created_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL
);

-- Agent capabilities (extracted from registration file)
CREATE TABLE IF NOT EXISTS agent_capabilities (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    capability TEXT NOT NULL,
    UNIQUE(agent_id, capability)
);

-- Agent endpoints (extracted from registration file)
CREATE TABLE IF NOT EXISTS agent_endpoints (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    endpoint_type TEXT NOT NULL,
    endpoint_url TEXT NOT NULL,
    version TEXT,
    UNIQUE(agent_id, endpoint_type)
);

-- Full-text search on agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_agents_search ON agents USING gin(search_vector);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_insurance_stakes_agent ON insurance_stakes(agent_id);
CREATE INDEX IF NOT EXISTS idx_insurance_stakes_active ON insurance_stakes(is_active);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_agent ON insurance_claims(agent_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_payments_from_agent ON payments(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_payments_to_agent ON payments(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_capabilities_capability ON agent_capabilities(capability);
CREATE INDEX IF NOT EXISTS idx_capabilities_agent ON agent_capabilities(agent_id);
CREATE INDEX IF NOT EXISTS idx_endpoints_type ON agent_endpoints(endpoint_type);
CREATE INDEX IF NOT EXISTS idx_endpoints_agent ON agent_endpoints(agent_id);

-- Row Level Security
ALTER TABLE insurance_stakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_endpoints ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Allow public read on insurance_stakes" ON insurance_stakes FOR SELECT USING (true);
CREATE POLICY "Allow public read on insurance_claims" ON insurance_claims FOR SELECT USING (true);
CREATE POLICY "Allow public read on payments" ON payments FOR SELECT USING (true);
CREATE POLICY "Allow public read on agent_capabilities" ON agent_capabilities FOR SELECT USING (true);
CREATE POLICY "Allow public read on agent_endpoints" ON agent_endpoints FOR SELECT USING (true);

-- Service write policies (for indexer)
CREATE POLICY "Allow service write on insurance_stakes" ON insurance_stakes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on insurance_claims" ON insurance_claims FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on agent_capabilities" ON agent_capabilities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on agent_endpoints" ON agent_endpoints FOR ALL USING (true) WITH CHECK (true);

-- Add indexer state entries for new contracts
INSERT INTO indexer_state (contract_name, last_block) VALUES
('insurance_pool', 0),
('agent_payments', 0)
ON CONFLICT (contract_name) DO NOTHING;
