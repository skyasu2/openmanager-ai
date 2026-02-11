'use client';

import { useQuery } from '@tanstack/react-query';
import type { MonitoringReport } from '@/services/monitoring/MonitoringContext';

type MonitoringReportResponse = {
  success: boolean;
  metadata: { dataSource: string; processingTime: number };
} & MonitoringReport;

async function fetchMonitoringReport(): Promise<MonitoringReportResponse> {
  const response = await fetch('/api/monitoring/report');
  if (!response.ok) {
    throw new Error(`Monitoring report API error: ${response.status}`);
  }
  return response.json();
}

export function useMonitoringReport() {
  return useQuery({
    queryKey: ['monitoring-report'],
    queryFn: fetchMonitoringReport,
    refetchInterval: 30_000, // 30초 간격 갱신
    staleTime: 25_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
