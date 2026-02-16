/**
 * Server Metrics Tools (AI SDK Format)
 *
 * All 5 tool definitions for server metrics querying.
 *
 * @version 1.0.0
 * @updated 2025-12-28
 */

import { tool } from 'ai';
import { z } from 'zod';
import {
  stableStringify,
  calculateAggregation,
  getTimeRangeData,
  getCurrentState,
  getAllServerEntries,
  get24hTrendSummaries,
  getDataCache,
  SERVER_GROUP_INPUT_DESCRIPTION,
  SERVER_GROUP_DESCRIPTION_LIST,
  normalizeServerType,
  type ServerSnapshot,
} from './data';

// ============================================================================
// AI SDK Tools
// ============================================================================

/**
 * Basic Server Metrics Tool
 * O(1) lookup using precomputed state
 *
 * Best Practices Applied:
 * - Detailed description with input/output examples
 * - .describe() on all schema fields
 * - Clear response structure documentation
 */
export const getServerMetrics = tool({
  description: `[현재 상태 전용] 서버 CPU/메모리/디스크의 실시간 상태를 조회합니다.

⚠️ 시간 범위(지난 1시간, 6시간 등), 평균/최대값 집계가 필요하면 getServerMetricsAdvanced를 사용하세요.

## 입력 예시
1. 전체 서버 현재 상태: { }
2. 특정 서버: { "serverId": "web-nginx-dc1-01" }

## 출력 형식
{ "success": true, "servers": [{ "id": "...", "name": "...", "cpu": 45, "memory": 67, "disk": 55, "dailyTrend": { "cpu": { "avg": 38, "max": 72, "min": 12 }, "memory": { "avg": 54, "max": 78, "min": 30 }, "disk": { "avg": 60, "max": 62, "min": 58 } } }], "summary": { "total": 15 } }

## 사용 시나리오
- "서버 상태" / "현재 CPU" → 이 도구
- "이 서버 오늘 어땠어?" → 이 도구 (dailyTrend 필드에 24시간 avg/max/min 포함)
- "지난 6시간 평균" / "최근 1시간 최대값" → getServerMetricsAdvanced 사용`,
  inputSchema: z.object({
    serverId: z
      .string()
      .optional()
      .describe('조회할 서버 ID. 예: "api-server-01", "db-server-02". 생략하면 모든 서버 조회. 절대 "all" 문자열을 넣지 마세요.'),
    metric: z
      .enum(['cpu', 'memory', 'disk', 'all'])
      .default('all')
      .describe('조회할 메트릭 종류. cpu=CPU 사용률, memory=메모리 사용률, disk=디스크 사용률, all=전체'),
  }),
  execute: async ({
    serverId,
    metric,
  }: {
    serverId?: string;
    metric: 'cpu' | 'memory' | 'disk' | 'all';
  }) => {
    const cache = getDataCache();
    const cacheKey = `${serverId || 'all'}:${metric}`;

    // Best Practice: Use cache.getMetrics with lazy computation
    return cache.getMetrics(cacheKey, async () => {
      const state = getCurrentState();

      const servers: ServerSnapshot[] = serverId
        ? state.servers.filter((s) => s.id === serverId)
        : state.servers;

      console.log(`📊 [getServerMetrics] Computing for ${cacheKey} (cache miss)`);

      // Build daily trend lookup for requested servers
      const trendSummaries = get24hTrendSummaries();
      const trendMap = new Map(trendSummaries.map((t) => [t.serverId, t]));

      // Build alertServers: warning/critical/offline 서버에 trend 정보 포함
      const alertServersList = servers
        .filter((s) => s.status === 'warning' || s.status === 'critical' || s.status === 'offline')
        .map((s) => {
          const trend = trendMap.get(s.id);
          const cpuTrend = trend
            ? s.cpu > trend.cpu.avg * 1.1 ? 'rising' as const
              : s.cpu < trend.cpu.avg * 0.9 ? 'falling' as const
              : 'stable' as const
            : 'stable' as const;
          const memoryTrend = trend
            ? s.memory > trend.memory.avg * 1.1 ? 'rising' as const
              : s.memory < trend.memory.avg * 0.9 ? 'falling' as const
              : 'stable' as const
            : 'stable' as const;
          return {
            id: s.id,
            status: s.status,
            cpu: s.cpu,
            memory: s.memory,
            disk: s.disk,
            cpuTrend,
            memoryTrend,
            ...(trend && {
              dailyAvg: {
                cpu: trend.cpu.avg,
                memory: trend.memory.avg,
              },
            }),
          };
        });

      return {
        success: true,
        servers: servers.map((s) => {
          const trend = trendMap.get(s.id);
          return {
            id: s.id,
            name: s.name,
            status: s.status,
            cpu: s.cpu,
            memory: s.memory,
            disk: s.disk,
            ...(trend && {
              dailyTrend: {
                cpu: trend.cpu,
                memory: trend.memory,
                disk: trend.disk,
              },
            }),
          };
        }),
        summary: {
          total: servers.length,
          alertCount: alertServersList.length,
        },
        requestedMetric: metric,
        alertServers: alertServersList.length > 0 ? alertServersList : undefined,
        timestamp: new Date().toISOString(),
        _cached: false,
      };
    });
  },
});

/**
 * Advanced Server Metrics Tool
 * Supports time range, filtering, aggregation
 *
 * Best Practices Applied:
 * - Comprehensive description with input/output examples
 * - .describe() on all schema fields
 * - Clear response structure documentation
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
    // Cache key: combine all parameters that affect the result
    // Use stableStringify for filters to ensure consistent key order
    const cacheKey = `adv:${serverId || 'all'}:${timeRange}:${metric}:${aggregation}:${sortBy || 'none'}:${sortOrder}:${limit || 0}:${stableStringify(filters)}`;

    return cache.getOrCompute('metrics', cacheKey, async () => {
    console.log(`📊 [getServerMetricsAdvanced] Computing for ${cacheKey} (cache miss)`);
    try {
      // 1. Get target server entries from precomputed slots
      const allEntries = getAllServerEntries();
      const targetEntries = serverId
        ? allEntries.filter((e) => e.serverId === serverId)
        : allEntries;

      if (targetEntries.length === 0) {
        return { success: false, error: `Server not found: ${serverId}` };
      }

      // 2. Collect time range data
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

      // 3. Apply filters
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

      // 4. Apply sorting
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

      // 5. Apply limit
      if (limit && limit > 0) {
        filteredResults = filteredResults.slice(0, limit);
      }

      // 6. Calculate global summary (across all servers)
      const globalSummary: Record<string, number> = {};
      if (filteredResults.length > 0) {
        const metricsToSummarize = metric === 'all' ? ['cpu', 'memory', 'disk'] : [metric];
        for (const m of metricsToSummarize) {
          const values = filteredResults
            .map((s) => s.metrics[m])
            .filter((v) => v !== undefined);
          if (values.length > 0) {
            globalSummary[`${m}_avg`] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
            globalSummary[`${m}_max`] = Math.max(...values);
            globalSummary[`${m}_min`] = Math.min(...values);
          }
        }
      }

      // 7. Generate interpretation for LLM
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
        // ⚠️ LLM: 아래 answer를 그대로 사용하세요
        answer: interpretation || `${timeRangeKr} 데이터 조회 완료`,
        globalSummary,
        serverCount: filteredResults.length,
        query: { timeRange, metric, aggregation, sortBy, limit },
        servers: filteredResults.slice(0, 5), // 상위 5개만 반환 (토큰 절약)
        hasMore: filteredResults.length > 5,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    }); // End of cache.getOrCompute wrapper
  },
});

/**
 * Filter Servers Tool
 * Quick filtering by condition
 *
 * Best Practices Applied:
 * - Clear description with input/output examples
 * - .describe() on all schema fields
 * - Clear response structure documentation
 */
export const filterServers = tool({
  description: `조건에 맞는 서버를 빠르게 필터링합니다.

## 입력 예시 (Input Examples)
1. CPU 80% 초과:
   { "field": "cpu", "operator": ">", "value": 80 }

2. 메모리 90% 이상 TOP 3:
   { "field": "memory", "operator": ">=", "value": 90, "limit": 3 }

3. 디스크 50% 미만:
   { "field": "disk", "operator": "<", "value": 50 }

4. 네트워크 70% 초과:
   { "field": "network", "operator": ">", "value": 70 }

5. 오프라인 서버 목록:
   { "field": "status", "operator": "==", "value": "offline" }

6. 온라인 서버만:
   { "field": "status", "operator": "==", "value": "online" }

## 출력 형식 (Output Schema)
{
  "success": true,
  "condition": "cpu > 80%",
  "servers": [
    { "id": "db-server-01", "name": "DB Server 01", "status": "warning", "cpu": 92.5 }
  ],
  "summary": { "matched": 3, "returned": 3, "total": 10 },
  "timestamp": "2025-01-04T12:00:00Z"
}

## 사용 시나리오
- "CPU 80% 이상 서버" → field="cpu", operator=">", value=80
- "메모리 90% 넘는 서버 3개" → field="memory", operator=">", value=90, limit=3
- "오프라인 서버" → field="status", operator="==", value="offline"
- "네트워크 높은 서버" → field="network", operator=">", value=70`,
  inputSchema: z.object({
    field: z
      .enum(['cpu', 'memory', 'disk', 'network', 'status'])
      .describe('필터링할 메트릭. cpu/memory/disk/network=사용률(%), status=서버 상태(online/warning/critical/offline)'),
    operator: z
      .enum(['>', '<', '>=', '<=', '==', '!='])
      .describe('비교 연산자. 숫자: >/</>=/<= | 상태: ==(같음), !=(다름)'),
    value: z.union([z.number(), z.string()]).describe('비교할 값. 숫자 필드: 퍼센트(80=80%). status 필드: "online"/"warning"/"critical"/"offline"'),
    limit: z.number().default(10).describe('반환할 최대 서버 수 (기본값: 10). TOP N 결과'),
  }),
  execute: async ({
    field,
    operator,
    value,
    limit,
  }: {
    field: 'cpu' | 'memory' | 'disk' | 'network' | 'status';
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    value: number | string;
    limit: number;
  }) => {
    const cache = getDataCache();
    const cacheKey = `filter:${field}:${operator}:${value}:${limit}`;

    return cache.getOrCompute('metrics', cacheKey, async () => {
    console.log(`📊 [filterServers] Computing for ${cacheKey} (cache miss)`);
    const state = getCurrentState();

    const filtered = state.servers.filter((server) => {
      // status 필드: 문자열 비교
      if (field === 'status') {
        const strValue = String(value).toLowerCase();
        switch (operator) {
          case '==':
            return server.status === strValue;
          case '!=':
            return server.status !== strValue;
          default:
            return false;
        }
      }
      // 숫자 필드: cpu, memory, disk, network
      const serverValue = server[field] as number;
      const numValue = Number(value);
      switch (operator) {
        case '>':
          return serverValue > numValue;
        case '<':
          return serverValue < numValue;
        case '>=':
          return serverValue >= numValue;
        case '<=':
          return serverValue <= numValue;
        case '==':
          return serverValue === numValue;
        case '!=':
          return serverValue !== numValue;
        default:
          return false;
      }
    });

    // Sort by the filtered field (descending for >, ascending for <)
    // status 필드는 이름순 정렬
    const sortedResults = field === 'status'
      ? filtered.sort((a, b) => a.name.localeCompare(b.name))
      : filtered.sort((a, b) =>
        operator.includes('>') ? (b[field] as number) - (a[field] as number) : (a[field] as number) - (b[field] as number)
      );

    const limitedResults = sortedResults.slice(0, limit);

    // Empty result hint: 조건에 맞는 서버가 없으면 상위 N개 서버 정보 제공
    let emptyResultHint: {
      topServers: Array<{ id: string; name: string; status: string; value: number }>;
      suggestion: string;
    } | undefined;

    if (filtered.length === 0 && field !== 'status') {
      const allSorted = [...state.servers].sort((a, b) =>
        operator.includes('>') ? (b[field] as number) - (a[field] as number) : (a[field] as number) - (b[field] as number)
      );
      emptyResultHint = {
        topServers: allSorted.slice(0, 3).map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          value: s[field] as number,
        })),
        suggestion: `조건(${field} ${operator} ${value}%)에 맞는 서버가 없습니다. 현재 ${field} 상위 3대를 참고하세요.`,
      };
    }

    return {
      success: true,
      condition: field === 'status' ? `${field} ${operator} ${value}` : `${field} ${operator} ${value}%`,
      servers: limitedResults.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        [field]: s[field],
      })),
      summary: {
        matched: filtered.length,
        returned: limitedResults.length,
        total: state.servers.length,
      },
      ...(emptyResultHint && { emptyResultHint }),
      timestamp: new Date().toISOString(),
    };
    }); // End of cache.getOrCompute wrapper
  },
});

/**
 * Server By Group Tool
 * Query servers by type/group (db, lb, web, cache, etc.)
 *
 * Best Practices Applied:
 * - Supports common abbreviations (db→database, lb→loadbalancer)
 * - Clear description with input/output examples
 * - Cached for performance
 */
export const getServerByGroup = tool({
  description: `서버 그룹/타입으로 조회합니다. DB 서버, 로드밸런서, 웹 서버 등 특정 유형의 서버를 조회할 때 사용하세요.

## 지원하는 그룹/타입 (config/server-types.ts 기준)
${SERVER_GROUP_DESCRIPTION_LIST}

## 입력 예시
1. DB 서버 조회: { "group": "db" } 또는 { "group": "database" }
2. 로드밸런서 조회: { "group": "lb" } 또는 { "group": "loadbalancer" }
3. 웹 서버 조회: { "group": "web" }
4. 캐시 서버 조회: { "group": "cache" }

## 출력 형식
{
  "success": true,
  "group": "database",
  "servers": [
    { "id": "db-mysql-dc1-01", "name": "MySQL Primary", "type": "database", "status": "online", "cpu": 45, "memory": 78, "disk": 62 }
  ],
  "summary": { "total": 2, "online": 2, "warning": 0, "critical": 0 }
}

## 사용 시나리오
- "DB 서버 상태 알려줘" → group="db"
- "로드밸런서 현황" → group="lb"
- "웹 서버 목록" → group="web"
- "캐시 서버 확인" → group="cache"`,
  inputSchema: z.object({
    group: z.string().describe(SERVER_GROUP_INPUT_DESCRIPTION),
  }),
  execute: async ({ group }: { group: string }) => {
    const cache = getDataCache();
    const normalizedGroup = group.toLowerCase().trim();
    const cacheKey = `group:${normalizedGroup}`;

    return cache.getOrCompute('metrics', cacheKey, async () => {
      console.log(`📊 [getServerByGroup] Computing for ${cacheKey} (cache miss)`);

      // Use shared type mapping from config/server-types.ts
      const targetType = normalizeServerType(normalizedGroup);
      const state = getCurrentState();

      // Filter by server type (exact match only after normalization)
      const filteredServers = state.servers.filter((s) => {
        const serverType = normalizeServerType(s.type || '');
        return serverType === targetType;
      });

      // Calculate summary
      const summary = {
        total: filteredServers.length,
        online: filteredServers.filter((s) => s.status === 'online').length,
        warning: filteredServers.filter((s) => s.status === 'warning').length,
        critical: filteredServers.filter((s) => s.status === 'critical').length,
        offline: filteredServers.filter((s) => s.status === 'offline').length,
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
        })),
        summary,
        timestamp: new Date().toISOString(),
      };
    });
  },
});

/**
 * Server By Group Advanced Tool
 * Query servers by type/group with filtering and sorting support
 *
 * Best Practices Applied:
 * - Extends getServerByGroup with filtering/sorting
 * - Supports compound queries like "DB 서버 중 CPU 80% 이상"
 * - Maintains backward compatibility
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

      // Use shared type mapping from config/server-types.ts
      const targetType = normalizeServerType(normalizedGroup);
      const state = getCurrentState();

      // Step 1: Filter by server type
      let filteredServers = state.servers.filter((s) => {
        const serverType = normalizeServerType(s.type || '');
        return serverType === targetType;
      });

      const totalBeforeFilters = filteredServers.length;

      // Step 2: Apply metric filters
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

      // Step 3: Apply sorting
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

      // Calculate summary BEFORE applying limit (reflects filter results, not limit)
      const filteredCount = filteredServers.length;
      const filteredStatus = {
        online: filteredServers.filter((s) => s.status === 'online').length,
        warning: filteredServers.filter((s) => s.status === 'warning').length,
        critical: filteredServers.filter((s) => s.status === 'critical').length,
        offline: filteredServers.filter((s) => s.status === 'offline').length,
      };

      // Step 4: Apply limit
      if (limit && limit > 0) {
        filteredServers = filteredServers.slice(0, limit);
      }

      // Summary reflects filtered results (before limit)
      const summary = {
        total: totalBeforeFilters,
        ...filteredStatus,
        filtered: filteredCount,
        returned: filteredServers.length,  // Actual returned count after limit
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
