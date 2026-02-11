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
import { createApiRoute } from '@/lib/api/zod-middleware';
import { logger } from '@/lib/logging';
import { getServerMonitoringService } from '@/services/monitoring';
import type { EnhancedServerMetrics } from '@/types/server';
import { getErrorMessage } from '@/types/type-utils';
import debug from '@/utils/debug';

// 📝 통합 요청 스키마
const serversUnifiedRequestSchema = z.object({
  action: z.enum([
    'list', // 기본 서버 목록 (기존 /api/servers/all)
    'cached', // 캐시된 서버 데이터
    'mock', // 목업 서버 데이터
    'realtime', // 실시간 서버 데이터
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
});

type ServersUnifiedRequest = z.infer<typeof serversUnifiedRequestSchema>;

/**
 * 🎯 실시간 서버 데이터 (ServerMonitoringService 기반)
 */
function getRealtimeServers(): EnhancedServerMetrics[] {
  const service = getServerMonitoringService();
  return service.getAllAsEnhancedMetrics();
}

/**
 * 🔍 특정 서버 상세 정보
 */
function getServerDetail(serverId: string): EnhancedServerMetrics | null {
  const service = getServerMonitoringService();
  return service.getServerAsEnhanced(serverId);
}

/**
 * ⚙️ 서버 프로세스 목록
 */
function getServerProcesses(serverId: string) {
  const server = getServerDetail(serverId);
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
  } = context.body;

  try {
    debug.log(`🎯 통합 서버 API - 액션: ${action}`, { serverId, page, limit });

    let servers: EnhancedServerMetrics[] = [];
    const additionalData: Record<string, unknown> = {};

    // 액션별 데이터 처리
    switch (action) {
      case 'list':
        servers = getRealtimeServers();
        break;

      case 'cached': {
        servers = getRealtimeServers();
        additionalData.cacheInfo = {
          cached: true,
          cacheTime: new Date().toISOString(),
          source: 'server-monitoring-service',
        };
        break;
      }

      case 'mock': {
        servers = getRealtimeServers();
        additionalData.mockInfo = {
          generated: true,
          serverCount: servers.length,
          source: 'server-monitoring-service',
        };
        break;
      }

      case 'realtime':
        servers = getRealtimeServers();
        additionalData.realtimeInfo = {
          realtime: true,
          source: 'server-monitoring-service',
          updateFrequency: '30s',
        };
        break;

      case 'detail': {
        if (!serverId) {
          return {
            success: false,
            error: 'serverId required for detail action',
          };
        }
        const serverDetail = getServerDetail(serverId);
        if (!serverDetail) {
          return { success: false, error: 'Server not found' };
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
        const processData = getServerProcesses(serverId);
        if (!processData) {
          return { success: false, error: 'Server not found' };
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
      data: [],
      timestamp: new Date().toISOString(),
    };
  }
}

// 🚀 API 라우트 내보내기
export const POST = createApiRoute()
  .body(serversUnifiedRequestSchema)
  .configure({
    showDetailedErrors: process.env.NODE_ENV === 'development',
    enableLogging: true,
  })
  .build(handleServersUnified);

// 호환성을 위한 GET 메서드 (기본 list 액션)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const defaultRequest: ServersUnifiedRequest = {
    action: 'list',
    page: parseInt(searchParams.get('page') || '1', 10),
    limit: parseInt(searchParams.get('limit') || '10', 10),
    search: searchParams.get('search') || undefined,
    sortBy:
      (searchParams.get('sortBy') as ServersUnifiedRequest['sortBy']) || 'name',
    sortOrder:
      (searchParams.get('sortOrder') as ServersUnifiedRequest['sortOrder']) ||
      'asc',
    includeProcesses: false,
    includeMetrics: true,
  };

  // 📊 DASHBOARD: 5분 TTL, SWR 비활성화 (서버 목록 최적화)
  // 서버 목록은 5분 캐시로 충분, SWR 불필요
  return NextResponse.json(
    await handleServersUnified(request, {
      body: defaultRequest,
      query: {},
      params: {},
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control':
          'public, max-age=600, s-maxage=600, stale-while-revalidate=60',
        'CDN-Cache-Control': 'public, s-maxage=600',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=600',
      },
    }
  );
}

export const dynamic = 'force-dynamic';
