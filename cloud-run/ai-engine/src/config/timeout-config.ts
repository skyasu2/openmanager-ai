import { logger } from '../lib/logger';
/**
 * Centralized Timeout Configuration
 *
 * Single source of truth for all timeout values across the AI Engine.
 * Ensures consistency between Vercel and Cloud Run constraints.
 *
 * @version 1.0.0
 * @created 2026-01-25
 */

// ============================================================================
// Platform Constraints
// ============================================================================

/**
 * Vercel Function limits
 * - Hobby: 10s (maxDuration)
 * - Pro (current): 60s (maxDuration, route별 10~60s 설정)
 * - Enterprise: 900s
 *
 * ⚠️ Current plan: Pro ($20/mo)
 * Streaming responses bypass maxDuration (only first byte must arrive within limit).
 * Non-streaming routes must complete within configured maxDuration.
 * Cloud Run internal timeouts below apply to Cloud Run's own 300s limit.
 */
export const VERCEL_CONSTRAINTS = {
  /** Hard limit imposed by Vercel proxy (Pro tier) */
  hardLimit: 60_000,
  /** Safety margin before proxy timeout */
  margin: 5_000,
  /** Effective timeout for non-streaming Vercel routes */
  effective: 55_000,
} as const;

/**
 * Cloud Run limits
 * - Default: 300s (5 minutes)
 * - Max: 3600s (1 hour) with configuration
 *
 * We use default 300s with 10s margin for cleanup
 */
export const CLOUD_RUN_CONSTRAINTS = {
  /** Hard limit configured in Cloud Run */
  hardLimit: 300_000,
  /** Safety margin for graceful shutdown */
  margin: 10_000,
  /** Effective timeout to use in code */
  effective: 290_000,
} as const;

// ============================================================================
// Layer-specific Timeouts
// ============================================================================

/**
 * Timeout configuration for each processing layer
 *
 * Architecture:
 *   Supervisor (50s) → Orchestrator (45s) → Agent (45s) → Subtask (30s) → Tool (25s)
 *
 * Each layer has progressively shorter timeouts to allow:
 * - Parent to handle child timeouts gracefully
 * - Error propagation and logging
 * - Cleanup and partial response generation
 */
export const TIMEOUT_CONFIG = {
  /**
   * Supervisor level (outermost)
   * - Manages overall request lifecycle
   * - Vercel proxy compliance (55s effective - 5s for cleanup)
   */
  supervisor: {
    /** Hard timeout - abort execution */
    hard: 50_000,
    /** Warning threshold - emit warning event */
    warning: 40_000,
    /** Soft timeout - start graceful degradation */
    soft: 45_000,
  },

  /**
   * Orchestrator level
   * - Routes to agents
   * - Task decomposition
   * - Parallel execution coordination
   */
  orchestrator: {
    /** Hard timeout for entire orchestration (5s headroom before Supervisor 50s) */
    hard: 45_000,
    /** Warning threshold for slow operations */
    warning: 30_000,
    /** Soft timeout for LLM routing decisions */
    routingDecision: 10_000,
  },

  /**
   * Agent level
   * - Individual agent execution (NLQ, Analyst, Reporter, Advisor)
   * - Tool calling + response generation
   */
  agent: {
    /** Hard timeout per agent execution */
    hard: 45_000,
    /** Warning threshold */
    warning: 35_000,
    /** Timeout for streaming responses */
    stream: 45_000,
  },

  /**
   * Subtask level (for parallel execution)
   * - Individual subtasks in Orchestrator-Worker pattern
   * - Shorter timeout to prevent one subtask blocking others
   */
  subtask: {
    /** Hard timeout per subtask */
    hard: 30_000,
    /** Warning threshold */
    warning: 25_000,
  },

  /**
   * Tool level
   * - Individual tool execution
   * - External API calls (Tavily, Supabase, etc.)
   */
  tool: {
    /** Hard timeout per tool call */
    hard: 25_000,
    /** Retry timeout for transient failures */
    retry: 5_000,
    /** Warning threshold */
    warning: 20_000,
  },

  /**
   * Reporter Pipeline
   * - Evaluator-Optimizer pattern with quality iterations
   */
  reporterPipeline: {
    /** Total pipeline timeout */
    total: 45_000,
    /** Per-iteration timeout */
    iteration: 20_000,
  },

  /**
   * External service timeouts
   * - API calls to third-party services
   */
  external: {
    /** LLM API call timeout */
    llmApi: 30_000,
    /** Tavily search timeout */
    tavily: 15_000,
    /** Redis operation timeout */
    redis: 5_000,
    /** Supabase query timeout */
    supabase: 10_000,
  },
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

export type TimeoutLayer = keyof typeof TIMEOUT_CONFIG;

export interface TimeoutInfo {
  hard: number;
  warning?: number;
  soft?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get timeout configuration for a specific layer
 */
export function getTimeoutConfig<T extends TimeoutLayer>(layer: T): (typeof TIMEOUT_CONFIG)[T] {
  return TIMEOUT_CONFIG[layer];
}

/**
 * Get the hard timeout for a layer
 */
export function getHardTimeout(layer: TimeoutLayer): number {
  const config = TIMEOUT_CONFIG[layer] as Record<string, unknown>;
  return (config.hard as number) ?? (config.total as number) ?? 30_000;
}

/**
 * Get the warning threshold for a layer
 */
export function getWarningThreshold(layer: TimeoutLayer): number {
  const config = TIMEOUT_CONFIG[layer] as Record<string, unknown>;
  return (config.warning as number) ?? getHardTimeout(layer) * 0.8;
}

/**
 * Check if elapsed time exceeds warning threshold
 */
export function isApproachingTimeout(layer: TimeoutLayer, elapsedMs: number): boolean {
  return elapsedMs >= getWarningThreshold(layer);
}

/**
 * Check if elapsed time exceeds hard timeout
 */
export function isTimedOut(layer: TimeoutLayer, elapsedMs: number): boolean {
  return elapsedMs >= getHardTimeout(layer);
}

/**
 * Calculate remaining time before timeout
 */
export function getRemainingTime(layer: TimeoutLayer, elapsedMs: number): number {
  return Math.max(0, getHardTimeout(layer) - elapsedMs);
}

/**
 * Create a timeout promise for use with Promise.race()
 */
export function createTimeoutPromise<T = never>(
  layer: TimeoutLayer,
  rejectValue?: T
): { promise: Promise<T>; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const promise = new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (!cancelled) {
        if (rejectValue !== undefined) {
          resolve(rejectValue);
        } else {
          reject(new Error(`Timeout exceeded for ${layer} (${getHardTimeout(layer)}ms)`));
        }
      }
    }, getHardTimeout(layer));
  });

  const cancel = () => {
    cancelled = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  };

  return { promise, cancel };
}

// ============================================================================
// Logging Helpers
// ============================================================================

/**
 * Log timeout event with consistent formatting
 */
export function logTimeoutWarning(
  layer: TimeoutLayer,
  operation: string,
  elapsedMs: number
): void {
  logger.warn(
    `⚠️ [Timeout:${layer}] ${operation} approaching timeout: ${elapsedMs}ms / ${getHardTimeout(layer)}ms ` +
      `(${((elapsedMs / getHardTimeout(layer)) * 100).toFixed(0)}%)`
  );
}

/**
 * Log timeout error with consistent formatting
 */
export function logTimeoutError(
  layer: TimeoutLayer,
  operation: string,
  elapsedMs: number
): void {
  logger.error(
    `🛑 [Timeout:${layer}] ${operation} TIMEOUT: ${elapsedMs}ms exceeded ${getHardTimeout(layer)}ms limit`
  );
}
