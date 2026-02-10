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

/**
 * Trace ID 생성
 * @description UUID v4 형식의 trace ID 생성
 */
export function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ============================================================================
// W3C Trace Context (traceparent)
// ============================================================================

/** W3C traceparent 헤더 이름 (표준 소문자) */
export const TRACEPARENT_HEADER = 'traceparent';

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
 * W3C traceparent 헤더 생성
 * @format `00-{trace-id 32hex}-{parent-id 16hex}-{flags 2hex}`
 * @param traceId - 기존 UUID trace ID (하이픈 제거 후 사용). 미전달 시 새로 생성.
 */
export function generateTraceparent(traceId?: string): string {
  const tid = traceId
    ? traceId.replace(/-/g, '').slice(0, 32).padEnd(32, '0')
    : randomHex(16);
  const parentId = randomHex(8);
  return `00-${tid}-${parentId}-01`;
}

/**
 * W3C traceparent 헤더에서 trace-id 추출
 * @returns trace-id (32 hex) 또는 null
 */
export function parseTraceparentTraceId(traceparent: string): string | null {
  const match = traceparent.match(
    /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/
  );
  return match?.[1] ?? null;
}

/**
 * trace-id (32 hex)를 UUID 형식으로 변환
 * @example "4bf92f3577b34da6a3ce929d0e0e4736" → "4bf92f35-77b3-4da6-a3ce-929d0e0e4736"
 */
export function traceIdToUUID(traceId32: string): string {
  if (traceId32.length !== 32) return traceId32;
  return `${traceId32.slice(0, 8)}-${traceId32.slice(8, 12)}-${traceId32.slice(12, 16)}-${traceId32.slice(16, 20)}-${traceId32.slice(20)}`;
}
