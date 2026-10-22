import { Job, Worker } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { checksService } from '../modules/checks/checks.service';
import { MonitorCheckJob } from '../modules/checks/checks.types';
import { CHECK_QUEUE_NAME, createQueueConnection } from '../queues/check.queue';

let checkWorkerInstance: Worker<MonitorCheckJob> | null = null;

export function startCheckWorker(): Worker<MonitorCheckJob> {
  if (checkWorkerInstance) {
    return checkWorkerInstance;
  }

  logger.info(
    { concurrency: env.CHECK_WORKER_CONCURRENCY },
    'Starting BullMQ monitor check worker...'
  );

  checkWorkerInstance = new Worker<MonitorCheckJob>(
    CHECK_QUEUE_NAME,
    async (job: Job<MonitorCheckJob>) => {
      logger.debug(
        { jobId: job.id, monitorId: job.data.monitorId, executionId: job.data.executionId },
        'Worker processing monitor check job'
      );

      try {
        const result = await checksService.executeCheck(job.data);
        return {
          success: true,
          outcome: result?.outcome || 'skipped',
        };
      } catch (err) {
        logger.error(
          {
            err,
            jobId: job.id,
            monitorId: job.data.monitorId,
            executionId: job.data.executionId,
          },
          'Worker encountered unhandled error during check execution'
        );
        throw err;
      }
    },
    {
      connection: createQueueConnection(),
      concurrency: env.CHECK_WORKER_CONCURRENCY,
    }
  );

  checkWorkerInstance.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Check worker successfully completed job');
  });

  checkWorkerInstance.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err: err.message },
      'Check worker failed job execution'
    );
  });

  checkWorkerInstance.on('error', (err) => {
    logger.warn({ err: err.message }, 'Check worker client error');
  });

  return checkWorkerInstance;
}

export async function closeCheckWorker(): Promise<void> {
  if (checkWorkerInstance) {
    logger.info('Closing BullMQ check worker...');
    await checkWorkerInstance.close();
    checkWorkerInstance = null;
    logger.info('BullMQ check worker closed');
  }
}
