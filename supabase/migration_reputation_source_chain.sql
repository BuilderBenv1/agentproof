-- Migration: Add source_chain column to reputation_events for multi-chain feedback
-- This tracks which chain the feedback was submitted on (avalanche, base, linea, ethereum)

ALTER TABLE reputation_events ADD COLUMN IF NOT EXISTS source_chain TEXT DEFAULT 'avalanche';
CREATE INDEX IF NOT EXISTS idx_reputation_events_source_chain ON reputation_events(source_chain);

-- Set existing rows to avalanche (they were all indexed from Avalanche)
UPDATE reputation_events SET source_chain = 'avalanche' WHERE source_chain IS NULL;
