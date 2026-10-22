import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonitorScheduler } from '../src/scheduler/monitor.scheduler';
import { checksRepository } from '../src/modules/checks/checks.repository';
import * as checkQueueModule from '../src/queues/check.queue';
import { redis } from '../src/lib/redis';
import { MonitorRow } from '../src/modules/monitors/monitors.types';

describe('MonitorScheduler - Distributed Scheduling Engine', () => {
  const mockDueMonitor: MonitorRow = {
    id: '33333333-3333-4333-a333-333333333333',
    user_id: 'user-123',
    name: 'Scheduled Monitor',
    target_url: 'https://api.github.com/zen',
    method: 'GET',
    interval_seconds: 60,
    timeout_ms: 5000,
    expected_status_min: 200,
    expected_status_max: 299,
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };

  const originalRedisStatus = redis.status;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(redis, 'status', { value: originalRedisStatus, configurable: true });
  });

  it('identifies due monitors, enqueues check jobs, and advances last_checked_at', async () => {
    const scheduler = new MonitorScheduler(1000);
    // Mark as running so tick() executes
    (scheduler as any).isRunning = true;

    vi.spyOn(checksRepository, 'findDueMonitors').mockResolvedValue([mockDueMonitor]);
    const enqueueSpy = vi.spyOn(checkQueueModule, 'enqueueCheckJob').mockResolvedValue();
    const updateSpy = vi.spyOn(checksRepository, 'updateLastCheckedAt').mockResolvedValue();

    const result = await scheduler.tick();

    expect(result.scheduledCount).toBe(1);
    expect(result.lockAcquired).toBe(true);

    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        monitorId: mockDueMonitor.id,
        executionId: expect.any(String),
        scheduledAt: expect.any(String),
      })
    );

    expect(updateSpy).toHaveBeenCalledWith(mockDueMonitor.id, expect.any(Date));
  });

  it('skips scheduling when another instance holds the active Redis distributed lock', async () => {
    const scheduler = new MonitorScheduler(1000);
    (scheduler as any).isRunning = true;

    // Simulate Redis client returning ready status
    Object.defineProperty(redis, 'status', { value: 'ready', configurable: true });
    // Simulate set NX PX failing because another node holds the lock
    vi.spyOn(redis, 'set').mockResolvedValue(null as any);

    const enqueueSpy = vi.spyOn(checkQueueModule, 'enqueueCheckJob');
    const findDueSpy = vi.spyOn(checksRepository, 'findDueMonitors');

    const result = await scheduler.tick();

    expect(result.lockAcquired).toBe(false);
    expect(result.scheduledCount).toBe(0);
    expect(findDueSpy).not.toHaveBeenCalled();
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('returns 0 scheduled count when no monitors are due', async () => {
    const scheduler = new MonitorScheduler(1000);
    (scheduler as any).isRunning = true;

    vi.spyOn(checksRepository, 'findDueMonitors').mockResolvedValue([]);
    const enqueueSpy = vi.spyOn(checkQueueModule, 'enqueueCheckJob');

    const result = await scheduler.tick();

    expect(result.scheduledCount).toBe(0);
    expect(result.lockAcquired).toBe(true);
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('starts and stops timer lifecycle cleanly', () => {
    const scheduler = new MonitorScheduler(5000);

    expect((scheduler as any).isRunning).toBe(false);
    scheduler.start();
    expect((scheduler as any).isRunning).toBe(true);
    expect((scheduler as any).timer).not.toBeNull();

    scheduler.stop();
    expect((scheduler as any).isRunning).toBe(false);
    expect((scheduler as any).timer).toBeNull();
  });
});
