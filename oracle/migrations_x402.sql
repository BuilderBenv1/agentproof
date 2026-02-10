-- ============================================================
-- x402 Payment Protocol — Supabase Migration
-- Records verified USDC micropayments for premium oracle endpoints
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS oracle_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Payment identification
    tx_hash TEXT,
    network TEXT NOT NULL,                         -- CAIP-2, e.g. "eip155:8453"

    -- Payer
    payer_address TEXT NOT NULL,

    -- Amount
    amount_usd DECIMAL(10,6) NOT NULL,

    -- What they paid for
    endpoint TEXT NOT NULL,                        -- e.g. "GET /api/v1/trust/42"
    http_method TEXT NOT NULL DEFAULT 'GET',
    http_path TEXT NOT NULL,
    agent_id_queried INTEGER,

    -- Oracle (payee)
    oracle_address TEXT NOT NULL,

    -- Timestamps
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Raw facilitator response
    facilitator_response JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_oracle_payments_payer ON oracle_payments(payer_address);
CREATE INDEX IF NOT EXISTS idx_oracle_payments_paid_at ON oracle_payments(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_payments_endpoint ON oracle_payments(endpoint);
CREATE INDEX IF NOT EXISTS idx_oracle_payments_network ON oracle_payments(network);

-- RLS: service role can read/write, anon can read
ALTER TABLE oracle_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "service_write_oracle_payments" ON oracle_payments FOR ALL
        USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "anon_read_oracle_payments" ON oracle_payments FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
