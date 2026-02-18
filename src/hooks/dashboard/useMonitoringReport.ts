'use client';

import { useQuery } from '@tanstack/react-query';
import {
  type MonitoringReportApiResponse,
  MonitoringReportApiResponseSchema,
  type MonitoringReportErrorResponse,
  type MonitoringReportResponse,
} from '@/schemas/api.monitoring-report.schema';

export type { MonitoringReportResponse };

const MONITORING_POLL_INTERVAL_MS = 30_000;
const MONITORING_STALE_TIME_MS = 25_000;
const MONITORING_GC_TIME_MS = 60_000;

function getMonitoringErrorMessageByStatus(status: number): string {
  if (status === 401) return '모니터링 리포트 조회 권한이 없습니다.';
  if (status === 403) return '모니터링 리포트 접근이 차단되었습니다.';
  if (status === 404) return '모니터링 리포트 API를 찾을 수 없습니다.';
  if (status >= 500) return '모니터링 서버 오류가 발생했습니다.';
  return `모니터링 리포트 조회 오류 (${status})`;
}

function getMonitoringErrorMessageByCode(
  errorResponse: MonitoringReportErrorResponse
): string {
  switch (errorResponse.code) {
    case 'MONITORING_DATA_SOURCE_TIMEOUT':
      return '모니터링 데이터 소스 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.';
    case 'MONITORING_RESPONSE_INVALID':
      return '모니터링 응답 형식이 올바르지 않습니다.';
    case 'MONITORING_CONTEXT_ERROR':
      return '모니터링 데이터를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    case 'MONITORING_REPORT_FAILED':
      return errorResponse.message || '모니터링 리포트 조회에 실패했습니다.';
    default:
      return '모니터링 리포트 조회 중 알 수 없는 오류가 발생했습니다.';
  }
}

async function fetchMonitoringReport(): Promise<MonitoringReportResponse> {
  const response = await fetch('/api/monitoring/report');

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const parsed = MonitoringReportApiResponseSchema.safeParse(payload);
  if (!parsed.success) {
    if (!response.ok) {
      throw new Error(getMonitoringErrorMessageByStatus(response.status));
    }

    throw new Error('Invalid monitoring report response format');
  }

  const data: MonitoringReportApiResponse = parsed.data;
  if (!data.success) {
    throw new Error(getMonitoringErrorMessageByCode(data));
  }

  return data;
}

export function useMonitoringReport() {
  return useQuery({
    queryKey: ['monitoring-report'],
    queryFn: fetchMonitoringReport,
    refetchInterval: () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible'
      ) {
        return false;
      }
      return MONITORING_POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
    staleTime: MONITORING_STALE_TIME_MS,
    gcTime: MONITORING_GC_TIME_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
