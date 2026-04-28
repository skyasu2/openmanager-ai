'use client';

/**
 * 📊 Enhanced Server Modal Metrics Tab
 *
 * Real-time metrics monitoring tab:
 * - Real-time performance charts (CPU, Memory, Disk, Network)
 * - Interactive real-time controls
 * - Color-coded status visualization
 * - Responsive grid layout
 * - Time series chart with prediction & anomaly detection
 */
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Pause,
  Play,
  TrendingUp,
} from 'lucide-react';
import { type FC, useState } from 'react';

import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { SERVER_DATA_INTERVAL_MS } from '@/config/server-data-polling';
import { useTimeSeriesMetrics } from '@/hooks/useTimeSeriesMetrics';

import { RealtimeChart } from './EnhancedServerModal.components';
import {
  METRIC_TYPES,
  type MetricType,
  TIME_RANGE_OPTIONS,
  type TimeRangeType,
  type ViewMode,
} from './EnhancedServerModal.metrics.constants';
import {
  buildMetricsChartConfigs,
  getAnomalySeverityBadgeClass,
  getMetricSummary,
} from './EnhancedServerModal.metrics.helpers';
import type {
  ChartData,
  RealtimeData,
  ServerData,
} from './EnhancedServerModal.types';

/**
 * Metrics Tab Props
 */
interface MetricsTabProps {
  /** 서버 데이터 */
  server: ServerData;
  /** 실시간 데이터 */
  realtimeData: RealtimeData;
  /** 실시간 모니터링 활성화 여부 */
  isRealtime: boolean;
  /** 실시간 모니터링 토글 함수 */
  onToggleRealtime: () => void;
}

/**
 * 📈 Metrics Tab Component
 *
 * 서버의 실시간 메트릭을 시각화하는 탭
 * - CPU, Memory, Disk, Network 실시간 차트
 * - 실시간 모니터링 제어
 * - 상태별 색상 구분
 * - 시계열 차트 (예측 + 이상탐지)
 */
export const MetricsTab: FC<MetricsTabProps> = ({
  server,
  realtimeData,
  isRealtime,
  onToggleRealtime,
}) => {
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('simple');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('cpu');
  const [timeRange, setTimeRange] = useState<TimeRangeType>('6h');
  const [showPrediction, setShowPrediction] = useState(true);
  const [showAnomalies, setShowAnomalies] = useState(true);

  // Time series data hook
  const {
    data: timeSeriesData,
    isLoading: timeSeriesLoading,
    error: timeSeriesError,
    refetch: refetchTimeSeries,
  } = useTimeSeriesMetrics({
    serverId: server.id,
    metric: selectedMetric,
    range: timeRange,
    includePrediction: showPrediction,
    includeAnomalies: showAnomalies,
    refreshInterval: isRealtime ? SERVER_DATA_INTERVAL_MS : 0,
  });

  // 차트 데이터 구성
  const chartConfigs: ChartData[] = buildMetricsChartConfigs(
    server,
    realtimeData
  );

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        {/* 헤더 섹션 */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-800">
            실시간 메트릭 모니터링
          </h3>

          <div className="flex items-center gap-3">
            {/* 뷰 모드 토글 */}
            <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode('simple')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  viewMode === 'simple'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                기본
              </button>
              <button
                type="button"
                onClick={() => setViewMode('advanced')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  viewMode === 'advanced'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                분석
              </button>
            </div>

            {/* 실시간 제어 버튼 */}
            <button
              type="button"
              onClick={onToggleRealtime}
              className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 font-semibold transition-all hover:scale-105 active:scale-95 ${
                isRealtime
                  ? 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  : 'border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {isRealtime ? (
                <>
                  <Pause className="h-4 w-4" />
                  일시정지
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  시작하기
                </>
              )}
            </button>
          </div>
        </div>

        {/* 기본 뷰 - 실시간 차트 */}
        {viewMode === 'simple' && (
          <>
            {/* 메트릭 차트 그리드 */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {chartConfigs.map((chart, idx) => (
                <div
                  key={chart.label}
                  className="animate-fade-in relative overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl"
                  style={{ animationDelay: `${0.2 + idx * 0.1}s` }}
                >
                  {/* 배경 그라데이션 */}
                  <div
                    className={`absolute inset-0 bg-linear-to-br ${chart.gradient} opacity-5`}
                  />

                  <div className="relative">
                    {/* 차트 헤더 */}
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{chart.icon}</span>
                        <h4 className="font-bold text-gray-800">
                          {chart.label}
                        </h4>
                      </div>

                      {/* 현재 값 표시 */}
                      <div
                        className={`bg-linear-to-r text-2xl font-bold ${chart.gradient} bg-clip-text text-transparent`}
                      >
                        {chart.data[chart.data.length - 1]?.toFixed(1) || '0'}%
                      </div>
                    </div>

                    {/* 실시간 차트 */}
                    <RealtimeChart
                      data={chart.data}
                      color={chart.color}
                      label={chart.label}
                    />
                  </div>

                  {/* 상태 표시기 */}
                  <div className="absolute right-4 top-4">
                    <div className="flex items-center gap-1">
                      <div
                        className="h-2 w-2 animate-pulse rounded-full"
                        style={{ backgroundColor: chart.color }}
                      />
                      <span className="text-xs text-gray-500">실시간</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 메트릭 요약 정보 */}
            <div
              className="animate-fade-in mt-6 grid grid-cols-2 gap-4 md:grid-cols-4"
              style={{ animationDelay: '0.6s' }}
            >
              {chartConfigs.map((chart) => {
                const { currentValue, avgValue } = getMetricSummary(chart.data);

                return (
                  <div
                    key={`${chart.label}-summary`}
                    className="rounded-xl border border-gray-100 bg-white p-4 shadow-xs"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-lg">{chart.icon}</span>
                      <span className="text-xs font-medium text-gray-600">
                        {chart.label.split(' ')[0]}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">현재</span>
                        <span
                          className="text-sm font-bold"
                          style={{ color: chart.color }}
                        >
                          {currentValue.toFixed(1)}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">평균</span>
                        <span className="text-sm text-gray-700">
                          {avgValue.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 분석 뷰 - 시계열 차트 */}
        {viewMode === 'advanced' && (
          <div className="space-y-6">
            {/* 컨트롤 패널 */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
              {/* 메트릭 선택 */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">
                  메트릭:
                </span>
                <div className="flex gap-1">
                  {METRIC_TYPES.map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setSelectedMetric(m)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                        selectedMetric === m
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* 시간 범위 선택 */}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <select
                  value={timeRange}
                  onChange={(e) =>
                    setTimeRange(e.target.value as TimeRangeType)
                  }
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
                >
                  {TIME_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 토글 옵션 */}
              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showPrediction}
                    onChange={(e) => setShowPrediction(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-500"
                  />
                  <span className="text-sm text-gray-600">예측</span>
                </label>

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showAnomalies}
                    onChange={(e) => setShowAnomalies(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-500"
                  />
                  <span className="text-sm text-gray-600">이상탐지</span>
                </label>
              </div>

              {/* 새로고침 버튼 */}
              <button
                type="button"
                onClick={() => refetchTimeSeries()}
                disabled={timeSeriesLoading}
                className="ml-auto rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50"
              >
                {timeSeriesLoading ? '로딩...' : '새로고침'}
              </button>
            </div>

            {/* 시계열 차트 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  <h4 className="font-bold text-gray-800">
                    {selectedMetric.toUpperCase()} 트렌드 분석
                  </h4>
                  {timeSeriesData && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {timeSeriesData.serverName}
                    </span>
                  )}
                </div>

                {timeSeriesData?.anomalies &&
                  timeSeriesData.anomalies.length > 0 && (
                    <div className="flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700">
                      <AlertTriangle className="h-4 w-4" />
                      {timeSeriesData.anomalies.length}개 이상 감지
                    </div>
                  )}
              </div>

              {timeSeriesError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  <span>{timeSeriesError}</span>
                </div>
              )}

              {timeSeriesLoading && !timeSeriesData && (
                <div className="flex h-[300px] items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                </div>
              )}

              {!timeSeriesLoading && !timeSeriesData && !timeSeriesError && (
                <div className="flex h-[300px] flex-col items-center justify-center gap-3 rounded-lg bg-gray-50 text-gray-500">
                  <BarChart3 className="h-12 w-12 text-gray-300" />
                  <p className="text-sm">
                    이 서버의 시계열 데이터가 아직 수집되지 않았습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => refetchTimeSeries()}
                    className="rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-200"
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {timeSeriesData && (
                <TimeSeriesChart
                  data={timeSeriesData.history}
                  predictions={timeSeriesData.prediction}
                  anomalies={timeSeriesData.anomalies}
                  metric={selectedMetric}
                  timeRange={timeRange}
                  showPrediction={showPrediction}
                  showAnomalies={showAnomalies}
                  showThresholds
                  height={350}
                />
              )}
            </div>

            {/* 이상탐지 요약 */}
            {timeSeriesData?.anomalies &&
              timeSeriesData.anomalies.length > 0 && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <h5 className="mb-3 flex items-center gap-2 font-bold text-orange-800">
                    <AlertTriangle className="h-5 w-5" />
                    이상 탐지 결과
                  </h5>
                  <div className="space-y-2">
                    {timeSeriesData.anomalies.map((anomaly, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-white p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getAnomalySeverityBadgeClass(anomaly.severity)}`}
                          >
                            {anomaly.severity}
                          </span>
                          <span className="text-sm text-gray-700">
                            {anomaly.description}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(anomaly.startTime).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};
