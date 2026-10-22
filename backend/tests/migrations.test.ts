import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { runMigrations } from '../src/migrations/runner';
import { pool } from '../src/lib/db';

describe('Database Migration Suite', () => {
  const migrationsDir = path.resolve(__dirname, '../migrations');

  it('should have 001_initial_schema.sql in the migrations directory', () => {
    const migrationFile = path.join(migrationsDir, '001_initial_schema.sql');
    expect(fs.existsSync(migrationFile)).toBe(true);
  });

  it('001_initial_schema.sql should define all required tables and indexes', () => {
    const migrationFile = path.join(migrationsDir, '001_initial_schema.sql');
    const content = fs.readFileSync(migrationFile, 'utf-8');

    // Required tables
    expect(content).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS monitors');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS monitor_checks');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS incidents');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS replay_jobs');

    // Required indexes
    expect(content).toContain('idx_monitors_user');
    expect(content).toContain('idx_monitors_active');
    expect(content).toContain('idx_checks_monitor_time');
    expect(content).toContain('idx_checks_outcome_time');
    expect(content).toContain('idx_incidents_monitor_status');
    expect(content).toContain('idx_incidents_started');
    expect(content).toContain('idx_replays_user_time');

    // Partial unique index for one unresolved incident per monitor
    expect(content).toContain('idx_incidents_one_unresolved');
    expect(content).toContain("WHERE status != 'resolved'");
  });

  it('runMigrations should apply pending migrations inside a transaction', async () => {
    const queryCalls: string[] = [];

    const mockClient = {
      query: vi.fn(async (sql: string) => {
        queryCalls.push(sql);
        if (sql.includes('SELECT name FROM schema_migrations')) {
          return { rows: [] }; // No migrations applied yet
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    vi.spyOn(pool, 'connect').mockResolvedValue(mockClient as any);

    const result = await runMigrations(migrationsDir);

    expect(result.applied).toContain('001_initial_schema.sql');
    expect(result.applied).toContain('002_add_check_execution_id.sql');
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('runMigrations should skip migrations that have already been applied', async () => {
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT name FROM schema_migrations')) {
          return { rows: [{ name: '001_initial_schema.sql' }, { name: '002_add_check_execution_id.sql' }] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    vi.spyOn(pool, 'connect').mockResolvedValue(mockClient as any);

    const result = await runMigrations(migrationsDir);

    expect(result.applied.length).toBe(0);
    expect(result.alreadyApplied).toContain('001_initial_schema.sql');
    expect(result.alreadyApplied).toContain('002_add_check_execution_id.sql');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
