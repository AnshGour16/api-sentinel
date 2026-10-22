import { z } from 'zod';
import { env } from '../../config/env';
import { validateTargetUrl } from '../../utils/ssrf';

export const createMonitorSchema = z
  .object({
    name: z
      .string({ required_error: 'Monitor name is required' })
      .trim()
      .min(1, 'Monitor name cannot be empty')
      .max(100, 'Monitor name cannot exceed 100 characters'),
    targetUrl: z
      .string({ required_error: 'Target URL is required' })
      .trim()
      .url('Target URL must be a valid URL')
      .refine(
        (url) => {
          const check = validateTargetUrl(url);
          return check.isValid;
        },
        (url) => {
          const check = validateTargetUrl(url);
          return { message: check.error || 'Invalid or prohibited target URL' };
        }
      ),
    method: z.enum(['GET', 'HEAD'], {
      errorMap: () => ({ message: 'Method must be either GET or HEAD' }),
    }).default('GET'),
    intervalSeconds: z
      .coerce
      .number({ invalid_type_error: 'intervalSeconds must be an integer' })
      .int('intervalSeconds must be an integer')
      .min(
        env.MONITOR_MIN_INTERVAL_SECONDS,
        `Interval must be at least ${env.MONITOR_MIN_INTERVAL_SECONDS} seconds`
      )
      .max(
        env.MONITOR_MAX_INTERVAL_SECONDS,
        `Interval cannot exceed ${env.MONITOR_MAX_INTERVAL_SECONDS} seconds`
      )
      .default(env.MONITOR_DEFAULT_INTERVAL_SECONDS),
    timeoutMs: z
      .coerce
      .number({ invalid_type_error: 'timeoutMs must be an integer' })
      .int('timeoutMs must be an integer')
      .min(100, 'Timeout must be at least 100ms')
      .max(
        env.MONITOR_MAX_TIMEOUT_MS,
        `Timeout cannot exceed ${env.MONITOR_MAX_TIMEOUT_MS}ms`
      )
      .default(env.MONITOR_DEFAULT_TIMEOUT_MS),
    expectedStatusMin: z
      .coerce
      .number({ invalid_type_error: 'expectedStatusMin must be a number' })
      .int()
      .min(100, 'Status code must be between 100 and 599')
      .max(599, 'Status code must be between 100 and 599')
      .default(200),
    expectedStatusMax: z
      .coerce
      .number({ invalid_type_error: 'expectedStatusMax must be a number' })
      .int()
      .min(100, 'Status code must be between 100 and 599')
      .max(599, 'Status code must be between 100 and 599')
      .default(299),
  })
  .refine(
    (data) => data.expectedStatusMin <= data.expectedStatusMax,
    {
      message: 'expectedStatusMin cannot be greater than expectedStatusMax',
      path: ['expectedStatusMin'],
    }
  );

export const updateMonitorSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Monitor name cannot be empty')
      .max(100, 'Monitor name cannot exceed 100 characters')
      .optional(),
    targetUrl: z
      .string()
      .trim()
      .url('Target URL must be a valid URL')
      .refine(
        (url) => {
          const check = validateTargetUrl(url);
          return check.isValid;
        },
        (url) => {
          const check = validateTargetUrl(url);
          return { message: check.error || 'Invalid or prohibited target URL' };
        }
      )
      .optional(),
    method: z.enum(['GET', 'HEAD'], {
      errorMap: () => ({ message: 'Method must be either GET or HEAD' }),
    }).optional(),
    intervalSeconds: z
      .coerce
      .number()
      .int('intervalSeconds must be an integer')
      .min(
        env.MONITOR_MIN_INTERVAL_SECONDS,
        `Interval must be at least ${env.MONITOR_MIN_INTERVAL_SECONDS} seconds`
      )
      .max(
        env.MONITOR_MAX_INTERVAL_SECONDS,
        `Interval cannot exceed ${env.MONITOR_MAX_INTERVAL_SECONDS} seconds`
      )
      .optional(),
    timeoutMs: z
      .coerce
      .number()
      .int('timeoutMs must be an integer')
      .min(100, 'Timeout must be at least 100ms')
      .max(
        env.MONITOR_MAX_TIMEOUT_MS,
        `Timeout cannot exceed ${env.MONITOR_MAX_TIMEOUT_MS}ms`
      )
      .optional(),
    expectedStatusMin: z
      .coerce
      .number()
      .int()
      .min(100, 'Status code must be between 100 and 599')
      .max(599, 'Status code must be between 100 and 599')
      .optional(),
    expectedStatusMax: z
      .coerce
      .number()
      .int()
      .min(100, 'Status code must be between 100 and 599')
      .max(599, 'Status code must be between 100 and 599')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: 'At least one field must be provided for update',
    }
  )
  .refine(
    (data) => {
      if (data.expectedStatusMin !== undefined && data.expectedStatusMax !== undefined) {
        return data.expectedStatusMin <= data.expectedStatusMax;
      }
      return true;
    },
    {
      message: 'expectedStatusMin cannot be greater than expectedStatusMax',
      path: ['expectedStatusMin'],
    }
  );

export const monitorIdParamSchema = z.object({
  id: z.string().uuid('Invalid monitor ID format. Must be a valid UUID'),
});

export const listMonitorsQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  limit: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50),
  offset: z
    .coerce
    .number()
    .int()
    .min(0)
    .default(0),
});

export type CreateMonitorSchemaType = z.infer<typeof createMonitorSchema>;
export type UpdateMonitorSchemaType = z.infer<typeof updateMonitorSchema>;
export type MonitorIdParamType = z.infer<typeof monitorIdParamSchema>;
export type ListMonitorsQueryType = z.infer<typeof listMonitorsQuerySchema>;
