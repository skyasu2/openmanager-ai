/**
 * Stream Error Constants (SSOT)
 *
 * Shared constants for stream error handling between:
 * - API Proxy (server-side): encodes errors into stream
 * - Client Hooks: detects errors from stream content
 *
 * @created 2026-01-20
 * @updated 2026-01-20 - Codex review feedback: improved regex, simplified logic
 */

// ============================================================================
// Error Markers
// ============================================================================

/**
 * Stream error marker prefix used by API proxy to encode errors
 * Format: "\n\n⚠️ 오류: {errorMessage}"
 */
export const STREAM_ERROR_MARKER = '⚠️ 오류:';

/**
 * Patterns indicating Cold Start or timeout-related errors
 * These errors trigger the ColdStartErrorBanner with auto-retry
 */
export const COLD_START_ERROR_PATTERNS = [
  'Stream error',
  'timeout',
  '504',
  'ECONNRESET',
  'fetch failed',
  'ETIMEDOUT',
  'socket hang up',
] as const;

/**
 * Patterns indicating model configuration / permission errors.
 * These errors are usually non-retryable without config changes.
 */
export const MODEL_CONFIG_ERROR_PATTERNS = [
  'does not exist or you do not have access',
  'model does not exist',
  'invalid model',
  'model_not_found',
  'no access to model',
] as const;

// ============================================================================
// Error Detection
// ============================================================================

/**
 * Regex pattern to extract error message from stream content
 * Robust to various newline formats:
 * - Start of string: "^⚠️ 오류: {message}"
 * - Double newline: "\n\n⚠️ 오류: {message}"
 * - Single newline: "\n⚠️ 오류: {message}"
 * - Windows CRLF: "\r\n⚠️ 오류: {message}"
 *
 * @updated 2026-01-20 - Made newline-agnostic per Codex review
 */
export const STREAM_ERROR_REGEX = new RegExp(
  `(?:^|\\r?\\n\\r?\\n?|\\n)${STREAM_ERROR_MARKER}\\s*([^\\n]+)`,
  'm'
);

/**
 * Extracts error message from stream content if present
 * Returns null if no error pattern found
 *
 * @example
 * extractStreamError("\n\n⚠️ 오류: Stream error") // "Stream error"
 * extractStreamError("⚠️ 오류: timeout") // "timeout"
 * extractStreamError("Normal AI response") // null
 *
 * @updated 2026-01-20 - Simplified logic per Codex review (removed dead branches)
 */
export function extractStreamError(content: string): string | null {
  if (!content?.trim()) return null;

  const match = content.match(STREAM_ERROR_REGEX);
  const errorMessage = match?.[1]?.trim();

  return errorMessage || null;
}

/**
 * Checks if an error message indicates a Cold Start error
 */
export function isColdStartRelatedError(errorMessage: string): boolean {
  return COLD_START_ERROR_PATTERNS.some((pattern) =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Checks if an error message indicates a model config/permission issue.
 */
export function isModelConfigRelatedError(errorMessage: string): boolean {
  return MODEL_CONFIG_ERROR_PATTERNS.some((pattern) =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}
