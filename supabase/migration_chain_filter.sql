-- =============================================================
-- Migration: Add source_chain column for multi-chain support
-- =============================================================
-- ERC-8004 is deployed on both Ethereum and Avalanche (same address).
-- This adds a source_chain column so users can filter by chain.

-- Step 1: Add source_chain column (default 'ethereum' since most existing agents are from Ethereum)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS source_chain TEXT DEFAULT 'ethereum';

-- Step 2: Tag known Avalanche agents (custom registry agents, agent_id <= 1621)
UPDATE agents SET source_chain = 'avalanche' WHERE agent_id <= 1621;

-- Step 3: Create index for chain filtering
CREATE INDEX IF NOT EXISTS idx_agents_source_chain ON agents(source_chain);

-- Step 4: Add composite index for chain + score queries
CREATE INDEX IF NOT EXISTS idx_agents_chain_score ON agents(source_chain, composite_score DESC);
