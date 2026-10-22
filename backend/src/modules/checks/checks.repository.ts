import { query } from '../../lib/db';
import { MonitorRow } from '../monitors/monitors.types';
import { CheckRecord, SaveCheckInput } from './checks.types';

export class ChecksRepository {
  async saveCheck(input: SaveCheckInput): Promise<CheckRecord> {
    const text = `
      INSERT INTO monitor_checks (
        monitor_id,
        execution_id,
        status_code,
        latency_ms,
        outcome,
        error_code,
        checked_at,
        completed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (execution_id) WHERE execution_id IS NOT NULL DO NOTHING
      RETURNING *
    `;

    const values = [
      input.monitorId,
      input.executionId,
      input.statusCode ?? null,
      input.latencyMs ?? null,
      input.outcome,
      input.errorCode ?? null,
      input.checkedAt || new Date(),
      input.completedAt || new Date(),
    ];

    const result = await query<CheckRecord>(text, values);

    // If a duplicate delivery occurred, fetch and return the already recorded check
    if (result.rows.length === 0) {
      const existing = await this.findByExecutionId(input.executionId);
      if (existing) {
        return existing;
      }
    }

    return result.rows[0];
  }

  async findByExecutionId(executionId: string): Promise<CheckRecord | null> {
    const result = await query<CheckRecord>(
      'SELECT * FROM monitor_checks WHERE execution_id = $1',
      [executionId]
    );
    return result.rows[0] || null;
  }

  async findDueMonitors(batchSize = 100): Promise<MonitorRow[]> {
    const text = `
      SELECT * FROM monitors
      WHERE is_active = true
        AND (last_checked_at IS NULL OR last_checked_at <= NOW() - (interval_seconds || ' seconds')::INTERVAL)
      ORDER BY last_checked_at ASC NULLS FIRST
      LIMIT $1
    `;
    const result = await query<MonitorRow>(text, [batchSize]);
    return result.rows;
  }

  async updateLastCheckedAt(monitorId: string, checkedAt: Date = new Date()): Promise<void> {
    await query(
      'UPDATE monitors SET last_checked_at = $1 WHERE id = $2',
      [checkedAt, monitorId]
    );
  }

  async findRecentChecks(monitorId: string, limit = 50): Promise<CheckRecord[]> {
    const result = await query<CheckRecord>(
      'SELECT * FROM monitor_checks WHERE monitor_id = $1 ORDER BY checked_at DESC LIMIT $2',
      [monitorId, limit]
    );
    return result.rows;
  }
}

export const checksRepository = new ChecksRepository();
