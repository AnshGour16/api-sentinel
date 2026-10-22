import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env';
import { logger } from './logger';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = process.hrtime.bigint();
  const res = await pool.query<T>(text, params);
  const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

  logger.debug({ query: text, durationMs, rows: res.rowCount }, 'Executed PostgreSQL query');
  return res;
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface DatabaseHealth {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const start = process.hrtime.bigint();
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1 AS ok;');
      const durationMs = Math.round(Number(process.hrtime.bigint() - start) / 1_000_000);
      return {
        healthy: true,
        latencyMs: durationMs,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    logger.warn({ err: error }, 'PostgreSQL health check failed');
    return {
      healthy: false,
      error: message,
    };
  }
}

export async function closeDatabase(): Promise<void> {
  logger.info('Closing PostgreSQL connection pool...');
  await pool.end();
  logger.info('PostgreSQL connection pool closed');
}
