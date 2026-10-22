import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../lib/errors';
import { loginSchema } from './auth.schemas';
import { AuthService, authService } from './auth.service';

export class AuthController {
  constructor(private readonly service: AuthService = authService) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid login credentials', parsed.error.errors);
      }

      const result = await this.service.login(parsed.data);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service.getMe(req.user!.id);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  };
}

export const authController = new AuthController();
