import { NotFoundError } from '../../lib/errors';
import { monitorsRepository } from '../monitors/monitors.repository';
import {
  analyticsRepository,
  AnalyticsRepository,
} from './analytics.repository';
import {
  AnalyticsSummary,
  CheckHistoryFilter,
  CheckHistoryItem,
  PaginatedCheckHistory,
} from './analytics.types';

export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository = analyticsRepository) {}

  private calculateWindowDate(window: string, now: Date): Date {
    const from = new Date(now);
    switch (window) {
      case '1h':
        from.setHours(from.getHours() - 1);
        break;
      case '7d':
        from.setDate(from.getDate() - 7);
        break;
      case '30d':
        from.setDate(from.getDate() - 30);
        break;
      case '24h':
      default:
        from.setHours(from.getHours() - 24);
        break;
    }
    return from;
  }

  async getAnalytics(
    monitorId: string,
    userId: string,
    timeWindow = '24h'
  ): Promise<AnalyticsSummary> {
    // 1. Verify monitor exists and belongs to the authenticated user
    const monitor = await monitorsRepository.findByIdAndUserId(monitorId, userId);
    if (!monitor) {
      throw new NotFoundError(`Monitor with ID "${monitorId}" was not found`);
    }

    const now = new Date();
    const from = this.calculateWindowDate(timeWindow, now);

    // 2. Query aggregate metrics
    const aggregates = await this.repo.getAggregates(monitorId, from, now);
    const hasData = aggregates.total_checks > 0;

    // 3. Precise metric definitions per Section 9 of backend.md
    // - Uptime: successful checks / all completed checks in the window
    // - Error rate: failed checks / all completed checks in the window
    // - If total is 0, return null (explicit insufficient data result)
    const uptimePercentage = hasData
      ? Math.round((aggregates.successful_checks / aggregates.total_checks) * 10000) / 100
      : null;

    const errorRate = hasData
      ? Math.round((aggregates.failed_checks / aggregates.total_checks) * 10000) / 10000
      : null;

    // 4. Query recent latency chart points
    const recentPoints = await this.repo.getChartPoints(monitorId, from, now, 100);

    return {
      monitorId,
      timeWindow,
      from: from.toISOString(),
      to: now.toISOString(),
      totalChecks: aggregates.total_checks,
      successfulChecks: aggregates.successful_checks,
      failedChecks: aggregates.failed_checks,
      uptimePercentage,
      errorRate,
      p50LatencyMs: aggregates.p50_latency_ms,
      p95LatencyMs: aggregates.p95_latency_ms,
      p99LatencyMs: aggregates.p99_latency_ms,
      hasSufficientData: hasData,
      recentPoints,
    };
  }

  async getCheckHistory(
    monitorId: string,
    userId: string,
    filter: CheckHistoryFilter = {}
  ): Promise<PaginatedCheckHistory> {
    const monitor = await monitorsRepository.findByIdAndUserId(monitorId, userId);
    if (!monitor) {
      throw new NotFoundError(`Monitor with ID "${monitorId}" was not found`);
    }

    const { checks, total } = await this.repo.getPaginatedChecks(monitorId, filter);

    const items: CheckHistoryItem[] = checks.map((c) => ({
      id: c.id,
      monitorId: c.monitor_id,
      executionId: c.execution_id,
      statusCode: c.status_code,
      latencyMs: c.latency_ms,
      outcome: c.outcome,
      errorCode: c.error_code,
      checkedAt: c.checked_at.toISOString(),
      completedAt: c.completed_at ? c.completed_at.toISOString() : null,
    }));

    return {
      checks: items,
      pagination: {
        total,
        limit: filter.limit ?? 50,
        offset: filter.offset ?? 0,
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
