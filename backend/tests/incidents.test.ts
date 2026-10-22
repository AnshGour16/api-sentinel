import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { incidentsService } from '../src/modules/incidents/incidents.service';
import { incidentsRepository } from '../src/modules/incidents/incidents.repository';
import { monitorsRepository } from '../src/modules/monitors/monitors.repository';
import { authService } from '../src/modules/auth/auth.service';
import { IncidentRecord } from '../src/modules/incidents/incidents.types';
import { MonitorRow } from '../src/modules/monitors/monitors.types';

describe('Incidents Module & Lifecycle State Machine', () => {
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
    name: 'Production Service',
    target_url: 'https://api.example.com/health',
    method: 'GET',
    interval_seconds: 60,
    timeout_ms: 5000,
    expected_status_min: 200,
    expected_status_max: 299,
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };

  const openIncident: IncidentRecord = {
    id: 'incident-abc-123',
    monitor_id: monitorId,
    status: 'open',
    started_at: new Date('2026-01-01T12:00:00Z'),
    resolved_at: null,
    failure_count: 1,
    last_failure_at: new Date('2026-01-01T12:00:00Z'),
    created_at: new Date('2026-01-01T12:00:00Z'),
    updated_at: new Date('2026-01-01T12:00:00Z'),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Incident State Transitions', () => {
    it('creates a new open incident on first failure (transition: opened)', async () => {
      // No active incident currently
      vi.spyOn(incidentsRepository, 'findActiveByMonitorId').mockResolvedValue(null);
      const createSpy = vi.spyOn(incidentsRepository, 'createIncident').mockResolvedValue(openIncident);

      const result = await incidentsService.processCheckOutcome(monitorId, 'http_error');

      expect(result.transitionType).toBe('opened');
      expect(result.incident?.id).toBe(openIncident.id);
      expect(result.incident?.status).toBe('open');
      expect(createSpy).toHaveBeenCalledWith(monitorId, expect.any(Date), undefined);
    });

    it('increments failure_count on subsequent failure (transition: updated)', async () => {
      // Active incident already exists
      vi.spyOn(incidentsRepository, 'findActiveByMonitorId').mockResolvedValue(openIncident);
      const updatedIncident: IncidentRecord = {
        ...openIncident,
        failure_count: 2,
        last_failure_at: new Date(),
      };
      const incrementSpy = vi.spyOn(incidentsRepository, 'incrementFailure').mockResolvedValue(updatedIncident);

      const result = await incidentsService.processCheckOutcome(monitorId, 'timeout');

      expect(result.transitionType).toBe('updated');
      expect(result.incident?.failure_count).toBe(2);
      expect(incrementSpy).toHaveBeenCalledWith(openIncident.id, expect.any(Date), undefined);
    });

    it('resolves active incident when check succeeds (transition: resolved)', async () => {
      // Active incident exists
      vi.spyOn(incidentsRepository, 'findActiveByMonitorId').mockResolvedValue(openIncident);
      const resolvedIncident: IncidentRecord = {
        ...openIncident,
        status: 'resolved',
        resolved_at: new Date(),
      };
      const resolveSpy = vi.spyOn(incidentsRepository, 'resolveIncident').mockResolvedValue(resolvedIncident);

      const result = await incidentsService.processCheckOutcome(monitorId, 'success');

      expect(result.transitionType).toBe('resolved');
      expect(result.incident?.status).toBe('resolved');
      expect(result.incident?.resolved_at).not.toBeNull();
      expect(resolveSpy).toHaveBeenCalledWith(openIncident.id, expect.any(Date), undefined);
    });

    it('returns transition: none when check succeeds and monitor is already healthy', async () => {
      // No active incident
      vi.spyOn(incidentsRepository, 'findActiveByMonitorId').mockResolvedValue(null);
      const resolveSpy = vi.spyOn(incidentsRepository, 'resolveIncident');

      const result = await incidentsService.processCheckOutcome(monitorId, 'success');

      expect(result.transitionType).toBe('none');
      expect(result.incident).toBeNull();
      expect(resolveSpy).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/monitors/:id/incidents (Incident History API)', () => {
    it('returns 200 and incident list for monitor owner', async () => {
      vi.spyOn(monitorsRepository, 'findByIdAndUserId').mockResolvedValue(mockMonitor);
      vi.spyOn(incidentsRepository, 'findByMonitorId').mockResolvedValue({
        incidents: [openIncident],
        total: 1,
      });

      const response = await request(app)
        .get(`/api/v1/monitors/${monitorId}/incidents`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.incidents.length).toBe(1);
      expect(response.body.incidents[0].id).toBe(openIncident.id);
      expect(response.body.incidents[0].monitorId).toBe(monitorId);
      expect(response.body.total).toBe(1);
    });

    it('returns 404 NOT_FOUND when unauthorized user attempts to view incidents', async () => {
      // Monitor repository returns null because user_id does not match otherUser
      vi.spyOn(monitorsRepository, 'findByIdAndUserId').mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/monitors/${monitorId}/incidents`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 401 UNAUTHORIZED when no token is supplied', async () => {
      const response = await request(app).get(`/api/v1/monitors/${monitorId}/incidents`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
