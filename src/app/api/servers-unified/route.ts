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
import { getUnifiedServerDataSource } from '@/services/data/UnifiedServerDataSource';
import { metricsProvider } from '@/services/metrics/MetricsProvider';
import type {
  EnhancedServerMetrics,
  ServerEnvironment,
  ServerRole,
} from '@/types/server';
import { getErrorMessage } from '@/types/type-utils';
import debug from '@/utils/debug';
import { mapServerToEnhanced } from '@/utils/serverUtils';

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
  enableRealtime: z.boolean().default(false),
  includeProcesses: z.boolean().default(false),
  includeMetrics: z.boolean().default(true),
});

type ServersUnifiedRequest = z.infer<typeof serversUnifiedRequestSchema>;

/**
 * 🎯 실시간 서버 데이터 (MetricsProvider 기반 고정 데이터)
 * 아키텍처: KST 시간 기준 fixed-24h-metrics 데이터 활용
 */
async function getRealtimeServers(): Promise<EnhancedServerMetrics[]> {
  try {
    // 🎯 MetricsProvider를 통한 고정 데이터 (KST 시간 기준)
    const allMetrics = metricsProvider.getAllServerMetrics();

    return allMetrics.map((metric): EnhancedServerMetrics => {
      // uptime: bootTimeSeconds로부터 계산, fallback 1일+현재시간
      const uptimeSeconds =
        metric.bootTimeSeconds && metric.bootTimeSeconds > 0
          ? Math.floor(Date.now() / 1000 - metric.bootTimeSeconds)
          : 86400 + metric.minuteOfDay * 60;

      // os: Prometheus labels에서 조합, fallback 'Ubuntu 22.04 LTS'
      const osLabel =
        metric.os && metric.osVersion
          ? `${metric.os.charAt(0).toUpperCase() + metric.os.slice(1)} ${metric.osVersion}`
          : 'Ubuntu 22.04 LTS';

      // specs: nodeInfo에서 추출, fallback serverType 기반
      const specs = metric.nodeInfo
        ? {
            cpu_cores: metric.nodeInfo.cpuCores,
            memory_gb: Math.round(metric.nodeInfo.memoryTotalBytes / 1024 ** 3),
            disk_gb: Math.round(metric.nodeInfo.diskTotalBytes / 1024 ** 3),
            network_speed: '1Gbps',
          }
        : {
            cpu_cores: metric.serverType === 'database' ? 8 : 4,
            memory_gb: metric.serverType === 'database' ? 32 : 16,
            disk_gb: metric.serverType === 'storage' ? 1000 : 200,
            network_speed: '1Gbps',
          };

      // ip: hostname 기반 결정적 생성
      const ip = metric.hostname
        ? `10.0.${metric.hostname.charCodeAt(0) % 256}.${metric.hostname.charCodeAt(4) % 256 || 1}`
        : `10.0.${metric.serverId.charCodeAt(0) % 256}.${metric.serverId.charCodeAt(4) % 256 || 1}`;

      return {
        id: metric.serverId,
        name: metric.serverId,
        hostname:
          metric.hostname ||
          `${metric.serverId.toLowerCase()}.openmanager.local`,
        status: metric.status,
        cpu: metric.cpu,
        cpu_usage: metric.cpu,
        memory: metric.memory,
        memory_usage: metric.memory,
        disk: metric.disk,
        disk_usage: metric.disk,
        network: metric.network,
        network_in: metric.network * 0.6,
        network_out: metric.network * 0.4,
        uptime: uptimeSeconds,
        responseTime: metric.responseTimeMs ?? 50 + metric.cpu * 2,
        last_updated: metric.timestamp,
        location: metric.location,
        alerts: metric.logs
          .filter((log) => log.includes('[WARN]') || log.includes('[CRITICAL]'))
          .map((log, idx) => ({
            id: `${metric.serverId}-${metric.minuteOfDay}-${idx}`,
            server_id: metric.serverId,
            type: log.includes('CPU')
              ? ('cpu' as const)
              : log.includes('memory') || log.includes('MEM')
                ? ('memory' as const)
                : log.includes('Disk') || log.includes('disk')
                  ? ('disk' as const)
                  : log.includes('Network') || log.includes('NET')
                    ? ('network' as const)
                    : ('custom' as const),
            message: log,
            severity: log.includes('[CRITICAL]')
              ? ('critical' as const)
              : ('warning' as const),
            timestamp: metric.timestamp,
            resolved: false,
          })),
        ip,
        os: osLabel,
        role: metric.serverType as ServerRole,
        environment: (metric.environment ||
          (metric.location.includes('Seoul')
            ? 'production'
            : 'staging')) as ServerEnvironment,
        provider: 'openmanager',
        specs,
        lastUpdate: metric.timestamp,
        services: [],
        systemInfo: {
          os: osLabel,
          uptime: `${Math.floor(uptimeSeconds / 3600)}h`,
          processes: metric.procsRunning ?? 100 + Math.floor(metric.cpu),
          zombieProcesses: 0,
          loadAverage:
            metric.loadAvg1 != null
              ? metric.loadAvg1.toFixed(2)
              : (metric.cpu / 25).toFixed(2),
          lastUpdate: metric.timestamp,
        },
        networkInfo: {
          interface: 'eth0',
          receivedBytes: `${(metric.network * 0.6).toFixed(1)} MB`,
          sentBytes: `${(metric.network * 0.4).toFixed(1)} MB`,
          receivedErrors: 0,
          sentErrors: 0,
          status: metric.status === 'offline' ? 'offline' : 'online',
        },
      };
    });
  } catch (error) {
    logger.error('❌ MetricsProvider 오류, Fallback 사용:', error);
    // Fallback to UnifiedServerDataSource
    const dataSource = getUnifiedServerDataSource();
    const rawServers = await dataSource.getServers();
    return rawServers.map(mapServerToEnhanced);
  }
}

/**
 * 🔍 특정 서버 상세 정보
 */
/**
 * 🔍 특정 서버 상세 정보
 */
async function getServerDetail(
  serverId: string
): Promise<EnhancedServerMetrics | null> {
  const dataSource = getUnifiedServerDataSource();
  const rawServers = await dataSource.getServers();
  const servers = rawServers.map(mapServerToEnhanced);
  return servers.find((server) => server.id === serverId) || null;
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
      enableRealtime?: boolean;
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
    enableRealtime = false,
  } = context.body;

  try {
    debug.log(`🎯 통합 서버 API - 액션: ${action}`, { serverId, page, limit });

    let servers: EnhancedServerMetrics[] = [];
    const additionalData: Record<string, unknown> = {};

    // 액션별 데이터 처리
    switch (action) {
      case 'list':
        if (enableRealtime) {
          servers = await getRealtimeServers();
        } else {
          const dataSource = getUnifiedServerDataSource();
          const rawServers = await dataSource.getServers();
          servers = rawServers.map(mapServerToEnhanced);
        }
        break;

      case 'cached': {
        // UnifiedServerDataSource handles caching internally
        const cachedDataSource = getUnifiedServerDataSource();
        const rawCachedServers = await cachedDataSource.getServers();
        servers = rawCachedServers.map(mapServerToEnhanced);
        additionalData.cacheInfo = {
          cached: true,
          cacheTime: new Date().toISOString(),
          source: 'unified-data-source',
        };
        break;
      }

      case 'mock': {
        // Mock data is also served by UnifiedServerDataSource (configured as 'custom' or 'basic')
        const mockDataSource = getUnifiedServerDataSource();
        const rawMockServers = await mockDataSource.getServers();
        servers = rawMockServers.map(mapServerToEnhanced);
        additionalData.mockInfo = {
          generated: true,
          serverCount: servers.length,
          source: 'unified-data-source',
        };
        break;
      }

      case 'realtime':
        servers = await getRealtimeServers();
        additionalData.realtimeInfo = {
          realtime: true,
          source: 'supabase-realtime',
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
        const serverDetail = await getServerDetail(serverId);
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
        const processData = await getServerProcesses(serverId);
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
        dataSource: enableRealtime ? 'supabase-realtime' : 'hourly-scenarios',
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
    enableRealtime: searchParams.get('realtime') === 'true',
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
