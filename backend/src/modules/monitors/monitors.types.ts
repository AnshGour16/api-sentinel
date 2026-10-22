export type HttpMethod = 'GET' | 'HEAD';

export interface MonitorRow {
  id: string;
  user_id: string;
  name: string;
  target_url: string;
  method: string;
  interval_seconds: number;
  timeout_ms: number;
  expected_status_min: number;
  expected_status_max: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MonitorResponse {
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
}

export interface CreateMonitorInput {
  name: string;
  targetUrl: string;
  method?: HttpMethod;
  intervalSeconds?: number;
  timeoutMs?: number;
  expectedStatusMin?: number;
  expectedStatusMax?: number;
  isActive?: boolean;
}

export interface UpdateMonitorInput {
  name?: string;
  targetUrl?: string;
  method?: HttpMethod;
  intervalSeconds?: number;
  timeoutMs?: number;
  expectedStatusMin?: number;
  expectedStatusMax?: number;
  isActive?: boolean;
}

export interface ListMonitorsFilter {
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export function toMonitorResponse(row: MonitorRow): MonitorResponse {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    targetUrl: row.target_url,
    method: row.method as HttpMethod,
    intervalSeconds: row.interval_seconds,
    timeoutMs: row.timeout_ms,
    expectedStatusMin: row.expected_status_min,
    expectedStatusMax: row.expected_status_max,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
