'use client';

import { useCallback, useSyncExternalStore } from 'react';
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

export interface UseSystemStatusOptions {
  enabled?: boolean;
}

type SystemStatusSnapshot = {
  status: SystemStatus | null;
  isLoading: boolean;
  error: string | null;
};

type SystemStatusStore = {
  snapshot: SystemStatusSnapshot;
  subscribers: Set<() => void>;
  intervalId: ReturnType<typeof setInterval> | null;
  focusHandler: (() => void) | null;
  abortController: AbortController | null;
  inFlightFetch: Promise<void> | null;
  lastFetchAt: number;
  lastFocusRefreshAt: number;
};

const SYSTEM_POLL_INTERVAL_MS = 10 * 60 * 1000; // 서버 데이터 10분 주기와 정렬
const FOCUS_REFRESH_THROTTLE_MS = 10 * 60 * 1000;
const MIN_REQUEST_GAP_MS = 5000;

const createInitialSnapshot = (): SystemStatusSnapshot => ({
  status: null,
  isLoading: true,
  error: null,
});

const initialSystemStatusSnapshot = createInitialSnapshot();

const systemStatusStore: SystemStatusStore = {
  snapshot: initialSystemStatusSnapshot,
  subscribers: new Set(),
  intervalId: null,
  focusHandler: null,
  abortController: null,
  inFlightFetch: null,
  lastFetchAt: 0,
  lastFocusRefreshAt: 0,
};

const getStoreSnapshot = () => systemStatusStore.snapshot;
const getServerSnapshot = () => initialSystemStatusSnapshot;
const disabledSystemStatusSnapshot: SystemStatusSnapshot = {
  status: null,
  isLoading: false,
  error: null,
};

const notifySubscribers = () => {
  for (const callback of systemStatusStore.subscribers) {
    callback();
  }
};

function updateSnapshot(partial: Partial<SystemStatusSnapshot>) {
  const current = systemStatusStore.snapshot;
  const nextStatus =
    partial.status === undefined ? current.status : partial.status;
  const nextIsLoading =
    partial.isLoading === undefined ? current.isLoading : partial.isLoading;
  const nextError = partial.error === undefined ? current.error : partial.error;

  if (
    Object.is(nextStatus, current.status) &&
    nextIsLoading === current.isLoading &&
    nextError === current.error
  ) {
    return;
  }

  systemStatusStore.snapshot = {
    status: nextStatus,
    isLoading: nextIsLoading,
    error: nextError,
  };
  notifySubscribers();
}

async function performFetch(options: { force?: boolean } = {}) {
  const { force = false } = options;
  const now = Date.now();

  if (systemStatusStore.inFlightFetch) {
    return systemStatusStore.inFlightFetch;
  }

  if (!force && now - systemStatusStore.lastFetchAt < MIN_REQUEST_GAP_MS) {
    return;
  }

  if (
    systemStatusStore.snapshot.status === null &&
    !systemStatusStore.snapshot.isLoading
  ) {
    updateSnapshot({ isLoading: true });
  }

  const controller = new AbortController();
  systemStatusStore.abortController = controller;

  let thisRequest: Promise<void> | null = null;
  const request = (async () => {
    try {
      const response = await fetch('/api/system', {
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as SystemStatus;
      const currentStatus = systemStatusStore.snapshot.status;
      const nextStatus = isStatusEqual(currentStatus, data)
        ? currentStatus
        : data;

      updateSnapshot({
        status: nextStatus,
        error: null,
        isLoading: false,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage =
        err instanceof Error ? err.message : '시스템 상태 조회 실패';
      updateSnapshot({ error: errorMessage, isLoading: false });
      // 네트워크 에러(페이지 전환, Cloud Run 미활성 등)는 예상 가능한 상황 — debug 레벨
      logger.debug('시스템 상태 조회 스킵:', errorMessage);
    } finally {
      if (systemStatusStore.abortController === controller) {
        systemStatusStore.abortController = null;
      }
      systemStatusStore.lastFetchAt = Date.now();
      if (systemStatusStore.inFlightFetch === thisRequest) {
        systemStatusStore.inFlightFetch = null;
      }
    }
  })();

  thisRequest = request;
  systemStatusStore.inFlightFetch = request;
  return request;
}

function ensureMonitoring() {
  if (systemStatusStore.intervalId) {
    return;
  }

  void performFetch();

  systemStatusStore.intervalId = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    void performFetch();
  }, SYSTEM_POLL_INTERVAL_MS);

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const handleFocus = () => {
    if (document.hidden) return;
    const now = Date.now();
    if (
      now - systemStatusStore.lastFocusRefreshAt <
      FOCUS_REFRESH_THROTTLE_MS
    ) {
      return;
    }
    systemStatusStore.lastFocusRefreshAt = now;
    void performFetch();
  };

  systemStatusStore.focusHandler = handleFocus;
  document.addEventListener('visibilitychange', handleFocus);
  window.addEventListener('focus', handleFocus);
}

function stopMonitoringIfIdle() {
  if (systemStatusStore.subscribers.size > 0) {
    return;
  }

  if (systemStatusStore.intervalId) {
    clearInterval(systemStatusStore.intervalId);
    systemStatusStore.intervalId = null;
  }

  if (systemStatusStore.focusHandler && typeof document !== 'undefined') {
    document.removeEventListener(
      'visibilitychange',
      systemStatusStore.focusHandler
    );
    window.removeEventListener('focus', systemStatusStore.focusHandler);
    systemStatusStore.focusHandler = null;
  }

  if (systemStatusStore.abortController) {
    systemStatusStore.abortController.abort();
    systemStatusStore.abortController = null;
    systemStatusStore.inFlightFetch = null;
  }
}

const subscribeToStore = (callback: () => void) => {
  systemStatusStore.subscribers.add(callback);
  ensureMonitoring();

  return () => {
    systemStatusStore.subscribers.delete(callback);
    stopMonitoringIfIdle();
  };
};

export function useSystemStatus(
  options: UseSystemStatusOptions = {}
): UseSystemStatusReturn {
  const { enabled = true } = options;
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!enabled) {
        return () => {};
      }
      return subscribeToStore(callback);
    },
    [enabled]
  );
  const getSnapshot = useCallback(
    () => (enabled ? getStoreSnapshot() : disabledSystemStatusSnapshot),
    [enabled]
  );
  const getServerSnapshotForMode = useCallback(
    () => (enabled ? getServerSnapshot() : disabledSystemStatusSnapshot),
    [enabled]
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshotForMode
  );

  const refresh = useCallback(async () => {
    if (!enabled) return;
    updateSnapshot({ isLoading: true });
    await performFetch({ force: true });
  }, [enabled]);

  const startSystem = useCallback(async () => {
    if (!enabled) return;

    // Guard against concurrent calls (e.g. double-click)
    if (systemStatusStore.snapshot.isLoading) return;

    try {
      updateSnapshot({ error: null, isLoading: true });

      const response = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });

      if (!response.ok) {
        throw new Error(`시스템 시작 실패: ${response.statusText}`);
      }

      await performFetch({ force: true });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '시스템 시작에 실패했습니다';
      updateSnapshot({ error: errorMessage, isLoading: false });
      logger.error('시스템 시작 실패:', err);
    }
  }, [enabled]);

  return {
    status: snapshot.status,
    isLoading: snapshot.isLoading,
    error: snapshot.error,
    refresh,
    startSystem,
  };
}
