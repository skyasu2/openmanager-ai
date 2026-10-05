'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EPHEMERAL_CHAT_STORAGE_KEYS } from '@/types/session';

const SESSION_STORAGE_KEY = EPHEMERAL_CHAT_STORAGE_KEYS.SESSION_ID;

type StoredSession = { sessionId: string; savedAt: number };

function loadPersistedSession(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const stored: StoredSession = JSON.parse(raw);
    return stored.sessionId;
  } catch {
    return null;
  }
}

function persistSession(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ sessionId, savedAt: Date.now() } satisfies StoredSession)
    );
  } catch {
    /* quota exceeded — ignore */
  }
}

function clearPersistedSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 고유 세션 ID 생성
 */
function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `session-${crypto.randomUUID()}`;
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 세션 ID 관리 훅
 *
 * useState + useRef 하이브리드 패턴:
 * - useState: 세션 변경 시 리렌더 트리거
 * - useRef: 콜백 내부에서 최신 값 참조
 *
 * sessionStorage 영속화 (탭 수명):
 * - 같은 탭 새로고침 시 Cloud Run Redis 이력(최대 1시간 TTL)과 같은 세션을 유지
 * - 탭을 1시간 넘게 열어두면 UI 메시지는 남을 수 있으나 서버 컨텍스트는 비어
 *   다음 질의부터 새 이력으로 시작한다. Redis TTL을 탭 수명에 맞추지 않는다.
 * - 탭 종료·다른 탭·로그아웃 시 새 대화로 리셋
 * - 명시적 새 대화 시작 시 새 세션 생성
 */
export function useChatSession(initialSessionId?: string) {
  const [sessionId, setSessionIdState] = useState(
    () => initialSessionId ?? loadPersistedSession() ?? generateSessionId()
  );
  const sessionIdRef = useRef(sessionId);

  // ref를 항상 최신 상태와 동기화
  sessionIdRef.current = sessionId;

  // sessionId 변경 시 sessionStorage에 저장 (탭 종료 시 삭제)
  useEffect(() => {
    persistSession(sessionId);
  }, [sessionId]);

  const refreshSessionId = useCallback(() => {
    clearPersistedSession();
    const next = generateSessionId();
    sessionIdRef.current = next;
    setSessionIdState(next);
    return next;
  }, []);

  const setSessionId = useCallback((newSessionId: string) => {
    sessionIdRef.current = newSessionId;
    setSessionIdState(newSessionId);
  }, []);

  return {
    sessionId,
    sessionIdRef,
    refreshSessionId,
    setSessionId,
  };
}
