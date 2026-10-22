import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { monitorsController } from './monitors.controller';

import { incidentsController } from '../incidents/incidents.controller';
import { analyticsController } from '../analytics/analytics.controller';

export const monitorsRouter = Router();

// Enforce authentication on all monitor routes
monitorsRouter.use(authMiddleware);

// Base path: /api/v1/monitors
monitorsRouter.post('/', monitorsController.create);
monitorsRouter.get('/', monitorsController.list);
monitorsRouter.get('/:id', monitorsController.getById);
monitorsRouter.patch('/:id', monitorsController.update);
monitorsRouter.delete('/:id', monitorsController.delete);
monitorsRouter.post('/:id/pause', monitorsController.pause);
monitorsRouter.post('/:id/resume', monitorsController.resume);
monitorsRouter.get('/:id/incidents', incidentsController.listByMonitor);
monitorsRouter.get('/:id/checks', analyticsController.getChecks);
monitorsRouter.get('/:id/analytics', analyticsController.getAnalytics);
