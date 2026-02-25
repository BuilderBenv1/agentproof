-- Migration 003: Add source_chain to reputation_events and leaderboard_cache
-- Fixes cross-chain feedback attribution and leaderboard ID collisions.
--
-- SAFETY: All new columns are nullable with defaults, so no data loss.
-- Existing rows get backfilled to 'ethereum' (the chain with the most feedback
-- historically; agents table already has correct source_chain values).

-- ── Step 1: Add source_chain to reputation_events ──────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reputation_events' AND column_name = 'source_chain'
    ) THEN
        ALTER TABLE reputation_events ADD COLUMN source_chain TEXT DEFAULT 'ethereum';
    END IF;
END $$;

-- Backfill: join against agents table to infer correct chain for existing rows.
-- Where no match is found, default to 'ethereum' (largest chain by feedback volume).
UPDATE reputation_events re
SET source_chain = COALESCE(a.source_chain, 'ethereum')
FROM agents a
WHERE re.agent_id = a.agent_id
  AND re.source_chain IS NULL;

-- Catch any orphan rows not matched by the join
UPDATE reputation_events
SET source_chain = 'ethereum'
WHERE source_chain IS NULL;

-- Index for the scoring engine's per-chain feedback lookups
CREATE INDEX IF NOT EXISTS idx_reputation_events_agent_chain
    ON reputation_events (agent_id, source_chain);

-- ── Step 2: Add source_chain to leaderboard_cache ──────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leaderboard_cache' AND column_name = 'source_chain'
    ) THEN
        ALTER TABLE leaderboard_cache ADD COLUMN source_chain TEXT DEFAULT 'avalanche';
    END IF;
END $$;

-- Create composite index for per-chain leaderboard queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_category_chain
    ON leaderboard_cache (category, source_chain, rank);

-- ── Step 3: Add source_chain to score_history ──────────────────────────
-- (score_history also keys by agent_id alone — same collision risk)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'score_history' AND column_name = 'source_chain'
    ) THEN
        ALTER TABLE score_history ADD COLUMN source_chain TEXT DEFAULT 'avalanche';
    END IF;
END $$;

-- Update the unique constraint to include source_chain
-- Must drop the constraint (not the index) since Postgres enforces it that way
ALTER TABLE score_history DROP CONSTRAINT IF EXISTS score_history_agent_id_snapshot_date_key;
DROP INDEX IF EXISTS score_history_agent_id_snapshot_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_score_history_agent_chain_date
    ON score_history (agent_id, source_chain, snapshot_date);
