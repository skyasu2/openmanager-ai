/** 게스트 로그인 전체 플로우 (상태 + Effects + 핸들러) */

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isGuestFullAccessEnabled } from '@/config/guestMode';
import { authStateManager } from '@/lib/auth/auth-state-manager';
import type { AuthUser } from '@/lib/auth/auth-state-manager-types';
import {
  AUTH_SESSION_ID_KEY,
  AUTH_TYPE_KEY,
  AUTH_USER_KEY,
  LEGACY_GUEST_SESSION_COOKIE_KEY,
} from '@/lib/auth/guest-session-utils';
import { triggerAIWarmup } from '@/utils/ai-warmup';
import debug from '@/utils/debug';
import {
  DEFAULT_REDIRECT_PATH,
  PAGE_REDIRECT_DELAY_MS,
  REDIRECT_STORAGE_KEY,
  sanitizeRedirectPath,
} from '../login.constants';

// ============================================================================
// Types & Constants
// ============================================================================

interface GuestSessionData {
  sessionId: string;
  user: AuthUser;
}

type GuestLoginErrorCode =
  | 'guest_pin_invalid'
  | 'guest_pin_required'
  | 'guest_pin_rate_limited'
  | 'guest_region_blocked'
  | 'guest_session_issue_failed';

interface GuestLoginPayload {
  success?: boolean;
  error?: GuestLoginErrorCode | string;
  message?: string;
  sessionId?: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
  countryCode?: string;
}

const GUEST_PIN_PATTERN = /^\d{4}$/;

function parseRetryAfterSeconds(
  response: Response,
  payload: GuestLoginPayload
): number {
  const retryAfterHeader = response.headers.get('Retry-After');
  const headerValue = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(headerValue) && headerValue > 0) {
    return Math.ceil(headerValue);
  }

  const bodyValue = payload.retryAfterSeconds;
  if (typeof bodyValue === 'number' && Number.isFinite(bodyValue)) {
    return Math.max(1, Math.ceil(bodyValue));
  }

  return 0;
}

function createGuestAttemptSeed(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

// ============================================================================
// Hook
// ============================================================================

export function useGuestLogin(deps: {
  setIsLoading: (v: boolean) => void;
  setLoadingType: (v: 'github' | 'guest' | 'google' | 'email' | null) => void;
  setErrorMessage: (msg: string | null) => void;
  setSuccessMessage: (msg: string | null) => void;
}) {
  const router = useRouter();
  const isGuestFullAccessMode = isGuestFullAccessEnabled();

  const [guestSession, setGuestSession] = useState<GuestSessionData | null>(
    null
  );
  const [guestPinInput, setGuestPinInput] = useState('');
  const [guestAttemptsLeft, setGuestAttemptsLeft] = useState<number | null>(
    null
  );
  const [guestLockUntilMs, setGuestLockUntilMs] = useState<number | null>(null);
  const [guestLockRemainingSeconds, setGuestLockRemainingSeconds] = useState(0);
  const [guestAttemptSeed] = useState(createGuestAttemptSeed);

  // Guest 모드 초기화
  useEffect(() => {
    debug.log('🎛️ [GuestMode] Login UI mode resolved', {
      mode: isGuestFullAccessMode ? 'full_access' : 'restricted',
    });

    if (isGuestFullAccessMode) {
      setGuestPinInput('');
      setGuestAttemptsLeft(null);
      setGuestLockUntilMs(null);
      setGuestLockRemainingSeconds(0);
    }
  }, [isGuestFullAccessMode]);

  // 잠금 카운트다운 타이머
  useEffect(() => {
    if (!guestLockUntilMs) {
      setGuestLockRemainingSeconds(0);
      return;
    }

    const syncRemaining = () => {
      const remaining = Math.ceil((guestLockUntilMs - Date.now()) / 1000);
      if (remaining <= 0) {
        setGuestLockUntilMs(null);
        setGuestLockRemainingSeconds(0);
        return;
      }
      setGuestLockRemainingSeconds(remaining);
    };

    syncRemaining();
    const timer = window.setInterval(syncRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [guestLockUntilMs]);

  // guestSession 변경 → localStorage 저장 + 페이지 이동
  useEffect(() => {
    if (guestSession) {
      try {
        localStorage.setItem(AUTH_SESSION_ID_KEY, guestSession.sessionId);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(guestSession.user));
      } catch {
        // Safari Private Browsing 등 localStorage 쓰기 불가 시 무시
      }

      const isProduction = window.location.protocol === 'https:';
      const secureFlag = isProduction ? '; Secure' : '';
      document.cookie = `${LEGACY_GUEST_SESSION_COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
      document.cookie = `${AUTH_TYPE_KEY}=; path=/; max-age=0; SameSite=Lax${secureFlag}`;

      debug.log(
        '✅ 게스트 세션 저장 완료 (localStorage), 페이지 이동:',
        guestSession.user.name
      );

      let targetPath = DEFAULT_REDIRECT_PATH;
      try {
        const savedRedirect = sessionStorage.getItem(REDIRECT_STORAGE_KEY);
        const safeSavedRedirect = sanitizeRedirectPath(savedRedirect);
        targetPath = safeSavedRedirect || DEFAULT_REDIRECT_PATH;

        if (savedRedirect) {
          sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
        }
        if (savedRedirect && !safeSavedRedirect) {
          debug.warn(
            '⚠️ 저장된 redirect 경로가 유효하지 않아 기본 경로로 이동:',
            savedRedirect
          );
        }
      } catch (error) {
        debug.warn('⚠️ redirect 세션 조회 실패, 기본 경로로 이동합니다:', error);
      }

      router.push(targetPath);
      router.refresh();

      const redirectTimer = setTimeout(() => {
        if (window.location.pathname === '/login') {
          window.location.href = targetPath;
        }
      }, PAGE_REDIRECT_DELAY_MS);

      return () => clearTimeout(redirectTimer);
    }
    return undefined;
  }, [guestSession, router]);

  // 게스트 로그인 핸들러
  const handleGuestLogin = async () => {
    try {
      deps.setIsLoading(true);
      deps.setLoadingType('guest');
      deps.setErrorMessage(null);
      deps.setSuccessMessage(null);

      debug.log('👤 게스트 로그인 시작...');

      if (guestLockRemainingSeconds > 0) {
        deps.setErrorMessage(
          `게스트 PIN 재시도가 잠겨 있습니다. ${guestLockRemainingSeconds}초 후 다시 시도해주세요.`
        );
        return;
      }

      const secureId = guestAttemptSeed;

      const guestUser: AuthUser = {
        id: `guest_${secureId}`,
        name: '게스트 사용자',
        email: `guest_${secureId.substring(0, 8)}@example.com`,
        provider: 'guest',
      };

      let guestPin: string | undefined;
      if (!isGuestFullAccessMode) {
        const normalizedPin = guestPinInput.trim();
        if (!GUEST_PIN_PATTERN.test(normalizedPin)) {
          deps.setErrorMessage('게스트 PIN은 4자리 숫자로 입력해주세요.');
          setGuestAttemptsLeft(null);
          return;
        }
        guestPin = normalizedPin;
      }

      let sessionId = `guest_${guestAttemptSeed}`;
      try {
        sessionId = localStorage.getItem(AUTH_SESSION_ID_KEY) || sessionId;
      } catch {
        // Safari Private Browsing 등 localStorage 접근 불가 시 fallback
      }

      try {
        const guestLoginAuditResponse = await fetch('/api/auth/guest-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            guestUserId: guestUser.id,
            guestEmail: guestUser.email,
            guestPin,
          }),
        });

        const payload = (await guestLoginAuditResponse
          .json()
          .catch(() => ({}))) as GuestLoginPayload;

        if (!guestLoginAuditResponse.ok) {
          const retryAfterSeconds = parseRetryAfterSeconds(
            guestLoginAuditResponse,
            payload
          );

          if (
            guestLoginAuditResponse.status === 429 ||
            payload.error === 'guest_pin_rate_limited'
          ) {
            if (retryAfterSeconds > 0) {
              setGuestLockUntilMs(Date.now() + retryAfterSeconds * 1000);
            }
            setGuestAttemptsLeft(0);
            deps.setErrorMessage(
              payload.message ||
                `게스트 PIN을 5회 연속 잘못 입력했습니다. ${
                  retryAfterSeconds > 0 ? retryAfterSeconds : 60
                }초 후 다시 시도해주세요.`
            );
            return;
          }

          if (payload.error === 'guest_pin_invalid') {
            if (typeof payload.attemptsLeft === 'number') {
              setGuestAttemptsLeft(Math.max(0, payload.attemptsLeft));
            }
            deps.setErrorMessage(
              payload.message ||
                '게스트 PIN 4자리가 올바르지 않습니다. 다시 확인해주세요.'
            );
            return;
          }

          if (payload.error === 'guest_pin_required') {
            deps.setErrorMessage(
              payload.message ||
                '게스트 PIN이 설정되지 않았습니다. 관리자에게 문의해주세요.'
            );
            return;
          }

          if (payload.error === 'guest_region_blocked') {
            deps.setErrorMessage(
              payload.message ||
                '현재 지역에서는 게스트 로그인이 제한됩니다. GitHub 또는 Google 로그인을 이용해주세요.'
            );
            return;
          }

          deps.setErrorMessage(
            payload.message ||
              '게스트 로그인 검증에 실패했습니다. 잠시 후 다시 시도해주세요.'
          );
          return;
        }

        if (payload.sessionId && typeof payload.sessionId === 'string') {
          sessionId = payload.sessionId;
        }
      } catch (auditError) {
        debug.warn('⚠️ 게스트 로그인 감사 로그 API 호출 실패:', auditError);
        deps.setErrorMessage(
          '게스트 로그인 검증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        );
        return;
      }

      await authStateManager.setGuestAuth(guestUser);
      setGuestAttemptsLeft(null);
      setGuestLockUntilMs(null);
      setGuestPinInput('');
      setGuestSession({ sessionId, user: guestUser });

      // 🚀 Cloud Run 선제 웜업: 로그인 성공 즉시 발사
      // 시스템 시작 → 대시보드 → AI 사이드바까지 ~15초 여유로 cold start 해소
      void triggerAIWarmup('guest-login-success');
    } catch (error) {
      debug.error('게스트 로그인 실패:', error);
      deps.setErrorMessage('게스트 로그인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      deps.setIsLoading(false);
      deps.setLoadingType(null);
    }
  };

  return {
    guestPinInput,
    setGuestPinInput,
    guestAttemptsLeft,
    guestLockRemainingSeconds,
    handleGuestLogin,
  };
}
