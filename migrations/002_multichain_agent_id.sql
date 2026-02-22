-- Migration: Multi-chain agent_id support
-- Problem: agent_id was UNIQUE globally, but ERC-8004 registries on different
-- chains (Avalanche, Base, Ethereum, Linea) assign agent_ids independently.
-- Agent #1 on Base was overwriting Agent #1 on Avalanche during indexing.
--
-- Fix: Make (agent_id, source_chain) the unique key instead of agent_id alone.

-- Step 1: Add source_chain column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'agents' AND column_name = 'source_chain'
    ) THEN
        ALTER TABLE agents ADD COLUMN source_chain TEXT NOT NULL DEFAULT 'avalanche';
    END IF;
END $$;

-- Step 2: Backfill existing rows that have NULL or empty source_chain
UPDATE agents SET source_chain = 'avalanche' WHERE source_chain IS NULL OR source_chain = '';

-- Step 3: Drop the old single-column unique constraint on agent_id
-- (constraint name may vary — try both common naming conventions)
DO $$
BEGIN
    -- Try dropping named constraint (Supabase auto-generated name)
    ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_agent_id_key;
EXCEPTION WHEN OTHERS THEN
    NULL; -- ignore if it doesn't exist
END $$;

-- Also drop any unique index on agent_id alone
DROP INDEX IF EXISTS agents_agent_id_key;
DROP INDEX IF EXISTS idx_agents_agent_id;

-- Step 4: Create composite unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_agent_id_chain
    ON agents (agent_id, source_chain);

-- Step 5: Add index for chain filtering
CREATE INDEX IF NOT EXISTS idx_agents_source_chain
    ON agents (source_chain);

-- Step 6: Reset Base and Linea indexer checkpoints so they re-scan
-- (previous scans may have been silently overwritten by Avalanche data)
UPDATE indexer_state SET last_block = 41667100
    WHERE contract_name = 'erc8004_base_identity';
UPDATE indexer_state SET last_block = 41667100
    WHERE contract_name = 'erc8004_base_feedback';
UPDATE indexer_state SET last_block = 28662500
    WHERE contract_name = 'erc8004_linea_identity';
UPDATE indexer_state SET last_block = 28662500
    WHERE contract_name = 'erc8004_linea_feedback';
