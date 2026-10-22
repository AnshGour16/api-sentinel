import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../lib/errors';
import { monitorIdParamSchema } from '../monitors/monitors.schemas';
import { incidentsService, IncidentsService } from './incidents.service';
import { z } from 'zod';

const listIncidentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export class IncidentsController {
  constructor(private readonly service: IncidentsService = incidentsService) {}

  listByMonitor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = monitorIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        throw new ValidationError('Invalid monitor ID', paramParsed.error.errors);
      }

      const queryParsed = listIncidentsQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        throw new ValidationError('Invalid pagination parameters', queryParsed.error.errors);
      }

      const userId = req.user!.id;
      const result = await this.service.getMonitorIncidents(
        paramParsed.data.id,
        userId,
        queryParsed.data.limit,
        queryParsed.data.offset
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const incidentsController = new IncidentsController();
