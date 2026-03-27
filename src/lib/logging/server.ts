/**
 * Server-side Logger (Pino)
 *
 * High-performance JSON logging for Node.js/Edge runtime
 */

import pino, { type Logger as PinoLogger } from 'pino';
import { loggerConfig } from './config';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Create server logger instance
 */
function createServerLogger(): PinoLogger {
  const options: pino.LoggerOptions = {
    level: loggerConfig.level,
    base: loggerConfig.base,
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // Development: pretty print with colors
  if (isDev && loggerConfig.prettyPrint) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  // Production: JSON output
  return pino(options);
}

export const serverLogger = createServerLogger();

/**
 * Create a child logger with additional context
 */
export function createChildLogger(
  bindings: Record<string, string | number | boolean>
): PinoLogger {
  return serverLogger.child(bindings);
}

/**
 * Logger type export for type inference
 */
export type ServerLogger = typeof serverLogger;
