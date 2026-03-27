/**
 * Browser-side Logger
 *
 * Lightweight console wrapper with level filtering for client-side
 */

import { LOG_LEVEL_PRIORITY, type LogLevel } from './config';

type LogMethod = (...args: unknown[]) => void;

interface BrowserLoggerInterface {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  child: (bindings: Record<string, unknown>) => BrowserLoggerInterface;
}

/**
 * Get minimum log level for browser
 */
function getBrowserLogLevel(): LogLevel {
  if (typeof window === 'undefined') return 'info';

  // Check for explicit override
  const override = (window as { __LOG_LEVEL__?: LogLevel }).__LOG_LEVEL__;
  if (override) return override;

  // Production: error only (DevTools Console 노출 최소화)
  if (process.env.NODE_ENV === 'production') return 'error';

  // Development: all logs
  return 'debug';
}

const minLevel = getBrowserLogLevel();

/**
 * Check if log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

/**
 * Create a browser logger with optional prefix
 */
function createBrowserLogger(prefix?: string): BrowserLoggerInterface {
  const formatArgs = (args: unknown[]): unknown[] => {
    if (prefix) {
      return [`[${prefix}]`, ...args];
    }
    return args;
  };

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog('debug')) {
        console.debug(...formatArgs(args));
      }
    },
    info: (...args: unknown[]) => {
      if (shouldLog('info')) {
        console.info(...formatArgs(args));
      }
    },
    warn: (...args: unknown[]) => {
      if (shouldLog('warn')) {
        console.warn(...formatArgs(args));
      }
    },
    error: (...args: unknown[]) => {
      if (shouldLog('error')) {
        console.error(...formatArgs(args));
      }
    },
    child: (bindings: Record<string, unknown>) => {
      const childPrefix = bindings.module ?? bindings.component ?? 'unknown';
      const newPrefix = prefix
        ? `${prefix}:${String(childPrefix)}`
        : String(childPrefix);
      return createBrowserLogger(newPrefix);
    },
  };
}

export const browserLogger = createBrowserLogger();

/**
 * Logger type export for type inference
 */
export type BrowserLogger = typeof browserLogger;
