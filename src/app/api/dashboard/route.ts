import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { getSystemConfig } from '@/config/SystemConfiguration';
import { createApiRoute } from '@/lib/api/zod-middleware';
import { logger } from '@/lib/logging';
import {
  DashboardActionRequestSchema,
  type DashboardActionResponse,
  DashboardActionResponseSchema,
  type DashboardResponse,
  DashboardResponseSchema,
  type DashboardServer,
  type DashboardStats,
} from '@/schemas/api.schema';
import { getServerMetricsFromUnifiedSource } from '@/services/data/UnifiedServerDataSource';
import type { Server } from '@/types/server';
import { getErrorMessage } from '@/types/type-utils';
import debug from '@/utils/debug';

/**
 * 테스트 모드 감지
 * E2E 테스트 시 인증 우회를 위한 헬퍼 함수
 */
function isTestMode(request: NextRequest): boolean {
  // Only allow test mode in non-production environments
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  // Check for test mode header
  const testHeader = request.headers.get('X-Test-Mode');
  if (testHeader === 'enabled') {
    logger.info('🧪 [Dashboard API] Test mode detected via X-Test-Mode header');
    return true;
  }

  // Check for test mode cookie
  const cookies = request.cookies;
  const testModeCookie = cookies.get('test_mode');
  if (testModeCookie?.value === 'enabled') {
    logger.info('🧪 [Dashboard API] Test mode detected via test_mode cookie');
    return true;
  }

  return false;
}

/**
 * 📊 실시간 대시보드 API
 *
 * Supabase에서 실제 서버 데이터를 가져와서 대시보드 표시
 * - 실시간 서버 메트릭
 * - Supabase PostgreSQL 연동
 * - 메모리 캐시 최적화
 * - Zod 스키마로 타입 안전성 보장
 */

// 서버 데이터 인터페이스 정의 (any 타입 제거)
interface SupabaseServer {
  id: string;
  name: string;
  type?: string;
  status: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: number;
  location?: string;
  environment?: string;
  uptime?: string | number;
  lastUpdate?: string | Date;
  metrics?: {
    cpu?: number | { usage: number };
    memory?: number | { usage: number; used?: number; total?: number };
    disk?: number | { usage: number; used?: number; total?: number };
    network?: { rx: number; tx: number; bytesIn?: number; bytesOut?: number };
  };
}

// GET 핸들러
const getHandler = createApiRoute()
  .response(DashboardResponseSchema)
  .configure({
    showDetailedErrors: process.env.NODE_ENV === 'development',
    enableLogging: true,
  })
  .build(async (_request, _context): Promise<DashboardResponse> => {
    const startTime = Date.now();

    debug.log('📊 실시간 대시보드 API 호출...');

    // 🎯 통합 데이터 소스 사용 (Single Source of Truth)
    debug.log('🚀 중앙집중식 설정 시스템으로 데이터 로드');

    let serverList: SupabaseServer[] = [];

    try {
      // 🎯 통합 서버 메트릭 조회 (중앙집중식 설정)
      const metrics = await getServerMetricsFromUnifiedSource();
      const config = getSystemConfig();

      debug.log(
        `🎯 통합 데이터 소스에서 ${metrics.totalServers}개 서버 로드 완료`
      );

      // 실제 서버 리스트 가져오기
      const { getUnifiedServerDataSource } = await import(
        '@/services/data/UnifiedServerDataSource'
      );
      const dataSource = getUnifiedServerDataSource();
      const servers = await dataSource.getServers();

      // 서버 데이터를 SupabaseServer 형태로 변환 (기존 호환성 유지)
      serverList = servers.map(
        (server: Server): SupabaseServer => ({
          id: server.id,
          name: server.name,
          type: server.type,
          status: server.status,
          cpu: server.cpu,
          memory: server.memory,
          disk: server.disk,
          location: server.location || 'us-east-1',
          environment: server.environment || 'production',
          uptime: server.uptime || 99.9,
          lastUpdate: server.lastUpdate || new Date().toISOString(),
          metrics: {
            cpu: server.cpu,
            memory: server.memory,
            disk: server.disk,
            network:
              typeof server.network === 'object' ? server.network : undefined,
          },
        })
      );

      debug.log(
        `✅ 통합 데이터 소스 로드 완료: ${serverList.length}개 서버, ${config.environment.mode} 환경`
      );
    } catch (error) {
      debug.error('❌ 통합 데이터 소스 로드 실패:', error);
      debug.log('🔄 응급 복구 모드로 전환...');
      serverList = [];
    }

    // 서버 데이터를 객체 형태로 변환 (기존 API 호환성)
    const serversMap: Record<string, DashboardServer> = {};
    serverList.forEach((server) => {
      const dashboardServer: DashboardServer = {
        id: server.id,
        name: server.name,
        type: server.type || 'server',
        status:
          server.status === 'online'
            ? 'online'
            : server.status === 'critical'
              ? 'critical'
              : 'warning',
        cpu:
          typeof server.metrics?.cpu === 'object'
            ? server.metrics.cpu.usage
            : server.metrics?.cpu || server.cpu || 0,
        memory:
          typeof server.metrics?.memory === 'object'
            ? server.metrics.memory.usage
            : server.metrics?.memory || server.memory || 0,
        disk:
          typeof server.metrics?.disk === 'object'
            ? server.metrics.disk.usage
            : server.metrics?.disk || server.disk || 0,
        location: server.location || 'Unknown',
        environment: server.environment,
        metrics: {
          cpu: server.metrics?.cpu,
          memory:
            typeof server.metrics?.memory === 'number'
              ? {
                  usage: server.metrics.memory,
                  used: Math.round(server.metrics.memory * 0.8),
                  total: 100,
                }
              : server.metrics?.memory
                ? {
                    usage: server.metrics.memory.usage || 0,
                    used:
                      server.metrics.memory.used ||
                      Math.round((server.metrics.memory.usage || 0) * 0.8),
                    total: server.metrics.memory.total || 100,
                  }
                : undefined,
          disk:
            typeof server.metrics?.disk === 'number'
              ? {
                  usage: server.metrics.disk,
                  used: Math.round(server.metrics.disk * 0.8),
                  total: 100,
                }
              : server.metrics?.disk
                ? {
                    usage: server.metrics.disk.usage || 0,
                    used:
                      server.metrics.disk.used ||
                      Math.round((server.metrics.disk.usage || 0) * 0.8),
                    total: server.metrics.disk.total || 100,
                  }
                : undefined,
          network: (() => {
            const networkValue = server.network || server.metrics?.network || 0;
            return typeof networkValue === 'number'
              ? {
                  rx: Math.round(networkValue * 0.6), // 60% inbound
                  tx: Math.round(networkValue * 0.4), // 40% outbound
                  bytesIn: Math.round(networkValue * 1024 * 1024), // MB 단위
                  bytesOut: Math.round(networkValue * 512 * 1024), // MB 단위
                }
              : networkValue;
          })(),
        },
      };
      serversMap[server.id] = dashboardServer;
    });

    // 통계 계산 - SupabaseServer를 DatabaseServer 호환 형식으로 변환
    const statsInput: DatabaseServer[] = serverList.map((server) => ({
      id: server.id,
      name: server.name,
      status: server.status,
      cpu: server.cpu,
      memory: server.memory,
      disk: server.disk,
      metrics: {
        cpu: server.cpu,
        memory: server.memory,
        disk: server.disk,
        network: {
          rx: Math.round((server.network || 0) * 0.6),
          tx: Math.round((server.network || 0) * 0.4),
        },
      },
      type: server.type,
      location: server.location,
      environment: server.environment,
      uptime:
        typeof server.uptime === 'string'
          ? parseInt(server.uptime, 10) || 0
          : server.uptime,
      lastUpdate:
        server.lastUpdate instanceof Date
          ? server.lastUpdate.toISOString()
          : server.lastUpdate,
    }));
    const stats = calculateServerStats(statsInput);

    const response: DashboardResponse = {
      success: true,
      data: {
        servers: serversMap,
        stats,
        recentAlerts: [], // Add required field
        systemHealth: 'good' as const, // Add required field
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      metadata: {
        processingTime: Date.now() - startTime,
        cacheHit: false,
        dataSource: 'supabase-realtime',
      },
    };

    debug.log(
      `✅ 실시간 대시보드 응답 완료 (${response.metadata?.processingTime || 0}ms)`
    );

    return response;
  });

/**
 * GET /api/dashboard
 *
 * Supabase에서 실시간 대시보드 데이터 가져오기
 */
async function handleDashboardGET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // 🧪 테스트 모드 확인 및 우회
  const testMode = isTestMode(request);
  if (testMode) {
    logger.info(
      '🧪 [Dashboard API] 테스트 모드 감지 - 인증 우회하고 테스트 데이터 반환'
    );

    // 테스트용 간소화된 응답 반환
    return NextResponse.json(
      {
        success: true,
        data: {
          servers: {},
          stats: {
            totalServers: 15,
            onlineServers: 12,
            warningServers: 2,
            criticalServers: 1,
            avgCpu: 45,
            avgMemory: 62,
            avgDisk: 58,
            totalAlerts: 3,
            criticalAlerts: 1,
            responseTime: 0,
          },
          recentAlerts: [],
          systemHealth: 'good' as const,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
        metadata: {
          processingTime: Date.now() - startTime,
          cacheHit: false,
          dataSource: 'test-mode',
        },
      },
      {
        status: 200,
        headers: {
          'X-Test-Mode-Active': 'true',
          'X-Data-Source': 'Test-Mode',
          'X-Response-Time': '0ms',
        },
      }
    );
  }

  try {
    const response = await getHandler(request);
    const responseData: DashboardResponse =
      typeof response === 'object' && 'json' in response
        ? await response.json()
        : response;

    // 📊 REALTIME: 30초 TTL, SWR 비활성화 (실시간 대시보드 최적화)
    // 대시보드는 자주 폴링되므로 SWR 백그라운드 갱신 불필요
    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control':
          'public, max-age=0, s-maxage=30, stale-while-revalidate=0',
        'CDN-Cache-Control': 'public, s-maxage=30',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=30',
        'X-Data-Source': 'Supabase-Realtime',
        'X-Response-Time': `${responseData.metadata?.processingTime || 0}ms`,
        'X-Server-Count':
          responseData.data?.stats?.totalServers?.toString() || '0',
      },
    });
  } catch (error) {
    debug.error('❌ 대시보드 API 오류:', error);

    const processingTime = Date.now() - startTime;
    return NextResponse.json(
      {
        success: false,
        data: {
          servers: {},
          stats: {
            totalServers: 0,
            onlineServers: 0,
            warningServers: 0,
            criticalServers: 0,
            avgCpu: 0,
            avgMemory: 0,
            avgDisk: 0,
            totalAlerts: 0,
            criticalAlerts: 0,
            responseTime: processingTime,
          },
          recentAlerts: [],
          systemHealth: 'critical' as const,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
        metadata: {
          processingTime,
          cacheHit: false,
          dataSource: 'error',
        },
      },
      {
        status: 500,
        headers: {
          'X-Error': 'Dashboard-Error',
          'X-Response-Time': `${processingTime}ms`,
        },
      }
    );
  }
}

/**
 * 📊 서버 통계 계산 (유틸리티 함수)
 */
interface DatabaseServer {
  id: string;
  name: string;
  status: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  metrics?: {
    cpu?: number;
    memory?: number;
    disk?: number;
    network?: { rx: number; tx: number };
  };
  type?: string;
  location?: string;
  environment?: string;
  uptime?: number;
  lastUpdate?: string;
  tags?: string[];
}

function calculateServerStats(servers: DatabaseServer[]): DashboardStats {
  if (servers.length === 0) {
    return {
      totalServers: 0,
      onlineServers: 0,
      warningServers: 0,
      criticalServers: 0,
      avgCpu: 0,
      avgMemory: 0,
      avgDisk: 0,
      totalAlerts: 0,
      criticalAlerts: 0,
      responseTime: 0,
    };
  }

  // 🎯 포트폴리오 시나리오 데이터의 실제 상태 매핑
  const online = servers.filter((s) => s.status === 'online').length;
  const warning = servers.filter((s) => s.status === 'warning').length;
  const critical = servers.filter(
    (s) => s.status === 'critical' || s.status === 'offline'
  ).length;

  debug.log('📊 서버 상태 통계 계산:', {
    total: servers.length,
    online,
    warning,
    critical,
    serverStatuses: servers.map((s) => ({ id: s.id, status: s.status })),
  });

  const totalCpu = servers.reduce((sum, s) => {
    const cpuValue = s.metrics?.cpu ?? s.cpu ?? 0;
    return sum + cpuValue;
  }, 0);

  const totalMemory = servers.reduce((sum, s) => {
    const memoryValue = s.metrics?.memory ?? s.memory ?? 0;
    return sum + memoryValue;
  }, 0);

  const totalDisk = servers.reduce((sum, s) => {
    const diskValue = s.metrics?.disk ?? s.disk ?? 0;
    return sum + diskValue;
  }, 0);

  return {
    totalServers: servers.length,
    onlineServers: online,
    warningServers: warning,
    criticalServers: critical,
    avgCpu: Math.round(totalCpu / servers.length),
    avgMemory: Math.round(totalMemory / servers.length),
    avgDisk: Math.round(totalDisk / servers.length),
    totalAlerts: warning + critical,
    criticalAlerts: critical,
    responseTime: 0,
  };
}

// POST 핸들러
const postHandler = createApiRoute()
  .body(DashboardActionRequestSchema)
  .response(DashboardActionResponseSchema)
  .configure({
    showDetailedErrors: process.env.NODE_ENV === 'development',
    enableLogging: true,
  })
  .build((_request, context): Promise<DashboardActionResponse> => {
    const { action } = context.body;

    debug.log('🔄 대시보드 액션 요청...', action);

    // 간단한 새로고침 응답
    if (action === 'refresh') {
      // 실제 시스템에서는 캐시 새로고침 또는 데이터 갱신
      debug.log('🔄 실시간 데이터 새로고침 중...');

      return Promise.resolve({
        success: true,
        message: '실시간 시스템 새로고침 완료',
        action: 'refresh',
        timestamp: new Date().toISOString(),
      });
    }

    return Promise.resolve({
      success: true,
      message: '액션 처리 완료',
      action: action || 'refresh',
      timestamp: new Date().toISOString(),
    });
  });

/**
 * POST /api/dashboard
 *
 * 대시보드 액션 처리 (새로고침 등)
 */
export const GET = withAuth(handleDashboardGET);

async function handleDashboardPOST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    return (await postHandler(request)) as NextResponse;
  } catch (error) {
    debug.error('❌ 대시보드 POST 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '액션 처리 실패',
        message: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handleDashboardPOST);
