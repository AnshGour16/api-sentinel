export type HttpMethod = 'GET' | 'HEAD';

export type CheckOutcome =
  | 'success'
  | 'http_error'
  | 'timeout'
  | 'network_error'
  | 'invalid_response';

export type IncidentStatus = 'open' | 'resolved';

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface Monitor {
  id: string;
  userId: string;
  name: string;
  targetUrl: string;
  method: HttpMethod;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatusMin: number;
  expectedStatusMax: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed client-side from real-time events or initial checks
  lastCheck?: CheckRecord;
  status?: 'healthy' | 'unhealthy' | 'paused';
}

export interface CheckRecord {
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

export interface Incident {
  id: string;
  monitorId: string;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt: string | null;
  failureCount: number;
  lastFailureAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LatencyChartPoint {
  id: string;
  timestamp: string;
  latencyMs: number | null;
  statusCode: number | null;
  outcome: CheckOutcome;
}

export interface AnalyticsSummary {
  monitorId: string;
  timeWindow: string;
  from: string;
  to: string;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  uptimePercentage: number | null;
  errorRate: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  hasSufficientData: boolean;
  recentPoints: LatencyChartPoint[];
}

export interface CreateMonitorPayload {
  name: string;
  targetUrl: string;
  method: HttpMethod;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatusMin: number;
  expectedStatusMax: number;
}
