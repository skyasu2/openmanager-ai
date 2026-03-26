/** 로딩 메시지 애니메이션 + ESC 취소 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { debug } from '@/utils/debug';
import {
  LOADING_MESSAGE_INTERVAL_MS,
  SUCCESS_MESSAGE_TIMEOUT_MS,
} from '../login.constants';

type LoadingType = 'github' | 'guest' | 'google' | 'email' | null;

const LOADING_MESSAGES: Record<NonNullable<LoadingType>, readonly string[]> = {
  github: [
    'GitHub에 연결 중...',
    'OAuth 인증 대기 중...',
    '사용자 정보 확인 중...',
    '리다이렉트 준비 중...',
  ],
  google: [
    'Google에 연결 중...',
    'OAuth 인증 대기 중...',
    '보안 프로필 확인 중...',
    '로그인 승인 중...',
  ],
  guest: [
    '게스트 세션 생성 중...',
    '임시 프로필 설정 중...',
    '시스템 접근 권한 부여 중...',
    '메인 페이지로 이동 중...',
  ],
  email: [
    '이메일 확인 중...',
    'Magic Link 생성 중...',
    '이메일 발송 중...',
    '보안 링크 전송 완료!',
  ],
};

export function useLoadingMessages(
  isLoading: boolean,
  loadingType: LoadingType,
  deps: {
    setIsLoading: (v: boolean) => void;
    setLoadingType: (v: LoadingType) => void;
    setSuccessMessage: (msg: string | null) => void;
  }
) {
  const {
    setIsLoading,
    setLoadingType: setLoadingTypeFn,
    setSuccessMessage,
  } = deps;
  const [loadingMessage, setLoadingMessage] = useState('');

  // 단계별 로딩 메시지 효과
  useEffect(() => {
    if (!loadingType) return;

    const currentMessages =
      LOADING_MESSAGES[loadingType] || LOADING_MESSAGES.github;
    let messageIndex = 0;
    setLoadingMessage(currentMessages[0] ?? '로딩 중...');

    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % currentMessages.length;
      setLoadingMessage(currentMessages[messageIndex] ?? '로딩 중...');
    }, LOADING_MESSAGE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadingType]);

  // ESC 키로 로딩 취소
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLoading) {
        debug.log('🛑 로딩 취소됨');
        setIsLoading(false);
        setLoadingTypeFn(null);
        setLoadingMessage('');
        setSuccessMessage('로그인이 취소되었습니다.');
        setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isLoading, setIsLoading, setLoadingTypeFn, setSuccessMessage]);

  const handleCancelLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingTypeFn(null);
    setLoadingMessage('');
    setSuccessMessage('로그인이 취소되었습니다.');
    setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
  }, [setIsLoading, setLoadingTypeFn, setSuccessMessage]);

  return { loadingMessage, handleCancelLoading };
}
