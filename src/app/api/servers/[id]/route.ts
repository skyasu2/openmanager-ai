import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getOTelTimeSeries } from '@/data/otel-processed';
import { withAuth } from '@/lib/auth/api-auth';
import type { ServerHistory } from '@/schemas/server-schemas/server-details.schema';
import { metricsProvider } from '@/services/metrics/MetricsProvider';
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

      const serverId = metric.serverId;

      debug.log(
        `✅ 서버 [${id}] 발견: ${metric.hostname ?? serverId} (${metric.environment ?? 'unknown'}/${metric.serverType})`
      );

      // ServerMonitoringService를 통한 가공된 데이터
      const service = getServerMonitoringService();
      const processed = service.getProcessedServer(serverId);
      const specs = processed?.specs
        ? { ...processed.specs, os: processed.osLabel }
        : undefined;
      const uptimeSeconds = processed?.uptimeSeconds ?? 0;

      // 3. 응답 형식에 따른 처리
      if (format === 'legacy') {
        // 레거시 형식
        const legacyServer = {
          id: serverId,
          hostname: metric.hostname ?? serverId,
          ip: processed?.ip,
          name: `OpenManager-${serverId}`,
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
          history = generateServerHistoryFromTimeSeries(serverId, range);
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
              // 인증 응답: 공유 캐시 금지
              'Cache-Control': 'private, no-store, max-age=0',
              Pragma: 'no-cache',
            },
          }
        );
      } else {
        // Enhanced 형식 (기본)
        const enhancedResponse = {
          // 기본 서버 정보
          server_info: {
            id: serverId,
            hostname: metric.hostname ?? serverId,
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
            hostname: metric.hostname ?? serverId,
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
          history = generateServerHistoryFromTimeSeries(serverId, range);
        }

        // 메타데이터
        const response = {
          success: true,
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
            'X-Server-Id': serverId,
            'X-Hostname': metric.hostname ?? serverId,
            'X-Server-Status': metric.status,
            'X-Processing-Time-Ms': (Date.now() - startTime).toString(),
            // 인증 응답: 공유 캐시 금지
            'Cache-Control': 'private, no-store, max-age=0',
            Pragma: 'no-cache',
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
 * 📈 사전 계산된 TimeSeries 데이터에서 서버 히스토리 생성
 */
function generateServerHistoryFromTimeSeries(
  serverId: string,
  range: string
): ServerHistory {
  const ts = getOTelTimeSeries();
  const serverIndex = ts.serverIds.indexOf(serverId);

  if (serverIndex === -1) {
    // Fallback: 1 point only
    const now = new Date().toISOString();
    return {
      time_range: range,
      start_time: now,
      end_time: now,
      interval_ms: 0,
      data_points: [],
    };
  }

  const timestamps: number[] = ts.timestamps;
  const cpuData = ts.metrics.cpu?.[serverIndex] || [];
  const memoryData = ts.metrics.memory?.[serverIndex] || [];
  const diskData = ts.metrics.disk?.[serverIndex] || [];
  const networkData = ts.metrics.network?.[serverIndex] || [];

  const fullDataPoints = timestamps.map((t: number, i: number) => ({
    timestamp: new Date(t * 1000).toISOString(),
    timestampUnix: t * 1000,
    metrics: {
      cpu_usage: cpuData[i] ?? 0,
      memory_usage: memoryData[i] ?? 0,
      disk_usage: diskData[i] ?? 0,
      network_in: Math.round((networkData[i] ?? 0) * 0.6),
      network_out: Math.round((networkData[i] ?? 0) * 0.4),
      response_time: 100 + (cpuData[i] ?? 0) * 2, // Simple heuristic
    },
  }));

  // 범위에 따른 필터링 구현
  let durationMs = 24 * 60 * 60 * 1000; // 기본 24h
  const match = range.match(/^(\d+)([mh])$/);
  if (match?.[1] && match[2]) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 'h') durationMs = value * 60 * 60 * 1000;
    else if (unit === 'm') durationMs = value * 60 * 1000;
  }

  const now = Date.now();
  const startTimeMs = now - durationMs;

  const filteredPoints = fullDataPoints.filter(
    (p) => p.timestampUnix >= startTimeMs
  );

  // 데이터가 없으면 빈 배열 대신 마지막 포인트라도 반환 (그래프 렌더링 위해)
  const finalPoints =
    filteredPoints.length > 0 ? filteredPoints : fullDataPoints.slice(-1);

  return {
    time_range: range,
    start_time: finalPoints[0]?.timestamp || new Date().toISOString(),
    end_time:
      finalPoints[finalPoints.length - 1]?.timestamp ||
      new Date().toISOString(),
    interval_ms: 600000, // 10분
    data_points: finalPoints.map(({ timestamp, metrics }) => ({
      timestamp,
      metrics,
    })),
  };
}
