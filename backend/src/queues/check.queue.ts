import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { MonitorCheckJob } from '../modules/checks/checks.types';

export const CHECK_QUEUE_NAME = 'monitor-checks';

// Dedicated connection for BullMQ with required maxRetriesPerRequest: null
export function createQueueConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      return Math.min(times * 200, 2000);
    },
  });
}

let checkQueueInstance: Queue<MonitorCheckJob> | null = null;

export function getCheckQueue(): Queue<MonitorCheckJob> {
  if (!checkQueueInstance) {
    checkQueueInstance = new Queue<MonitorCheckJob>(CHECK_QUEUE_NAME, {
      connection: createQueueConnection(),
      defaultJobOptions: {
        attempts: 1, // Monitor check errors are recorded as outcomes in PostgreSQL rather than retrying indefinitely in queue
        removeOnComplete: {
          count: 1000,
          age: 3600, // 1 hour
        },
        removeOnFail: {
          count: 1000,
          age: 86400, // 24 hours
        },
      },
    });

    checkQueueInstance.on('error', (err) => {
      logger.warn({ err: err.message }, 'Check queue encountered error');
    });
  }

  return checkQueueInstance;
}

export async function enqueueCheckJob(job: MonitorCheckJob): Promise<void> {
  const queue = getCheckQueue();

  // Use executionId as BullMQ jobId to guarantee queue-level deduplication
  await queue.add('execute-check', job, {
    jobId: job.executionId,
  });

  logger.debug(
    { monitorId: job.monitorId, executionId: job.executionId },
    'Enqueued monitor check job'
  );
}

export async function closeCheckQueue(): Promise<void> {
  if (checkQueueInstance) {
    logger.info('Closing BullMQ check queue...');
    await checkQueueInstance.close();
    checkQueueInstance = null;
    logger.info('BullMQ check queue closed');
  }
}
