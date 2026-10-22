import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { analyticsRepository } from '../src/modules/analytics/analytics.repository';
import { monitorsRepository } from '../src/modules/monitors/monitors.repository';
import { authService } from '../src/modules/auth/auth.service';
import { MonitorRow } from '../src/modules/monitors/monitors.types';

describe('Analytics & Check History API', () => {
  const monitorId = '11111111-1111-4111-a111-111111111111';
  const ownerUser = {
    id: 'user-owner-111',
    email: 'owner@example.com',
    name: 'Owner',
    created_at: new Date('2026-01-01T00:00:00Z'),
  };
  const otherUser = {
    id: 'user-other-222',
    email: 'other@example.com',
    name: 'Other',
    created_at: new Date('2026-01-01T00:00:00Z'),
  };

  const ownerToken = authService.generateToken(ownerUser);
  const otherToken = authService.generateToken(otherUser);

  const mockMonitor: MonitorRow = {
    id: monitorId,
    user_id: ownerUser.id,
    name: 'Production API',
    target_url: 'https://api.example.com',
    method: 'GET',
    interval_seconds: 60,
    timeout_ms: 5000,
    expected_status_min: 200,
    expected_status_max: 299,
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/v1/monitors/:id/analytics', () => {
    it('calculates uptime, error rate, and percentiles accurately when check data exists', async () => {
      vi.spyOn(monitorsRepository, 'findByIdAndUserId').mockResolvedValue(mockMonitor);

      vi.spyOn(analyticsRepository, 'getAggregates').mockResolvedValue({
        total_checks: 1000,
        successful_checks: 990,
        failed_checks: 10,
        p50_latency_ms: 45.2,
        p95_latency_ms: 120.5,
        p99_latency_ms: 245.0,
      });

      vi.spyOn(analyticsRepository, 'getChartPoints').mockResolvedValue([
        {
          id: 'point-1',
          timestamp: new Date().toISOString(),
          latencyMs: 42,
          statusCode: 200,
          outcome: 'success',
        },
      ]);

      const response = await request(app)
        .get(`/api/v1/monitors/${monitorId}/analytics?window=24h`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          monitorId,
          timeWindow: '24h',
          totalChecks: 1000,
          successfulChecks: 990,
          failedChecks: 10,
          uptimePercentage: 99.0, // (990 / 1000) * 100
          errorRate: 0.01, // 10 / 1000
          p50LatencyMs: 45.2,
          p95LatencyMs: 120.5,
          p99LatencyMs: 245.0,
          hasSufficientData: true,
        })
      );
      expect(response.body.recentPoints.length).toBe(1);
    });

    it('returns null metrics when totalChecks is 0 (insufficient data)', async () => {
      vi.spyOn(monitorsRepository, 'findByIdAndUserId').mockResolvedValue(mockMonitor);

      vi.spyOn(analyticsRepository, 'getAggregates').mockResolvedValue({
        total_checks: 0,
        successful_checks: 0,
        failed_checks: 0,
        p50_latency_ms: null,
        p95_latency_ms: null,
        p99_latency_ms: null,
      });

      vi.spyOn(analyticsRepository, 'getChartPoints').mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/v1/monitors/${monitorId}/analytics?window=1h`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalChecks).toBe(0);
      expect(response.body.uptimePercentage).toBeNull();
      expect(response.body.errorRate).toBeNull();
      expect(response.body.p50LatencyMs).toBeNull();
      expect(response.body.hasSufficientData).toBe(false);
    });

    it('returns 404 NOT_FOUND when unauthorized user attempts to view analytics', async () => {
      vi.spyOn(monitorsRepository, 'findByIdAndUserId').mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/monitors/${monitorId}/analytics`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/monitors/:id/checks (Check History API)', () => {
    it('returns paginated check history for monitor owner', async () => {
      vi.spyOn(monitorsRepository, 'findByIdAndUserId').mockResolvedValue(mockMonitor);

      const mockChecks = [
        {
          id: 'check-1',
          monitor_id: monitorId,
          execution_id: 'exec-1',
          status_code: 200,
          latency_ms: 50,
          outcome: 'success' as const,
          error_code: null,
          checked_at: new Date('2026-01-01T10:00:00Z'),
          completed_at: new Date('2026-01-01T10:00:01Z'),
          created_at: new Date(),
        },
      ];

      vi.spyOn(analyticsRepository, 'getPaginatedChecks').mockResolvedValue({
        checks: mockChecks,
        total: 1,
      });

      const response = await request(app)
        .get(`/api/v1/monitors/${monitorId}/checks?limit=10&offset=0&outcome=success`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.checks.length).toBe(1);
      expect(response.body.checks[0].id).toBe('check-1');
      expect(response.body.checks[0].statusCode).toBe(200);
      expect(response.body.pagination).toEqual({
        total: 1,
        limit: 10,
        offset: 0,
      });
    });

    it('returns 404 NOT_FOUND for unauthorized access to check history', async () => {
      vi.spyOn(monitorsRepository, 'findByIdAndUserId').mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/monitors/${monitorId}/checks`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
      const response = await request(app).get(`/api/v1/monitors/${monitorId}/checks`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
