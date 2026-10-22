export type CheckOutcome =
  | 'success'
  | 'http_error'
  | 'timeout'
  | 'network_error'
  | 'invalid_response';

export interface CheckRecord {
  id: string;
  monitor_id: string;
  execution_id: string | null;
  status_code: number | null;
  latency_ms: number | null;
  outcome: CheckOutcome;
  error_code: string | null;
  checked_at: Date;
  completed_at: Date | null;
  created_at: Date;
}

export interface SaveCheckInput {
  monitorId: string;
  executionId: string;
  statusCode?: number | null;
  latencyMs?: number | null;
  outcome: CheckOutcome;
  errorCode?: string | null;
  checkedAt?: Date;
  completedAt?: Date;
}

export interface MonitorCheckJob {
  monitorId: string;
  scheduledAt: string;
  executionId: string;
}
