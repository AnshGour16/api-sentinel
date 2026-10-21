import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: env.NODE_ENV === 'production' ? { env: env.NODE_ENV } : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
          },
        },
      }
    : {}),
});
