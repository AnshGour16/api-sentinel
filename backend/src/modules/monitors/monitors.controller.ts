import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../lib/errors';
import {
  createMonitorSchema,
  listMonitorsQuerySchema,
  monitorIdParamSchema,
  updateMonitorSchema,
} from './monitors.schemas';
import { MonitorsService, monitorsService } from './monitors.service';

export class MonitorsController {
  constructor(private readonly service: MonitorsService = monitorsService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createMonitorSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('The monitor configuration is invalid', parsed.error.errors);
      }

      const userId = req.user!.id;
      const monitor = await this.service.createMonitor(userId, parsed.data);
      res.status(201).json({ monitor });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listMonitorsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Invalid query parameters', parsed.error.errors);
      }

      const userId = req.user!.id;
      const result = await this.service.listMonitors(userId, parsed.data);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = monitorIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        throw new ValidationError('Invalid monitor ID', paramParsed.error.errors);
      }

      const userId = req.user!.id;
      const monitor = await this.service.getMonitorById(paramParsed.data.id, userId);
      res.status(200).json({ monitor });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = monitorIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        throw new ValidationError('Invalid monitor ID', paramParsed.error.errors);
      }

      const bodyParsed = updateMonitorSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        throw new ValidationError('Invalid update payload', bodyParsed.error.errors);
      }

      const userId = req.user!.id;
      const monitor = await this.service.updateMonitor(
        paramParsed.data.id,
        userId,
        bodyParsed.data
      );
      res.status(200).json({ monitor });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = monitorIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        throw new ValidationError('Invalid monitor ID', paramParsed.error.errors);
      }

      const userId = req.user!.id;
      await this.service.deleteMonitor(paramParsed.data.id, userId);
      res.status(200).json({ message: 'Monitor deleted successfully' });
    } catch (err) {
      next(err);
    }
  };

  pause = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = monitorIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        throw new ValidationError('Invalid monitor ID', paramParsed.error.errors);
      }

      const userId = req.user!.id;
      const monitor = await this.service.pauseMonitor(paramParsed.data.id, userId);
      res.status(200).json({ monitor });
    } catch (err) {
      next(err);
    }
  };

  resume = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = monitorIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        throw new ValidationError('Invalid monitor ID', paramParsed.error.errors);
      }

      const userId = req.user!.id;
      const monitor = await this.service.resumeMonitor(paramParsed.data.id, userId);
      res.status(200).json({ monitor });
    } catch (err) {
      next(err);
    }
  };
}

export const monitorsController = new MonitorsController();
