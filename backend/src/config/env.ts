import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from project root or backend directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback to current working directory

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  // Database and Redis URLs
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .regex(/^(postgres|postgresql):\/\/.+/, 'DATABASE_URL must start with postgres:// or postgresql://')
    .default('postgresql://postgres:postgrespassword@localhost:5432/api_sentinel'),
  REDIS_URL: z
    .string()
    .min(1, 'REDIS_URL is required')
    .regex(/^rediss?:\/\/.+/, 'REDIS_URL must start with redis:// or rediss://')
    .default('redis://localhost:6379'),

  // CORS
  FRONTEND_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  // Secrets & Auth
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters').default('change_this_secret_in_production_min_16_chars'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('change_this_jwt_secret_in_production_min_16_chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Monitoring Defaults & Safe Bounds
  MONITOR_DEFAULT_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  MONITOR_MIN_INTERVAL_SECONDS: z.coerce.number().int().positive().default(10),
  MONITOR_MAX_INTERVAL_SECONDS: z.coerce.number().int().positive().default(86400),
  MONITOR_DEFAULT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  MONITOR_MAX_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  // Local Mock Target for Safe Testing
  MOCK_API_URL: z.string().default('http://localhost:8080'),

  // Background Worker Settings
  CHECK_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  CHECK_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),

  // Observability
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errorDetails}`);
  }

  return result.data;
}

export const env = validateEnv();
