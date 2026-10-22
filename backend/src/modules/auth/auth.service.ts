import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError, NotFoundError } from '../../lib/errors';
import { AuthRepository, authRepository } from './auth.repository';
import { AuthResponse, AuthUser, LoginInput, TokenPayload, User } from './auth.types';

export class AuthService {
  constructor(private readonly repo: AuthRepository = authRepository) {}

  generateToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
    };

    const options: SignOptions = {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    };

    return jwt.sign(payload, env.JWT_SECRET, options);
  }

  verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      if (!decoded.userId || !decoded.email) {
        throw new UnauthorizedError('Malformed token payload');
      }
      return decoded;
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Authorization token has expired');
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid authorization token');
      }
      if (err instanceof UnauthorizedError) {
        throw err;
      }
      throw new UnauthorizedError('Authentication failed');
    }
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.repo.upsertUser(input.email, input.name);
    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at.toISOString(),
      },
      token,
    };
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new NotFoundError('User profile not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}

export const authService = new AuthService();
