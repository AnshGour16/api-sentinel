import { Request, Response, NextFunction } from 'express';
import { healthService } from './health.service';

export class HealthController {
  public getLive(_req: Request, res: Response): void {
    const liveness = healthService.getLiveness();
    res.status(200).json(liveness);
  }

  public async getReady(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const readiness = await healthService.getReadiness();
      const statusCode = readiness.status === 'ok' ? 200 : 503;
      res.status(statusCode).json(readiness);
    } catch (error) {
      next(error);
    }
  }
}

export const healthController = new HealthController();
