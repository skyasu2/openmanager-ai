/** URL 파라미터 파싱 + 리다이렉트 로직 */

'use client';

import { useEffect, useState } from 'react';
import debug from '@/utils/debug';
import { LOGIN_POLICY_COPY } from '@/lib/auth/login-policy-copy';
import {
  DEFAULT_REDIRECT_PATH,
  REDIRECT_STORAGE_KEY,
  sanitizeRedirectPath,
} from '../login.constants';

export function useLoginUrlParams(deps: {
  setErrorMessage: (msg: string | null) => void;
  setSuccessMessage: (msg: string | null) => void;
}) {
  const { setErrorMessage, setSuccessMessage } = deps;
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);

  // 현재 로그인 방식 감지 (계정 전환 시 해당 버튼 숨김)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const current = searchParams.get('current');
    if (current === 'github' || current === 'google' || current === 'guest') {
      setCurrentProvider(current);
    }
  }, []);

  // URL 파라미터에서 에러 메시지와 리다이렉트 URL 확인
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const error = searchParams.get('error');
    const message = searchParams.get('message');
    const warning = searchParams.get('warning');
    const redirectTo = searchParams.get('redirectTo');
    const code = searchParams.get('code');

    // OAuth 콜백 코드가 있으면 /auth/callback으로 리다이렉트
    if (code) {
      debug.log('🔐 OAuth 콜백 코드 감지:', code);
      debug.log('🔄 /auth/callback으로 리다이렉트 중...');
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      callbackUrl.search = window.location.search;
      window.location.href = callbackUrl.toString();
      return;
    }

    // redirectTo 파라미터가 있으면 안전한 내부 경로만 세션 스토리지에 저장
    const safeRedirectFromQuery = sanitizeRedirectPath(redirectTo);
    if (
      safeRedirectFromQuery &&
      safeRedirectFromQuery !== DEFAULT_REDIRECT_PATH
    ) {
      try {
        sessionStorage.setItem(REDIRECT_STORAGE_KEY, safeRedirectFromQuery);
        debug.log('🔗 로그인 후 리다이렉트 URL 저장:', safeRedirectFromQuery);
      } catch (error) {
        debug.warn('⚠️ redirect 세션 저장 실패, 기본 경로로 이동합니다:', error);
      }
    } else if (redirectTo && redirectTo !== DEFAULT_REDIRECT_PATH) {
      debug.warn('⚠️ 유효하지 않은 redirectTo 파라미터 무시:', redirectTo);
    }

    if (error && message) {
      setErrorMessage(decodeURIComponent(message));
    } else if (error === 'provider_error') {
      setErrorMessage(
        'OAuth 설정을 확인해주세요. 아래 가이드를 참고하거나 다른 인증 방식을 이용하세요.'
      );
    } else if (error === 'auth_callback_failed') {
      setErrorMessage('인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } else if (error === 'pkce_failed') {
      setErrorMessage(
        '인증 코드 처리에 실패했습니다. 소셜/이메일 로그인 또는 게스트 모드로 재시도해 주세요.'
      );
      try {
        const keysToRemove = Object.keys(localStorage).filter(
          (key) => key.startsWith('sb-') || key.includes('supabase')
        );
        for (const key of keysToRemove) {
          localStorage.removeItem(key);
        }
      } catch {
        // Safari Private Browsing 등 localStorage 접근 불가 시 무시
      }
    } else if (error === 'session_timeout') {
      setErrorMessage('세션 생성에 실패했습니다. 다시 로그인해주세요.');
    } else if (error === 'guest_region_blocked') {
      const countryCode = searchParams.get('country');
      setErrorMessage(
        countryCode
          ? `현재 지역(${countryCode})에서는 ${LOGIN_POLICY_COPY.guestRegionBlockedPrompt}`
          : `현재 지역에서는 ${LOGIN_POLICY_COPY.guestRegionBlockedPrompt}`
      );
    } else if (error === 'guest_pin_invalid') {
      setErrorMessage(
        '게스트 PIN 4자리가 올바르지 않습니다. 다시 확인해주세요.'
      );
    } else if (error === 'guest_pin_required') {
      setErrorMessage(
        '게스트 PIN이 설정되지 않았습니다. 관리자에게 문의해주세요.'
      );
    } else if (warning === 'no_session') {
      setSuccessMessage(
        '인증이 완료되었지만 세션이 생성되지 않았습니다. 게스트 모드를 이용해주세요.'
      );
    }
  }, [setErrorMessage, setSuccessMessage]);

  return { currentProvider };
}
