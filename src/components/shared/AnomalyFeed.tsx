'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ServerCrash, Zap } from 'lucide-react';
import type { FC } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

interface AnomalyFeedProps {
  className?: string;
  maxItems?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  showDetails?: boolean;
}

// Fetcher function
const fetchAnomalies = async (): Promise<AnomalyResponse> => {
  const res = await fetch('/api/ai/anomaly-detection', {
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error(`이상 징후 데이터 조회 실패: ${res.status}`);
  }
  return res.json();
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
  refreshInterval = 20000, // 20 seconds
  showDetails: _showDetails = true,
}: AnomalyFeedProps) {
  // Data fetching using React Query
  const { data, error, isLoading } = useQuery({
    queryKey: ['anomalies'],
    queryFn: fetchAnomalies,
    refetchInterval: autoRefresh ? refreshInterval : false,
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
