/**
 * AI 엔진 웜업 유틸리티
 *
 * Cloud Run cold start 대응을 위한 조기 웜업 기능
 * - 세션 내 중복 호출 방지 (5분 쿨다운)
 * - Fire-and-forget 패턴 (실패해도 사용자 경험 미영향)
 */

import { logger } from '@/lib/logging';

const WARMUP_COOLDOWN_MS = 5 * 60 * 1000; // 5분 쿨다운 (Cloud Run 무료 티어 최적화)
const WARMUP_STORAGE_KEY = 'ai_warmup_timestamp';

// sessionStorage 비활성 환경을 위한 메모리 fallback
let lastWarmupMemory = 0;

/**
 * 마지막 웜업 시간 조회
 * - NaN 값 자동 복구
 * - sessionStorage 비활성 시 메모리 fallback
 */
function getLastWarmupTime(): number {
  try {
    if (typeof window === 'undefined') return 0;
    const stored = sessionStorage.getItem(WARMUP_STORAGE_KEY);
    const parsed = stored ? Number.parseInt(stored, 10) : 0;
    // NaN 값 자동 복구
    if (Number.isNaN(parsed)) {
      sessionStorage.removeItem(WARMUP_STORAGE_KEY);
      return 0;
    }
    return parsed;
  } catch {
    // sessionStorage 비활성 시 메모리 fallback
    return lastWarmupMemory;
  }
}

/**
 * 웜업 시간 기록
 * - sessionStorage 비활성 시 메모리에 저장
 */
function setWarmupTime(): void {
  const now = Date.now();
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(WARMUP_STORAGE_KEY, now.toString());
      return;
    }
  } catch {
    // sessionStorage 비활성 시 메모리에 저장
  }
  lastWarmupMemory = now;
}

/**
 * 웜업이 필요한지 확인 (쿨다운 체크)
 */
function needsWarmup(): boolean {
  const lastWarmup = getLastWarmupTime();
  return Date.now() - lastWarmup > WARMUP_COOLDOWN_MS;
}

/**
 * AI 엔진 웜업 트리거
 *
 * - 5분 쿨다운 내에는 중복 호출하지 않음
 * - Fire-and-forget: 결과 무시, 실패해도 사용자 경험 미영향
 *
 * @param source 호출 위치 (로깅용)
 * @returns 실제 웜업 요청이 전송되었는지 여부
 */
export async function triggerAIWarmup(source?: string): Promise<boolean> {
  // 쿨다운 체크
  if (!needsWarmup()) {
    logger.debug(
      `[AI Warmup] Skipped (cooldown) - source: ${source || 'unknown'}`
    );
    return false;
  }

  // 타임스탬프 먼저 기록 (중복 요청 방지)
  setWarmupTime();

  try {
    await fetch('/api/ai/wake-up', { method: 'POST' });
    logger.debug(`[AI Warmup] Triggered - source: ${source || 'unknown'}`);
    return true;
  } catch {
    // Fire-and-forget: 실패해도 무시
    return true; // 요청은 시도됨
  }
}

/**
 * 웜업 상태 리셋 (테스트용)
 */
export function resetWarmupState(): void {
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(WARMUP_STORAGE_KEY);
    }
  } catch {
    // 무시
  }
}
