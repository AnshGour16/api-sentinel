export interface LivenessResponse {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

export interface DependencyCheck {
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}

export interface ReadinessResponse {
  status: 'ok' | 'unhealthy';
  checks: {
    database: DependencyCheck;
    redis: DependencyCheck;
  };
  timestamp: string;
}
