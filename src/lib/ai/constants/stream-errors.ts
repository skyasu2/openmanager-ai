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

import {
  SYSTEM_NOT_RUNNING_ERROR,
  SYSTEM_NOT_RUNNING_MESSAGE,
} from '@/lib/system/system-running-contract';

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

/**
 * Patterns indicating authentication / authorization errors (401/403).
 * These errors should show a login prompt instead of a generic error.
 */
export const AUTH_ERROR_PATTERNS = [
  '401',
  'Unauthorized',
  '인증',
  '권한이 없습니다',
  'auth_proof',
  '로그인이 필요합니다',
] as const;

const BLOCKED_INPUT_ERROR_PATTERNS = [
  'Security: blocked input',
  'PROMPT_INJECTION',
  '보안 정책에 의해 차단된 요청입니다.',
  '입력 내용이 서버 모니터링 AI가 처리할 수 없는 형식입니다.',
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
 * Checks if an error message indicates an authentication/authorization error (401/403)
 */
export function isAuthRelatedError(errorMessage: string): boolean {
  return AUTH_ERROR_PATTERNS.some((pattern) =>
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

function tryParseErrorEnvelope(
  errorMessage: string
): { message?: string; error?: string; code?: string } | null {
  const trimmed = errorMessage.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      message?: unknown;
      error?: unknown;
      code?: unknown;
    };

    return {
      message: typeof parsed.message === 'string' ? parsed.message : undefined,
      error: typeof parsed.error === 'string' ? parsed.error : undefined,
      code: typeof parsed.code === 'string' ? parsed.code : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 시스템 실행 창이 닫힌 상태의 409를 식별한다.
 * 이 판정이 없으면 아래 sanitize의 envelope 분기가 가드 안내를
 * 일반 오류 문구로 덮어써, 사용자가 "시스템을 시작하라"는 안내를 못 본다.
 */
export function isSystemNotRunningError(errorMessage: string): boolean {
  if (!errorMessage?.trim()) return false;

  const envelope = tryParseErrorEnvelope(errorMessage);
  const candidates = [errorMessage, envelope?.error, envelope?.message].filter(
    (value): value is string => typeof value === 'string'
  );

  return candidates.some((candidate) =>
    candidate.toLowerCase().includes(SYSTEM_NOT_RUNNING_ERROR.toLowerCase())
  );
}

export function isBlockedInputError(errorMessage: string): boolean {
  if (!errorMessage?.trim()) return false;

  const envelope = tryParseErrorEnvelope(errorMessage);
  const candidates = [
    errorMessage,
    envelope?.message,
    envelope?.error,
    envelope?.code,
  ].filter((value): value is string => typeof value === 'string');

  return candidates.some((candidate) =>
    BLOCKED_INPUT_ERROR_PATTERNS.some((pattern) =>
      candidate.toLowerCase().includes(pattern.toLowerCase())
    )
  );
}

export function sanitizeDisplayedErrorMessage(errorMessage: string): string {
  if (!errorMessage?.trim()) {
    return 'AI 응답 중 오류가 발생했습니다.';
  }

  if (isSystemNotRunningError(errorMessage)) {
    return SYSTEM_NOT_RUNNING_MESSAGE;
  }

  if (isBlockedInputError(errorMessage)) {
    return '입력 내용이 서버 모니터링 AI가 처리할 수 없는 형식입니다. 다른 표현으로 다시 시도해주세요.';
  }

  const envelope = tryParseErrorEnvelope(errorMessage);
  if (envelope) {
    return '요청을 처리하는 중 오류가 발생했습니다.';
  }

  return errorMessage;
}
