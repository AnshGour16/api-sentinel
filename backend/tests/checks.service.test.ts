import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checksService } from '../src/modules/checks/checks.service';
import { checksRepository } from '../src/modules/checks/checks.repository';
import { monitorsRepository } from '../src/modules/monitors/monitors.repository';
import { MonitorRow } from '../src/modules/monitors/monitors.types';
import { incidentsService } from '../src/modules/incidents/incidents.service';

describe('ChecksService - Execution Engine', () => {
  const mockMonitor: MonitorRow = {
    id: '11111111-1111-4111-a111-111111111111',
    user_id: 'user-123',
    name: 'Production API',
    target_url: 'https://api.github.com/status',
    method: 'GET',
    interval_seconds: 60,
    timeout_ms: 2000,
    expected_status_min: 200,
    expected_status_max: 299,
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };

  const baseJob = {
    monitorId: mockMonitor.id,
    scheduledAt: new Date().toISOString(),
    executionId: 'exec-test-12345',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(incidentsService, 'processCheckOutcome').mockResolvedValue({
      incident: null,
      transitionType: 'none',
    });
  });

  it('records outcome "success" when HTTP response falls within expected status range', async () => {
    vi.spyOn(monitorsRepository, 'findById').mockResolvedValue(mockMonitor);
    const saveSpy = vi.spyOn(checksRepository, 'saveCheck').mockImplementation(async (data) => ({
      id: 'check-1',
      monitor_id: data.monitorId,
      execution_id: data.executionId,
      status_code: data.statusCode ?? null,
      latency_ms: data.latencyMs ?? null,
      outcome: data.outcome,
      error_code: data.errorCode ?? null,
      checked_at: data.checkedAt || new Date(),
      completed_at: data.completedAt || new Date(),
      created_at: new Date(),
    }));
    vi.spyOn(checksRepository, 'updateLastCheckedAt').mockResolvedValue();

    // Mock global fetch to return 200 OK
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      ok: true,
    } as any);

    const result = await checksService.executeCheck(baseJob);

    expect(result).toBeDefined();
    expect(result?.outcome).toBe('success');
    expect(result?.status_code).toBe(200);
    expect(result?.error_code).toBeNull();
    expect(result?.latency_ms).toBeGreaterThanOrEqual(0);

    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        monitorId: mockMonitor.id,
        executionId: baseJob.executionId,
        outcome: 'success',
        statusCode: 200,
      })
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      mockMonitor.target_url,
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
      })
    );
  });

  it('records outcome "http_error" when status code is outside expected range (e.g. 500)', async () => {
    vi.spyOn(monitorsRepository, 'findById').mockResolvedValue(mockMonitor);
    vi.spyOn(checksRepository, 'saveCheck').mockImplementation(async (data) => ({
      id: 'check-2',
      monitor_id: data.monitorId,
      execution_id: data.executionId,
      status_code: data.statusCode ?? null,
      latency_ms: data.latencyMs ?? null,
      outcome: data.outcome,
      error_code: data.errorCode ?? null,
      checked_at: data.checkedAt || new Date(),
      completed_at: data.completedAt || new Date(),
      created_at: new Date(),
    }));
    vi.spyOn(checksRepository, 'updateLastCheckedAt').mockResolvedValue();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 500,
      ok: false,
    } as any);

    const result = await checksService.executeCheck(baseJob);

    expect(result?.outcome).toBe('http_error');
    expect(result?.status_code).toBe(500);
    expect(result?.error_code).toBe('HTTP_500');
  });

  it('records outcome "timeout" when request execution exceeds configured timeout_ms', async () => {
    vi.spyOn(monitorsRepository, 'findById').mockResolvedValue(mockMonitor);
    vi.spyOn(checksRepository, 'saveCheck').mockImplementation(async (data) => ({
      id: 'check-3',
      monitor_id: data.monitorId,
      execution_id: data.executionId,
      status_code: data.statusCode ?? null,
      latency_ms: data.latencyMs ?? null,
      outcome: data.outcome,
      error_code: data.errorCode ?? null,
      checked_at: data.checkedAt || new Date(),
      completed_at: data.completedAt || new Date(),
      created_at: new Date(),
    }));
    vi.spyOn(checksRepository, 'updateLastCheckedAt').mockResolvedValue();

    const timeoutError = new Error('The operation was aborted');
    timeoutError.name = 'AbortError';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(timeoutError);

    const result = await checksService.executeCheck(baseJob);

    expect(result?.outcome).toBe('timeout');
    expect(result?.status_code).toBeNull();
    expect(result?.error_code).toBe('REQUEST_TIMEOUT');
  });

  it('records outcome "network_error" on DNS failure or connection refused', async () => {
    vi.spyOn(monitorsRepository, 'findById').mockResolvedValue(mockMonitor);
    vi.spyOn(checksRepository, 'saveCheck').mockImplementation(async (data) => ({
      id: 'check-4',
      monitor_id: data.monitorId,
      execution_id: data.executionId,
      status_code: data.statusCode ?? null,
      latency_ms: data.latencyMs ?? null,
      outcome: data.outcome,
      error_code: data.errorCode ?? null,
      checked_at: data.checkedAt || new Date(),
      completed_at: data.completedAt || new Date(),
      created_at: new Date(),
    }));
    vi.spyOn(checksRepository, 'updateLastCheckedAt').mockResolvedValue();

    const networkErr = new Error('getaddrinfo ENOTFOUND api.bad-domain.xyz') as any;
    networkErr.code = 'ENOTFOUND';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(networkErr);

    const result = await checksService.executeCheck(baseJob);

    expect(result?.outcome).toBe('network_error');
    expect(result?.status_code).toBeNull();
    expect(result?.error_code).toBe('ENOTFOUND');
  });

  it('rejects prohibited SSRF destinations at runtime without making network requests', async () => {
    const maliciousMonitor: MonitorRow = {
      ...mockMonitor,
      target_url: 'http://169.254.169.254/latest/meta-data',
    };
    vi.spyOn(monitorsRepository, 'findById').mockResolvedValue(maliciousMonitor);
    const saveSpy = vi.spyOn(checksRepository, 'saveCheck').mockImplementation(async (data) => ({
      id: 'check-5',
      monitor_id: data.monitorId,
      execution_id: data.executionId,
      status_code: data.statusCode ?? null,
      latency_ms: data.latencyMs ?? null,
      outcome: data.outcome,
      error_code: data.errorCode ?? null,
      checked_at: data.checkedAt || new Date(),
      completed_at: data.completedAt || new Date(),
      created_at: new Date(),
    }));
    vi.spyOn(checksRepository, 'updateLastCheckedAt').mockResolvedValue();

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await checksService.executeCheck(baseJob);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result?.outcome).toBe('invalid_response');
    expect(result?.error_code).toBe('SSRF_PROHIBITED');
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'invalid_response',
        errorCode: 'SSRF_PROHIBITED',
      })
    );
  });

  it('skips execution gracefully if the monitor is paused or deleted', async () => {
    // 1. Deleted monitor
    vi.spyOn(monitorsRepository, 'findById').mockResolvedValue(null);
    const saveSpy = vi.spyOn(checksRepository, 'saveCheck');

    const res1 = await checksService.executeCheck(baseJob);
    expect(res1).toBeNull();
    expect(saveSpy).not.toHaveBeenCalled();

    // 2. Paused monitor
    vi.spyOn(monitorsRepository, 'findById').mockResolvedValue({
      ...mockMonitor,
      is_active: false,
    });

    const res2 = await checksService.executeCheck(baseJob);
    expect(res2).toBeNull();
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
