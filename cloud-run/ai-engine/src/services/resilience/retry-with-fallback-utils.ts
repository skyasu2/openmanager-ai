import type {
  GenerateTextOptions,
  RetryConfig,
} from './retry-with-fallback';

/**
 * Error codes that trigger fallback to next provider
 */
export const FALLBACK_ERROR_CODES = [
  404, // Model not found / deprecated
  410, // Gone / retired endpoint or model
  429, // Rate limit
  503, // Service unavailable
  502, // Bad gateway
  504, // Gateway timeout
];

/**
 * Error codes that should retry same provider
 */
export const RETRY_ERROR_CODES = [
  408, // Request timeout
  500, // Internal server error (transient)
];

export const SHORT_CONTEXT_LIMIT_TOKENS = 8_192;
const APPROX_CHARS_PER_TOKEN = 4;

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
export function getBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const delay = config.initialDelayMs * Math.pow(2, attempt);
  return Math.min(delay, config.maxDelayMs);
}

function getErrorStatusCode(error: Error): number | undefined {
  const anyError = error as {
    status?: number;
    statusCode?: number;
  };
  return anyError.status ?? anyError.statusCode;
}

function getErrorDetailsText(error: Error): string {
  const anyError = error as {
    data?: unknown;
    responseBody?: unknown;
  };
  const details = [
    error.message,
    typeof anyError.responseBody === 'string' ? anyError.responseBody : '',
    anyError.data ? JSON.stringify(anyError.data) : '',
  ];
  return details.join(' ').toLowerCase();
}

export function isProviderRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const statusCode = getErrorStatusCode(error);
  if (statusCode === 429) {
    return true;
  }

  const details = getErrorDetailsText(error);
  return (
    details.includes('rate limit') ||
    details.includes('too many requests') ||
    details.includes('too_many_requests') ||
    details.includes('queue_exceeded') ||
    details.includes('high traffic') ||
    details.includes('1302') ||
    details.includes('1303') ||
    details.includes('1305') ||
    details.includes('429')
  );
}

/**
 * Check if error should trigger fallback to next provider
 */
export function shouldFallback(error: unknown): boolean {
  if (error instanceof Error) {
    if (isProviderRateLimitError(error)) {
      return true;
    }

    const message = error.message.toLowerCase();

    if (message.includes('503') || message.includes('unavailable')) {
      return true;
    }

    const statusCode = getErrorStatusCode(error);
    if (statusCode && FALLBACK_ERROR_CODES.includes(statusCode)) {
      return true;
    }
  }

  return false;
}

export function estimateContextTokens(options: GenerateTextOptions): number {
  const messageTokens = options.messages.reduce(
    (total, message) =>
      total + Math.ceil(message.content.length / APPROX_CHARS_PER_TOKEN),
    0
  );
  return messageTokens + (options.maxOutputTokens ?? 2048);
}

/**
 * Check if error should trigger retry on same provider
 */
export function shouldRetry(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('econnreset')) {
      return true;
    }

    const anyError = error as { status?: number; statusCode?: number };
    if (anyError.status && RETRY_ERROR_CODES.includes(anyError.status)) {
      return true;
    }
  }

  return false;
}

export function createAttemptAbortController(
  timeoutMs: number,
  externalSignal?: AbortSignal
): {
  signal: AbortSignal;
  timeoutPromise: Promise<never>;
  externalAbortPromise?: Promise<never>;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutError = new Error('Request timeout');
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let removeExternalAbortListener: (() => void) | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort(timeoutError);
      reject(timeoutError);
    }, timeoutMs);
  });

  const externalAbortPromise = externalSignal
    ? new Promise<never>((_, reject) => {
        const abortFromExternalSignal = () => {
          const reason =
            externalSignal.reason instanceof Error
              ? externalSignal.reason
              : new Error('Request aborted');
          controller.abort(reason);
          reject(reason);
        };

        if (externalSignal.aborted) {
          abortFromExternalSignal();
          return;
        }

        externalSignal.addEventListener('abort', abortFromExternalSignal, {
          once: true,
        });
        removeExternalAbortListener = () =>
          externalSignal.removeEventListener('abort', abortFromExternalSignal);
      })
    : undefined;

  return {
    signal: controller.signal,
    timeoutPromise,
    externalAbortPromise,
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      removeExternalAbortListener?.();
    },
  };
}
