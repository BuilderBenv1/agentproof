-- Webhook subscriptions and deliveries
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscriber_name TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    secret_token TEXT NOT NULL,
    events TEXT[] DEFAULT ARRAY['score_change','risk_change','uri_change','unreachable'],
    agent_ids INTEGER[],
    min_score_delta DECIMAL DEFAULT 5.0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_fired_at TIMESTAMPTZ,
    total_deliveries INTEGER DEFAULT 0,
    failed_deliveries INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id UUID REFERENCES webhook_subscriptions(id),
    event_type TEXT NOT NULL,
    agent_id INTEGER,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending',
    http_status INTEGER,
    attempt_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Telegram notification subscriptions
CREATE TABLE IF NOT EXISTS agent_subscriptions (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    agent_id INTEGER NOT NULL,
    alert_types TEXT[] DEFAULT ARRAY['score_change','risk_change','uri_change','unreachable'],
    min_score_delta DECIMAL DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(telegram_id, agent_id)
);

-- Notifier cursor for tracking last processed alert
CREATE TABLE IF NOT EXISTS notifier_cursor (
    service TEXT PRIMARY KEY,
    last_alert_created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
