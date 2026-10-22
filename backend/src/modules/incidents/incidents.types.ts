export type IncidentStatus = 'open' | 'resolved';

export interface IncidentRecord {
  id: string;
  monitor_id: string;
  status: IncidentStatus;
  started_at: Date;
  resolved_at: Date | null;
  failure_count: number;
  last_failure_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface IncidentResponse {
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

export type IncidentTransitionType = 'opened' | 'updated' | 'resolved' | 'none';

export interface IncidentTransitionResult {
  incident: IncidentRecord | null;
  transitionType: IncidentTransitionType;
}

export function toIncidentResponse(record: IncidentRecord): IncidentResponse {
  return {
    id: record.id,
    monitorId: record.monitor_id,
    status: record.status,
    startedAt: record.started_at.toISOString(),
    resolvedAt: record.resolved_at ? record.resolved_at.toISOString() : null,
    failureCount: record.failure_count,
    lastFailureAt: record.last_failure_at ? record.last_failure_at.toISOString() : null,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
  };
}
