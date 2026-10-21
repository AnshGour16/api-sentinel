-- Migration: 001_initial_schema.sql
-- Description: Creates initial tables for users, monitors, checks, incidents, and replay jobs.

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Monitors Table
CREATE TABLE IF NOT EXISTS monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_url TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    interval_seconds INTEGER NOT NULL DEFAULT 60,
    timeout_ms INTEGER NOT NULL DEFAULT 5000,
    expected_status_min INTEGER NOT NULL DEFAULT 200,
    expected_status_max INTEGER NOT NULL DEFAULT 299,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitors_user
    ON monitors(user_id);

CREATE INDEX IF NOT EXISTS idx_monitors_active
    ON monitors(is_active);

-- Monitor Checks Table
CREATE TABLE IF NOT EXISTS monitor_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status_code INTEGER,
    latency_ms INTEGER,
    outcome TEXT NOT NULL,
    error_code TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checks_monitor_time
    ON monitor_checks(monitor_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_checks_outcome_time
    ON monitor_checks(outcome, checked_at DESC);

-- Incidents Table
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'open',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    failure_count INTEGER NOT NULL DEFAULT 1,
    last_failure_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_monitor_status
    ON incidents(monitor_id, status);

CREATE INDEX IF NOT EXISTS idx_incidents_started
    ON incidents(started_at DESC);

-- Ensure only one unresolved incident exists per monitor at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_one_unresolved
    ON incidents(monitor_id)
    WHERE status != 'resolved';

-- Replay Jobs Table
CREATE TABLE IF NOT EXISTS replay_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    monitor_id UUID REFERENCES monitors(id) ON DELETE SET NULL,
    target_environment TEXT NOT NULL,
    http_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    status_code INTEGER,
    latency_ms INTEGER,
    error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_replays_user_time
    ON replay_jobs(user_id, created_at DESC);
