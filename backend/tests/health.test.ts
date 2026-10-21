import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import * as dbModule from '../src/lib/db';
import * as redisModule from '../src/lib/redis';

describe('Health and Readiness Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /health/live', () => {
    it('should return 200 OK with liveness status and correlation ID header', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.headers).toHaveProperty('x-request-id');
    });

    it('should preserve incoming X-Request-Id header', async () => {
      const customId = 'test-request-id-12345';
      const response = await request(app)
        .get('/health/live')
        .set('X-Request-Id', customId);

      expect(response.status).toBe(200);
      expect(response.headers['x-request-id']).toBe(customId);
    });

    it('should also respond at /api/v1/health/live', async () => {
      const response = await request(app).get('/api/v1/health/live');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 OK when both PostgreSQL and Redis are healthy', async () => {
      vi.spyOn(dbModule, 'checkDatabaseHealth').mockResolvedValue({
        healthy: true,
        latencyMs: 3,
      });
      vi.spyOn(redisModule, 'checkRedisHealth').mockResolvedValue({
        healthy: true,
        latencyMs: 1,
      });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        checks: {
          database: { status: 'healthy', latencyMs: 3 },
          redis: { status: 'healthy', latencyMs: 1 },
        },
        timestamp: expect.any(String),
      });
    });

    it('should return 503 Service Unavailable when PostgreSQL is unhealthy', async () => {
      vi.spyOn(dbModule, 'checkDatabaseHealth').mockResolvedValue({
        healthy: false,
        error: 'connection refused to 127.0.0.1:5432',
      });
      vi.spyOn(redisModule, 'checkRedisHealth').mockResolvedValue({
        healthy: true,
        latencyMs: 1,
      });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.checks.database.status).toBe('unhealthy');
      expect(response.body.checks.database.error).toBe('connection refused to 127.0.0.1:5432');
      expect(response.body.checks.redis.status).toBe('healthy');
    });

    it('should return 503 Service Unavailable when Redis is unhealthy', async () => {
      vi.spyOn(dbModule, 'checkDatabaseHealth').mockResolvedValue({
        healthy: true,
        latencyMs: 2,
      });
      vi.spyOn(redisModule, 'checkRedisHealth').mockResolvedValue({
        healthy: false,
        error: 'Redis ping timed out after 2000ms',
      });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.checks.database.status).toBe('healthy');
      expect(response.body.checks.redis.status).toBe('unhealthy');
      expect(response.body.checks.redis.error).toBe('Redis ping timed out after 2000ms');
    });

    it('should return 503 Service Unavailable when both dependencies are unhealthy', async () => {
      vi.spyOn(dbModule, 'checkDatabaseHealth').mockResolvedValue({
        healthy: false,
        error: 'database down',
      });
      vi.spyOn(redisModule, 'checkRedisHealth').mockResolvedValue({
        healthy: false,
        error: 'redis down',
      });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.checks.database.status).toBe('unhealthy');
      expect(response.body.checks.redis.status).toBe('unhealthy');
    });
  });

  describe('Route Not Found (404)', () => {
    it('should return standardized 404 error JSON for unknown paths', async () => {
      const response = await request(app).get('/non-existent-endpoint');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Route GET /non-existent-endpoint not found',
        },
      });
    });
  });
});
