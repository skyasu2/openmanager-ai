import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OTEL_METRIC } from '@/constants/otel-metric-names';
import { getTimeSeries } from '@/data/otel-data';
import { withAuth } from '@/lib/auth/api-auth';
import type {
  EnhancedServerResponse,
  LegacyServerResponse,
  ServerHistory,
} from '@/schemas/server-schemas/server-details.schema';
import { metricsProvider } from '@/services/metrics/MetricsProvider';
import {
  normalizeNetworkUtilizationPercent,
  normalizeUtilizationPercent,
} from '@/services/metrics/metric-normalization';
import { getServerMonitoringService } from '@/services/monitoring';
import debug from '@/utils/debug';
import { formatUptime } from '@/utils/serverUtils';

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

      // 비동기 데이터 로딩 보장
      await metricsProvider.ensureDataLoaded();

      // MetricsProvider에서 서버 찾기 (ID 또는 hostname으로 검색)
      let metric = await metricsProvider.getServerMetrics(id);

      // hostname으로도 검색 시도
      if (!metric) {
        const allMetrics = await metricsProvider.getAllServerMetrics();
        metric =
          allMetrics.find((m) => m.hostname === id || m.serverId === id) ??
          null;
      }

      if (!metric) {
        const allMetrics = await metricsProvider.getAllServerMetrics();
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
      const processed = await service.getProcessedServer(serverId);
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
          uptime: formatUptime(uptimeSeconds, { includeMinutes: true }),
          lastUpdate: new Date(metric.timestamp).toISOString(),
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
        } satisfies LegacyServerResponse['server'];

        // 히스토리 데이터 생성 (요청시)
        let history = null;
        if (includeHistory) {
          history = await generateServerHistoryFromTimeSeries(serverId, range);
        }

        const legacyResponse = {
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
        } satisfies LegacyServerResponse;

        return NextResponse.json(legacyResponse, {
          headers: {
            // 인증 응답: 공유 캐시 금지
            'Cache-Control': 'private, no-store, max-age=0',
            Pragma: 'no-cache',
          },
        });
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
            uptime: formatUptime(uptimeSeconds, { includeMinutes: true }),
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
        } satisfies EnhancedServerResponse['data'];

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
          history = await generateServerHistoryFromTimeSeries(serverId, range);
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
        } satisfies EnhancedServerResponse;

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
 * 📈 사전 계산된 TimeSeries 데이터에서 서버 히스토리 생성
 */
async function generateServerHistoryFromTimeSeries(
  serverId: string,
  range: string
): Promise<ServerHistory> {
  const ts = await getTimeSeries();

  if (!ts) {
    const now = new Date().toISOString();
    return {
      time_range: range,
      start_time: now,
      end_time: now,
      interval_ms: 0,
      data_points: [],
    };
  }

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
  const cpuData = ts.metrics[OTEL_METRIC.CPU]?.[serverIndex] || [];
  const memoryData = ts.metrics[OTEL_METRIC.MEMORY]?.[serverIndex] || [];
  const diskData = ts.metrics[OTEL_METRIC.DISK]?.[serverIndex] || [];
  const networkData = ts.metrics[OTEL_METRIC.NETWORK]?.[serverIndex] || [];
  const responseData =
    ts.metrics[OTEL_METRIC.HTTP_DURATION]?.[serverIndex] || [];

  const fullDataPoints = timestamps.map((t: number, i: number) => ({
    // OTel timeseries는 ratio(0~1) 기반이므로 히스토리 응답 전에 percent(0~100)로 정규화.
    // UI/경고 로직의 SSOT 임계값(%)과 단위를 맞춘다.
    //
    // network_in/out은 단일 utilization 값을 방향 비율로 분할해 제공한다.
    // (OTel source에 방향 태그가 없는 시나리오 대응)
    timestamp: new Date(t * 1000).toISOString(),
    timestampUnix: t * 1000,
    metrics: (() => {
      const cpuUsage = normalizeUtilizationPercent(cpuData[i] ?? 0);
      const memoryUsage = normalizeUtilizationPercent(memoryData[i] ?? 0);
      const diskUsage = normalizeUtilizationPercent(diskData[i] ?? 0);
      const networkUsage = normalizeNetworkUtilizationPercent(
        networkData[i] ?? 0
      );

      return {
        cpu_usage: cpuUsage,
        memory_usage: memoryUsage,
        disk_usage: diskUsage,
        network_in: Math.round(networkUsage * 0.6),
        network_out: Math.round(networkUsage * 0.4),
        response_time: Math.round((responseData[i] ?? 0) * 1000), // sec -> ms
      };
    })(),
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

  // 정적 데이터셋(public/data)에서도 안정적으로 동작하도록
  // "현재 시각"이 아니라 데이터셋 마지막 포인트를 anchor로 사용한다.
  const datasetEndMs =
    timestamps.length > 0
      ? timestamps[timestamps.length - 1]! * 1000
      : Date.now();
  const datasetStartMs =
    timestamps.length > 0 ? timestamps[0]! * 1000 : datasetEndMs;
  const startTimeMs = Math.max(datasetStartMs, datasetEndMs - durationMs);

  const filteredPoints = fullDataPoints.filter(
    (p) => p.timestampUnix >= startTimeMs && p.timestampUnix <= datasetEndMs
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
