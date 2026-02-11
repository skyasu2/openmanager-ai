/**
 * Async Context for Request-Scoped Tracing
 *
 * @description AsyncLocalStorage 기반 요청별 traceId 자동 전파
 * - Logger에서 자동으로 traceId를 포함
 * - 함수 시그니처에 traceId 전달 불필요
 * - Node.js (서버 사이드) 전용
 * - 클라이언트: Turbopack resolveAlias로 empty-module 대체 → noop
 *
 * @example
 * ```typescript
 * import { runWithTraceId, getTraceId } from '@/lib/tracing/async-context';
 *
 * // API route handler에서 컨텍스트 설정
 * await runWithTraceId(traceId, async () => {
 *   // 이 블록 내 모든 코드에서 getTraceId() 사용 가능
 *   logger.info('This log automatically includes traceId');
 * });
 * ```
 *
 * @created 2026-02-10
 * @updated 2026-02-11 - 클라이언트 번들 호환 (Turbopack empty-module 대응)
 */

import { AsyncLocalStorage } from 'node:async_hooks';

interface TraceContext {
  traceId: string;
}

// AsyncLocalStorage is undefined when resolved to empty-module (client/Turbopack)
const asyncLocalStorage =
  typeof AsyncLocalStorage === 'function'
    ? new AsyncLocalStorage<TraceContext>()
    : null;

/**
 * 현재 요청의 traceId 조회
 * AsyncLocalStorage 컨텍스트 밖에서 호출하면 undefined 반환
 */
export function getTraceId(): string | undefined {
  return asyncLocalStorage?.getStore()?.traceId;
}

/**
 * traceId 컨텍스트 내에서 함수 실행
 * 이 블록 내에서 호출되는 모든 비동기 코드에서 getTraceId() 사용 가능
 */
export function runWithTraceId<T>(
  traceId: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  if (!asyncLocalStorage) return fn();
  return asyncLocalStorage.run({ traceId }, fn);
}
