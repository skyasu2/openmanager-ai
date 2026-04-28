/**
 * 🚀 Web Worker 통계 계산 Hook
 * 메인 스레드 블로킹 없이 백그라운드에서 서버 통계 계산
 *
 * 성능 이점:
 * - 메인 스레드 논블로킹
 * - 병렬 처리 가능
 * - 대용량 데이터 처리 최적화
 */

import { useCallback, useEffect, useRef } from 'react';
import type { EnhancedServerData } from '@/types/dashboard/server-dashboard.types'; // 🔧 Phase 77: type-only import로 순환 참조 완전 차단

export interface ServerStats {
  total: number;
  online: number;
  offline: number;
  warning: number;
  critical: number;
  averageCpu: number;
  averageMemory: number;
  averageUptime: number;
  totalBandwidth: number;
  typeDistribution: Record<string, number>;
  performanceMetrics: {
    calculationTime: number;
    serversProcessed: number;
  };
}

interface PaginationInfo {
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  startIndex: number;
  endIndex: number;
  currentPage?: number;
}

interface Filters {
  status?: string[];
  type?: string[];
  search?: string;
}

interface CombinedResult {
  filteredServers: EnhancedServerData[];
  stats: ServerStats;
  pagination: PaginationInfo;
  totalFiltered: number;
}

interface WorkerMessage {
  type: string;
  id: string;
  data?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
}

type WorkerCallback = (result: unknown) => void;

import { logger } from '@/lib/logging';

type WorkerErrorCallback = (error: Error) => void;
type WorkerTimeout = ReturnType<typeof setTimeout>;

const EXPECTED_WORKER_LIFECYCLE_MESSAGES = new Set([
  'Worker terminated',
  'Worker restarted',
  'Worker not available',
  'Worker not initialized',
]);

function getWorkerErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isExpectedWorkerLifecycleError(error: unknown): boolean {
  return EXPECTED_WORKER_LIFECYCLE_MESSAGES.has(getWorkerErrorMessage(error));
}

/**
 * 🔧 Web Worker 관리 Hook
 */
export const useWorkerStats = () => {
  const workerRef = useRef<Worker | null>(null);
  const callbacksRef = useRef<
    Map<
      string,
      {
        resolve: WorkerCallback;
        reject: WorkerErrorCallback;
        timeoutId: WorkerTimeout;
      }
    >
  >(new Map());
  const isInitializedRef = useRef(false);

  const rejectPendingOperations = useCallback((message: string) => {
    callbacksRef.current.forEach(({ reject, timeoutId }) => {
      clearTimeout(timeoutId);
      reject(new Error(message));
    });
    callbacksRef.current.clear();
  }, []);

  // 🚀 Worker 초기화
  const initializeWorker = useCallback(() => {
    if (workerRef.current || isInitializedRef.current) return;

    try {
      workerRef.current = new Worker('/workers/serverStatsWorker.js');
      isInitializedRef.current = true;

      // 메시지 핸들러 설정
      workerRef.current.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const { type, id, data, error } = e.data;

        if (type === 'WORKER_READY') {
          logger.info('🚀 Server Stats Worker initialized successfully');
          return;
        }

        if (!id) return;

        const callbacks = callbacksRef.current.get(id);
        if (!callbacks) return;

        callbacksRef.current.delete(id);
        clearTimeout(callbacks.timeoutId);

        if (type === 'SUCCESS') {
          callbacks.resolve(data);
        } else if (type === 'ERROR') {
          const errorObj = new Error(
            error?.message || 'Worker calculation failed'
          );
          if (error?.stack) {
            errorObj.stack = error.stack;
          }
          callbacks.reject(errorObj);
        }
      };

      // 에러 핸들러 설정
      workerRef.current.onerror = (error) => {
        logger.error('🚨 Worker error:', error);
        rejectPendingOperations('Worker crashed');
      };
    } catch (error) {
      logger.error('🚨 Worker initialization failed:', error);
      isInitializedRef.current = false;
    }
  }, [rejectPendingOperations]);

  // 🔄 Worker 메시지 전송 (Promise 기반)
  const sendMessage = useCallback(
    <T>(type: string, data: unknown): Promise<T> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const timeoutId = setTimeout(() => {
          const pending = callbacksRef.current.get(id);
          if (!pending) return;

          callbacksRef.current.delete(id);
          reject(new Error('Worker calculation timeout'));
        }, 30000);

        // 콜백 등록
        callbacksRef.current.set(id, {
          resolve: resolve as WorkerCallback,
          reject,
          timeoutId,
        });

        // Worker에 메시지 전송
        workerRef.current.postMessage({ type, data, id });
      });
    },
    []
  );

  // 📊 통합 계산 (가장 효율적인 방법)
  const calculateCombinedStats = useCallback(
    async (
      servers: EnhancedServerData[],
      filters: Filters,
      currentPage: number = 1,
      itemsPerPage: number = 10
    ): Promise<CombinedResult> => {
      if (!workerRef.current) {
        throw new Error('Worker not available');
      }

      return sendMessage<CombinedResult>('COMBINED_CALCULATION', {
        servers,
        filters,
        currentPage,
        itemsPerPage,
      });
    },
    [sendMessage]
  );

  // 📈 서버 통계만 계산 (Phase 76: 스키마 검증 추가)
  const calculateStats = useCallback(
    async (servers: EnhancedServerData[]): Promise<ServerStats> => {
      if (!workerRef.current) {
        logger.debug(
          'ℹ️ Worker unavailable before stats calculation, using sync fallback'
        );
        return calculateServerStatsFallback(servers);
      }

      try {
        const result = await sendMessage<ServerStats>('CALCULATE_STATS', {
          servers,
        });

        // 🛡️ Phase 76: Worker 응답 스키마 검증
        if (!isValidServerStats(result)) {
          logger.error('❌ Worker 응답 스키마 불일치, Fallback 사용:', result);
          return calculateServerStatsFallback(servers);
        }

        return result;
      } catch (error) {
        if (isExpectedWorkerLifecycleError(error)) {
          logger.debug(
            'ℹ️ Worker lifecycle interruption during stats calculation, using sync fallback:',
            getWorkerErrorMessage(error)
          );
        } else {
          logger.error('❌ Worker 계산 실패, Fallback 사용:', error);
        }
        return calculateServerStatsFallback(servers);
      }
    },
    [sendMessage]
  );

  // 📄 페이지네이션만 계산
  const calculatePagination = useCallback(
    async (
      totalItems: number,
      currentPage: number,
      itemsPerPage: number
    ): Promise<PaginationInfo> => {
      if (!workerRef.current) {
        throw new Error('Worker not available');
      }

      return sendMessage<PaginationInfo>('CALCULATE_PAGINATION', {
        totalItems,
        currentPage,
        itemsPerPage,
      });
    },
    [sendMessage]
  );

  // 🔍 필터링만 적용
  const applyFilters = useCallback(
    async (
      servers: EnhancedServerData[],
      filters: Filters
    ): Promise<EnhancedServerData[]> => {
      if (!workerRef.current) {
        throw new Error('Worker not available');
      }

      return sendMessage<EnhancedServerData[]>('APPLY_FILTERS', {
        servers,
        filters,
      });
    },
    [sendMessage]
  );

  // 🎯 Worker 상태 확인
  const isWorkerReady = useCallback(() => {
    return !!workerRef.current && isInitializedRef.current;
  }, []);

  // 🔄 Worker 재시작
  const restartWorker = useCallback(() => {
    if (workerRef.current) {
      rejectPendingOperations('Worker restarted');
      workerRef.current.terminate();
      workerRef.current = null;
      isInitializedRef.current = false;
    }
    initializeWorker();
  }, [initializeWorker, rejectPendingOperations]);

  // 🧹 정리
  useEffect(() => {
    initializeWorker();

    return () => {
      if (workerRef.current) {
        rejectPendingOperations('Worker terminated');
        workerRef.current.terminate();
        workerRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, [initializeWorker, rejectPendingOperations]);

  return {
    // 핵심 계산 함수들
    calculateCombinedStats,
    calculateStats,
    calculatePagination,
    applyFilters,

    // Worker 관리
    isWorkerReady,
    restartWorker,

    // 성능 모니터링
    get pendingOperations() {
      return callbacksRef.current.size;
    },
  };
};

/**
 * 🛡️ Fallback 동기 계산 함수들 (Worker 실패 시 사용)
 * Type Guard 함수들과 동일한 로직을 메인 스레드에서 실행
 */

// Type Guard 함수들 (재사용)
const isValidArray = <T>(value: unknown): value is T[] => {
  return Array.isArray(value) && value.length > 0;
};

const isValidServer = (value: unknown): value is EnhancedServerData => {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { id?: unknown }).id === 'string'
  );
};

const isValidNumber = (value: unknown): value is number => {
  return (
    typeof value === 'number' &&
    !Number.isNaN(value) &&
    Number.isFinite(value) &&
    value >= 0
  );
};

// 🛡️ ServerStats 타입 가드 (Phase 76)
const isValidServerStats = (value: unknown): value is ServerStats => {
  if (!value || typeof value !== 'object') return false;

  const stats = value as Partial<ServerStats>;

  return (
    typeof stats.total === 'number' &&
    typeof stats.online === 'number' &&
    typeof stats.offline === 'number' &&
    typeof stats.warning === 'number' &&
    typeof stats.critical === 'number' &&
    typeof stats.averageCpu === 'number' &&
    typeof stats.averageMemory === 'number' &&
    typeof stats.averageUptime === 'number' &&
    typeof stats.totalBandwidth === 'number' &&
    typeof stats.typeDistribution === 'object' &&
    stats.typeDistribution !== null &&
    typeof stats.performanceMetrics === 'object' &&
    stats.performanceMetrics !== null &&
    typeof stats.performanceMetrics.calculationTime === 'number' &&
    typeof stats.performanceMetrics.serversProcessed === 'number'
  );
};

// 🔄 Fallback 통계 계산
export const calculateServerStatsFallback = (
  servers: EnhancedServerData[]
): ServerStats => {
  if (!isValidArray(servers)) {
    return {
      total: 0,
      online: 0,
      offline: 0,
      warning: 0,
      critical: 0,
      averageCpu: 0,
      averageMemory: 0,
      averageUptime: 0,
      totalBandwidth: 0,
      typeDistribution: {},
      performanceMetrics: {
        calculationTime: 0,
        serversProcessed: 0,
      },
    };
  }

  const startTime = performance.now();
  const statusMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  let cpuSum = 0;
  let memorySum = 0;
  let uptimeSum = 0;
  let bandwidthSum = 0;
  let validServersCount = 0;

  for (const server of servers) {
    if (!isValidServer(server)) continue;

    validServersCount++;

    const status = server.status || 'unknown';
    statusMap.set(status, (statusMap.get(status) || 0) + 1);

    const type = server.type || 'unknown';
    typeMap.set(type, (typeMap.get(type) || 0) + 1);

    if (isValidNumber(server.cpu)) cpuSum += server.cpu;
    if (isValidNumber(server.memory)) memorySum += server.memory;
    if (isValidNumber(server.uptime)) uptimeSum += server.uptime;
    // 🔧 수정: bandwidth 속성 안전 접근 (optional)
    const bandwidth = (server as { bandwidth?: number }).bandwidth;
    if (isValidNumber(bandwidth)) bandwidthSum += bandwidth;
  }

  const safeAverage = (sum: number, count: number) =>
    count > 0 ? sum / count : 0;
  const endTime = performance.now();

  return {
    total: validServersCount,
    online: statusMap.get('online') || 0,
    offline: statusMap.get('offline') || 0,
    warning: statusMap.get('warning') || 0,
    critical: statusMap.get('critical') || 0,
    averageCpu: safeAverage(cpuSum, validServersCount),
    averageMemory: safeAverage(memorySum, validServersCount),
    averageUptime: safeAverage(uptimeSum, validServersCount),
    totalBandwidth: bandwidthSum,
    typeDistribution: Object.fromEntries(typeMap),
    performanceMetrics: {
      calculationTime: endTime - startTime,
      serversProcessed: validServersCount,
    },
  };
};
