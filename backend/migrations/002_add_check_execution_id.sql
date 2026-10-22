-- Migration: 002_add_check_execution_id.sql
-- Description: Adds execution_id for idempotency on monitor_checks and last_checked_at on monitors for scheduling.

-- 1. Add execution_id to monitor_checks
ALTER TABLE monitor_checks
    ADD COLUMN IF NOT EXISTS execution_id TEXT;

-- Enforce uniqueness on execution_id for at-least-once delivery deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_checks_execution_id
    ON monitor_checks(execution_id)
    WHERE execution_id IS NOT NULL;

-- 2. Add last_checked_at to monitors for efficient scheduler queries
ALTER TABLE monitors
    ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_monitors_scheduling
    ON monitors(is_active, last_checked_at);
