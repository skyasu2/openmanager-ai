import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OTEL_METRIC } from '@/constants/otel-metric-names';

export const maxDuration = 10;

import { getTimeSeries } from '@/data/otel-data';
import { withAuth } from '@/lib/auth/api-auth';
import type {
  EnhancedServerResponse,
  ServerHistory,
} from '@/schemas/server-schemas/server-details.schema';
import { ServerDetailQuerySchema } from '@/schemas/server-schemas/server-details.schema';
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

      // 쿼리 계약을 스키마로 검증한다. 지원하지 않는 값을 조용히 무시하면
      // meta.request_info가 실제 처리와 다른 값을 되돌려주게 된다.
      const parsedQuery = ServerDetailQuerySchema.safeParse(
        Object.fromEntries(searchParams)
      );

      if (!parsedQuery.success) {
        const invalidParams = parsedQuery.error.issues.map((issue) =>
          issue.path.join('.')
        );

        return NextResponse.json(
          {
            success: false,
            error: 'Invalid query parameter',
            message: `지원하지 않는 쿼리 값입니다: ${invalidParams.join(', ')}`,
            invalid_params: invalidParams,
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }

      const query = parsedQuery.data;
      const includeHistory = query.history === 'true';
      const range = query.range;
      const format = query.format;

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

      const enhancedResponse = {
        server_info: {
          id: serverId,
          hostname: metric.hostname ?? serverId,
          environment: metric.environment ?? 'unknown',
          role: metric.serverType,
          status: metric.status,
          uptime: formatUptime(uptimeSeconds, { includeMinutes: true }),
          last_updated: metric.timestamp,
        },
        current_metrics: {
          cpu_usage: metric.cpu,
          memory_usage: metric.memory,
          disk_usage: metric.disk,
          network_in: processed?.networkIn ?? 0,
          network_out: processed?.networkOut ?? 0,
          response_time: processed?.responseTimeMs ?? 0,
        },
        resources: specs,
        network: {
          hostname: metric.hostname ?? serverId,
          ip: processed?.ip,
          interface: 'eth0',
        },
        alerts: processed?.alerts ?? [],
        services: processed?.services ?? [],
      } satisfies EnhancedServerResponse['data'];

      let history: ServerHistory | undefined;
      if (includeHistory) {
        history = await generateServerHistoryFromTimeSeries(serverId, range);
      }

      const response = {
        success: true,
        meta: {
          request_info: {
            server_id: id,
            format,
            include_history: includeHistory,
            range,
            processing_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          },
          dataSource: 'vercel-static-otel-hourly-scenarios',
          scenario: 'production',
        },
        data: {
          ...enhancedResponse,
          history,
        },
      } satisfies EnhancedServerResponse;

      return NextResponse.json(response, {
        headers: {
          'X-Server-Id': serverId,
          'X-Hostname': metric.hostname ?? serverId,
          'X-Server-Status': metric.status,
          'X-Processing-Time-Ms': (Date.now() - startTime).toString(),
          'Cache-Control': 'private, no-store, max-age=0',
          Pragma: 'no-cache',
        },
      });
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
