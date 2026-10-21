import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = (req.headers['x-request-id'] || req.headers['x-correlation-id']) as string | undefined;
  const requestId = incomingId && incomingId.trim().length > 0 ? incomingId.trim() : uuidv4();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
