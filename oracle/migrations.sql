-- ============================================================
-- Oracle Autonomous Scheduler — Supabase Migrations
-- Run these against your Supabase SQL editor (https://supabase.com/dashboard)
-- ============================================================

-- 0. Drop stale check constraints from prior versions
--    (tables were previously created with overly restrictive constraints)
ALTER TABLE IF EXISTS oracle_alerts DROP CONSTRAINT IF EXISTS oracle_alerts_alert_type_check;
ALTER TABLE IF EXISTS oracle_alerts DROP CONSTRAINT IF EXISTS oracle_alerts_severity_check;
ALTER TABLE IF EXISTS oracle_screenings DROP CONSTRAINT IF EXISTS oracle_screenings_risk_level_check;

-- 1. Oracle screenings — results of automated agent risk screening
CREATE TABLE IF NOT EXISTS oracle_screenings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    risk_level TEXT NOT NULL DEFAULT 'low',
    flags JSONB NOT NULL DEFAULT '[]',
    screened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oracle_screenings_agent_id ON oracle_screenings(agent_id);
CREATE INDEX IF NOT EXISTS idx_oracle_screenings_screened_at ON oracle_screenings(screened_at DESC);

-- 2. Oracle alerts — anomaly detection alerts
CREATE TABLE IF NOT EXISTS oracle_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id INTEGER,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    details TEXT,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oracle_alerts_agent_id ON oracle_alerts(agent_id);
CREATE INDEX IF NOT EXISTS idx_oracle_alerts_created_at ON oracle_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_alerts_type ON oracle_alerts(alert_type);

-- 3. Oracle reports — periodic network health reports
CREATE TABLE IF NOT EXISTS oracle_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_data JSONB NOT NULL DEFAULT '{}',
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oracle_reports_created_at ON oracle_reports(created_at DESC);

-- 4. Add oracle columns to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS oracle_last_screened TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_verified TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_verified_reachable BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_agents_oracle_last_screened ON agents(oracle_last_screened)
    WHERE oracle_last_screened IS NULL;
CREATE INDEX IF NOT EXISTS idx_agents_last_verified ON agents(last_verified);

-- 5. Enable RLS — service role writes, anon reads
DO $$
BEGIN
    ALTER TABLE oracle_screenings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE oracle_alerts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE oracle_reports ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Policies (IF NOT EXISTS not supported for policies, so use DO blocks)
DO $$ BEGIN
    CREATE POLICY "service_write_oracle_screenings" ON oracle_screenings FOR ALL
        USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE POLICY "anon_read_oracle_screenings" ON oracle_screenings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE POLICY "service_write_oracle_alerts" ON oracle_alerts FOR ALL
        USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE POLICY "anon_read_oracle_alerts" ON oracle_alerts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE POLICY "service_write_oracle_reports" ON oracle_reports FOR ALL
        USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE POLICY "anon_read_oracle_reports" ON oracle_reports FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Clean up test data
DELETE FROM oracle_reports WHERE report_data = '{"test": true}'::jsonb;
