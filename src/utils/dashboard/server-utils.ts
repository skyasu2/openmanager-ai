import { calculateServerStatsFallback } from '@/hooks/useWorkerStats';
import type {
  EnhancedServerData,
  ServerStats,
} from '@/types/dashboard/server-dashboard.types';

// 🛡️ 2025 모던 Type Guard 함수들 (Best Practices)
export const isValidArray = <T>(value: unknown): value is T[] => {
  return Array.isArray(value) && value.length > 0;
};

export const isValidServer = (value: unknown): value is EnhancedServerData => {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).id === 'string'
  );
};

export const isValidNumber = (value: unknown): value is number => {
  return (
    typeof value === 'number' &&
    !Number.isNaN(value) &&
    Number.isFinite(value) &&
    value >= 0
  );
};

export const _hasValidLength = (
  value: unknown
): value is { length: number } => {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.hasOwn(value, 'length') &&
    isValidNumber((value as Record<string, unknown>).length)
  );
};

// 🚀 성능 최적화: Map 기반 캐싱 시스템
const statsCache = new Map<string, ServerStats>();
// const _serverGroupCache = new Map<string, Map<string, EnhancedServerData[]>>(); // Unused

export const getServerGroupKey = (servers: EnhancedServerData[]): string => {
  return servers
    .map((s) => `${s.id}:${s.status}:${s.cpu}:${s.memory}:${s.disk}`)
    .join('|');
};

export const _groupServersByStatus = (
  servers: EnhancedServerData[]
): Map<string, EnhancedServerData[]> => {
  const groups = new Map<string, EnhancedServerData[]>();

  for (const server of servers) {
    if (!isValidServer(server)) continue;

    const status = server.status || 'unknown';
    if (!groups.has(status)) {
      groups.set(status, []);
    }
    const bucket = groups.get(status);
    bucket?.push(server);
  }

  return groups;
};

// 🚀 Web Worker 결과를 레거시 포맷으로 변환하는 어댑터 함수
export const adaptWorkerStatsToLegacy = (workerStats: {
  total?: number;
  online?: number;
  offline?: number;
  unknown?: number;
  warning?: number;
  critical?: number;
  averageCpu?: number;
  averageMemory?: number;
  averageUptime?: number;
  totalBandwidth?: number;
  typeDistribution?: Record<string, number>;
  performanceMetrics?: { calculationTime: number; serversProcessed: number };
}): ServerStats => {
  return {
    total: workerStats.total || 0,
    online: workerStats.online || 0,
    unknown: workerStats.unknown || workerStats.offline || 0,
    warning: workerStats.warning || 0,
    critical: workerStats.critical || 0,
    avgCpu: Math.round(workerStats.averageCpu || 0),
    avgMemory: Math.round(workerStats.averageMemory || 0),
    avgDisk: 0,
    averageCpu: workerStats.averageCpu,
    averageMemory: workerStats.averageMemory,
    averageUptime: workerStats.averageUptime,
    totalBandwidth: workerStats.totalBandwidth,
    typeDistribution: workerStats.typeDistribution,
    performanceMetrics: workerStats.performanceMetrics,
  };
};

export const calculateServerStats = (
  servers: EnhancedServerData[]
): ServerStats => {
  if (!isValidArray<EnhancedServerData>(servers)) {
    return {
      total: 0,
      online: 0,
      unknown: 0,
      warning: 0,
      critical: 0,
      avgCpu: 0,
      avgMemory: 0,
      avgDisk: 0,
    };
  }

  // 🚀 캐시 키 생성 및 캐시 확인
  const cacheKey = getServerGroupKey(servers);
  if (statsCache.has(cacheKey)) {
    const cachedStats = statsCache.get(cacheKey);
    if (cachedStats) {
      return cachedStats;
    }
  }

  // 🚀 Fallback 계산 사용 (Web Worker 미지원 환경용)
  const fallbackStats = calculateServerStatsFallback(servers);

  // 레거시 포맷으로 변환
  const result: ServerStats = adaptWorkerStatsToLegacy(fallbackStats);

  // 🚀 결과 캐싱 (최대 100개 엔트리로 제한)
  if (statsCache.size >= 100) {
    const firstKey = statsCache.keys().next().value;
    if (firstKey !== undefined) {
      statsCache.delete(firstKey);
    }
  }
  statsCache.set(cacheKey, result);

  return result;
};

export const calculatePagination = <T>(
  items: T[],
  currentPage: number,
  itemsPerPage: number
): { paginatedItems: T[]; totalPages: number } => {
  if (!isValidArray<T>(items)) {
    return { paginatedItems: [], totalPages: 0 };
  }

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = items.slice(startIndex, endIndex);

  return { paginatedItems, totalPages };
};

// 업타임 포맷팅 — SSOT re-export
export { formatUptime } from '@/utils/serverUtils';
