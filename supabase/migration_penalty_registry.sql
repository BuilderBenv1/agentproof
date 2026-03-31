-- Migration: Penalty Registry
-- Adds penalty_registry table for slash-and-recovery mechanism.
-- Agents with confirmed malicious behaviour get a penalty slash that
-- hard-floors their composite score. Recovery is possible through
-- sustained clean operation tracked by consecutive_good_days.

CREATE TABLE IF NOT EXISTS penalty_registry (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES agents(agent_id),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    reason TEXT NOT NULL,
    evidence_uri TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    consecutive_good_days INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_penalty_registry_agent_active
    ON penalty_registry (agent_id, active)
    WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_penalty_registry_severity
    ON penalty_registry (severity)
    WHERE active = TRUE;

-- Reviewer accuracy tracking for bootstrap weight calculation
CREATE TABLE IF NOT EXISTS reviewer_accuracy (
    id SERIAL PRIMARY KEY,
    reviewer_address TEXT NOT NULL,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    aligned_reviews INTEGER NOT NULL DEFAULT 0,
    accuracy_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
    last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (reviewer_address)
);

CREATE INDEX IF NOT EXISTS idx_reviewer_accuracy_address
    ON reviewer_accuracy (reviewer_address);
