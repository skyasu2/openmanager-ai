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
  getCurrentState,
  get24hTrendSummaries,
  getDataCache,
  SERVER_GROUP_INPUT_DESCRIPTION,
  SERVER_GROUP_DESCRIPTION_LIST,
  normalizeServerType,
  type ServerSnapshot,
} from './data';
export {
  getServerByGroupAdvanced,
  getServerMetricsAdvanced,
} from './tools-advanced';

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
