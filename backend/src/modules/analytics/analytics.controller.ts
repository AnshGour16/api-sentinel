import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../lib/errors';
import { monitorIdParamSchema } from '../monitors/monitors.schemas';
import { analyticsService, AnalyticsService } from './analytics.service';
import { CheckOutcome } from '../checks/checks.types';

const getAnalyticsQuerySchema = z.object({
  window: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
});

const getChecksQuerySchema = z.object({
  outcome: z
    .enum(['success', 'http_error', 'timeout', 'network_error', 'invalid_response'])
    .optional(),
  from: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
  to: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export class AnalyticsController {
  constructor(private readonly service: AnalyticsService = analyticsService) {}

  getAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = monitorIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        throw new ValidationError('Invalid monitor ID', paramParsed.error.errors);
      }

      const queryParsed = getAnalyticsQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        throw new ValidationError('Invalid window parameter', queryParsed.error.errors);
      }

      const userId = req.user!.id;
      const result = await this.service.getAnalytics(
        paramParsed.data.id,
        userId,
        queryParsed.data.window
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getChecks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = monitorIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        throw new ValidationError('Invalid monitor ID', paramParsed.error.errors);
      }

      const queryParsed = getChecksQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        throw new ValidationError('Invalid query parameters', queryParsed.error.errors);
      }

      const userId = req.user!.id;
      const result = await this.service.getCheckHistory(paramParsed.data.id, userId, {
        outcome: queryParsed.data.outcome as CheckOutcome | undefined,
        from: queryParsed.data.from,
        to: queryParsed.data.to,
        limit: queryParsed.data.limit,
        offset: queryParsed.data.offset,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const analyticsController = new AnalyticsController();
