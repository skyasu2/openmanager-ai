/**
 * SLA 대시보드 위젯
 *
 * 서비스 수준 협약(SLA) 메트릭 표시
 * - 가용률
 * - MTTR (Mean Time To Resolution)
 * - MTTA (Mean Time To Acknowledge)
 * - 다운타임 예산
 */

'use client';

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';

interface SLAMetrics {
  period: 'daily' | 'weekly' | 'monthly';
  targetUptime: number;
  actualUptime: number;
  totalMinutes: number;
  downtimeMinutes: number;
  remainingBudget: number;
  mttr: number; // minutes
  mtta: number; // minutes
  incidentCount: number;
  slaViolation: boolean;
}

interface SLAWidgetProps {
  period?: 'daily' | 'weekly' | 'monthly';
  compact?: boolean;
}

const PERIOD_LABELS: Record<string, string> = {
  daily: '일간',
  weekly: '주간',
  monthly: '월간',
};

const PERIOD_MINUTES = {
  daily: 1440,
  weekly: 10080,
  monthly: 43800,
} as const;

function getPeriodMinutes(period: 'daily' | 'weekly' | 'monthly'): number {
  return PERIOD_MINUTES[period];
}

export const SLAWidget = memo(function SLAWidget({
  period = 'monthly',
  compact = false,
}: SLAWidgetProps) {
  const [metrics, setMetrics] = useState<SLAMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateSLAMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 보고서 목록에서 SLA 메트릭 계산
      const dateRange =
        period === 'daily' ? '7d' : period === 'weekly' ? '30d' : '90d';
      const response = await fetch(
        `/api/ai/incident-report?dateRange=${dateRange}&limit=50`
      );

      if (!response.ok) {
        throw new Error(`SLA 데이터 조회 실패 (HTTP ${response.status})`);
      }

      const data = await response.json();
      const reports = data.reports || [];

      // MTTR 계산 (해결된 보고서만)
      const resolvedReports = reports.filter(
        (r: { status: string; resolved_at: string; created_at: string }) =>
          r.status === 'resolved' && r.resolved_at
      );

      let avgMttr = 0;
      if (resolvedReports.length > 0) {
        const totalMttr = resolvedReports.reduce(
          (sum: number, r: { resolved_at: string; created_at: string }) => {
            const created = new Date(r.created_at).getTime();
            const resolved = new Date(r.resolved_at).getTime();
            return sum + (resolved - created) / 60000; // minutes
          },
          0
        );
        avgMttr = totalMttr / resolvedReports.length;
      }

      // 다운타임 추정 (critical/high 보고서 기준)
      const criticalReports = reports.filter(
        (r: { severity: string }) =>
          r.severity === 'critical' || r.severity === 'high'
      );

      // 간단한 다운타임 추정: critical은 15분, high는 5분
      const estimatedDowntime = criticalReports.reduce(
        (sum: number, r: { severity: string }) =>
          sum + (r.severity === 'critical' ? 15 : 5),
        0
      );

      const totalMinutes = getPeriodMinutes(period);
      const targetUptime = 99.9;
      const maxDowntime = totalMinutes * (1 - targetUptime / 100);
      const actualUptime = Math.max(
        0,
        ((totalMinutes - estimatedDowntime) / totalMinutes) * 100
      );

      setMetrics({
        period,
        targetUptime,
        actualUptime: Math.min(100, actualUptime),
        totalMinutes,
        downtimeMinutes: estimatedDowntime,
        remainingBudget: Math.max(0, maxDowntime - estimatedDowntime),
        mttr: avgMttr,
        mtta: avgMttr * 0.3, // MTTA는 MTTR의 약 30%로 추정
        incidentCount: reports.length,
        slaViolation: actualUptime < targetUptime,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    calculateSLAMetrics();
  }, [calculateSLAMetrics]);

  const formatMinutes = (minutes: number): string => {
    if (minutes < 1) return '< 1분';
    if (minutes < 60) return `${Math.round(minutes)}분`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  };

  const getUptimeColor = (uptime: number, target: number): string => {
    if (uptime >= target) return 'text-green-600';
    if (uptime >= target - 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 text-red-500">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm">
            {error || 'SLA 데이터를 불러올 수 없습니다'}
          </span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            <span className="font-medium text-gray-700">SLA</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div
                className={`text-xl font-bold ${getUptimeColor(metrics.actualUptime, metrics.targetUptime)}`}
              >
                {metrics.actualUptime.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500">
                목표 {metrics.targetUptime}%
              </div>
            </div>
            {metrics.slaViolation ? (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          <span className="font-bold text-gray-800">SLA 현황</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            {PERIOD_LABELS[metrics.period]}
          </span>
        </div>
        <button
          type="button"
          onClick={calculateSLAMetrics}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Main Metric */}
      <div className="mb-4 rounded-lg bg-linear-to-r from-blue-50 to-indigo-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600">현재 가용률</div>
            <div
              className={`text-3xl font-bold ${getUptimeColor(metrics.actualUptime, metrics.targetUptime)}`}
            >
              {metrics.actualUptime.toFixed(3)}%
            </div>
            <div className="mt-1 text-xs text-gray-500">
              목표: {metrics.targetUptime}%
            </div>
          </div>
          <div className="text-right">
            {metrics.slaViolation ? (
              <div className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                <AlertTriangle className="h-4 w-4" />
                SLA 위반
              </div>
            ) : (
              <div className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                <CheckCircle className="h-4 w-4" />
                정상
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all ${
                metrics.slaViolation ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, metrics.actualUptime)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* MTTR */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            MTTR
          </div>
          <div className="mt-1 text-lg font-bold text-gray-800">
            {formatMinutes(metrics.mttr)}
          </div>
          <div className="text-xs text-gray-400">평균 복구 시간</div>
        </div>

        {/* MTTA */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Activity className="h-3.5 w-3.5" />
            MTTA
          </div>
          <div className="mt-1 text-lg font-bold text-gray-800">
            {formatMinutes(metrics.mtta)}
          </div>
          <div className="text-xs text-gray-400">평균 인지 시간</div>
        </div>

        {/* Downtime */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <TrendingUp className="h-3.5 w-3.5" />
            다운타임
          </div>
          <div className="mt-1 text-lg font-bold text-gray-800">
            {formatMinutes(metrics.downtimeMinutes)}
          </div>
          <div className="text-xs text-gray-400">누적 중단 시간</div>
        </div>

        {/* Budget */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Target className="h-3.5 w-3.5" />
            남은 예산
          </div>
          <div
            className={`mt-1 text-lg font-bold ${metrics.remainingBudget > 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {formatMinutes(metrics.remainingBudget)}
          </div>
          <div className="text-xs text-gray-400">허용 가능 다운타임</div>
        </div>
      </div>

      {/* Incident Count */}
      <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
        <span className="text-gray-600">총 장애 건수</span>
        <span className="font-bold text-gray-800">
          {metrics.incidentCount}건
        </span>
      </div>
    </div>
  );
});

export default SLAWidget;
