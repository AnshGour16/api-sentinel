import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { authService } from '../src/modules/auth/auth.service';
import { monitorsRepository } from '../src/modules/monitors/monitors.repository';
import { MonitorRow } from '../src/modules/monitors/monitors.types';

describe('Monitors Module & Ownership API', () => {
  const user1 = {
    id: '11111111-1111-4111-a111-111111111111',
    email: 'user1@example.com',
    name: 'User One',
    created_at: new Date('2026-01-01T00:00:00Z'),
  };

  const user2 = {
    id: '22222222-2222-4222-a222-222222222222',
    email: 'user2@example.com',
    name: 'User Two',
    created_at: new Date('2026-01-01T00:00:00Z'),
  };

  const tokenUser1 = authService.generateToken(user1);
  const tokenUser2 = authService.generateToken(user2);

  const mockMonitorRowUser1: MonitorRow = {
    id: '99999999-9999-4999-a999-999999999999',
    user_id: user1.id,
    name: 'Production Health API',
    target_url: 'https://api.github.com/zen',
    method: 'GET',
    interval_seconds: 60,
    timeout_ms: 5000,
    expected_status_min: 200,
    expected_status_max: 299,
    is_active: true,
    created_at: new Date('2026-01-01T12:00:00Z'),
    updated_at: new Date('2026-01-01T12:00:00Z'),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication Enforcement', () => {
    it('returns 401 when accessing monitor endpoints without token', async () => {
      const resList = await request(app).get('/api/v1/monitors');
      expect(resList.status).toBe(401);
      expect(resList.body.error.code).toBe('UNAUTHORIZED');

      const resCreate = await request(app).post('/api/v1/monitors').send({});
      expect(resCreate.status).toBe(401);

      const resGet = await request(app).get(`/api/v1/monitors/${mockMonitorRowUser1.id}`);
      expect(resGet.status).toBe(401);
    });
  });

  describe('POST /api/v1/monitors (Create Monitor)', () => {
    it('creates a monitor successfully and enforces user ownership from token', async () => {
      const createSpy = vi.spyOn(monitorsRepository, 'create').mockResolvedValue(mockMonitorRowUser1);

      const response = await request(app)
        .post('/api/v1/monitors')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({
          name: 'Production Health API',
          targetUrl: 'https://api.github.com/zen',
          method: 'GET',
          intervalSeconds: 60,
          timeoutMs: 5000,
          expectedStatusMin: 200,
          expectedStatusMax: 299,
          // Intentionally attempt to spoof userId in payload:
          userId: user2.id,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('monitor');
      expect(response.body.monitor.id).toBe(mockMonitorRowUser1.id);
      expect(response.body.monitor.userId).toBe(user1.id);

      // Verify that the repository was called with user1's ID from the token, ignoring body spoof
      expect(createSpy).toHaveBeenCalledWith(
        user1.id,
        expect.objectContaining({
          name: 'Production Health API',
          targetUrl: 'https://api.github.com/zen',
        })
      );
    });

    it('rejects invalid or prohibited SSRF target URLs with 400 VALIDATION_ERROR', async () => {
      const response = await request(app)
        .post('/api/v1/monitors')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({
          name: 'Dangerous Internal Call',
          targetUrl: 'http://169.254.169.254/latest/meta-data',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects unsupported HTTP methods (e.g. POST, DELETE)', async () => {
      const response = await request(app)
        .post('/api/v1/monitors')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({
          name: 'POST Monitor',
          targetUrl: 'https://example.com/health',
          method: 'POST',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects configuration where expectedStatusMin > expectedStatusMax', async () => {
      const response = await request(app)
        .post('/api/v1/monitors')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({
          name: 'Invalid Status Range',
          targetUrl: 'https://example.com/health',
          expectedStatusMin: 500,
          expectedStatusMax: 200,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(response.body)).toContain('expectedStatusMin cannot be greater');
    });
  });

  describe('GET /api/v1/monitors (List Monitors)', () => {
    it('returns the list of monitors scoped strictly to the authenticated user', async () => {
      const listSpy = vi.spyOn(monitorsRepository, 'findByUserId').mockResolvedValue({
        monitors: [mockMonitorRowUser1],
        total: 1,
      });

      const response = await request(app)
        .get('/api/v1/monitors?isActive=true&limit=20&offset=0')
        .set('Authorization', `Bearer ${tokenUser1}`);

      expect(response.status).toBe(200);
      expect(response.body.monitors.length).toBe(1);
      expect(response.body.monitors[0].id).toBe(mockMonitorRowUser1.id);
      expect(response.body.pagination).toEqual({
        total: 1,
        limit: 20,
        offset: 0,
      });

      expect(listSpy).toHaveBeenCalledWith(user1.id, {
        isActive: true,
        limit: 20,
        offset: 0,
      });
    });
  });

  describe('GET /api/v1/monitors/:id (Get Monitor By ID)', () => {
    it('returns 200 when user accesses their own monitor', async () => {
      vi.spyOn(monitorsRepository, 'findByIdAndUserId').mockResolvedValue(mockMonitorRowUser1);

      const response = await request(app)
        .get(`/api/v1/monitors/${mockMonitorRowUser1.id}`)
        .set('Authorization', `Bearer ${tokenUser1}`);

      expect(response.status).toBe(200);
      expect(response.body.monitor.id).toBe(mockMonitorRowUser1.id);
    });

    it('returns 404 NOT_FOUND when User 2 attempts to access User 1 monitor', async () => {
      // Repository query returns null because user_id does not match user2
      vi.spyOn(monitorsRepository, 'findByIdAndUserId').mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/monitors/${mockMonitorRowUser1.id}`)
        .set('Authorization', `Bearer ${tokenUser2}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 VALIDATION_ERROR when ID is not a valid UUID', async () => {
      const response = await request(app)
        .get('/api/v1/monitors/invalid-not-a-uuid')
        .set('Authorization', `Bearer ${tokenUser1}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/v1/monitors/:id (Update Monitor)', () => {
    it('updates monitor configuration when authorized', async () => {
      const updatedRow = {
        ...mockMonitorRowUser1,
        name: 'Updated Name',
        interval_seconds: 120,
      };

      const updateSpy = vi.spyOn(monitorsRepository, 'update').mockResolvedValue(updatedRow);

      const response = await request(app)
        .patch(`/api/v1/monitors/${mockMonitorRowUser1.id}`)
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({
          name: 'Updated Name',
          intervalSeconds: 120,
        });

      expect(response.status).toBe(200);
      expect(response.body.monitor.name).toBe('Updated Name');
      expect(response.body.monitor.intervalSeconds).toBe(120);
      expect(updateSpy).toHaveBeenCalledWith(
        mockMonitorRowUser1.id,
        user1.id,
        expect.objectContaining({ name: 'Updated Name', intervalSeconds: 120 })
      );
    });

    it('returns 404 NOT_FOUND when User 2 attempts to update User 1 monitor', async () => {
      vi.spyOn(monitorsRepository, 'update').mockResolvedValue(null);

      const response = await request(app)
        .patch(`/api/v1/monitors/${mockMonitorRowUser1.id}`)
        .set('Authorization', `Bearer ${tokenUser2}`)
        .send({
          name: 'Unauthorized update attempt',
        });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects empty update body with 400 VALIDATION_ERROR', async () => {
      const response = await request(app)
        .patch(`/api/v1/monitors/${mockMonitorRowUser1.id}`)
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/monitors/:id/pause and /resume', () => {
    it('pauses a monitor (sets isActive = false)', async () => {
      const pausedRow = { ...mockMonitorRowUser1, is_active: false };
      vi.spyOn(monitorsRepository, 'setActiveState').mockResolvedValue(pausedRow);

      const response = await request(app)
        .post(`/api/v1/monitors/${mockMonitorRowUser1.id}/pause`)
        .set('Authorization', `Bearer ${tokenUser1}`);

      expect(response.status).toBe(200);
      expect(response.body.monitor.isActive).toBe(false);
    });

    it('resumes a paused monitor (sets isActive = true)', async () => {
      const resumedRow = { ...mockMonitorRowUser1, is_active: true };
      vi.spyOn(monitorsRepository, 'setActiveState').mockResolvedValue(resumedRow);

      const response = await request(app)
        .post(`/api/v1/monitors/${mockMonitorRowUser1.id}/resume`)
        .set('Authorization', `Bearer ${tokenUser1}`);

      expect(response.status).toBe(200);
      expect(response.body.monitor.isActive).toBe(true);
    });

    it('returns 404 when pausing a monitor belonging to another user', async () => {
      vi.spyOn(monitorsRepository, 'setActiveState').mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/v1/monitors/${mockMonitorRowUser1.id}/pause`)
        .set('Authorization', `Bearer ${tokenUser2}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/monitors/:id', () => {
    it('deletes monitor successfully for owner', async () => {
      vi.spyOn(monitorsRepository, 'delete').mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/v1/monitors/${mockMonitorRowUser1.id}`)
        .set('Authorization', `Bearer ${tokenUser1}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('returns 404 when attempting to delete another user monitor', async () => {
      vi.spyOn(monitorsRepository, 'delete').mockResolvedValue(false);

      const response = await request(app)
        .delete(`/api/v1/monitors/${mockMonitorRowUser1.id}`)
        .set('Authorization', `Bearer ${tokenUser2}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
