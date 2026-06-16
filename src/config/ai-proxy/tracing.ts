/**
 * W3C Trace Context Utilities
 *
 * @description Trace ID 생성 및 W3C traceparent 헤더 처리
 * @see https://www.w3.org/TR/trace-context/
 *
 * @created 2026-02-10 - Extracted from ai-proxy.config.ts
 */

// ============================================================================
// Trace ID Generation
// ============================================================================

/** W3C traceparent 헤더 이름 (표준 소문자) */
export const TRACEPARENT_HEADER = 'traceparent';

const TRACE_ID_HEX_REGEX = /^[0-9a-f]{32}$/;
const PARENT_ID_HEX_REGEX = /^[0-9a-f]{16}$/;
const INVALID_TRACE_ID = '0'.repeat(32);
const INVALID_PARENT_ID = '0'.repeat(16);
const TRACEPARENT_REGEX =
  /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;
const DEFAULT_TRACE_FLAGS = '01';

interface TraceparentOptions {
  traceFlags?: string | null;
}

export interface ParsedTraceparent {
  traceId: string;
  traceFlags: string;
}

/**
 * 16진수 랜덤 문자열 생성
 */
function randomHex(bytes: number): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hex = '';
  for (let i = 0; i < bytes; i++) {
    hex += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * UUID 또는 32-hex trace ID를 W3C trace-id 형식으로 정규화합니다.
 */
export function normalizeTraceId(traceId?: string | null): string | null {
  if (typeof traceId !== 'string') {
    return null;
  }

  const normalized = traceId.trim().toLowerCase().replace(/-/g, '');
  if (!TRACE_ID_HEX_REGEX.test(normalized) || normalized === INVALID_TRACE_ID) {
    return null;
  }

  return normalized;
}

/**
 * Trace ID 생성
 * @description W3C/Langfuse 호환 32-hex trace ID 생성
 */
export function generateTraceId(): string {
  return randomHex(16);
}

function normalizeTraceFlags(traceFlags?: string | null): string {
  if (typeof traceFlags !== 'string') {
    return DEFAULT_TRACE_FLAGS;
  }

  const normalized = traceFlags.trim().toLowerCase();
  return /^[0-9a-f]{2}$/.test(normalized)
    ? normalized
    : DEFAULT_TRACE_FLAGS;
}

// ============================================================================
// W3C Trace Context (traceparent)
// ============================================================================

/**
 * W3C traceparent 헤더 생성
 * @format `00-{trace-id 32hex}-{parent-id 16hex}-{flags 2hex}`
 * @param traceId - 기존 trace ID. UUID/32-hex 모두 허용하며, 불일치 시 새로 생성합니다.
 */
export function generateTraceparent(
  traceId?: string,
  options?: TraceparentOptions
): string {
  const tid = normalizeTraceId(traceId) ?? generateTraceId();
  const parentId = randomHex(8);
  return `00-${tid}-${parentId}-${normalizeTraceFlags(options?.traceFlags)}`;
}

/**
 * W3C traceparent 헤더를 파싱합니다.
 * @returns normalized trace-id/flags 또는 null
 */
export function parseTraceparent(traceparent: string): ParsedTraceparent | null {
  const match = traceparent.trim().match(TRACEPARENT_REGEX);
  if (!match?.[1] || !match[2] || !match[3]) return null;

  const traceId = match[1].toLowerCase();
  const parentId = match[2].toLowerCase();
  if (!TRACE_ID_HEX_REGEX.test(traceId) || traceId === INVALID_TRACE_ID) {
    return null;
  }
  if (
    !PARENT_ID_HEX_REGEX.test(parentId) ||
    parentId === INVALID_PARENT_ID
  ) {
    return null;
  }

  return {
    traceId,
    traceFlags: match[3].toLowerCase(),
  };
}

/**
 * W3C traceparent 헤더에서 trace-id 추출
 * @returns trace-id (32 hex) 또는 null
 */
export function parseTraceparentTraceId(traceparent: string): string | null {
  return parseTraceparent(traceparent)?.traceId ?? null;
}

/**
 * W3C traceparent 헤더에서 trace flags 추출
 * @returns trace flags (2 hex) 또는 null
 */
export function parseTraceparentTraceFlags(
  traceparent: string
): string | null {
  return parseTraceparent(traceparent)?.traceFlags ?? null;
}

/**
 * trace-id (32 hex)를 UUID 형식으로 변환
 * @example "4bf92f3577b34da6a3ce929d0e0e4736" → "4bf92f35-77b3-4da6-a3ce-929d0e0e4736"
 */
export function traceIdToUUID(traceId32: string): string {
  const normalized = normalizeTraceId(traceId32);
  if (!normalized) return traceId32;
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}
