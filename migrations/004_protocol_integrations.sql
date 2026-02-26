-- Migration 004: Protocol Integration Monetization Layer
-- Adds API key management, usage tracking, and subscription tables
-- for the protocol integration tier system (free / growth / enterprise).
--
-- SAFETY: All new tables, no existing data affected.

-- ── Step 1: API Keys ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL,
    protocol_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'growth', 'enterprise')),
    daily_limit INTEGER NOT NULL DEFAULT 1000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = TRUE;

-- ── Step 2: Daily Usage Aggregates ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_usage_daily (
    id SERIAL PRIMARY KEY,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    request_count INTEGER DEFAULT 0,
    endpoints_hit JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(api_key_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_usage_daily_key_date ON api_usage_daily(api_key_id, usage_date DESC);

-- ── Step 3: Subscriptions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    tier TEXT NOT NULL CHECK (tier IN ('growth', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled')),
    price_cents INTEGER,
    billing_email TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    cancelled_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_key ON subscriptions(api_key_id);

-- ── Step 4: Link webhooks to API keys ───────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'webhook_subscriptions' AND column_name = 'api_key_id'
    ) THEN
        ALTER TABLE webhook_subscriptions ADD COLUMN api_key_id UUID REFERENCES api_keys(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_webhook_subs_api_key ON webhook_subscriptions(api_key_id);
