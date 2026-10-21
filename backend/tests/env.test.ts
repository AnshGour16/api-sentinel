import { describe, it, expect } from 'vitest';
import { validateEnv } from '../src/config/env';

describe('Environment Configuration Validation', () => {
  it('should parse valid default environment successfully', () => {
    const config = validateEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgrespassword@localhost:5432/api_sentinel',
      REDIS_URL: 'redis://localhost:6379',
    });

    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(4000);
    expect(config.DATABASE_URL).toContain('postgresql://');
    expect(config.REDIS_URL).toContain('redis://');
    expect(config.CHECK_WORKER_CONCURRENCY).toBe(5);
    expect(config.CHECK_MAX_RETRIES).toBe(2);
  });

  it('should reject invalid PORT values', () => {
    expect(() => {
      validateEnv({
        PORT: '-10',
      });
    }).toThrow('Environment validation failed');

    expect(() => {
      validateEnv({
        PORT: '999999',
      });
    }).toThrow('Environment validation failed');
  });

  it('should reject invalid DATABASE_URL protocols', () => {
    expect(() => {
      validateEnv({
        DATABASE_URL: 'mysql://localhost:3306/db',
      });
    }).toThrow('Environment validation failed');
  });

  it('should reject invalid REDIS_URL protocols', () => {
    expect(() => {
      validateEnv({
        REDIS_URL: 'http://localhost:6379',
      });
    }).toThrow('Environment validation failed');
  });

  it('should reject invalid LOG_LEVEL values', () => {
    expect(() => {
      validateEnv({
        LOG_LEVEL: 'verbose' as any,
      });
    }).toThrow('Environment validation failed');
  });
});
