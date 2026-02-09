'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logging';

// 🔧 깊은 비교 함수 (불필요한 리렌더링 방지)
function isStatusEqual(
  a: SystemStatus | null,
  b: SystemStatus | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  // services 깊은 비교 (DB/Cache/AI 장애 감지)
  const servicesEqual =
    a.services?.database === b.services?.database &&
    a.services?.cache === b.services?.cache &&
    a.services?.ai === b.services?.ai;

  return (
    a.isRunning === b.isRunning &&
    a.isStarting === b.isStarting &&
    a.userCount === b.userCount &&
    a.uptime === b.uptime &&
    a.version === b.version &&
    a.environment === b.environment &&
    servicesEqual
    // Note: lastUpdate 변경은 의도적으로 무시 (리렌더링 방지)
  );
}

export interface SystemStatus {
  isRunning: boolean;
  isStarting: boolean;
  lastUpdate: string;
  userCount: number;
  version: string;
  environment: string;
  uptime: number; // 초 단위
  services?: {
    database: boolean;
    cache: boolean;
    ai: boolean;
  };
}

export interface UseSystemStatusReturn {
  status: SystemStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startSystem: () => Promise<void>;
}

export function useSystemStatus(): UseSystemStatusReturn {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFocusRefresh, setLastFocusRefresh] = useState<number>(0);
  const statusRef = useRef<SystemStatus | null>(null); // 🔧 비교용 ref

  // 🔧 상태 업데이트 최적화: 변경된 경우만 setState 호출
  const updateStatusIfChanged = useCallback((newStatus: SystemStatus) => {
    if (!isStatusEqual(statusRef.current, newStatus)) {
      statusRef.current = newStatus;
      setStatus(newStatus);
    }
  }, []);

  // 공통 상태 조회 함수 (중복 제거)
  const performFetch = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch('/api/system', { signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        updateStatusIfChanged(data);
        setError(null);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const errorMessage =
          err instanceof Error ? err.message : '시스템 상태 조회 실패';
        setError(errorMessage);
        logger.error('시스템 상태 조회 실패:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [updateStatusIfChanged]
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await performFetch();
  }, [performFetch]);

  const startSystem = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });

      if (!response.ok) {
        throw new Error(`시스템 시작 실패: ${response.statusText}`);
      }

      // 시스템 시작 후 상태 새로고침 - 인라인 구현
      const statusResponse = await fetch('/api/system');
      if (statusResponse.ok) {
        const data = await statusResponse.json();
        setStatus(data);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '시스템 시작에 실패했습니다';
      setError(errorMessage);
      logger.error('시스템 시작 실패:', err);
    }
  }, []); // fetchStatus 의존성 제거하여 React Error #310 해결

  // 초기 로드 및 주기적 업데이트
  useEffect(() => {
    const abortController = new AbortController();

    // 초기 로드
    void performFetch(abortController.signal);

    // 30초마다 상태 업데이트
    const interval = setInterval(() => {
      void performFetch(abortController.signal);
    }, 30000);

    return () => {
      clearInterval(interval);
      abortController.abort();
    };
  }, [performFetch]);

  // 페이지 포커스 시 상태 새로고침 (2분 throttle)
  useEffect(() => {
    const abortController = new AbortController();

    const handleFocus = () => {
      if (!document.hidden) {
        const now = Date.now();
        if (now - lastFocusRefresh > 120000) {
          setLastFocusRefresh(now);
          void performFetch(abortController.signal);
        }
      }
    };

    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
      abortController.abort();
    };
  }, [lastFocusRefresh, performFetch]);

  return {
    status,
    isLoading,
    error,
    refresh,
    startSystem,
  };
}
