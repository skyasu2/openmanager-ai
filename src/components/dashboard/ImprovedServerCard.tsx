import {
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Globe,
  MapPin,
} from 'lucide-react';
import React, {
  type FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSafeServer } from '@/hooks/useSafeServer';
import { useServerMetrics } from '@/hooks/useServerMetrics';
import { getServerStatusTheme } from '@/styles/design-constants';
import type { Server as ServerType } from '@/types/server';
import { formatUptime } from '@/utils/serverUtils';
import ServerCardErrorBoundary from '../error/ServerCardErrorBoundary';
import { withCurrentMetricPoint } from './dashboard-metric-points';
import {
  CompactMetricChip,
  DetailRow,
  MetricItem,
  SecondaryMetrics,
  ServiceChip,
} from './ImprovedServerCard.parts';

/**
 * 🎨 Premium Server Card v2.2
 * - 랜딩 페이지 스타일 그라데이션 애니메이션
 * - 상태별 색상: Critical(빨강), Warning(주황), Healthy(녹색)
 * - 호버 스케일 + 글로우 효과
 * - 서버 카드 독자 기능: 실시간 메트릭, Progressive Disclosure
 * - 카드 크기 50% 축소 (2025-12-13)
 * - HTML 접근성 수정: 중첩 인터랙티브 제거, header button이 카드 클릭 담당 (2026-02-24)
 */

export interface ImprovedServerCardProps {
  server: ServerType;
  onClick: (server: ServerType) => void;
  onOpenLogs?: (server: ServerType) => void;
  variant?: 'compact' | 'standard' | 'detailed';
  showRealTimeUpdates?: boolean;
  index?: number;
  enableProgressiveDisclosure?: boolean;
}

// TODO: dashboard-status-tokens — 향후 공유 디자인 토큰으로 통합 예정
// 상태별 그라데이션 (모듈 레벨 상수 — 매 렌더시 재생성 방지)
const statusGradients = {
  critical: {
    gradient: 'from-red-500 via-rose-500 to-red-600',
    shadow: 'shadow-red-500/30',
    glow: 'rgba(239, 68, 68, 0.4)',
  },
  warning: {
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    shadow: 'shadow-amber-500/30',
    glow: 'rgba(245, 158, 11, 0.4)',
  },
  online: {
    gradient: 'from-emerald-500 via-green-500 to-emerald-600',
    shadow: 'shadow-emerald-500/30',
    glow: 'rgba(16, 185, 129, 0.3)',
  },
  offline: {
    gradient: 'from-gray-500 via-slate-500 to-gray-600',
    shadow: 'shadow-gray-500/20',
    glow: 'rgba(107, 114, 128, 0.3)',
  },
  maintenance: {
    gradient: 'from-blue-500 via-indigo-500 to-blue-600',
    shadow: 'shadow-blue-500/30',
    glow: 'rgba(59, 130, 246, 0.3)',
  },
  unknown: {
    gradient: 'from-purple-500 via-violet-500 to-purple-600',
    shadow: 'shadow-purple-500/20',
    glow: 'rgba(139, 92, 246, 0.3)',
  },
};

// BUG-5 fix: Tailwind JIT는 동적 클래스를 감지 못함 → 정적 룩업 맵 사용
const hoverShadowClasses: Record<string, string> = {
  critical: 'hover:shadow-red-500/30',
  warning: 'hover:shadow-amber-500/30',
  online: 'hover:shadow-emerald-500/30',
  offline: 'hover:shadow-gray-500/20',
  maintenance: 'hover:shadow-blue-500/30',
  unknown: 'hover:shadow-purple-500/20',
};

const statusAccentBorderClasses: Record<string, string> = {
  critical: 'border-l-4 border-l-red-500',
  warning: 'border-l-4 border-l-orange-500',
  online: 'border-l-4 border-l-green-500',
  offline: 'border-l-4 border-l-slate-400',
  maintenance: 'border-l-4 border-l-blue-500',
  unknown: 'border-l-4 border-l-purple-500',
};

const statusLabels: Record<string, string> = {
  critical: '위험',
  warning: '주의',
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
    enableProgressiveDisclosure = true,
  }) => {
    // Basic data preparation
    const {
      safeServer,
      serverIcon,
      serverTypeLabel,
      osDisplayName,
      osIcon,
      osShortName,
    } = useSafeServer(server);
    // 🎨 White Mode with Glassmorphism + Status Colors
    const statusTheme = getServerStatusTheme(safeServer.status);

    const currentGradient =
      statusGradients[safeServer.status] || statusGradients.online;
    const isCompactVariant = variant === 'compact';

    const [showTertiaryInfo, setShowTertiaryInfo] = useState(false);

    // 📈 서버 메트릭 히스토리 로드 (OTel TimeSeries)
    const { metricsHistory, loadMetricsHistory } = useServerMetrics();

    useEffect(() => {
      // 컴포넌트 마운트 시 24시간 히스토리 로드
      loadMetricsHistory(safeServer.id, '24h');
    }, [safeServer.id, loadMetricsHistory]);

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
          container: 'min-h-[150px] p-2.5',
          maxServices: 2,
          showDetails: false,
          showServices: false,
        },
        detailed: {
          container: 'min-h-[185px] p-3',
          maxServices: 4,
          showDetails: true,
          showServices: true,
        },
        standard: {
          container: 'min-h-[175px] p-2.5',
          maxServices: 3,
          showDetails: true,
          showServices: true,
        },
      };
      return styles[variant] || styles.standard;
    }, [variant]);

    // Interactions - Progressive Disclosure Toggle
    const toggleExpansion = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setShowTertiaryInfo((prev) => !prev);
    }, []);

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
      hoverShadowClasses[safeServer.status] || hoverShadowClasses.online;
    const currentAccentBorder =
      statusAccentBorderClasses[safeServer.status] ||
      statusAccentBorderClasses.online;
    const actionRailClass = `flex items-center gap-1 ${isCompactVariant ? 'pt-1 sm:pt-2' : 'pt-4'}`;
    const actionButtonClass = `flex items-center justify-center bg-black/5 text-gray-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
        className={`group relative w-full overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 ease-out hover:shadow-xl backdrop-blur-md text-left bg-transparent ${statusTheme.background} ${statusTheme.border} ${currentAccentBorder} ${variantStyles.container} ${currentHoverShadow}`}
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
            boxShadow: `inset 0 0 30px ${currentGradient.glow}`,
          }}
        />

        {/* 🎨 상태별 장식 요소 (Critical/Warning 시 더 강조) */}
        {(safeServer.status === 'critical' ||
          safeServer.status === 'warning') && (
          <>
            <div
              className={`absolute right-2 top-2 h-3 w-3 rounded-full animate-pulse ${
                safeServer.status === 'critical'
                  ? 'bg-red-400/40'
                  : 'bg-amber-400/40'
              }`}
            />
            <div
              className={`absolute left-2 bottom-2 h-2 w-2 rounded-full animate-pulse delay-300 ${
                safeServer.status === 'critical'
                  ? 'bg-red-400/30'
                  : 'bg-amber-400/30'
              }`}
            />
          </>
        )}

        {/* Live Indicator - Enhanced Pulse */}
        {showRealTimeUpdates && (
          <div className="absolute right-3 top-3 z-10">
            <span
              className={`block h-2.5 w-2.5 rounded-full ring-1 ring-white/80 shadow-md ${shouldAnimateStatusSignal ? 'animate-pulse' : ''} ${statusTheme.text.replace('text-', 'bg-')}`}
              style={{ boxShadow: `0 0 6px ${currentGradient.glow}` }}
            />
          </div>
        )}
        {/* Header - OS/타입 정보 추가 */}
        <header className="mb-2 flex items-start justify-between relative z-10">
          {/* 접근성 수정: 중첩 버튼 문제 해결을 위해 메인 영역을 버튼으로 변경 */}
          <button
            type="button"
            onClick={handleCardClick}
            className="flex min-w-0 flex-1 items-center gap-2 text-left appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg -ml-1 pl-1"
          >
            {/* 🎨 아이콘 박스 - 그라데이션 스타일 (랜딩 카드 참조) */}
            <div
              className={`relative rounded-xl p-2 shadow-md backdrop-blur-sm transition-transform duration-200 bg-linear-to-br ${currentGradient.gradient} ${needsAttention ? 'group-hover:scale-105' : ''}`}
              style={{
                boxShadow: `0 4px 15px ${currentGradient.glow}`,
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
          </button>

          <div className={actionRailClass}>
            {onOpenLogs && (
              <button
                type="button"
                onClick={handleOpenLogs}
                aria-label={`${safeServer.name} 로그 보기`}
                className={`${actionButtonClass} hover:bg-blue-50 hover:text-blue-700`}
              >
                <FileText className="h-4 w-4" />
              </button>
            )}
            {enableProgressiveDisclosure && (
              <button
                type="button"
                data-toggle-button
                onClick={toggleExpansion}
                className={`${actionButtonClass} cursor-pointer hover:bg-black/10 hover:text-gray-700`}
                aria-expanded={showTertiaryInfo}
                aria-label={
                  showTertiaryInfo ? '상세 정보 접기' : '상세 정보 펼치기'
                }
              >
                {showTertiaryInfo ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </header>
        {/* Main Content Section */}
        <section className="relative z-10">
          {/* 🎨 상태 요약 - core monitoring surface */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className={`h-1.5 w-1.5 rounded-full bg-linear-to-r ${currentGradient.gradient}`}
              />
              <span className="text-2xs font-medium uppercase tracking-wider text-gray-400">
                Live Metrics
              </span>
            </div>
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

          {/* Tertiary Details (OS, Uptime) */}
          <div
            className={`space-y-2 overflow-hidden transition-all duration-500 ${showTertiaryInfo ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
          >
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100">
              <DetailRow
                icon={<Globe className="h-3 w-3" />}
                label="OS"
                value={osDisplayName}
              />
              <DetailRow
                icon={<Clock className="h-3 w-3" />}
                label="Uptime"
                value={formatUptime(safeServer.uptime)}
              />
            </div>
          </div>
        </section>

        {/* Services Section */}
        {variantStyles.showServices &&
          safeServer.services?.length > 0 &&
          (showTertiaryInfo || !enableProgressiveDisclosure) && (
            <div
              className={`mt-2 flex flex-wrap gap-1.5 transition-all duration-300 relative z-10 ${showTertiaryInfo || !enableProgressiveDisclosure ? 'opacity-100' : 'opacity-0'} ${isCompactVariant ? 'hidden sm:flex' : 'flex'}`}
            >
              {safeServer.services
                .slice(0, variantStyles.maxServices)
                .map((s, i) => (
                  <ServiceChip key={i} service={s} />
                ))}
              {safeServer.services.length > variantStyles.maxServices && (
                <span className="px-1.5 py-0.5 text-2xs text-gray-500">
                  +{safeServer.services.length - variantStyles.maxServices}
                </span>
              )}
            </div>
          )}
      </div>
    );
  }
);

ImprovedServerCardInner.displayName = 'ImprovedServerCardInner';

const ImprovedServerCard: FC<ImprovedServerCardProps> = (props) => (
  <ServerCardErrorBoundary>
    <ImprovedServerCardInner {...props} />
  </ServerCardErrorBoundary>
);

ImprovedServerCard.displayName = 'ImprovedServerCard';

export default ImprovedServerCard;
