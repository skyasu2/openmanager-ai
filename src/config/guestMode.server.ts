/**
 * 서버 사이드 전용 게스트 모드 유틸리티
 *
 * ✅ 단일 토글 환경 변수 우선순위 (NEXT_PUBLIC_* only - SSOT 원칙)
 * 1. NEXT_PUBLIC_GUEST_FULL_ACCESS (bool) - 서버/클라이언트 공통
 * 2. NEXT_PUBLIC_GUEST_MODE (문자열) - 서버/클라이언트 공통
 *
 * fallback: 'restricted'
 *
 * 🔧 v2.0: 서버 전용 환경변수 제거 (2025-10-24)
 * - 제거: GUEST_FULL_ACCESS_ENABLED, GUEST_MODE_ENABLED
 * - 이유: Client-Server 환경변수 불일치 해결 (SSOT 원칙)
 * - 참고: logs/ai-decisions/2025-10-24-guest-mode-codex-analysis.md
 */

import {
  GUEST_MODE,
  type GuestModeType,
  normalizeGuestModeValue,
  parseGuestBooleanFlag,
} from './guestMode';

function resolveBooleanFlag(): boolean | undefined {
  const candidates = [process.env.NEXT_PUBLIC_GUEST_FULL_ACCESS];

  for (const value of candidates) {
    const parsed = parseGuestBooleanFlag(value);
    if (typeof parsed === 'boolean') {
      return parsed;
    }
  }

  return undefined;
}

function resolveStringMode(): GuestModeType | undefined {
  const candidates = [process.env.NEXT_PUBLIC_GUEST_MODE];

  for (const value of candidates) {
    const normalized = normalizeGuestModeValue(value);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

export function getServerGuestMode(): GuestModeType {
  const booleanOverride = resolveBooleanFlag();
  if (typeof booleanOverride === 'boolean') {
    return booleanOverride ? GUEST_MODE.FULL_ACCESS : GUEST_MODE.RESTRICTED;
  }

  const stringMode = resolveStringMode();
  if (stringMode) {
    return stringMode;
  }

  // 기본값: 보안 원칙에 따라 RESTRICTED (2026-01-20 수정)
  return GUEST_MODE.RESTRICTED;
}

export function isGuestFullAccessEnabledServer(): boolean {
  return getServerGuestMode() === GUEST_MODE.FULL_ACCESS;
}
