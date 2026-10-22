import { query } from '../../lib/db';
import {
  CreateMonitorInput,
  ListMonitorsFilter,
  MonitorRow,
  UpdateMonitorInput,
} from './monitors.types';

export class MonitorsRepository {
  async create(userId: string, input: CreateMonitorInput): Promise<MonitorRow> {
    const text = `
      INSERT INTO monitors (
        user_id,
        name,
        target_url,
        method,
        interval_seconds,
        timeout_ms,
        expected_status_min,
        expected_status_max,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      userId,
      input.name,
      input.targetUrl,
      input.method || 'GET',
      input.intervalSeconds ?? 60,
      input.timeoutMs ?? 5000,
      input.expectedStatusMin ?? 200,
      input.expectedStatusMax ?? 299,
      input.isActive ?? true,
    ];

    const result = await query<MonitorRow>(text, values);
    return result.rows[0];
  }

  async findByUserId(
    userId: string,
    filter: ListMonitorsFilter = {}
  ): Promise<{ monitors: MonitorRow[]; total: number }> {
    const conditions: string[] = ['user_id = $1'];
    const values: (string | number | boolean)[] = [userId];

    if (filter.isActive !== undefined) {
      values.push(filter.isActive);
      conditions.push(`is_active = $${values.length}`);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM monitors WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get paginated rows
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    values.push(limit);
    const limitIdx = values.length;
    values.push(offset);
    const offsetIdx = values.length;

    const dataResult = await query<MonitorRow>(
      `SELECT * FROM monitors
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      values
    );

    return {
      monitors: dataResult.rows,
      total,
    };
  }

  async findById(id: string): Promise<MonitorRow | null> {
    const result = await query<MonitorRow>(
      'SELECT * FROM monitors WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<MonitorRow | null> {
    const result = await query<MonitorRow>(
      'SELECT * FROM monitors WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rows[0] || null;
  }

  async update(
    id: string,
    userId: string,
    input: UpdateMonitorInput
  ): Promise<MonitorRow | null> {
    const updates: string[] = [];
    const values: (string | number | boolean)[] = [id, userId];

    if (input.name !== undefined) {
      values.push(input.name);
      updates.push(`name = $${values.length}`);
    }
    if (input.targetUrl !== undefined) {
      values.push(input.targetUrl);
      updates.push(`target_url = $${values.length}`);
    }
    if (input.method !== undefined) {
      values.push(input.method);
      updates.push(`method = $${values.length}`);
    }
    if (input.intervalSeconds !== undefined) {
      values.push(input.intervalSeconds);
      updates.push(`interval_seconds = $${values.length}`);
    }
    if (input.timeoutMs !== undefined) {
      values.push(input.timeoutMs);
      updates.push(`timeout_ms = $${values.length}`);
    }
    if (input.expectedStatusMin !== undefined) {
      values.push(input.expectedStatusMin);
      updates.push(`expected_status_min = $${values.length}`);
    }
    if (input.expectedStatusMax !== undefined) {
      values.push(input.expectedStatusMax);
      updates.push(`expected_status_max = $${values.length}`);
    }
    if (input.isActive !== undefined) {
      values.push(input.isActive);
      updates.push(`is_active = $${values.length}`);
    }

    if (updates.length === 0) {
      return this.findByIdAndUserId(id, userId);
    }

    updates.push('updated_at = NOW()');

    const text = `
      UPDATE monitors
      SET ${updates.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await query<MonitorRow>(text, values);
    return result.rows[0] || null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await query<{ id: string }>(
      'DELETE FROM monitors WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async setActiveState(
    id: string,
    userId: string,
    isActive: boolean
  ): Promise<MonitorRow | null> {
    const result = await query<MonitorRow>(
      `UPDATE monitors
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [isActive, id, userId]
    );
    return result.rows[0] || null;
  }
}

export const monitorsRepository = new MonitorsRepository();
