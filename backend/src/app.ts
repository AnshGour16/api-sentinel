import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { logger } from './lib/logger';
import { requestIdMiddleware } from './middleware/request-id';
import { errorHandlerMiddleware } from './middleware/error-handler';
import { notFoundMiddleware } from './middleware/not-found';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { monitorsRouter } from './modules/monitors/monitors.routes';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Correlation-Id'],
    })
  );

  // Request correlation IDs
  app.use(requestIdMiddleware);

  // Body parsing with safe size limit
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Structured HTTP request logging (excluding full payloads to prevent leaking sensitive data)
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Math.round(Number(process.hrtime.bigint() - start) / 100_000) / 10;
      logger.info(
        {
          requestId: req.id,
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          durationMs,
        },
        'HTTP request completed'
      );
    });

    next();
  });

  // Health routes mounted at /health and /api/v1/health
  app.use('/health', healthRouter);
  app.use('/api/v1/health', healthRouter);

  // Auth and Monitor API routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/monitors', monitorsRouter);

  // 404 handler
  app.use(notFoundMiddleware);

  // Centralized error handler
  app.use(errorHandlerMiddleware);

  return app;
}

export const app = createApp();
