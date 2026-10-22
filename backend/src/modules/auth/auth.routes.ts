import { Router } from 'express';
import { authController } from './auth.controller';
import { authMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rate-limit';

export const authRouter = Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window per IP
  keyPrefix: 'rl:auth:',
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

// POST /api/v1/auth/login (or signup)
authRouter.post('/login', authRateLimiter, authController.login);

// GET /api/v1/auth/me (requires authentication)
authRouter.get('/me', authMiddleware, authController.getMe);
