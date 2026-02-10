/**
 * Retry Utility with Exponential Backoff
 *
 * @description
 * - Exponential backoff with jitter for retry operations
 * - Configurable retry conditions
 * - Thundering Herd prevention
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch('/api/ai/jobs', { method: 'POST' }),
 *   { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000 }
 * );
 * ```
 *
 * @created 2025-12-30
 */

// ============================================================================
// Types
// ============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Jitter factor (0-1, default 0.1 = ±10%) */
  jitterFactor?: number;
  /** Custom function to determine if error is retryable */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback on each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: unknown;
  attempts: number;
  totalDelayMs: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> & {
  onRetry?: RetryOptions['onRetry'];
} = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.1,
  shouldRetry: defaultShouldRetry,
  onRetry: undefined,
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Calculate exponential backoff delay with jitter
 *
 * Formula: min(baseDelay * 2^attempt, maxDelay) * (1 ± jitter)
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterFactor: number = 0.1
): number {
  // Exponential backoff
  const exponentialDelay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);

  // Add jitter to prevent thundering herd
  const jitter = exponentialDelay * jitterFactor * (Math.random() * 2 - 1);

  return Math.round(exponentialDelay + jitter);
}

/**
 * Default retry condition checker
 *
 * Retries on:
 * - Network errors
 * - HTTP 5xx errors
 * - Timeout errors
 *
 * Does NOT retry on:
 * - HTTP 4xx errors (client errors)
 * - Authentication errors (401, 403)
 */
export function defaultShouldRetry(error: unknown, _attempt: number): boolean {
  // Network errors (no response)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Check for Response-like errors
  if (isResponseError(error)) {
    const status = error.status;

    // Don't retry client errors
    if (status >= 400 && status < 500) {
      return false;
    }

    // Retry server errors
    if (status >= 500) {
      return true;
    }
  }

  // Check for error with status property
  if (hasStatusCode(error)) {
    const status = error.status || error.statusCode;

    if (typeof status === 'number') {
      // Don't retry client errors
      if (status >= 400 && status < 500) {
        return false;
      }
      // Retry server errors
      if (status >= 500) {
        return true;
      }
    }
  }

  // Check for timeout errors
  if (isTimeoutError(error)) {
    return true;
  }

  // Check for connection errors
  if (isConnectionError(error)) {
    return true;
  }

  // Default: don't retry unknown errors
  return false;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const isLastAttempt = attempt >= opts.maxRetries;
      const canRetry = opts.shouldRetry?.(error, attempt) ?? false;

      if (isLastAttempt || !canRetry) {
        throw error;
      }

      // Calculate delay
      const delayMs = calculateBackoff(
        attempt,
        opts.baseDelayMs,
        opts.maxDelayMs,
        opts.jitterFactor
      );

      // Notify retry callback
      opts.onRetry?.(error, attempt + 1, delayMs);

      // Wait before retry
      await sleep(delayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Execute a function with retry and return detailed result
 */
export async function withRetryResult<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let totalDelayMs = 0;
  let attempts = 0;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    attempts = attempt + 1;

    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt >= opts.maxRetries;
      const canRetry = opts.shouldRetry?.(error, attempt) ?? false;

      if (isLastAttempt || !canRetry) {
        return {
          success: false,
          error: lastError,
          attempts,
          totalDelayMs,
        };
      }

      const delayMs = calculateBackoff(
        attempt,
        opts.baseDelayMs,
        opts.maxDelayMs,
        opts.jitterFactor
      );
      totalDelayMs += delayMs;

      opts.onRetry?.(error, attempt + 1, delayMs);
      await sleep(delayMs);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts,
    totalDelayMs,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isResponseError(error: unknown): error is { status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}

function hasStatusCode(
  error: unknown
): error is { status?: number; statusCode?: number } {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as Record<string, unknown>;
  return 'status' in e || 'statusCode' in e;
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('etimedout') ||
      message.includes('timed out')
    );
  }
  return false;
}

function isConnectionError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('network') ||
      message.includes('connection')
    );
  }
  return false;
}

// ============================================================================
// Specialized Retry Functions
// ============================================================================

/**
 * Retry specifically for HTTP fetch operations
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retryOptions?: Partial<RetryOptions>
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(url, init);

    // Throw on server errors to trigger retry
    if (response.status >= 500) {
      const error = new Error(`HTTP ${response.status}`);
      (error as Error & { status: number }).status = response.status;
      throw error;
    }

    return response;
  }, retryOptions);
}

// ============================================================================
// Preset Configurations
// ============================================================================

/** Aggressive retry for critical operations */
export const RETRY_AGGRESSIVE: RetryOptions = {
  maxRetries: 5,
  baseDelayMs: 500,
  maxDelayMs: 30000,
  jitterFactor: 0.15,
};

/** Standard retry for normal operations */
export const RETRY_STANDARD: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.1,
};

/** Conservative retry for non-critical operations */
export const RETRY_CONSERVATIVE: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 2000,
  maxDelayMs: 10000,
  jitterFactor: 0.05,
};

export default withRetry;
