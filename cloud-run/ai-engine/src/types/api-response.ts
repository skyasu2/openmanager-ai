/**
 * Standardized API Response Types
 *
 * Provides consistent response structure across all endpoints.
 *
 * @version 1.0.0
 * @created 2025-12-28
 */

// ============================================================================
// 1. Base Response Types
// ============================================================================

/**
 * Success response wrapper
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Error response wrapper
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
  timestamp: string;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================================
// 2. Response Factory Functions
// ============================================================================

/**
 * Create a success response
 */
export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(
  error: string | Error,
  code?: string,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    error: error instanceof Error ? error.message : error,
    code,
    details,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// 3. Specific Response Types
// ============================================================================

/**
 * Supervisor response data
 */
export interface SupervisorResponseData {
  response: string;
  toolsCalled: string[];
  toolResults?: Record<string, unknown>[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata: {
    provider: string;
    modelId: string;
    stepsExecuted: number;
    durationMs: number;
    mode?: 'single' | 'multi' | 'auto';
    handoffs?: Array<{ from: string; to: string; reason?: string }>;
    finalAgent?: string;
  };
}

/**
 * Embedding response data
 */
export interface EmbeddingResponseData {
  embedding: number[];
  model: string;
  dimensions: number;
  cached?: boolean;
}

/**
 * Batch embedding response data
 */
export interface BatchEmbeddingResponseData {
  embeddings: number[][];
  model: string;
  dimensions: number;
  count: number;
}

/**
 * Generate response data
 */
export interface GenerateResponseData {
  text: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Health check response data
 */
export interface HealthResponseData {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  config?: Record<string, unknown>;
  redis?: boolean;
  version?: string;
}

/**
 * Stats response data (generic)
 */
export interface StatsResponseData {
  totalRequests: number;
  cacheHits?: number;
  cacheMisses?: number;
  averageLatencyMs?: number;
  [key: string]: unknown;
}

// ============================================================================
// 4. Error Codes
// ============================================================================

export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // AI-specific errors
  MODEL_ERROR: 'MODEL_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  TIMEOUT: 'TIMEOUT',
  AUTH_ERROR: 'AUTH_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
