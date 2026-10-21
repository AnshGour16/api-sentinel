import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const requestId = req.id || 'unknown';

  if (err instanceof AppError) {
    logger.warn(
      {
        requestId,
        path: req.originalUrl,
        method: req.method,
        statusCode: err.statusCode,
        code: err.code,
        message: err.message,
      },
      'Application handled error'
    );

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Unhandled internal error
  logger.error(
    {
      requestId,
      path: req.originalUrl,
      method: req.method,
      err: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
    },
    'Unhandled server error'
  );

  // Redact all internal details from client response
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred',
    },
  });
}
