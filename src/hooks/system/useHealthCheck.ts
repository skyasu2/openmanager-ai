/**
 * useHealthCheck - AI Engine 및 시스템 Health Check 통합 훅
 *
 * @description
 * - SystemContextPanel, CloudRunStatusIndicator 등 중복 제거
 * - 싱글톤 패턴으로 동일 요청 방지
 * - Page Visibility API로 백그라운드 폴링 최적화
 * - AbortController로 요청 취소 지원
 *
 * @since v7.1.0
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

// ============================================================================
// Types
// ============================================================================

export type HealthStatus =
  | 'unknown'
  | 'checking'
  | 'healthy'
  | 'degraded'
  | 'error';

export type ProviderStatus = {
  name: string;
  status: 'active' | 'inactive' | 'error';
  role?: string;
  color?: string;
};

export type HealthCheckResult = {
  status: HealthStatus;
  providers: ProviderStatus[];
  latency: number | null;
  lastChecked: Date | null;
  isSystemOnline: boolean;
  error: string | null;
};

export type UseHealthCheckOptions = {
  /** 자동 폴링 간격 (ms). 0이면 비활성화. 기본값: 30000 (30초) */
  pollingInterval?: number;
  /** 페이지 가시성에 따라 폴링 중지. 기본값: true */
  pauseWhenHidden?: boolean;
  /** 초기 로드 시 자동 체크. 기본값: true */
  checkOnMount?: boolean;
  /** Health check API 서비스 파라미터. 기본값: 'ai' */
  service?: 'ai' | 'all';
};

// ============================================================================
// Global State Store (싱글톤 패턴)
// ============================================================================

type HealthStoreState = {
  result: HealthCheckResult;
  isChecking: boolean;
  subscribers: Set<() => void>;
  abortController: AbortController | null;
  lastRequestTime: number;
};

const DEBOUNCE_MS = 2000; // 2초 내 중복 요청 방지

const createInitialResult = (): HealthCheckResult => ({
  status: 'unknown',
  providers: [],
  latency: null,
  lastChecked: null,
  isSystemOnline: false,
  error: null,
});

const initialHealthResult = createInitialResult();

// 글로벌 상태 저장소 (싱글톤)
const healthStore: HealthStoreState = {
  result: initialHealthResult,
  isChecking: false,
  subscribers: new Set(),
  abortController: null,
  lastRequestTime: 0,
};

const notifySubscribers = () => {
  for (const callback of healthStore.subscribers) {
    callback();
  }
};

const subscribeToStore = (callback: () => void) => {
  healthStore.subscribers.add(callback);
  return () => {
    healthStore.subscribers.delete(callback);
  };
};

const getStoreSnapshot = () => healthStore.result;
const getServerSnapshot = () => initialHealthResult;

// ============================================================================
// Core Health Check Function
// ============================================================================

async function performHealthCheck(service: 'ai' | 'all' = 'ai'): Promise<void> {
  const now = Date.now();

  // 중복 요청 방지 (2초 debounce)
  if (
    healthStore.isChecking ||
    now - healthStore.lastRequestTime < DEBOUNCE_MS
  ) {
    return;
  }

  const controller = new AbortController();
  healthStore.abortController = controller;
  healthStore.isChecking = true;
  healthStore.lastRequestTime = now;
  healthStore.result = { ...healthStore.result, status: 'checking' };
  notifySubscribers();

  const startTime = Date.now();

  try {
    const response = await fetch(`/api/health?service=${service}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    const elapsed = Date.now() - startTime;

    if (response.ok) {
      const data = (await response.json()) as {
        status?: string;
        providers?: Array<{ name: string; status: string; role?: string }>;
        latency?: number;
      };

      // Provider 상태 매핑
      const providers: ProviderStatus[] = (data.providers || []).map((p) => ({
        name: p.name,
        status:
          p.status === 'healthy' ||
          p.status === 'online' ||
          p.status === 'active'
            ? 'active'
            : p.status === 'error'
              ? 'error'
              : 'inactive',
        role: p.role,
      }));

      const isHealthy =
        data.status === 'ok' ||
        data.status === 'healthy' ||
        data.status === 'online';

      healthStore.result = {
        status: isHealthy ? 'healthy' : 'degraded',
        providers,
        latency: data.latency ?? elapsed,
        lastChecked: new Date(),
        isSystemOnline: isHealthy,
        error: null,
      };
    } else {
      healthStore.result = {
        ...healthStore.result,
        status: 'error',
        latency: elapsed,
        lastChecked: new Date(),
        isSystemOnline: false,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    // AbortError는 정상적인 취소
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }

    healthStore.result = {
      ...healthStore.result,
      status: 'error',
      latency: Date.now() - startTime,
      lastChecked: new Date(),
      isSystemOnline: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    if (healthStore.abortController === controller) {
      healthStore.abortController = null;
    }
    healthStore.isChecking = false;
    notifySubscribers();
  }
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useHealthCheck(options: UseHealthCheckOptions = {}) {
  const {
    pollingInterval = 30000,
    pauseWhenHidden = true,
    checkOnMount = true,
    service = 'ai',
  } = options;

  // useSyncExternalStore로 글로벌 상태 구독
  const result = useSyncExternalStore(
    subscribeToStore,
    getStoreSnapshot,
    getServerSnapshot
  );

  const [isChecking, setIsChecking] = useState(healthStore.isChecking);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 체크 함수
  const check = useCallback(async () => {
    setIsChecking(true);
    try {
      await performHealthCheck(service);
    } finally {
      setIsChecking(false);
    }
  }, [service]);

  // 폴링 설정
  useEffect(() => {
    const isVisible = () =>
      typeof document === 'undefined' || document.visibilityState === 'visible';

    // 초기 체크
    if (checkOnMount && isVisible()) {
      void check();
    }

    // 폴링 시작
    if (pollingInterval > 0) {
      intervalRef.current = setInterval(() => {
        if (!pauseWhenHidden || isVisible()) {
          void check();
        }
      }, pollingInterval);
    }

    // Visibility 변경 핸들러
    const handleVisibility = () => {
      if (pauseWhenHidden && document.visibilityState === 'visible') {
        void check();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [pollingInterval, pauseWhenHidden, checkOnMount, check]);

  return {
    ...result,
    isChecking,
    check,
    // 편의 메서드
    isHealthy: result.status === 'healthy',
    isDegraded: result.status === 'degraded',
    isError: result.status === 'error',
  };
}

// ============================================================================
// Exports
// ============================================================================

export default useHealthCheck;
