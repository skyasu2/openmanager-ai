'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ServerCrash, Zap } from 'lucide-react';
import { type FC, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getMsUntilNextServerDataSlot,
  SERVER_DATA_INTERVAL_MS,
} from '@/config/server-data-polling';

interface AnomalyData {
  id: string;
  serverId: string;
  serverName: string;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'response_time' | 'error_rate';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  status: 'active' | 'resolved' | 'investigating';
  source?: 'metrics' | 'logs';
  description?: string;
  metric?: string;
}

interface AnomalyResponse {
  success: boolean;
  anomalies: AnomalyData[];
}

interface MonitoringReportResponse {
  success: boolean;
  firingAlerts?: Array<{
    id: string;
    serverId: string;
    instance: string;
    metric: string;
    value: number;
    threshold: number;
    severity: 'warning' | 'critical';
    state: 'firing' | 'resolved';
    firedAt: string;
    labels?: Record<string, string>;
  }>;
}

interface AnomalyFeedProps {
  className?: string;
  maxItems?: number;
  autoRefresh?: boolean;
  /** 갱신 주기 (ms). 최소 SERVER_DATA_INTERVAL_MS(10분)로 클램핑됨. 0이면 슬롯 경계 정렬 폴링. */
  refreshInterval?: number;
  showDetails?: boolean;
}

// Fetcher function
const fetchAnomalies = async (): Promise<AnomalyResponse> => {
  const res = await fetch('/api/monitoring/report', {
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error(`이상 징후 데이터 조회 실패: ${res.status}`);
  }

  const report = (await res.json()) as MonitoringReportResponse;
  if (!report.success) {
    throw new Error('모니터링 리포트 응답이 올바르지 않습니다.');
  }

  const normalizeType = (metric: string): AnomalyData['type'] => {
    const value = metric.toLowerCase();
    if (value.includes('cpu')) return 'cpu';
    if (value.includes('memory')) return 'memory';
    if (value.includes('disk')) return 'disk';
    if (value.includes('network')) return 'network';
    if (value.includes('response')) return 'response_time';
    return 'error_rate';
  };

  const anomalies: AnomalyData[] = (report.firingAlerts ?? []).map((alert) => {
    return {
      id: alert.id,
      serverId: alert.serverId,
      serverName: alert.instance || alert.serverId,
      type: normalizeType(alert.metric),
      severity: alert.severity === 'critical' ? 'critical' : 'medium',
      message:
        alert.labels?.summary ||
        `${alert.metric} 임계치(${alert.threshold}) 초과`,
      value: alert.value,
      threshold: alert.threshold,
      timestamp: alert.firedAt,
      status: alert.state === 'resolved' ? 'resolved' : 'active',
      source: 'metrics',
      metric: alert.metric,
    };
  });

  return { success: true, anomalies };
};

// Icon component
const AnomalyIcon: FC<{ anomaly: AnomalyData }> = ({ anomaly }) => {
  if (anomaly.source === 'logs') {
    return (
      <ServerCrash
        className={`h-5 w-5 ${anomaly.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}
      />
    );
  }
  return (
    <Zap
      className={`h-5 w-5 ${anomaly.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}
    />
  );
};

export function AnomalyFeed({
  className = '',
  maxItems = 20,
  autoRefresh = true,
  refreshInterval = 0, // 0이면 10분 슬롯 경계 정렬 폴링
  showDetails: _showDetails = true,
}: AnomalyFeedProps) {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' &&
      refreshInterval > 0 &&
      refreshInterval < SERVER_DATA_INTERVAL_MS
    ) {
      console.warn(
        `[AnomalyFeed] refreshInterval(${refreshInterval}ms)이 최소값(${SERVER_DATA_INTERVAL_MS}ms)보다 작아 클램핑됩니다.`
      );
    }
  }, [refreshInterval]);

  // Data fetching using React Query
  const { data, error, isLoading } = useQuery({
    queryKey: ['anomalies'],
    queryFn: fetchAnomalies,
    refetchInterval: () => {
      if (!autoRefresh) return false;
      if (
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible'
      ) {
        return false;
      }
      if (refreshInterval > 0) {
        return Math.max(refreshInterval, SERVER_DATA_INTERVAL_MS);
      }
      return getMsUntilNextServerDataSlot();
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  const anomalies: AnomalyData[] = data?.anomalies || [];
  const sortedAnomalies = anomalies
    .sort(
      (a: AnomalyData, b: AnomalyData) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, maxItems);

  // Time formatting
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) {
      // Less than 1 minute
      return '방금 전';
    } else if (diff < 3600000) {
      // Less than 1 hour
      return `${Math.floor(diff / 60000)}분 전`;
    } else if (diff < 86400000) {
      // Less than 24 hours
      return `${Math.floor(diff / 3600000)}시간 전`;
    } else {
      return date.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  // Dashboard style rendering
  return (
    <Card className={`h-full border-slate-700 bg-slate-800/50 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <AlertTriangle className="h-6 w-6 text-yellow-400" />
          실시간 이상 징후 피드
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-120 overflow-y-auto pr-2">
        {isLoading && sortedAnomalies.length === 0 && (
          <p className="text-slate-400">피드 로딩 중...</p>
        )}
        {error && (
          <p className="text-red-400">오류: {(error as Error).message}</p>
        )}
        {sortedAnomalies.length === 0 && !isLoading && (
          <div className="py-10 text-center text-slate-500">
            <CheckCircle2 className="mx-auto h-12 w-12" />
            <p className="mt-4">탐지된 이상 징후가 없습니다.</p>
          </div>
        )}
        <div className="space-y-4">
          {sortedAnomalies.map((anomaly, index) => (
            <div
              key={anomaly.id || index}
              className="flex items-start gap-4 rounded-lg bg-slate-700/50 p-3"
            >
              <AnomalyIcon anomaly={anomaly} />
              <div className="flex-1">
                <p className="font-medium text-slate-200">
                  {anomaly.description || anomaly.message}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <Badge
                    variant={
                      anomaly.severity === 'critical'
                        ? 'destructive'
                        : 'default'
                    }
                    className={
                      anomaly.severity === 'medium' ||
                      anomaly.severity === 'high'
                        ? 'border-yellow-500 bg-yellow-600/50'
                        : ''
                    }
                  >
                    {anomaly.severity}
                  </Badge>
                  <span>{formatTime(anomaly.timestamp)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Default and named export
export default AnomalyFeed;
