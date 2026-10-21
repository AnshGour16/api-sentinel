import { Request, Response } from 'express';
import { NotFoundError } from '../lib/errors';

export function notFoundMiddleware(req: Request, res: Response): void {
  const err = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
  res.status(err.statusCode).json({
    error: {
      code: err.code,
      message: err.message,
    },
  });
}
