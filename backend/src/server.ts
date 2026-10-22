import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { closeDatabase } from './lib/db';
import { closeRedis } from './lib/redis';
import { logger } from './lib/logger';
import { startCheckWorker, closeCheckWorker } from './workers/check.worker';
import { closeCheckQueue } from './queues/check.queue';
import { monitorScheduler } from './scheduler/monitor.scheduler';
import { initSocketServer, closeSocketServer } from './lib/socket';

const server = http.createServer(app);

function startServer(): void {
  // Initialize authenticated Socket.IO server
  initSocketServer(server);

  server.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        nodeEnv: env.NODE_ENV,
        nodeVersion: process.version,
      },
      `API Sentinel server started successfully on port ${env.PORT}`
    );

    // Start background monitoring worker and scheduler
    try {
      startCheckWorker();
      monitorScheduler.start();
    } catch (err) {
      logger.error({ err }, 'Failed to start background worker or scheduler');
    }
  });
}

let isShuttingDown = false;

export async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Graceful shutdown already in progress...');
    return;
  }
  isShuttingDown = true;
  logger.info({ signal }, 'Received termination signal, initiating graceful shutdown...');

  // Set timeout to force exit if graceful shutdown hangs
  const forceExitTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out, force terminating process');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  try {
    // 1. Stop scheduler and background workers first
    monitorScheduler.stop();
    await closeCheckWorker();
    await closeCheckQueue();

    // 2. Close Socket.IO connections
    await closeSocketServer();

    // 3. Stop accepting new HTTP requests
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) return reject(err);
        logger.info('HTTP server closed');
        resolve();
      });
    });

    // 3. Close Redis client
    await closeRedis();

    // 4. Close PostgreSQL pool
    await closeDatabase();

    logger.info('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Error encountered during graceful shutdown');
    process.exit(1);
  }
}

// Process signal listeners
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception detected');
  gracefulShutdown('uncaughtException').catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection detected');
  gracefulShutdown('unhandledRejection').catch(() => process.exit(1));
});

if (require.main === module) {
  startServer();
}

export { server };
