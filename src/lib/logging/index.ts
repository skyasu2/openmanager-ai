/**
 * Unified Logger
 *
 * Automatically selects server or browser logger based on runtime environment.
 *
 * @example
 * ```typescript
 * import { logger } from '@/lib/logging';
 *
 * // Basic logging
 * logger.debug('Detailed debug info');
 * logger.info('General information');
 * logger.warn('Warning message');
 * logger.error('Error occurred', { context: {} });
 *
 * // Multiple arguments (console.log style)
 * logger.info('Value:', someValue, 'Count:', count);
 *
 * // Module-specific logger
 * const apiLogger = logger.child({ module: 'api' });
 * apiLogger.info('API request received');
 * ```
 */

import { type BrowserLogger, browserLogger } from './browser';
import { createChildLogger, type ServerLogger, serverLogger } from './server';

// Re-export config utilities
export { type LogLevel, loggerConfig, shouldLog } from './config';

// Runtime log level controls are server-only.
// Import directly from '@/lib/logging/runtime' in server contexts (API routes).
// Not re-exported here to avoid pulling pino into client bundles.

/**
 * Unified logger interface - accepts multiple arguments like console.log
 */
interface UnifiedLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  child: (bindings: Record<string, unknown>) => UnifiedLogger;
}

/**
 * Detect runtime environment
 */
const isServer = typeof window === 'undefined';

/**
 * Convert multiple arguments to a single log entry for Pino
 */
function formatForPino(args: unknown[]): { msg: string; context?: object } {
  if (args.length === 0) {
    return { msg: '' };
  }

  if (args.length === 1) {
    const first = args[0];
    if (typeof first === 'string') {
      return { msg: first };
    }
    if (typeof first === 'object' && first !== null) {
      return { msg: JSON.stringify(first), context: first as object };
    }
    return { msg: String(first) };
  }

  // Multiple arguments - combine into message string
  const msgParts: string[] = [];
  let context: object | undefined;

  for (const arg of args) {
    if (typeof arg === 'string') {
      msgParts.push(arg);
    } else if (typeof arg === 'object' && arg !== null) {
      // Keep the first object as context for Pino's structured logging
      if (!context) {
        context = arg as object;
      }
      msgParts.push(JSON.stringify(arg));
    } else {
      msgParts.push(String(arg));
    }
  }

  return { msg: msgParts.join(' '), context };
}

/**
 * Create server-side unified logger wrapper
 */
function createServerUnifiedLogger(): UnifiedLogger {
  return {
    debug: (...args: unknown[]) => {
      const { msg, context } = formatForPino(args);
      if (context) {
        serverLogger.debug(context, msg);
      } else {
        serverLogger.debug(msg);
      }
    },
    info: (...args: unknown[]) => {
      const { msg, context } = formatForPino(args);
      if (context) {
        serverLogger.info(context, msg);
      } else {
        serverLogger.info(msg);
      }
    },
    warn: (...args: unknown[]) => {
      const { msg, context } = formatForPino(args);
      if (context) {
        serverLogger.warn(context, msg);
      } else {
        serverLogger.warn(msg);
      }
    },
    error: (...args: unknown[]) => {
      const { msg, context } = formatForPino(args);
      if (context) {
        serverLogger.error(context, msg);
      } else {
        serverLogger.error(msg);
      }
    },
    child: (bindings) => {
      const childLogger = createChildLogger(
        bindings as Record<string, string | number | boolean>
      );
      return {
        debug: (...args: unknown[]) => {
          const { msg, context } = formatForPino(args);
          if (context) {
            childLogger.debug(context, msg);
          } else {
            childLogger.debug(msg);
          }
        },
        info: (...args: unknown[]) => {
          const { msg, context } = formatForPino(args);
          if (context) {
            childLogger.info(context, msg);
          } else {
            childLogger.info(msg);
          }
        },
        warn: (...args: unknown[]) => {
          const { msg, context } = formatForPino(args);
          if (context) {
            childLogger.warn(context, msg);
          } else {
            childLogger.warn(msg);
          }
        },
        error: (...args: unknown[]) => {
          const { msg, context } = formatForPino(args);
          if (context) {
            childLogger.error(context, msg);
          } else {
            childLogger.error(msg);
          }
        },
        child: (b) => createServerUnifiedLogger().child({ ...bindings, ...b }),
      };
    },
  };
}

/**
 * Create browser-side unified logger wrapper
 */
function createBrowserUnifiedLogger(): UnifiedLogger {
  return {
    debug: (...args: unknown[]) => browserLogger.debug(...args),
    info: (...args: unknown[]) => browserLogger.info(...args),
    warn: (...args: unknown[]) => browserLogger.warn(...args),
    error: (...args: unknown[]) => browserLogger.error(...args),
    child: (bindings) => {
      const childLogger = browserLogger.child(bindings);
      return {
        debug: (...args: unknown[]) => childLogger.debug(...args),
        info: (...args: unknown[]) => childLogger.info(...args),
        warn: (...args: unknown[]) => childLogger.warn(...args),
        error: (...args: unknown[]) => childLogger.error(...args),
        child: (b) => browserLogger.child({ ...bindings, ...b }),
      };
    },
  };
}

/**
 * Create unified logger that works in both environments
 */
function createUnifiedLogger(): UnifiedLogger {
  if (isServer) {
    return createServerUnifiedLogger();
  }
  return createBrowserUnifiedLogger();
}

/**
 * Main logger instance
 *
 * Use this for all logging throughout the application.
 * Automatically uses Pino on server, console wrapper in browser.
 */
export const logger = createUnifiedLogger();

/**
 * Create a module-specific logger
 *
 * @example
 * ```typescript
 * const apiLogger = createModuleLogger('api');
 * apiLogger.info('Request received');
 * ```
 */
export function createModuleLogger(module: string): UnifiedLogger {
  return logger.child({ module });
}

export { browserLogger } from './browser';
// Re-export individual loggers for advanced use cases
export { serverLogger } from './server';
export type { BrowserLogger, ServerLogger, UnifiedLogger };
