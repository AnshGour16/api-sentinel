import { CheckOutcome } from '../checks/checks.types';

export interface AnalyticsSummary {
  monitorId: string;
  timeWindow: string; // '1h' | '24h' | '7d' | '30d'
  from: string;
  to: string;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  uptimePercentage: number | null; // e.g. 99.85
  errorRate: number | null; // e.g. 0.0015
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  hasSufficientData: boolean;
  recentPoints: LatencyChartPoint[];
}

export interface LatencyChartPoint {
  id: string;
  timestamp: string;
  latencyMs: number | null;
  statusCode: number | null;
  outcome: CheckOutcome;
}

export interface CheckHistoryItem {
  id: string;
  monitorId: string;
  executionId: string | null;
  statusCode: number | null;
  latencyMs: number | null;
  outcome: CheckOutcome;
  errorCode: string | null;
  checkedAt: string;
  completedAt: string | null;
}

export interface PaginatedCheckHistory {
  checks: CheckHistoryItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface CheckHistoryFilter {
  outcome?: CheckOutcome;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}
