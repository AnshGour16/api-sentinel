import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
}

// In-memory fallback tracking when Redis is temporarily offline or disconnected
const memoryStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyPrefix = 'rl:',
    message = 'Too many requests, please try again later.',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}${ip}`;
    const now = Date.now();

    try {
      if (redis && redis.status === 'ready') {
        const current = await redis.incr(key);
        if (current === 1) {
          await redis.pexpire(key, windowMs);
        }

        const ttlMs = await redis.pttl(key);
        const resetSeconds = Math.ceil(Math.max(0, ttlMs) / 1000);

        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - current)));
        res.setHeader('X-RateLimit-Reset', String(resetSeconds));

        if (current > max) {
          res.setHeader('Retry-After', String(resetSeconds));
          throw new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
        }

        return next();
      }
    } catch (err) {
      if (err instanceof AppError) {
        return next(err);
      }
      logger.warn({ err }, 'Redis rate limit error, falling back to in-memory store');
    }

    // Fallback in-memory rate limiting
    const record = memoryStore.get(key);
    if (!record || now > record.resetTime) {
      memoryStore.set(key, { count: 1, resetTime: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(max - 1));
      return next();
    }

    record.count += 1;
    const remainingSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - record.count)));
    res.setHeader('X-RateLimit-Reset', String(remainingSeconds));

    if (record.count > max) {
      res.setHeader('Retry-After', String(remainingSeconds));
      return next(new AppError(message, 429, 'RATE_LIMIT_EXCEEDED'));
    }

    next();
  };
}
