import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import type { ServerHistory } from '@/schemas/server-schemas/server-details.schema';
import {
  metricsProvider,
  type ServerMetrics,
} from '@/services/metrics/MetricsProvider';
import { getServerMonitoringService } from '@/services/monitoring';
import debug from '@/utils/debug';

/**
 * 📊 MetricsProvider 기반 개별 서버 정보 조회 API
 * GET /api/servers/[id]
 * 특정 서버의 상세 정보 및 히스토리를 반환합니다 (OTel + hourly-data 2-tier)
 */
export const GET = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const startTime = Date.now();

    try {
      const { id } = await params;
      const { searchParams } = new URL(request.url);
      const includeHistory = searchParams.get('history') === 'true';
      const range = searchParams.get('range') || '24h';
      const format = searchParams.get('format') || 'enhanced'; // enhanced | legacy | prometheus
      const includeMetrics = searchParams.get('include_metrics') === 'true';
      const includePatterns = searchParams.get('include_patterns') === 'true';

      debug.log(
        `📊 서버 [${id}] 정보 조회: history=${includeHistory}, range=${range}, format=${format}`
      );

      // MetricsProvider에서 서버 찾기 (ID 또는 hostname으로 검색)
      let metric = metricsProvider.getServerMetrics(id);

      // hostname으로도 검색 시도
      if (!metric) {
        const allMetrics = metricsProvider.getAllServerMetrics();
        metric =
          allMetrics.find((m) => m.hostname === id || m.serverId === id) ??
          null;
      }

      if (!metric) {
        const allMetrics = metricsProvider.getAllServerMetrics();
        const availableServers = allMetrics.slice(0, 10).map((m) => ({
          id: m.serverId,
          hostname: m.hostname ?? m.serverId,
        }));

        return NextResponse.json(
          {
            success: false,
            error: 'Server not found',
            message: `서버 '${id}'를 찾을 수 없습니다`,
            available_servers: availableServers,
            timestamp: new Date().toISOString(),
          },
          { status: 404 }
        );
      }

      debug.log(
        `✅ 서버 [${id}] 발견: ${metric.hostname ?? metric.serverId} (${metric.environment ?? 'unknown'}/${metric.serverType})`
      );

      // ServerMonitoringService를 통한 가공된 데이터
      const service = getServerMonitoringService();
      const processed = service.getProcessedServer(metric.serverId);
      const specs = processed?.specs
        ? { ...processed.specs, os: processed.osLabel }
        : undefined;
      const uptimeSeconds = processed?.uptimeSeconds ?? 0;

      // 3. 응답 형식에 따른 처리
      if (format === 'prometheus') {
        // 🗑️ Prometheus 형식은 더 이상 지원하지 않음
        return NextResponse.json(
          {
            error: 'Prometheus format is no longer supported',
            message: 'Please use JSON format instead',
            server_id: metric.serverId,
          },
          { status: 410 } // Gone
        );
      } else if (format === 'legacy') {
        // 레거시 형식
        const legacyServer = {
          id: metric.serverId,
          hostname: metric.hostname ?? metric.serverId,
          ip: processed?.ip,
          name: `OpenManager-${metric.serverId}`,
          type: metric.serverType,
          environment: metric.environment ?? 'onpremise',
          location: getLocationByEnvironment(metric.environment ?? 'onpremise'),
          provider: getProviderByEnvironment(metric.environment ?? 'onpremise'),
          status: metric.status,
          cpu: Math.round(metric.cpu),
          memory: Math.round(metric.memory),
          disk: Math.round(metric.disk),
          uptime: formatUptime(uptimeSeconds),
          lastUpdate: new Date(metric.timestamp),
          alerts: 0,
          services: processed?.services ?? [],
          specs,
          os: specs?.os ?? processed?.osLabel ?? 'Unknown',
          metrics: {
            cpu: Math.round(metric.cpu),
            memory: Math.round(metric.memory),
            disk: Math.round(metric.disk),
            network_in: processed?.networkIn ?? 0,
            network_out: processed?.networkOut ?? 0,
            response_time: processed?.responseTimeMs ?? 0,
          },
        };

        // 히스토리 데이터 생성 (요청시)
        let history = null;
        if (includeHistory) {
          history = generateServerHistory(metric, range);
        }

        return NextResponse.json(
          {
            success: true,
            server: legacyServer,
            history,
            meta: {
              format: 'legacy',
              include_history: includeHistory,
              range,
              timestamp: new Date().toISOString(),
              processing_time_ms: Date.now() - startTime,
            },
          },
          {
            headers: {
              // Legacy 형식도 30초 캐싱
              'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
              'CDN-Cache-Control': 'public, s-maxage=30',
              'Vercel-CDN-Cache-Control': 'public, s-maxage=30',
            },
          }
        );
      } else {
        // Enhanced 형식 (기본)
        const enhancedResponse = {
          // 기본 서버 정보
          server_info: {
            id: metric.serverId,
            hostname: metric.hostname ?? metric.serverId,
            environment: metric.environment ?? 'unknown',
            role: metric.serverType,
            status: metric.status,
            uptime: formatUptime(uptimeSeconds),
            last_updated: metric.timestamp,
          },

          // 현재 메트릭 (ServerMonitoringService 기반)
          current_metrics: {
            cpu_usage: metric.cpu,
            memory_usage: metric.memory,
            disk_usage: metric.disk,
            network_in: processed?.networkIn ?? 0,
            network_out: processed?.networkOut ?? 0,
            response_time: processed?.responseTimeMs ?? 0,
          },

          // 리소스 정보 (MetricsProvider nodeInfo 기반)
          resources: specs,
          network: {
            hostname: metric.hostname ?? metric.serverId,
            ip: processed?.ip,
            interface: 'eth0',
          },

          // 알람 정보
          alerts: processed?.alerts ?? [],

          // 서비스 정보
          services: processed?.services ?? [],
        };

        // 패턴 정보 포함 (요청시)
        let patternInfo: unknown;
        let correlationMetrics: unknown;
        if (includePatterns) {
          patternInfo = null;
          correlationMetrics = null;
        }

        // 히스토리 데이터 (요청시)
        let history: ServerHistory | undefined;
        if (includeHistory) {
          history = generateServerHistory(metric, range);
        }

        // 메타데이터
        const response = {
          meta: {
            request_info: {
              server_id: id,
              format,
              include_history: includeHistory,
              include_metrics: includeMetrics,
              include_patterns: includePatterns,
              range,
              processing_time_ms: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            },
            dataSource: 'hourly-scenarios',
            scenario: 'production',
          },
          data: {
            ...enhancedResponse,
            pattern_info: patternInfo,
            correlation_metrics: correlationMetrics,
            history,
          },
        };

        return NextResponse.json(response, {
          headers: {
            'X-Server-Id': metric.serverId,
            'X-Hostname': metric.hostname ?? metric.serverId,
            'X-Server-Status': metric.status,
            'X-Processing-Time-Ms': (Date.now() - startTime).toString(),
            // 개별 서버 정보는 30초 캐싱
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
            'CDN-Cache-Control': 'public, s-maxage=30',
            'Vercel-CDN-Cache-Control': 'public, s-maxage=30',
          },
        });
      }
    } catch (error) {
      debug.error(`❌ 서버 [${(await params).id}] 정보 조회 실패:`, error);

      return NextResponse.json(
        {
          success: false,
          error: 'Server information retrieval failed',
          message:
            error instanceof Error
              ? error.message
              : '서버 정보 조회 중 오류가 발생했습니다',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  }
);

/**
 * 🌍 환경별 위치 반환
 */
function getLocationByEnvironment(environment: string): string {
  const locationMap: Record<string, string> = {
    aws: 'AWS Seoul (ap-northeast-2)',
    azure: 'Azure Korea Central',
    gcp: 'GCP Seoul (asia-northeast3)',
    container: 'Container Cluster',
    idc: 'Seoul IDC',
    vdi: 'Virtual Desktop Infrastructure',
    onpremise: 'On-Premise Seoul DC1',
  };
  return locationMap[environment] || 'Unknown Location';
}

/**
 * 🏢 환경별 제공자 반환
 */
function getProviderByEnvironment(environment: string): string {
  const providerMap: Record<string, string> = {
    aws: 'Amazon Web Services',
    azure: 'Microsoft Azure',
    gcp: 'Google Cloud Platform',
    kubernetes: 'Kubernetes',
    idc: 'Internet Data Center',
    vdi: 'VMware vSphere',
    onpremise: 'On-Premise',
  };
  return providerMap[environment] || 'Unknown Provider';
}

/**
 * ⏰ 업타임 포맷팅
 */
function formatUptime(uptimeSeconds: number): string {
  const days = Math.floor(uptimeSeconds / (24 * 3600));
  const hours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);

  return `${days}d ${hours}h ${minutes}m`;
}

/**
 * 📈 서버 히스토리 (현재 스냅샷만 반환)
 * 실제 시계열 데이터가 없으므로 현재 메트릭을 단일 데이터 포인트로 반환.
 * Math.random/Math.sin 기반 fabrication 제거됨.
 */
function generateServerHistory(
  metric: ServerMetrics,
  range: string
): ServerHistory {
  const now = new Date().toISOString();

  return {
    time_range: range,
    start_time: now,
    end_time: now,
    interval_ms: 0,
    data_points: [
      {
        timestamp: now,
        metrics: {
          cpu_usage: metric.cpu,
          memory_usage: metric.memory,
          disk_usage: metric.disk,
          network_in: metric.network,
          network_out: metric.network,
          response_time: metric.responseTimeMs ?? 0,
        },
      },
    ],
  };
}
