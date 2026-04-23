-- Migration 006: Anchor feedback to verifiable ERC-8183 job IDs
-- Closes the "fake ratings / unverified service" attack vectors by requiring
-- that each rating reference a jobId recorded by AgentProofHook on-chain.
--
-- SAFETY: All new columns are nullable with defaults, so existing rows are
-- preserved as verified=FALSE (legacy, pre-hook feedback).

-- ── Step 1: Add job verification columns to reputation_events ──────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reputation_events' AND column_name = 'job_id'
    ) THEN
        ALTER TABLE reputation_events ADD COLUMN job_id NUMERIC;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reputation_events' AND column_name = 'verified'
    ) THEN
        ALTER TABLE reputation_events ADD COLUMN verified BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reputation_events' AND column_name = 'hook_chain'
    ) THEN
        ALTER TABLE reputation_events ADD COLUMN hook_chain TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reputation_events' AND column_name = 'hook_address'
    ) THEN
        ALTER TABLE reputation_events ADD COLUMN hook_address TEXT;
    END IF;
END $$;

-- ── Step 2: Indexes for verification-aware queries ─────────────────────

-- Scoring pulls verified vs unverified feedback separately
CREATE INDEX IF NOT EXISTS idx_reputation_events_agent_verified
    ON reputation_events (agent_id, verified);

-- Prevent duplicate feedback for the same (hook_chain, job_id) pair.
-- One rating per completed job — the core anti-sybil guarantee.
-- Partial index so legacy rows (hook_chain / job_id NULL) are ignored.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reputation_events_unique_job
    ON reputation_events (hook_chain, job_id)
    WHERE hook_chain IS NOT NULL AND job_id IS NOT NULL;
