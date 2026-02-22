/**
 * Runtime Log Level Control
 *
 * Allows changing Pino log level at runtime without restart.
 * Supports TTL-based auto-reset to prevent debug mode left on in production.
 */

import { serverLogger } from './server';
import { type LogLevel, loggerConfig } from './config';

const VALID_LEVELS: ReadonlySet<string> = new Set<LogLevel>([
  'debug',
  'info',
  'warn',
  'error',
  'silent',
]);
const MAX_TTL_SECONDS = 3600; // 1 hour

let resetTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Set the runtime log level with optional TTL auto-reset.
 * Changes take effect immediately on all subsequent log calls.
 */
export function setRuntimeLogLevel(level: LogLevel, ttlSeconds?: number): void {
  if (!VALID_LEVELS.has(level)) {
    throw new Error(
      `Invalid log level: ${level}. Valid: ${[...VALID_LEVELS].join(', ')}`
    );
  }

  // Clear any existing reset timer
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }

  serverLogger.level = level;

  if (ttlSeconds && ttlSeconds > 0) {
    const clampedTtl = Math.min(ttlSeconds, MAX_TTL_SECONDS);
    resetTimer = setTimeout(() => {
      resetToDefaultLogLevel();
    }, clampedTtl * 1000);
  }
}

/**
 * Get the current runtime log level.
 */
export function getRuntimeLogLevel(): LogLevel {
  return serverLogger.level as LogLevel;
}

/**
 * Get the default log level from environment/config (set at startup).
 */
export function getDefaultLogLevel(): LogLevel {
  return loggerConfig.level;
}

/**
 * Reset to the default log level and cancel any pending TTL timer.
 */
export function resetToDefaultLogLevel(): void {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  serverLogger.level = loggerConfig.level;
}
