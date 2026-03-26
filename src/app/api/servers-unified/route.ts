/**
 * 🎯 통합 서버 관리 API
 *
 * 통합된 기능:
 * - /api/servers (기본 서버 목록)
 * - /api/servers/all (전체 서버 데이터)
 * - /api/servers/next (다음 서버 데이터)
 * - /api/servers/[id] (특정 서버 상세)
 * - /api/servers/[id]/processes (서버 프로세스 목록)
 *
 * v5.87: /mock, /realtime, /cached 제거 (Dead Code 정리)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as z from 'zod';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { getServerMonitoringService } from '@/services/monitoring';
import { queryOTelLogs } from '@/services/monitoring/otel-log-search';
import type { EnhancedServerMetrics } from '@/types/server';
import { getErrorMessage } from '@/types/type-utils';
import debug from '@/utils/debug';

// 📝 통합 요청 스키마
const serversUnifiedRequestSchema = z.object({
  action: z.enum([
    'list', // 기본 서버 목록 (기존 /api/servers/all)
    'logs', // 24시간 OTel 로그 검색
    'detail', // 특정 서버 상세
    'processes', // 서버 프로세스 목록
  ]),
  serverId: z.string().optional(), // detail, processes 액션용

  // 페이지네이션 & 필터링
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
  sortBy: z
    .enum(['name', 'cpu', 'memory', 'disk', 'network', 'uptime'])
    .default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),

  // 실시간 특화 옵션
  includeProcesses: z.boolean().default(false),
  includeMetrics: z.boolean().default(true),

  // logs 액션 옵션
  level: z.enum(['info', 'warn', 'error']).optional(),
  logSource: z.string().optional(),
  logKeyword: z.string().optional(),
});

type ServersUnifiedRequest = z.infer<typeof serversUnifiedRequestSchema>;

/**
 * 🎯 실시간 서버 데이터 (ServerMonitoringService 기반)
 */
async function getRealtimeServers(): Promise<EnhancedServerMetrics[]> {
  const service = getServerMonitoringService();
  return service.getAllAsEnhancedMetrics();
}

/**
 * 🔍 특정 서버 상세 정보
 */
async function getServerDetail(
  serverId: string
): Promise<EnhancedServerMetrics | null> {
  const service = getServerMonitoringService();
  return service.getServerAsEnhanced(serverId);
}

/**
 * ⚙️ 서버 프로세스 목록
 */
async function getServerProcesses(serverId: string) {
  const server = await getServerDetail(serverId);
  if (!server) return null;

  // 현실적인 프로세스 목록 생성
  const processes = [
    { pid: 1, name: 'systemd', cpu: 0.1, memory: 0.2, status: 'running' },
    { pid: 2, name: 'kthreadd', cpu: 0.0, memory: 0.0, status: 'running' },
    { pid: 123, name: 'nginx', cpu: 2.5, memory: 1.2, status: 'running' },
    { pid: 456, name: 'node', cpu: 15.3, memory: 8.7, status: 'running' },
    { pid: 789, name: 'postgres', cpu: 5.2, memory: 12.1, status: 'running' },
    {
      pid: 1012,
      name: 'redis-server',
      cpu: 1.8,
      memory: 2.3,
      status: 'running',
    },
    { pid: 1345, name: 'docker', cpu: 3.1, memory: 4.5, status: 'running' },
    { pid: 1678, name: 'ssh', cpu: 0.1, memory: 0.3, status: 'running' },
  ];

  return {
    serverId,
    serverName: server.name,
    totalProcesses: processes.length,
    runningProcesses: processes.filter((p) => p.status === 'running').length,
    processes: processes.map((proc) => ({
      ...proc,
      cpu: proc.cpu * (1 + (Math.random() - 0.5) * 0.2), // ±10% 변동
      memory: proc.memory * (1 + (Math.random() - 0.5) * 0.1), // ±5% 변동
    })),
    lastUpdate: new Date().toISOString(),
  };
}

/**
 * 📊 데이터 필터링 및 정렬
 */
function filterAndSortServers(
  servers: EnhancedServerMetrics[],
  search?: string,
  sortBy: string = 'name',
  sortOrder: 'asc' | 'desc' = 'asc'
): EnhancedServerMetrics[] {
  let filtered = servers;

  // 검색 필터 적용
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = servers.filter(
      (server) =>
        server.name.toLowerCase().includes(searchLower) ||
        server.hostname.toLowerCase().includes(searchLower) ||
        server.status.toLowerCase().includes(searchLower) ||
        (server.type?.toLowerCase() || '').includes(searchLower)
    );
  }

  // 정렬 적용
  filtered.sort((a, b) => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'cpu':
        return (a.cpu_usage - b.cpu_usage) * dir;
      case 'memory':
        return (a.memory_usage - b.memory_usage) * dir;
      case 'disk':
        return (a.disk_usage - b.disk_usage) * dir;
      case 'network':
        return ((a.network || 0) - (b.network || 0)) * dir;
      case 'uptime':
        return (a.uptime - b.uptime) * dir;
      default:
        return a.name.localeCompare(b.name) * dir;
    }
  });

  return filtered;
}

/**
 * 🎯 메인 핸들러
 */
async function handleServersUnified(
  _request: NextRequest,
  context: {
    body: {
      action: ServersUnifiedRequest['action'];
      serverId?: string;
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: ServersUnifiedRequest['sortBy'];
      sortOrder?: ServersUnifiedRequest['sortOrder'];
      includeProcesses?: boolean;
      includeMetrics?: boolean;
      level?: 'info' | 'warn' | 'error';
      logSource?: string;
      logKeyword?: string;
    };
    query: unknown;
    params: Record<string, string>;
  }
): Promise<unknown> {
  const {
    action,
    serverId,
    page = 1,
    limit = 10,
    search,
    sortBy = 'name',
    sortOrder = 'asc',
    level,
    logSource,
    logKeyword,
  } = context.body;

  try {
    debug.log(`🎯 통합 서버 API - 액션: ${action}`, { serverId, page, limit });

    let servers: EnhancedServerMetrics[] = [];
    const additionalData: Record<string, unknown> = {};

    // 액션별 데이터 처리
    switch (action) {
      // 🚀 비동기 데이터 로딩 보장 (Bundle Size Optimization 대응)
      // logs는 OTel hourly index 기반이므로 MetricsProvider hydration 불필요
      case 'list':
      case 'detail':
      case 'processes': {
        const MetricsProvider = (
          await import('@/services/metrics/MetricsProvider')
        ).MetricsProvider;
        await MetricsProvider.getInstance().ensureDataLoaded();
      }
    }

    switch (action) {
      case 'list':
        servers = await getRealtimeServers();
        break;

      case 'logs': {
        const logResult = await queryOTelLogs({
          level,
          source: logSource,
          serverId: serverId || search || undefined,
          keyword: logKeyword,
          page,
          limit,
          sortOrder,
        });

        return {
          success: true,
          action,
          data: logResult.items,
          pagination: {
            page: logResult.page,
            limit: logResult.limit,
            total: logResult.total,
            totalPages: logResult.totalPages,
            hasNext: logResult.page < logResult.totalPages,
            hasPrev: logResult.page > 1,
          },
          metadata: {
            action,
            dataSource: 'otel-hourly-log-index',
            logWindow: {
              start: logResult.metadata.windowStart,
              end: logResult.metadata.windowEnd,
            },
            cacheAgeMs: logResult.metadata.cacheAgeMs,
            builtAt: logResult.metadata.builtAt,
            availableSources: logResult.metadata.availableSources,
            availableServers: logResult.metadata.availableServers,
            unifiedApi: true,
            systemVersion: 'servers-unified-v1.2',
          },
          timestamp: new Date().toISOString(),
        };
      }

      case 'detail': {
        if (!serverId) {
          return {
            success: false,
            error: 'serverId required for detail action',
          };
        }
        const serverDetail = await getServerDetail(serverId);
        if (!serverDetail) {
          return { success: false, error: 'Server not found', notFound: true };
        }
        return {
          success: true,
          data: serverDetail,
          action: 'detail',
          serverId,
        };
      }

      case 'processes': {
        if (!serverId) {
          return {
            success: false,
            error: 'serverId required for processes action',
          };
        }
        const processData = await getServerProcesses(serverId);
        if (!processData) {
          return { success: false, error: 'Server not found', notFound: true };
        }
        return {
          success: true,
          data: processData,
          action: 'processes',
          serverId,
        };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }

    // 필터링 및 정렬
    const filteredServers = filterAndSortServers(
      servers,
      search,
      sortBy,
      sortOrder
    );

    // 페이지네이션 적용
    const total = filteredServers.length;
    const startIndex = (page - 1) * limit;
    const paginatedServers = filteredServers.slice(
      startIndex,
      startIndex + limit
    );

    // 서버 상태 요약
    const statusSummary = filteredServers.reduce(
      (acc, server) => {
        acc[server.status] = (acc[server.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    debug.log(`✅ 통합 서버 API 응답: ${paginatedServers.length}개 서버`);

    return {
      success: true,
      action,
      data: paginatedServers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: startIndex + limit < total,
        hasPrev: page > 1,
      },
      summary: {
        total: filteredServers.length,
        statusSummary,
        ...additionalData,
      },
      metadata: {
        action,
        serverId,
        serverCount: paginatedServers.length,
        totalServers: total,
        dataSource: 'server-monitoring-service',
        unifiedApi: true,
        systemVersion: 'servers-unified-v1.0',
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`❌ 통합 서버 API 오류 (${action}):`, error);

    return {
      success: false,
      action,
      error: getErrorMessage(error),
      fallback: true,
      isServerError: true,
      data: [],
      timestamp: new Date().toISOString(),
    };
  }
}

// 🚀 API 라우트 내보내기
async function postHandler(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const parsed = serversUnifiedRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Request validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const result = await handleServersUnified(request, {
    body: parsed.data,
    query: {},
    params: {},
  });

  const r = result as Record<string, unknown> | null;
  const isError = r != null && typeof r === 'object' && r.success === false;
  const isNotFound = isError && r.notFound === true;
  const isServerError = isError && r.isServerError === true;
  return NextResponse.json(result, {
    status: isNotFound ? 404 : isServerError ? 500 : isError ? 400 : 200,
  });
}

// 호환성을 위한 GET 메서드 (기본 list 액션)
async function getHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedAction = searchParams.get('action');
  const allowedActions: ServersUnifiedRequest['action'][] = [
    'list',
    'logs',
    'detail',
    'processes',
  ];
  const action: ServersUnifiedRequest['action'] = allowedActions.includes(
    requestedAction as ServersUnifiedRequest['action']
  )
    ? (requestedAction as ServersUnifiedRequest['action'])
    : 'list';

  const levelParam = searchParams.get('level');
  const level = ['info', 'warn', 'error'].includes(levelParam || '')
    ? (levelParam as 'info' | 'warn' | 'error')
    : undefined;

  const sortOrderParam = searchParams.get('sortOrder');
  const defaultSortOrder = action === 'logs' ? 'desc' : 'asc';
  const sortOrder =
    sortOrderParam === 'asc' || sortOrderParam === 'desc'
      ? (sortOrderParam as ServersUnifiedRequest['sortOrder'])
      : (defaultSortOrder as ServersUnifiedRequest['sortOrder']);

  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const rawLimit = parseInt(searchParams.get('limit') || '10', 10);

  const defaultRequest = {
    action,
    serverId: searchParams.get('serverId') || undefined,
    page: Number.isNaN(rawPage) ? 1 : rawPage,
    limit: Number.isNaN(rawLimit) ? 10 : rawLimit,
    search: searchParams.get('search') || undefined,
    sortBy:
      (searchParams.get('sortBy') as ServersUnifiedRequest['sortBy']) || 'name',
    sortOrder,
    includeProcesses: false,
    includeMetrics: true,
    level,
    logSource: searchParams.get('logSource') || undefined,
    logKeyword: searchParams.get('logKeyword') || undefined,
  };

  const parsed = serversUnifiedRequestSchema.safeParse(defaultRequest);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid query parameters',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const result = await handleServersUnified(request, {
    body: parsed.data,
    query: {},
    params: {},
  });

  const r2 = result as Record<string, unknown> | null;
  const isError = r2 != null && typeof r2 === 'object' && r2.success === false;
  const isNotFound = isError && r2.notFound === true;
  const isServerError = isError && r2.isServerError === true;
  return NextResponse.json(result, {
    status: isNotFound ? 404 : isServerError ? 500 : isError ? 400 : 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

export const POST = withAuth(postHandler);
export const GET = withAuth(getHandler);

// MIGRATED: Removed export const dynamic = "force-dynamic" (now default)
