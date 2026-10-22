import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger';
import { redis } from '../lib/redis';
import { checksRepository } from '../modules/checks/checks.repository';
import { MonitorCheckJob } from '../modules/checks/checks.types';
import { enqueueCheckJob } from '../queues/check.queue';

export class MonitorScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isTickInProgress = false;
  private readonly instanceId = uuidv4();
  private readonly lockKey = 'lock:monitor-scheduler';
  private readonly lockTtlMs = 4500; // Lock expires just before next tick
  private readonly tickIntervalMs: number;

  constructor(tickIntervalMs = 5000) {
    this.tickIntervalMs = tickIntervalMs;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info(
      { intervalMs: this.tickIntervalMs, instanceId: this.instanceId },
      'Starting monitor scheduler...'
    );

    // Run first tick immediately, then periodically
    this.tick().catch((err) => {
      logger.error({ err }, 'Unhandled error in initial scheduler tick');
    });

    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        logger.error({ err }, 'Unhandled error in scheduler tick');
      });
    }, this.tickIntervalMs);

    this.timer.unref(); // Allow node process to exit cleanly if needed
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    logger.info('Monitor scheduler stopped');
  }

  async tick(): Promise<{ scheduledCount: number; lockAcquired: boolean }> {
    if (!this.isRunning || this.isTickInProgress) {
      return { scheduledCount: 0, lockAcquired: false };
    }

    this.isTickInProgress = true;
    let lockAcquired = false;

    try {
      // 1. Distributed coordination via Redis to avoid duplicate scheduling across multiple instances
      if (redis && redis.status === 'ready') {
        const acquired = await redis.set(
          this.lockKey,
          this.instanceId,
          'PX',
          this.lockTtlMs,
          'NX'
        );

        if (!acquired) {
          logger.debug('Another scheduler instance holds the active lock, skipping tick');
          return { scheduledCount: 0, lockAcquired: false };
        }
        lockAcquired = true;
      } else {
        // In local/test environments where Redis client is not in ready status, proceed with local execution
        lockAcquired = true;
      }

      // 2. Query monitors that are due for execution
      const dueMonitors = await checksRepository.findDueMonitors(100);
      if (dueMonitors.length === 0) {
        return { scheduledCount: 0, lockAcquired: true };
      }

      logger.info({ count: dueMonitors.length }, 'Found due monitors to schedule');

      const now = new Date();
      let scheduledCount = 0;

      for (const monitor of dueMonitors) {
        const executionId = uuidv4();
        const job: MonitorCheckJob = {
          monitorId: monitor.id,
          scheduledAt: now.toISOString(),
          executionId,
        };

        // Enqueue check into BullMQ
        await enqueueCheckJob(job);

        // Advance last_checked_at immediately so the next tick does not duplicate this monitor
        await checksRepository.updateLastCheckedAt(monitor.id, now);
        scheduledCount++;
      }

      logger.info(
        { scheduledCount },
        'Scheduler successfully enqueued due monitor checks'
      );

      return { scheduledCount, lockAcquired: true };
    } catch (err) {
      logger.error({ err }, 'Error occurred during scheduler tick execution');
      return { scheduledCount: 0, lockAcquired };
    } finally {
      // Release lock if we own it
      try {
        if (lockAcquired && redis && redis.status === 'ready') {
          const currentOwner = await redis.get(this.lockKey);
          if (currentOwner === this.instanceId) {
            await redis.del(this.lockKey);
          }
        }
      } catch {
        // Allow TTL to expire if del fails
      }

      this.isTickInProgress = false;
    }
  }
}

export const monitorScheduler = new MonitorScheduler();
