'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SESSION_STORAGE_KEY = 'openmanager-ai-session-id';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30분 (Cloud Run context TTL과 동일)

type StoredSession = { sessionId: string; savedAt: number };

function loadPersistedSession(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const stored: StoredSession = JSON.parse(raw);
    if (Date.now() - stored.savedAt > SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return stored.sessionId;
  } catch {
    return null;
  }
}

function persistSession(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
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
    localStorage.removeItem(SESSION_STORAGE_KEY);
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
 * localStorage 영속화 (30분 TTL):
 * - 새로고침 시 Cloud Run 컨텍스트와 동일 세션 유지
 * - TTL 만료 또는 명시적 새 대화 시작 시 새 세션 생성
 */
export function useChatSession(initialSessionId?: string) {
  const [sessionId, setSessionIdState] = useState(
    () => initialSessionId ?? loadPersistedSession() ?? generateSessionId()
  );
  const sessionIdRef = useRef(sessionId);

  // ref를 항상 최신 상태와 동기화
  sessionIdRef.current = sessionId;

  // sessionId 변경 시 localStorage에 자동 저장
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
