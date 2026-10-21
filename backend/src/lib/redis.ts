import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 5) {
      return null; // Stop retrying after 5 attempts
    }
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => {
  logger.warn({ err: err.message }, 'Redis client connection error');
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

export interface RedisHealth {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export async function checkRedisHealth(): Promise<RedisHealth> {
  const start = process.hrtime.bigint();
  try {
    if (redis.status === 'wait') {
      await redis.connect();
    }

    const pongPromise = redis.ping();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis ping timed out after 2000ms')), 2000)
    );

    const response = await Promise.race([pongPromise, timeoutPromise]);
    if (response !== 'PONG') {
      return {
        healthy: false,
        error: `Unexpected response from Redis: ${response}`,
      };
    }

    const durationMs = Math.round(Number(process.hrtime.bigint() - start) / 1_000_000);
    return {
      healthy: true,
      latencyMs: durationMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Redis error';
    logger.warn({ err: message }, 'Redis health check failed');
    return {
      healthy: false,
      error: message,
    };
  }
}

export async function closeRedis(): Promise<void> {
  logger.info('Closing Redis connection...');
  try {
    if (redis.status !== 'end' && redis.status !== 'wait') {
      await redis.quit();
    }
  } catch (err) {
    redis.disconnect();
  }
  logger.info('Redis connection closed');
}
