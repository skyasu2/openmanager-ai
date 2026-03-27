/**
 * Centralized Error Handler
 *
 * Provides consistent error handling across all API endpoints.
 *
 * @version 1.0.0
 * @created 2025-12-28
 */

import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createErrorResponse, ErrorCodes, type ErrorCode } from '../types/api-response';
import { logger } from './logger';

// ============================================================================
// 1. Error Classification
// ============================================================================

/**
 * Classify error and determine appropriate HTTP status code
 */
function classifyError(error: unknown): { code: ErrorCode; status: ContentfulStatusCode } {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Authentication errors
  if (message.includes('api key') || message.includes('unauthorized') || message.includes('auth')) {
    return { code: ErrorCodes.AUTH_ERROR, status: 401 };
  }

  // Rate limiting
  if (message.includes('rate limit') || message.includes('quota') || message.includes('too many')) {
    return { code: ErrorCodes.RATE_LIMIT, status: 429 };
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out') || message.includes('deadline')) {
    return { code: ErrorCodes.TIMEOUT, status: 504 };
  }

  // Model/Provider errors
  if (message.includes('model') || message.includes('provider') || message.includes('llm')) {
    return { code: ErrorCodes.MODEL_ERROR, status: 503 };
  }

  // Validation errors
  if (message.includes('required') || message.includes('invalid') || message.includes('missing')) {
    return { code: ErrorCodes.VALIDATION_ERROR, status: 400 };
  }

  // Not found
  if (message.includes('not found') || message.includes('does not exist')) {
    return { code: ErrorCodes.NOT_FOUND, status: 404 };
  }

  // Default: internal error
  return { code: ErrorCodes.INTERNAL_ERROR, status: 500 };
}

const ERROR_STATUS_BY_CODE: Record<string, ContentfulStatusCode> = {
  [ErrorCodes.AUTH_ERROR]: 401,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.BAD_REQUEST]: 400,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.RATE_LIMIT]: 429,
  [ErrorCodes.TIMEOUT]: 504,
  [ErrorCodes.MODEL_ERROR]: 503,
  [ErrorCodes.PROVIDER_ERROR]: 503,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  CIRCUIT_OPEN: 503,
  NO_VISION_PROVIDER: 503,
  HARD_TIMEOUT: 504,
  STREAM_ERROR: 503,
  PROMPT_INJECTION: 400,
};

const PUBLIC_ERROR_MESSAGES: Record<string, string> = {
  [ErrorCodes.AUTH_ERROR]: 'Unauthorized',
  [ErrorCodes.UNAUTHORIZED]: 'Unauthorized',
  [ErrorCodes.VALIDATION_ERROR]: 'Invalid request',
  [ErrorCodes.BAD_REQUEST]: 'Invalid request',
  [ErrorCodes.NOT_FOUND]: 'Resource not found',
  [ErrorCodes.RATE_LIMIT]: 'Rate limit exceeded',
  [ErrorCodes.TIMEOUT]: 'Request timed out',
  [ErrorCodes.MODEL_ERROR]: 'Service unavailable',
  [ErrorCodes.PROVIDER_ERROR]: 'Service unavailable',
  [ErrorCodes.SERVICE_UNAVAILABLE]: 'Service unavailable',
  [ErrorCodes.INTERNAL_ERROR]: 'Internal Server Error',
  CIRCUIT_OPEN: 'AI providers are temporarily unavailable',
  NO_VISION_PROVIDER: 'Vision features are temporarily unavailable',
  HARD_TIMEOUT: 'Request timed out',
  STREAM_ERROR: 'Service unavailable',
  STREAM_ERROR_OCCURRED: 'A streaming issue occurred during response generation',
  UNKNOWN_ERROR: 'Internal Server Error',
  PROMPT_INJECTION: 'Security: blocked input',
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getStatusForErrorCode(code?: string): ContentfulStatusCode {
  if (!code) {
    return 500;
  }
  return ERROR_STATUS_BY_CODE[code] ?? 500;
}

export function getPublicErrorMessage(code?: string): string {
  if (!code) {
    return PUBLIC_ERROR_MESSAGES[ErrorCodes.INTERNAL_ERROR];
  }
  return PUBLIC_ERROR_MESSAGES[code] ?? PUBLIC_ERROR_MESSAGES[ErrorCodes.INTERNAL_ERROR];
}

export function getPublicErrorResponse(
  error: unknown
): { code: string; status: ContentfulStatusCode; message: string } {
  const { code, status } = classifyError(error);
  return {
    code,
    status,
    message: getPublicErrorMessage(code),
  };
}

export function sanitizeErrorData(data: unknown): Record<string, unknown> & { code: string } {
  const payload = isObjectRecord(data) ? { ...data } : {};
  const code = typeof payload.code === 'string' ? payload.code : ErrorCodes.INTERNAL_ERROR;
  const publicMessage = getPublicErrorMessage(code);

  if ('error' in payload) {
    payload.error = publicMessage;
  }

  if ('message' in payload || !('error' in payload)) {
    payload.message = publicMessage;
  }

  payload.code = code;
  return payload as Record<string, unknown> & { code: string };
}

// ============================================================================
// 2. Error Handler Functions
// ============================================================================

/**
 * Handle API errors with automatic classification
 * @param c - Hono context
 * @param error - Error to handle
 * @param logPrefix - Prefix for console logging
 */
export function handleApiError(
  c: Context,
  error: unknown,
  logPrefix = 'API'
): Response {
  const { code, status, message } = getPublicErrorResponse(error);
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Log error with prefix
  logger.error(`❌ [${logPrefix}] Error:`, errorMessage);

  // Return standardized error response
  return c.json(createErrorResponse(message, code), status);
}

/**
 * Handle validation errors (400 Bad Request)
 */
export function handleValidationError(
  c: Context,
  message: string,
  details?: unknown
): Response {
  logger.warn(`⚠️ [Validation] ${message}`);
  return c.json(createErrorResponse(message, ErrorCodes.VALIDATION_ERROR, details), 400 as ContentfulStatusCode);
}

/**
 * Handle not found errors (404)
 */
export function handleNotFoundError(
  c: Context,
  resource: string
): Response {
  const message = `${resource} not found`;
  logger.warn(`⚠️ [NotFound] ${message}`);
  return c.json(createErrorResponse(message, ErrorCodes.NOT_FOUND), 404 as ContentfulStatusCode);
}

/**
 * Handle unauthorized errors (401)
 */
export function handleUnauthorizedError(c: Context): Response {
  logger.warn(`⚠️ [Auth] Unauthorized request`);
  return c.json(createErrorResponse('Unauthorized', ErrorCodes.UNAUTHORIZED), 401 as ContentfulStatusCode);
}

// ============================================================================
// 3. Async Error Wrapper
// ============================================================================

/**
 * Wrap async route handler with error handling
 * Use this for routes where you want automatic error handling
 */
export function withErrorHandler<T>(
  handler: (c: Context) => Promise<T>,
  logPrefix = 'API'
): (c: Context) => Promise<T | Response> {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (error) {
      return handleApiError(c, error, logPrefix);
    }
  };
}

// ============================================================================
// 4. Success Response Helper
// ============================================================================

/**
 * Create a success JSON response
 */
export function jsonSuccess<T extends object>(c: Context, data: T, status: ContentfulStatusCode = 200): Response {
  return c.json(
    {
      success: true as const,
      ...(data as Record<string, unknown>),
      timestamp: new Date().toISOString(),
    },
    status
  );
}

/**
 * Create a simple success response with data wrapper
 */
export function jsonSuccessData<T>(c: Context, data: T, status: ContentfulStatusCode = 200): Response {
  return c.json(
    {
      success: true as const,
      data,
      timestamp: new Date().toISOString(),
    },
    status
  );
}
