import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { authRepository } from '../src/modules/auth/auth.repository';
import { authService } from '../src/modules/auth/auth.service';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('Auth Module & Authentication Middleware', () => {
  const mockUser = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'developer@example.com',
    name: 'Test Developer',
    created_at: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 200 and issues a JWT token for valid credentials', async () => {
      vi.spyOn(authRepository, 'upsertUser').mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'developer@example.com',
          name: 'Test Developer',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        createdAt: mockUser.created_at.toISOString(),
      });

      // Verify the token payload
      const decoded = jwt.verify(response.body.token, env.JWT_SECRET) as any;
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
    });

    it('returns 400 VALIDATION_ERROR when email is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'not-an-email',
          name: 'Developer',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Invalid login credentials');
    });

    it('returns 400 VALIDATION_ERROR when email is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          name: 'Developer',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 200 and profile when authenticated with valid Bearer token', async () => {
      vi.spyOn(authRepository, 'findById').mockResolvedValue(mockUser);
      const token = authService.generateToken(mockUser);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
    });

    it('returns 401 UNAUTHORIZED when Authorization header is missing', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toContain('Authorization header');
    });

    it('returns 401 UNAUTHORIZED when Bearer token is invalid or tampered', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.tampered.token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toContain('Invalid authorization token');
    });

    it('returns 401 UNAUTHORIZED when token has expired', async () => {
      const expiredToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email },
        env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toContain('expired');
    });
  });
});
