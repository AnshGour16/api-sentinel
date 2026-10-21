import fs from 'fs';
import path from 'path';
import { pool, closeDatabase } from '../lib/db';
import { logger } from '../lib/logger';

import { Client } from 'pg';
import { env } from '../config/env';

export interface MigrationResult {
  applied: string[];
  alreadyApplied: string[];
}

export async function ensureDatabaseExists(): Promise<void> {
  try {
    const url = new URL(env.DATABASE_URL);
    const dbName = url.pathname.replace(/^\//, '');

    if (!dbName || dbName === 'postgres') {
      return;
    }

    // Connect to the default 'postgres' maintenance database to check/create target database
    url.pathname = '/postgres';
    const client = new Client({ connectionString: url.toString() });

    await client.connect();
    try {
      const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1;', [dbName]);
      if (res.rowCount === 0) {
        logger.info({ database: dbName }, 'Target database does not exist, creating it now...');
        // Database names cannot be parameterized in CREATE DATABASE, validate identifier characters
        if (/^[a-zA-Z0-9_]+$/.test(dbName)) {
          await client.query(`CREATE DATABASE "${dbName}";`);
          logger.info({ database: dbName }, 'Successfully created database');
        }
      }
    } finally {
      await client.end();
    }
  } catch (error) {
    // If user lacks permission to create db or connection fails, log debug and proceed to pool connection
    logger.debug({ err: error }, 'Automatic database creation check skipped or completed');
  }
}

export async function runMigrations(migrationsDir?: string): Promise<MigrationResult> {
  const dir = migrationsDir || path.resolve(__dirname, '../../migrations');

  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }

  await ensureDatabaseExists();

  const client = await pool.connect();
  const applied: string[] = [];
  const alreadyApplied: string[] = [];

  try {
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Fetch applied migrations
    const { rows } = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations ORDER BY id ASC;'
    );
    const appliedSet = new Set(rows.map((r) => r.name));
    rows.forEach((r) => alreadyApplied.push(r.name));

    // Read and sort SQL migration files
    const allFiles = fs.readdirSync(dir);
    const migrationFiles = allFiles
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    const pending = migrationFiles.filter((file) => !appliedSet.has(file));

    if (pending.length === 0) {
      logger.info('Database schema is up to date. No pending migrations.');
      return { applied, alreadyApplied };
    }

    logger.info({ pendingCount: pending.length, pending }, 'Found pending migrations to apply');

    for (const file of pending) {
      const filePath = path.join(dir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      logger.info({ migration: file }, 'Applying database migration...');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1);', [file]);
        await client.query('COMMIT');
        applied.push(file);
        logger.info({ migration: file }, 'Successfully applied database migration');
      } catch (migrationError) {
        await client.query('ROLLBACK');
        logger.error({ migration: file, err: migrationError }, 'Failed to apply migration, transaction rolled back');
        throw migrationError;
      }
    }

    return { applied, alreadyApplied };
  } finally {
    client.release();
  }
}

// Support CLI execution: tsx src/migrations/runner.ts
if (require.main === module) {
  runMigrations()
    .then((result) => {
      logger.info({ result }, 'Migration execution completed');
      return closeDatabase();
    })
    .then(() => {
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error({ err }, 'Migration execution failed');
      try {
        await closeDatabase();
      } catch {
        // ignore
      }
      process.exit(1);
    });
}
