import { FileText, MapPin } from 'lucide-react';
import React, { type FC, memo, useCallback, useEffect, useMemo } from 'react';
import { useSafeServer } from '@/hooks/useSafeServer';
import { useServerMetrics } from '@/hooks/useServerMetrics';
import {
  DASHBOARD_STATUS_GRADIENTS,
  getServerStatusTheme,
  SERVER_CARD_HOVER_SHADOW_CLASSES,
  SERVER_CARD_STATUS_ACCENT_BORDER_CLASSES,
} from '@/styles/design-constants';
import type { Server as ServerType } from '@/types/server';
import ServerCardErrorBoundary from '../error/ServerCardErrorBoundary';
import { withCurrentMetricPoint } from './dashboard-metric-points';
import {
  CompactMetricChip,
  MetricItem,
  SecondaryMetrics,
} from './ImprovedServerCard.parts';
import type { DashboardTimeRange } from './types/dashboard.types';

/**
 * 🎨 Premium Server Card v2.2
 * - 랜딩 페이지 스타일 그라데이션 애니메이션
 * - 상태별 색상: Critical(빨강), Warning(주황), Healthy(녹색)
 * - 호버 스케일 + 글로우 효과
 * - 서버 카드 독자 기능: 실시간 메트릭, 카드 전체 상세 진입
 * - 카드 크기 50% 축소 (2025-12-13)
 * - Dashboard UX: 상세 버튼/펼치기 제거, 카드 전체 클릭으로 상세 이동 (2026-05-16)
 */

export interface ImprovedServerCardProps {
  server: ServerType;
  onClick: (server: ServerType) => void;
  onOpenLogs?: (server: ServerType) => void;
  variant?: 'compact' | 'standard' | 'detailed';
  showRealTimeUpdates?: boolean;
  index?: number;
  enableProgressiveDisclosure?: boolean;
  metricsTimeRange?: DashboardTimeRange;
}

const statusLabels: Record<string, string> = {
  critical: '위험',
  warning: '경고',
  online: '정상',
  offline: '오프라인',
  maintenance: '점검',
  unknown: '미확인',
};

const ImprovedServerCardInner: FC<ImprovedServerCardProps> = memo(
  ({
    server,
    onClick,
    onOpenLogs,
    variant = 'standard',
    showRealTimeUpdates = true,
    metricsTimeRange = '24h',
  }) => {
    // Basic data preparation
    const { safeServer, serverIcon, serverTypeLabel, osIcon, osShortName } =
      useSafeServer(server);
    // 🎨 White Mode with Glassmorphism + Status Colors
    const statusTheme = getServerStatusTheme(safeServer.status);

    const currentGradient =
      DASHBOARD_STATUS_GRADIENTS[
        safeServer.status as keyof typeof DASHBOARD_STATUS_GRADIENTS
      ] || DASHBOARD_STATUS_GRADIENTS.online;
    const isCompactVariant = variant === 'compact';

    // 📈 서버 메트릭 히스토리 로드 (OTel TimeSeries)
    const { metricsHistory, loadMetricsHistory } = useServerMetrics();

    useEffect(() => {
      loadMetricsHistory(safeServer.id, metricsTimeRange);
    }, [metricsTimeRange, safeServer.id, loadMetricsHistory]);

    // 실시간 메트릭 (Props 기반 SSOT)
    const realtimeMetrics = useMemo(
      () => ({
        cpu: safeServer.cpu ?? 0,
        memory: safeServer.memory ?? 0,
        disk: safeServer.disk ?? 0,
        network: safeServer.network ?? 0,
      }),
      [safeServer]
    );

    // 📊 메트릭별 히스토리 배열 (SvgSparkline용)
    const { cpuHistory, memoryHistory, diskHistory } = useMemo(
      () => ({
        cpuHistory: withCurrentMetricPoint(
          metricsHistory.map((h) => h.cpu),
          safeServer.cpu
        ),
        memoryHistory: withCurrentMetricPoint(
          metricsHistory.map((h) => h.memory),
          safeServer.memory
        ),
        diskHistory: withCurrentMetricPoint(
          metricsHistory.map((h) => h.disk),
          safeServer.disk
        ),
      }),
      [metricsHistory, safeServer.cpu, safeServer.disk, safeServer.memory]
    );

    // UI Variants - 높이 증가 (그래프 영역 확대)
    const variantStyles = useMemo(() => {
      const styles = {
        compact: {
          container: 'min-h-[192px] p-3 pb-4',
        },
        detailed: {
          container: 'min-h-[244px] p-4 pb-5',
        },
        standard: {
          container: 'min-h-[226px] p-3 pb-4',
        },
      };
      return styles[variant] || styles.standard;
    }, [variant]);

    // 카드 클릭 핸들러
    const handleCardClick = useCallback(
      (e?: React.MouseEvent | React.KeyboardEvent) => {
        e?.stopPropagation();
        onClick(safeServer);
      },
      [onClick, safeServer]
    );

    const needsAttention =
      safeServer.status === 'warning' || safeServer.status === 'critical';
    const shouldAnimateStatusSignal = showRealTimeUpdates && needsAttention;

    const handleOpenLogs = useCallback(
      (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        onOpenLogs?.(safeServer);
      },
      [onOpenLogs, safeServer]
    );

    const currentHoverShadow =
      SERVER_CARD_HOVER_SHADOW_CLASSES[safeServer.status] ||
      SERVER_CARD_HOVER_SHADOW_CLASSES.online;
    const currentAccentBorder =
      SERVER_CARD_STATUS_ACCENT_BORDER_CLASSES[safeServer.status] ||
      SERVER_CARD_STATUS_ACCENT_BORDER_CLASSES.online;
    const actionRailClass = `flex items-center gap-1 ${isCompactVariant ? 'pt-1 sm:pt-2' : 'pt-4'}`;
    const actionButtonClass = `flex items-center justify-center bg-slate-100 text-gray-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      isCompactVariant ? 'h-9 w-9 rounded-lg' : 'h-11 w-11 rounded-full'
    }`;

    const metricStatusBadge = (
      <span
        data-testid="metric-status-badge"
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusTheme.badge}`}
        title={`서버 상태: ${statusLabels[safeServer.status] ?? statusLabels.unknown}`}
      >
        {statusLabels[safeServer.status] ?? statusLabels.unknown}
      </span>
    );

    return (
      <div
        id={`server-card-${safeServer.id}`}
        className={`group relative w-full cursor-pointer overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 ease-out hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 backdrop-blur-md text-left bg-transparent ${statusTheme.background} ${statusTheme.border} ${currentAccentBorder} ${variantStyles.container} ${currentHoverShadow}`}
      >
        {/* 🎨 그라데이션 애니메이션 배경 (랜딩 카드 스타일) */}
        <div
          className={`absolute inset-0 rounded-2xl bg-linear-to-br ${currentGradient.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-[0.08]`}
          style={{
            backgroundSize: '200% 200%',
            animation: 'gradient-shift 4s ease-in-out infinite',
          }}
        />

        {/* 🎨 호버 글로우 효과 */}
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-40 pointer-events-none rounded-2xl"
          style={{
            boxShadow: `inset 0 0 30px ${currentGradient.inlineGlow}`,
          }}
        />

        {/* Live Indicator - 주의 필요 서버에서만 펄스(단일 상태 신호) */}
        {showRealTimeUpdates && (
          <div className="absolute right-3 top-3 z-10">
            <span
              className={`block h-2.5 w-2.5 rounded-full ring-1 ring-white/80 shadow-md ${shouldAnimateStatusSignal ? 'animate-pulse' : ''} ${statusTheme.text.replace('text-', 'bg-')}`}
              style={{ boxShadow: `0 0 6px ${currentGradient.inlineGlow}` }}
            />
          </div>
        )}

        <button
          type="button"
          aria-label={`${safeServer.name} 상세 보기`}
          onClick={handleCardClick}
          className="absolute inset-0 z-20 rounded-2xl border-0 bg-transparent p-0 text-left appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <span className="sr-only">{safeServer.name} 상세 보기</span>
        </button>

        {/* Header - OS/타입 정보 추가 */}
        <header className="pointer-events-none relative z-30 mb-2 flex items-start justify-between">
          <div className="-ml-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg pl-1 text-left">
            {/* 🎨 아이콘 박스 - 그라데이션 스타일 (랜딩 카드 참조) */}
            <div
              className={`relative rounded-xl p-2 shadow-md backdrop-blur-sm transition-transform duration-200 bg-linear-to-br ${currentGradient.gradient} ${needsAttention ? 'group-hover:scale-105' : ''}`}
              style={{
                boxShadow: `0 4px 15px ${currentGradient.inlineGlow}`,
              }}
            >
              <div className="text-white">{serverIcon}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-1.5">
                <h2
                  className="truncate text-sm font-medium text-gray-900"
                  title={safeServer.name}
                >
                  {safeServer.name}
                </h2>
              </div>
              {/* 서버 타입 + OS 정보 표시 (WCAG AA Color Contrast) */}
              <div className="flex items-center gap-2 text-xs">
                <span
                  className="inline-flex items-center gap-1 rounded bg-blue-600 px-1.5 py-0.5 text-xs-plus font-medium text-white"
                  title={`서버 타입: ${serverTypeLabel}`}
                >
                  {serverTypeLabel}
                </span>
                <span
                  className={`${isCompactVariant ? 'hidden sm:inline-flex' : 'inline-flex'} items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-700`}
                  title={`운영체제: ${osShortName}`}
                >
                  <span aria-hidden="true">{osIcon}</span>
                  <span className="text-xs-plus font-medium">
                    {osShortName}
                  </span>
                </span>
              </div>
              {/* 위치 정보 */}
              <div
                className={`mt-1 ${isCompactVariant ? 'hidden sm:flex' : 'flex'} items-center gap-1 text-xs text-gray-500`}
              >
                <MapPin className="h-3 w-3" />
                <span className="max-w-[140px] truncate sm:max-w-none">
                  {safeServer.location}
                </span>
              </div>
            </div>
          </div>

          {onOpenLogs && (
            <div className={`pointer-events-auto ${actionRailClass}`}>
              <button
                type="button"
                onClick={handleOpenLogs}
                aria-label={`${safeServer.name} 로그 보기`}
                className={`${actionButtonClass} hover:bg-blue-50 hover:text-blue-700`}
              >
                <FileText className="h-4 w-4" />
              </button>
            </div>
          )}
        </header>
        {/* Main Content Section */}
        <section className="relative z-10">
          {/* 상태 배지 - 카드 핵심 상태 신호 (장식 eyebrow 제거) */}
          <div className="mb-3 flex items-center justify-end">
            {isCompactVariant ? (
              <div className="hidden sm:block">{metricStatusBadge}</div>
            ) : (
              metricStatusBadge
            )}
          </div>

          {/* 모바일 compact: 핵심 수치 우선 노출 */}
          {isCompactVariant && (
            <div className="mb-2 grid grid-cols-3 gap-1.5 sm:hidden">
              <CompactMetricChip label="CPU" value={realtimeMetrics.cpu} />
              <CompactMetricChip label="MEM" value={realtimeMetrics.memory} />
              <CompactMetricChip label="DISK" value={realtimeMetrics.disk} />
            </div>
          )}

          {/* 🎨 Core Metrics - 개선된 그리드 (CPU/Memory/Disk) */}
          <div
            className={`grid grid-cols-3 gap-2 px-0.5 ${isCompactVariant ? 'hidden sm:grid' : ''}`}
          >
            <MetricItem
              type="cpu"
              value={realtimeMetrics.cpu}
              history={cpuHistory}
            />
            <MetricItem
              type="memory"
              value={realtimeMetrics.memory}
              history={memoryHistory}
            />
            <MetricItem
              type="disk"
              value={realtimeMetrics.disk}
              history={diskHistory}
            />
          </div>

          {/* 🆕 보조 메트릭 (Load, Response Time) */}
          {isCompactVariant ? (
            <div className="hidden sm:block">
              <SecondaryMetrics
                server={safeServer}
                compact={isCompactVariant}
              />
            </div>
          ) : (
            <SecondaryMetrics server={safeServer} compact={isCompactVariant} />
          )}
        </section>
      </div>
    );
  }
);

ImprovedServerCardInner.displayName = 'ImprovedServerCardInner';

const ImprovedServerCard: FC<ImprovedServerCardProps> = (props) => (
  <ServerCardErrorBoundary serverId={props.server?.id}>
    <ImprovedServerCardInner {...props} />
  </ServerCardErrorBoundary>
);

ImprovedServerCard.displayName = 'ImprovedServerCard';

export default ImprovedServerCard;
