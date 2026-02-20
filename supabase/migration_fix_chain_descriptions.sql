-- =============================================================
-- Migration: Fix descriptions that incorrectly reference Avalanche
-- for agents on other chains (Ethereum, Base, Linea)
-- =============================================================
-- Bug: resolve_agent_metadata.py generated descriptions with hardcoded
-- "on Avalanche" text regardless of the agent's actual source_chain.
-- This fixes non-Avalanche agents that got Avalanche descriptions.

-- Fix "on Avalanche" references in descriptions for non-Avalanche agents
UPDATE agents
SET description = REPLACE(description, 'on Avalanche network', 'with on-chain reputation')
WHERE source_chain != 'avalanche'
  AND description LIKE '%on Avalanche network%';

UPDATE agents
SET description = REPLACE(description, 'on Avalanche', 'across chains')
WHERE source_chain != 'avalanche'
  AND description LIKE '%on Avalanche%';

UPDATE agents
SET description = REPLACE(description, 'for Avalanche', 'for cross-chain')
WHERE source_chain != 'avalanche'
  AND description LIKE '%for Avalanche%';

-- Also fix the "operating on Avalanche" variant
UPDATE agents
SET description = REPLACE(description, 'operating on Avalanche', 'with verified identity')
WHERE source_chain != 'avalanche'
  AND description LIKE '%operating on Avalanche%';
