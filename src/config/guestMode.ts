/**
 * 게스트 모드 설정
 *
 * 환경 변수로 게스트 접근 권한을 제어합니다.
 *
 * ⚠️ 주의: NEXT_PUBLIC_ 환경 변수는 빌드 타임에 번들링됩니다.
 * Vercel에서 환경 변수 변경 후 반드시 재빌드가 필요합니다.
 *
 * ✅ 2025-10-21 업데이트
 * - `NEXT_PUBLIC_GUEST_FULL_ACCESS=true|false` 형태의 단일 토글 지원
 * - 기존 `NEXT_PUBLIC_GUEST_MODE=full_access|restricted`와 완벽 호환
 *
 * @example
 * // .env.local (개발 환경)
 * NEXT_PUBLIC_GUEST_FULL_ACCESS=true
 *
 * // Vercel 환경 변수 (프로덕션)
 * NEXT_PUBLIC_GUEST_FULL_ACCESS=false
 *
 */

import { logger } from '@/lib/logging';
export const GUEST_MODE = {
  /** 게스트가 모든 기능 사용 가능 (개발용) */
  FULL_ACCESS: 'full_access',
  /** 게스트 접근 제한 (프로덕션용) */
  RESTRICTED: 'restricted',
} as const;

export type GuestModeType = (typeof GUEST_MODE)[keyof typeof GUEST_MODE];

const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on', 'full_access']);
const FALSY_VALUES = new Set(['0', 'false', 'no', 'off', 'restricted']);

// 디버그 로그 한 번만 출력 (리렌더링 스팸 방지)
let hasLoggedOnce = false;

/**
 * boolean 형태의 환경 변수 값을 파싱합니다.
 *
 * @returns true | false | undefined (인식할 수 없는 값은 undefined)
 */
export function parseGuestBooleanFlag(
  value?: string | null
): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (TRUTHY_VALUES.has(normalized)) return true;
  if (FALSY_VALUES.has(normalized)) return false;
  return undefined;
}

/**
 * 문자열 형태의 모드 값을 정규화합니다.
 *
 * @returns GuestModeType | undefined
 */
export function normalizeGuestModeValue(
  value?: string | null
): GuestModeType | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/^['"]|['"]$/g, '');
  if (normalized === GUEST_MODE.FULL_ACCESS) return GUEST_MODE.FULL_ACCESS;
  if (normalized === GUEST_MODE.RESTRICTED) return GUEST_MODE.RESTRICTED;
  return undefined;
}

/**
 * 현재 게스트 모드 설정을 반환합니다.
 *
 * @returns 'full_access' | 'restricted'
 * @default 'restricted' (환경 변수 미설정 시 보안 우선)
 */
export function getGuestMode(): GuestModeType {
  const booleanOverride = parseGuestBooleanFlag(
    process.env.NEXT_PUBLIC_GUEST_FULL_ACCESS
  );
  if (typeof booleanOverride === 'boolean') {
    return booleanOverride ? GUEST_MODE.FULL_ACCESS : GUEST_MODE.RESTRICTED;
  }

  const mode =
    normalizeGuestModeValue(process.env.NEXT_PUBLIC_GUEST_MODE) ||
    GUEST_MODE.RESTRICTED;

  // 디버그: 환경 변수 값 확인 (클라이언트, 한 번만)
  if (typeof window !== 'undefined' && !hasLoggedOnce) {
    hasLoggedOnce = true;
    logger.info('🎛️ [GuestMode] Init', {
      envBoolean: process.env.NEXT_PUBLIC_GUEST_FULL_ACCESS ?? null,
      envMode: process.env.NEXT_PUBLIC_GUEST_MODE ?? null,
      resolvedMode: mode,
    });
  }

  return mode;
}

/**
 * 게스트 전체 접근이 허용되었는지 확인합니다.
 *
 * @returns true: 게스트가 모든 기능 사용 가능
 * @returns false: 게스트 접근 제한 (기본값)
 */
export function isGuestFullAccessEnabled(): boolean {
  // 🛠️ 테스트/진단용 강제 활성화 플래그
  if (parseGuestBooleanFlag(process.env.NEXT_PUBLIC_FORCE_SHOW_AI)) {
    return true;
  }

  return getGuestMode() === GUEST_MODE.FULL_ACCESS;
}

/**
 * 게스트가 시스템 시작 버튼 등 제어 기능을 사용할 수 있는지 여부
 * @default true
 */
export function isGuestSystemStartEnabled(): boolean {
  const flag = parseGuestBooleanFlag(
    process.env.NEXT_PUBLIC_GUEST_SYSTEM_START_ENABLED
  );

  if (typeof flag === 'boolean') {
    return flag;
  }

  // 별도 설정이 없다면 개발/테스트 편의성을 위해 허용
  return true;
}

/**
 * 현재 게스트 모드 설정 정보를 반환합니다.
 *
 * @returns 설정 정보 객체
 */
export function getGuestModeInfo() {
  const mode = getGuestMode();

  return {
    mode,
    isFullAccess: mode === GUEST_MODE.FULL_ACCESS,
    isRestricted: mode === GUEST_MODE.RESTRICTED,
    description:
      mode === GUEST_MODE.FULL_ACCESS
        ? '게스트 모든 권한 허용 (개발 모드)'
        : '게스트 접근 제한 (프로덕션 모드)',
  };
}
