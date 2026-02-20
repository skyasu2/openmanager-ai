import { tool } from 'ai';
import { z } from 'zod';
import {
  stableStringify,
  calculateAggregation,
  getTimeRangeData,
  getCurrentState,
  getAllServerEntries,
  getDataCache,
  SERVER_GROUP_INPUT_DESCRIPTION,
  SERVER_GROUP_DESCRIPTION_LIST,
  normalizeServerType,
} from './data';

/**
 * Advanced Server Metrics Tool
 * Supports time range, filtering, aggregation
 */
export const getServerMetricsAdvanced = tool({
  description: `시간 범위 집계 도구. "지난 N시간", "평균", "최대값" 질문에 사용.

⚠️ 중요: 응답의 "answer" 필드를 사용자에게 그대로 전달하세요.

예시:
- "6시간 CPU 평균" → { "timeRange": "last6h", "metric": "cpu", "aggregation": "avg" }

출력: { answer: "지난 6시간 전체 15대 서버 집계: cpu_avg=34%...", globalSummary: {...} }`,
  inputSchema: z.object({
    serverId: z
      .string()
      .optional()
      .describe('조회할 서버 ID. 예: "db-server-01". 생략하면 모든 서버 대상. 절대 "all" 문자열을 넣지 마세요.'),
    metric: z
      .enum(['cpu', 'memory', 'disk', 'network', 'all'])
      .default('all')
      .describe('조회할 메트릭. cpu/memory/disk/network 중 선택 또는 all(전체)'),
    timeRange: z
      .enum(['current', 'last1h', 'last6h', 'last24h'])
      .default('current')
      .describe('시간 범위. current=현재, last1h=최근 1시간, last6h=최근 6시간, last24h=최근 24시간'),
    filters: z
      .array(
        z.object({
          field: z.enum(['cpu', 'memory', 'disk', 'network', 'status']).describe('필터 대상 필드'),
          operator: z.enum(['>', '<', '>=', '<=', '==', '!=']).describe('비교 연산자'),
          value: z.union([z.number(), z.string()]).describe('비교할 값 (숫자 또는 문자열)'),
        })
      )
      .optional()
      .describe('필터 조건 배열. 예: [{field:"cpu", operator:">", value:80}]'),
    aggregation: z
      .enum(['avg', 'max', 'min', 'count', 'none'])
      .default('none')
      .describe('집계 함수. avg=평균, max=최대값, min=최소값, count=개수, none=집계안함'),
    sortBy: z
      .enum(['cpu', 'memory', 'disk', 'network', 'name'])
      .optional()
      .describe('정렬 기준 필드'),
    sortOrder: z.enum(['asc', 'desc']).default('desc').describe('정렬 순서. asc=오름차순, desc=내림차순'),
    limit: z.number().optional().describe('반환할 최대 서버 수. 예: 5면 TOP 5'),
  }),
  execute: async ({
    serverId,
    metric,
    timeRange,
    filters,
    aggregation,
    sortBy,
    sortOrder,
    limit,
  }: {
    serverId?: string;
    metric: 'cpu' | 'memory' | 'disk' | 'network' | 'all';
    timeRange: 'current' | 'last1h' | 'last6h' | 'last24h';
    filters?: Array<{
      field: 'cpu' | 'memory' | 'disk' | 'network' | 'status';
      operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
      value: number | string;
    }>;
    aggregation: 'avg' | 'max' | 'min' | 'count' | 'none';
    sortBy?: 'cpu' | 'memory' | 'disk' | 'network' | 'name';
    sortOrder: 'asc' | 'desc';
    limit?: number;
  }) => {
    const cache = getDataCache();
    const cacheKey = `adv:${serverId || 'all'}:${timeRange}:${metric}:${aggregation}:${sortBy || 'none'}:${sortOrder}:${limit || 0}:${stableStringify(filters)}`;

    return cache.getOrCompute('metrics', cacheKey, async () => {
      console.log(`📊 [getServerMetricsAdvanced] Computing for ${cacheKey} (cache miss)`);
      try {
        const allEntries = getAllServerEntries();
        const targetEntries = serverId
          ? allEntries.filter((e) => e.serverId === serverId)
          : allEntries;

        if (targetEntries.length === 0) {
          return { success: false, error: `Server not found: ${serverId}` };
        }

        const serverResults: Array<{
          id: string;
          name: string;
          type: string;
          location: string;
          metrics: Record<string, number>;
          dataPoints?: number;
        }> = [];

        for (const entry of targetEntries) {
          const dataPoints = getTimeRangeData(entry.serverId, timeRange);
          if (dataPoints.length === 0) continue;

          let metrics: Record<string, number>;
          if (aggregation && aggregation !== 'none') {
            metrics = calculateAggregation(dataPoints, metric, aggregation);
          } else {
            const latest = dataPoints[dataPoints.length - 1] || dataPoints[0];
            metrics =
              metric === 'all'
                ? {
                    cpu: latest.cpu,
                    memory: latest.memory,
                    disk: latest.disk,
                    network: latest.network,
                  }
                : { [metric]: latest[metric] };
          }

          serverResults.push({
            id: entry.serverId,
            name: entry.serverId,
            type: entry.serverType,
            location: entry.location,
            metrics,
            dataPoints: dataPoints.length,
          });
        }

        let filteredResults = serverResults;
        if (filters && filters.length > 0) {
          filteredResults = serverResults.filter((server) => {
            return filters.every((filter) => {
              const value = server.metrics[filter.field];
              if (value === undefined) return true;

              switch (filter.operator) {
                case '>':
                  return value > Number(filter.value);
                case '<':
                  return value < Number(filter.value);
                case '>=':
                  return value >= Number(filter.value);
                case '<=':
                  return value <= Number(filter.value);
                case '==':
                  return value === Number(filter.value);
                case '!=':
                  return value !== Number(filter.value);
                default:
                  return true;
              }
            });
          });
        }

        if (sortBy) {
          filteredResults.sort((a, b) => {
            const aVal = sortBy === 'name' ? a.name : (a.metrics[sortBy] ?? 0);
            const bVal = sortBy === 'name' ? b.name : (b.metrics[sortBy] ?? 0);
            if (typeof aVal === 'string' && typeof bVal === 'string') {
              return sortOrder === 'asc'
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
            }
            return sortOrder === 'asc'
              ? Number(aVal) - Number(bVal)
              : Number(bVal) - Number(aVal);
          });
        }

        if (limit && limit > 0) {
          filteredResults = filteredResults.slice(0, limit);
        }

        const globalSummary: Record<string, number> = {};
        if (filteredResults.length > 0) {
          const metricsToSummarize = metric === 'all' ? ['cpu', 'memory', 'disk'] : [metric];
          for (const m of metricsToSummarize) {
            const values = filteredResults
              .map((s) => s.metrics[m])
              .filter((v) => v !== undefined);
            if (values.length > 0) {
              globalSummary[`${m}_avg`] =
                Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
              globalSummary[`${m}_max`] = Math.max(...values);
              globalSummary[`${m}_min`] = Math.min(...values);
            }
          }
        }

        const timeRangeKr = {
          current: '현재',
          last1h: '지난 1시간',
          last6h: '지난 6시간',
          last24h: '지난 24시간',
        }[timeRange];

        const interpretation = Object.keys(globalSummary).length > 0
          ? `[응답 가이드] ${timeRangeKr} 전체 ${filteredResults.length}대 서버 집계: ` +
            Object.entries(globalSummary)
              .map(([k, v]) => `${k}=${v}%`)
              .join(', ') +
            '. 이 값을 사용자에게 전달하세요.'
          : null;

        return {
          success: true,
          answer: interpretation || `${timeRangeKr} 데이터 조회 완료`,
          globalSummary,
          serverCount: filteredResults.length,
          query: { timeRange, metric, aggregation, sortBy, limit },
          servers: filteredResults.slice(0, 5),
          hasMore: filteredResults.length > 5,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
  },
});

/**
 * Server By Group Advanced Tool
 * Query servers by type/group with filtering and sorting support
 */
export const getServerByGroupAdvanced = tool({
  description: `서버 그룹/타입 조회 + 필터링/정렬 기능. 복합 조건 쿼리에 사용하세요.

## 사용 시나리오
- "DB 서버 중 CPU 80% 이상" → group="db", filters={ cpuMin: 80 }
- "웹 서버 메모리 순으로 정렬" → group="web", sort={ by: "memory", order: "desc" }
- "캐시 서버 중 warning 상태" → group="cache", filters={ status: "warning" }
- "상위 3개 DB 서버 (CPU 기준)" → group="db", sort={ by: "cpu", order: "desc" }, limit=3

## 지원 그룹 (config/server-types.ts 기준)
${SERVER_GROUP_DESCRIPTION_LIST}

## 필터 옵션
- cpuMin/cpuMax: CPU 사용률 범위 (0-100)
- memoryMin/memoryMax: 메모리 사용률 범위 (0-100)
- status: online | warning | critical

## 정렬 옵션
- by: cpu | memory | disk | network | name
- order: asc | desc`,
  inputSchema: z.object({
    group: z.string().describe(SERVER_GROUP_INPUT_DESCRIPTION),
    filters: z.object({
      cpuMin: z.number().min(0).max(100).optional().describe('최소 CPU 사용률'),
      cpuMax: z.number().min(0).max(100).optional().describe('최대 CPU 사용률'),
      memoryMin: z.number().min(0).max(100).optional().describe('최소 메모리 사용률'),
      memoryMax: z.number().min(0).max(100).optional().describe('최대 메모리 사용률'),
      status: z.enum(['online', 'warning', 'critical', 'offline']).optional().describe('서버 상태'),
    }).optional().describe('필터 조건'),
    sort: z.object({
      by: z.enum(['cpu', 'memory', 'disk', 'network', 'name']).describe('정렬 기준'),
      order: z.enum(['asc', 'desc']).describe('정렬 순서'),
    }).optional().describe('정렬 옵션'),
    limit: z.number().min(1).max(100).optional().describe('최대 결과 수'),
  }),
  execute: async ({
    group,
    filters,
    sort,
    limit,
  }: {
    group: string;
    filters?: {
      cpuMin?: number;
      cpuMax?: number;
      memoryMin?: number;
      memoryMax?: number;
      status?: 'online' | 'warning' | 'critical' | 'offline';
    };
    sort?: {
      by: 'cpu' | 'memory' | 'disk' | 'network' | 'name';
      order: 'asc' | 'desc';
    };
    limit?: number;
  }) => {
    const cache = getDataCache();
    const normalizedGroup = group.toLowerCase().trim();
    const filterKey = filters ? JSON.stringify(filters) : 'none';
    const sortKey = sort ? `${sort.by}-${sort.order}` : 'none';
    const cacheKey = `group-adv:${normalizedGroup}:${filterKey}:${sortKey}:${limit || 'all'}`;

    return cache.getOrCompute('metrics', cacheKey, async () => {
      console.log(`📊 [getServerByGroupAdvanced] Computing for ${cacheKey} (cache miss)`);

      const targetType = normalizeServerType(normalizedGroup);
      const state = getCurrentState();

      let filteredServers = state.servers.filter((s) => {
        const serverType = normalizeServerType(s.type || '');
        return serverType === targetType;
      });

      const totalBeforeFilters = filteredServers.length;

      if (filters) {
        if (filters.cpuMin !== undefined) {
          filteredServers = filteredServers.filter((s) => s.cpu >= filters.cpuMin!);
        }
        if (filters.cpuMax !== undefined) {
          filteredServers = filteredServers.filter((s) => s.cpu <= filters.cpuMax!);
        }
        if (filters.memoryMin !== undefined) {
          filteredServers = filteredServers.filter((s) => s.memory >= filters.memoryMin!);
        }
        if (filters.memoryMax !== undefined) {
          filteredServers = filteredServers.filter((s) => s.memory <= filters.memoryMax!);
        }
        if (filters.status) {
          filteredServers = filteredServers.filter((s) => s.status === filters.status);
        }
      }

      if (sort) {
        filteredServers.sort((a, b) => {
          let valueA: number | string;
          let valueB: number | string;

          switch (sort.by) {
            case 'cpu':
              valueA = a.cpu;
              valueB = b.cpu;
              break;
            case 'memory':
              valueA = a.memory;
              valueB = b.memory;
              break;
            case 'disk':
              valueA = a.disk;
              valueB = b.disk;
              break;
            case 'network':
              valueA = a.network || 0;
              valueB = b.network || 0;
              break;
            case 'name':
              valueA = a.name;
              valueB = b.name;
              break;
            default:
              valueA = a.cpu;
              valueB = b.cpu;
          }

          if (typeof valueA === 'string' && typeof valueB === 'string') {
            return sort.order === 'asc'
              ? valueA.localeCompare(valueB)
              : valueB.localeCompare(valueA);
          }

          return sort.order === 'asc'
            ? (valueA as number) - (valueB as number)
            : (valueB as number) - (valueA as number);
        });
      }

      const filteredCount = filteredServers.length;
      const filteredStatus = {
        online: filteredServers.filter((s) => s.status === 'online').length,
        warning: filteredServers.filter((s) => s.status === 'warning').length,
        critical: filteredServers.filter((s) => s.status === 'critical').length,
        offline: filteredServers.filter((s) => s.status === 'offline').length,
      };

      if (limit && limit > 0) {
        filteredServers = filteredServers.slice(0, limit);
      }

      const summary = {
        total: totalBeforeFilters,
        ...filteredStatus,
        filtered: filteredCount,
        returned: filteredServers.length,
      };

      return {
        success: true,
        group: targetType,
        servers: filteredServers.map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type || targetType,
          status: s.status,
          cpu: s.cpu,
          memory: s.memory,
          disk: s.disk,
          network: s.network,
        })),
        summary,
        appliedFilters: filters || undefined,
        appliedSort: sort || undefined,
        timestamp: new Date().toISOString(),
      };
    });
  },
});
