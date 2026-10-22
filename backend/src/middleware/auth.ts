import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../lib/errors';
import { authService } from '../modules/auth/auth.service';
import { AuthUser } from '../modules/auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header. Expected "Bearer <token>"');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedError('Bearer token is empty');
    }

    const decoded = authService.verifyToken(token);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (err) {
    next(err);
  }
}
