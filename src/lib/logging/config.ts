/**
 * Logger Configuration
 *
 * Environment-based log levels and settings
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LoggerConfig {
  level: LogLevel;
  prettyPrint: boolean;
  base: Record<string, string | undefined>;
}

const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Get log level based on environment
 */
function getLogLevel(): LogLevel {
  // Explicit override via env var
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL as LogLevel;
  }

  if (isTest) return 'silent';
  if (isDev) return 'debug';
  return 'info'; // production
}

export const loggerConfig: LoggerConfig = {
  level: getLogLevel(),
  prettyPrint: isDev,
  base: {
    env: process.env.NODE_ENV,
    version: process.env.APP_VERSION ?? process.env.npm_package_version,
  },
};

/**
 * Log level priority for filtering
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

/**
 * Check if a log level should be output based on current config
 */
export function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[loggerConfig.level];
}
