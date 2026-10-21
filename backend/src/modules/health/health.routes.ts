import { Router } from 'express';
import { healthController } from './health.controller';

export const healthRouter = Router();

healthRouter.get('/live', (req, res) => healthController.getLive(req, res));
healthRouter.get('/ready', (req, res, next) => healthController.getReady(req, res, next));
