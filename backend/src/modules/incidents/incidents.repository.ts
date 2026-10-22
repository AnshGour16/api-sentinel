import { PoolClient, QueryResult } from 'pg';
import { query } from '../../lib/db';
import { IncidentRecord } from './incidents.types';

export class IncidentsRepository {
  private async executeQuery<T extends object>(
    text: string,
    params: unknown[],
    client?: PoolClient
  ): Promise<QueryResult<T>> {
    if (client) {
      return client.query<T>(text, params);
    }
    return query<T>(text, params);
  }

  async findActiveByMonitorId(
    monitorId: string,
    client?: PoolClient
  ): Promise<IncidentRecord | null> {
    const text = `
      SELECT * FROM incidents
      WHERE monitor_id = $1 AND status != 'resolved'
      LIMIT 1
      ${client ? 'FOR UPDATE' : ''}
    `;
    const result = await this.executeQuery<IncidentRecord>(text, [monitorId], client);
    return result.rows[0] || null;
  }

  async createIncident(
    monitorId: string,
    startedAt: Date = new Date(),
    client?: PoolClient
  ): Promise<IncidentRecord> {
    const text = `
      INSERT INTO incidents (
        monitor_id,
        status,
        started_at,
        failure_count,
        last_failure_at
      )
      VALUES ($1, 'open', $2, 1, $2)
      ON CONFLICT (monitor_id) WHERE status != 'resolved'
      DO UPDATE SET
        failure_count = incidents.failure_count + 1,
        last_failure_at = EXCLUDED.last_failure_at,
        updated_at = NOW()
      RETURNING *
    `;
    const result = await this.executeQuery<IncidentRecord>(text, [monitorId, startedAt], client);
    return result.rows[0];
  }

  async incrementFailure(
    incidentId: string,
    failureAt: Date = new Date(),
    client?: PoolClient
  ): Promise<IncidentRecord | null> {
    const text = `
      UPDATE incidents
      SET failure_count = failure_count + 1,
          last_failure_at = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await this.executeQuery<IncidentRecord>(text, [failureAt, incidentId], client);
    return result.rows[0] || null;
  }

  async resolveIncident(
    incidentId: string,
    resolvedAt: Date = new Date(),
    client?: PoolClient
  ): Promise<IncidentRecord | null> {
    const text = `
      UPDATE incidents
      SET status = 'resolved',
          resolved_at = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await this.executeQuery<IncidentRecord>(text, [resolvedAt, incidentId], client);
    return result.rows[0] || null;
  }

  async findByMonitorId(
    monitorId: string,
    limit = 50,
    offset = 0
  ): Promise<{ incidents: IncidentRecord[]; total: number }> {
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*)::text as count FROM incidents WHERE monitor_id = $1',
      [monitorId]
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    const result = await query<IncidentRecord>(
      `SELECT * FROM incidents
       WHERE monitor_id = $1
       ORDER BY started_at DESC
       LIMIT $2 OFFSET $3`,
      [monitorId, limit, offset]
    );

    return {
      incidents: result.rows,
      total,
    };
  }
}

export const incidentsRepository = new IncidentsRepository();
