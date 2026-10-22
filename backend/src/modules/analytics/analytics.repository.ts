import { query } from '../../lib/db';
import { CheckRecord } from '../checks/checks.types';
import { CheckHistoryFilter, LatencyChartPoint } from './analytics.types';

export interface AggregateQueryResult {
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
  p99_latency_ms: number | null;
}

export class AnalyticsRepository {
  async getAggregates(
    monitorId: string,
    from: Date,
    to: Date = new Date()
  ): Promise<AggregateQueryResult> {
    const text = `
      SELECT
        COUNT(*)::int AS total_checks,
        COUNT(*) FILTER (WHERE outcome = 'success')::int AS successful_checks,
        COUNT(*) FILTER (WHERE outcome != 'success')::int AS failed_checks,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms)::numeric, 1)::float AS p50_latency_ms,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::numeric, 1)::float AS p95_latency_ms,
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::numeric, 1)::float AS p99_latency_ms
      FROM monitor_checks
      WHERE monitor_id = $1
        AND checked_at >= $2
        AND checked_at <= $3
    `;

    const result = await query<AggregateQueryResult>(text, [monitorId, from, to]);
    return (
      result.rows[0] || {
        total_checks: 0,
        successful_checks: 0,
        failed_checks: 0,
        p50_latency_ms: null,
        p95_latency_ms: null,
        p99_latency_ms: null,
      }
    );
  }

  async getChartPoints(
    monitorId: string,
    from: Date,
    to: Date = new Date(),
    limit = 100
  ): Promise<LatencyChartPoint[]> {
    const text = `
      SELECT
        id,
        checked_at,
        latency_ms,
        status_code,
        outcome
      FROM monitor_checks
      WHERE monitor_id = $1
        AND checked_at >= $2
        AND checked_at <= $3
      ORDER BY checked_at ASC
      LIMIT $4
    `;

    const result = await query<{
      id: string;
      checked_at: Date;
      latency_ms: number | null;
      status_code: number | null;
      outcome: any;
    }>(text, [monitorId, from, to, limit]);

    return result.rows.map((row) => ({
      id: row.id,
      timestamp: row.checked_at.toISOString(),
      latencyMs: row.latency_ms,
      statusCode: row.status_code,
      outcome: row.outcome,
    }));
  }

  async getPaginatedChecks(
    monitorId: string,
    filter: CheckHistoryFilter = {}
  ): Promise<{ checks: CheckRecord[]; total: number }> {
    const conditions: string[] = ['monitor_id = $1'];
    const values: (string | number | Date)[] = [monitorId];

    if (filter.outcome) {
      values.push(filter.outcome);
      conditions.push(`outcome = $${values.length}`);
    }

    if (filter.from) {
      values.push(filter.from);
      conditions.push(`checked_at >= $${values.length}`);
    }

    if (filter.to) {
      values.push(filter.to);
      conditions.push(`checked_at <= $${values.length}`);
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM monitor_checks WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Paginated rows
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    values.push(limit);
    const limitIdx = values.length;
    values.push(offset);
    const offsetIdx = values.length;

    const result = await query<CheckRecord>(
      `SELECT * FROM monitor_checks
       WHERE ${whereClause}
       ORDER BY checked_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      values
    );

    return {
      checks: result.rows,
      total,
    };
  }
}

export const analyticsRepository = new AnalyticsRepository();
