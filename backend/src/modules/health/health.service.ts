import { checkDatabaseHealth } from '../../lib/db';
import { checkRedisHealth } from '../../lib/redis';
import { LivenessResponse, ReadinessResponse } from './health.types';

export class HealthService {
  public getLiveness(): LivenessResponse {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime() * 100) / 100,
      timestamp: new Date().toISOString(),
    };
  }

  public async getReadiness(): Promise<ReadinessResponse> {
    const [dbResult, redisResult] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const isDbHealthy = dbResult.healthy;
    const isRedisHealthy = redisResult.healthy;
    const allHealthy = isDbHealthy && isRedisHealthy;

    return {
      status: allHealthy ? 'ok' : 'unhealthy',
      checks: {
        database: {
          status: isDbHealthy ? 'healthy' : 'unhealthy',
          ...(dbResult.latencyMs !== undefined ? { latencyMs: dbResult.latencyMs } : {}),
          ...(dbResult.error ? { error: dbResult.error } : {}),
        },
        redis: {
          status: isRedisHealthy ? 'healthy' : 'unhealthy',
          ...(redisResult.latencyMs !== undefined ? { latencyMs: redisResult.latencyMs } : {}),
          ...(redisResult.error ? { error: redisResult.error } : {}),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const healthService = new HealthService();
