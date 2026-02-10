import {
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  MapPin,
  Zap,
} from 'lucide-react';
import React, {
  type FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFixed24hMetrics } from '@/hooks/useFixed24hMetrics';
import { useSafeServer } from '@/hooks/useSafeServer';
import { getServerStatusTheme } from '@/styles/design-constants';
import type {
  ServerStatus,
  Server as ServerType,
  Service,
} from '@/types/server';
import { formatUptime } from '@/utils/serverUtils';
import ServerCardErrorBoundary from '../error/ServerCardErrorBoundary';
import { AIInsightBadge } from '../shared/AIInsightBadge';
import { MiniLineChart } from '../shared/MiniLineChart';

/**
 * 🎨 Premium Server Card v2.2
 * - 랜딩 페이지 스타일 그라데이션 애니메이션
 * - 상태별 색상: Critical(빨강), Warning(주황), Healthy(녹색)
 * - 호버 스케일 + 글로우 효과
 * - 서버 카드 독자 기능: 실시간 메트릭, AI Insight, Progressive Disclosure
 * - 카드 크기 50% 축소 (2025-12-13)
 * - HTML 접근성 완전 수정: 카드=div[role=button], 토글=button (2026-01-17)
 */

export interface ImprovedServerCardProps {
  server: ServerType;
  onClick: (server: ServerType) => void;
  variant?: 'compact' | 'standard' | 'detailed';
  showRealTimeUpdates?: boolean;
  index?: number;
  enableProgressiveDisclosure?: boolean;
}

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

const ImprovedServerCardInner: FC<ImprovedServerCardProps> = memo(
  ({
    server,
    onClick,
    variant = 'standard',
    showRealTimeUpdates = true,
    enableProgressiveDisclosure = true,
  }) => {
    // Basic data preparation
    const { safeServer, serverIcon, serverTypeLabel, osIcon, osShortName } =
      useSafeServer(server);
    // 🎨 White Mode with Glassmorphism + Status Colors
    const statusTheme = getServerStatusTheme(safeServer.status);

    const currentGradient =
      statusGradients[safeServer.status] || statusGradients.online;

    const [showSecondaryInfo, setShowSecondaryInfo] = useState(false);
    const [showTertiaryInfo, setShowTertiaryInfo] = useState(false);

    // Mount tracking
    const isMountedRef = useRef(true);
    useEffect(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
      };
    }, []);

    // Metric data
    const { currentMetrics, historyData } = useFixed24hMetrics(safeServer.id);

    const realtimeMetrics = useMemo(
      () => ({
        cpu: currentMetrics?.cpu ?? safeServer.cpu ?? 0,
        memory: currentMetrics?.memory ?? safeServer.memory ?? 0,
        disk: currentMetrics?.disk ?? safeServer.disk ?? 0,
        network: currentMetrics?.network ?? safeServer.network ?? 0,
      }),
      [currentMetrics, safeServer]
    );

    // 📊 메트릭별 히스토리 배열 캐싱 (단일 useMemo로 통합)
    const { cpuHistory, memoryHistory, diskHistory } = useMemo(
      () => ({
        cpuHistory: historyData?.map((h) => h.cpu),
        memoryHistory: historyData?.map((h) => h.memory),
        diskHistory: historyData?.map((h) => h.disk),
      }),
      [historyData]
    );

    // UI Variants - 높이 증가 (그래프 영역 확대)
    const variantStyles = useMemo(() => {
      const styles = {
        compact: {
          container: 'min-h-[155px] p-2',
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
      setShowTertiaryInfo((prev) => {
        if (!prev) setShowSecondaryInfo(true);
        return !prev;
      });
    }, []);

    // 카드 클릭 핸들러 (키보드 지원)
    const handleCardClick = useCallback(() => {
      onClick(safeServer);
    }, [onClick, safeServer]);

    const handleCardKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        // 내부 토글 버튼에서 이벤트가 발생한 경우 무시 (버블링 방지)
        if ((e.target as HTMLElement).closest('[data-toggle-button]')) {
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(safeServer);
        }
      },
      [onClick, safeServer]
    );

    // 🔧 인라인 화살표 함수를 useCallback으로 최적화
    const handleMouseEnter = useCallback(() => {
      if (enableProgressiveDisclosure) setShowSecondaryInfo(true);
    }, [enableProgressiveDisclosure]);

    const handleMouseLeave = useCallback(() => {
      if (enableProgressiveDisclosure && !showTertiaryInfo)
        setShowSecondaryInfo(false);
    }, [enableProgressiveDisclosure, showTertiaryInfo]);

    return (
      // biome-ignore lint/a11y/useSemanticElements: 카드 내부에 별도 토글 버튼이 있어 button 요소로 변경 시 HTML 명세 위반 (button 내 interactive 요소 금지)
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`group relative w-full cursor-pointer overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 ease-out hover:shadow-xl backdrop-blur-md text-left bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${statusTheme.background} ${statusTheme.border} ${variantStyles.container} hover:${currentGradient.shadow}`}
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
              className={`block h-2.5 w-2.5 rounded-full animate-pulse ring-2 ring-white/80 shadow-lg ${statusTheme.text.replace('text-', 'bg-')}`}
              style={{ boxShadow: `0 0 8px ${currentGradient.glow}` }}
            />
          </div>
        )}
        {/* Header - OS/타입 정보 추가 */}
        <header className="mb-2 flex items-start justify-between relative z-10">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {/* 🎨 아이콘 박스 - 그라데이션 스타일 (랜딩 카드 참조) */}
            <div
              className={`relative rounded-xl p-2 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:scale-110 bg-linear-to-br ${currentGradient.gradient}`}
              style={{
                boxShadow: `0 4px 15px ${currentGradient.glow}`,
              }}
            >
              <div className="text-white">{serverIcon}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-1.5">
                <h2 className="truncate text-sm font-semibold text-gray-900">
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
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-700"
                  title={`운영체제: ${osShortName}`}
                >
                  <span aria-hidden="true">{osIcon}</span>
                  <span className="text-xs-plus font-medium">
                    {osShortName}
                  </span>
                </span>
              </div>
              {/* 위치 정보 */}
              <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="h-3 w-3" />
                <span>{safeServer.location}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 pt-4">
            {enableProgressiveDisclosure && (
              <button
                type="button"
                data-toggle-button
                onClick={toggleExpansion}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                aria-expanded={showTertiaryInfo}
                aria-label={
                  showTertiaryInfo ? '상세 정보 접기' : '상세 정보 펼치기'
                }
              >
                {showTertiaryInfo ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            )}
          </div>
        </header>
        {/* Main Content Section */}
        <section className="relative z-10">
          {/* 🎨 AI Insight - 강화된 표시 */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className={`h-1.5 w-1.5 rounded-full bg-linear-to-r ${currentGradient.gradient}`}
              />
              <span className="text-2xs font-semibold uppercase tracking-wider text-gray-400">
                Live Metrics
              </span>
            </div>
            <AIInsightBadge {...realtimeMetrics} historyData={historyData} />
          </div>

          {/* 🎨 Core Metrics - 개선된 그리드 (CPU/Memory/Disk) */}
          <div className="grid grid-cols-3 gap-2 px-0.5">
            <MetricItem
              type="cpu"
              value={realtimeMetrics.cpu}
              status={safeServer.status}
              history={cpuHistory}
              color={statusTheme.graphColor}
            />
            <MetricItem
              type="memory"
              value={realtimeMetrics.memory}
              status={safeServer.status}
              history={memoryHistory}
              color={statusTheme.graphColor}
            />
            <MetricItem
              type="disk"
              value={realtimeMetrics.disk}
              status={safeServer.status}
              history={diskHistory}
              color={statusTheme.graphColor}
            />
          </div>

          {/* 🆕 보조 메트릭 (Load, Response Time) */}
          <SecondaryMetrics server={safeServer} />

          {/* Tertiary Details (OS, Uptime, IP) */}
          <div
            className={`space-y-2 overflow-hidden transition-all duration-500 ${showTertiaryInfo ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
          >
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-200">
              <DetailRow
                icon={<Globe className="h-3 w-3" />}
                label="OS"
                value={safeServer.os}
              />
              <DetailRow
                icon={<Clock className="h-3 w-3" />}
                label="Uptime"
                value={formatUptime(safeServer.uptime)}
              />
              <DetailRow
                icon={<Zap className="h-3 w-3" />}
                label="IP"
                value={safeServer.ip}
              />
            </div>
          </div>
        </section>

        {/* Services Section */}
        {variantStyles.showServices &&
          safeServer.services?.length > 0 &&
          (showSecondaryInfo || !enableProgressiveDisclosure) && (
            <div
              className={`mt-2 flex flex-wrap gap-1.5 transition-all duration-300 relative z-10 ${showSecondaryInfo || !enableProgressiveDisclosure ? 'opacity-100' : 'opacity-0'}`}
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

// Helper Components - 축소된 스타일
interface MetricItemProps {
  type: 'cpu' | 'memory' | 'disk' | 'network';
  value: number;
  status: ServerStatus;
  history?: number[];
  color: string;
}

const MetricItem = ({
  type,
  value,
  status: _status,
  history,
  color: _themeColor,
}: MetricItemProps) => {
  // 가독성 향상: 축약어 → 전체 이름
  const labels = {
    cpu: 'CPU',
    memory: 'Memory',
    disk: 'Disk',
    network: 'Network',
  };

  // 🎨 Per-Metric Severity Coloring (User Request)
  // Red (>90), Orange (>80), Green (else)
  const getSeverityColor = (val: number) => {
    if (val >= 90) return '#ef4444'; // Red-500
    if (val >= 80) return '#f97316'; // Orange-500
    return '#10b981'; // Emerald-500
  };

  const metricColor = getSeverityColor(value);

  return (
    <div className="flex flex-col">
      {/* Header: Label + Value */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs-plus font-medium text-gray-500 tracking-wide">
          {labels[type]}
        </span>
        <span
          className="text-sm font-bold tracking-tight"
          style={{ color: metricColor }}
        >
          {Math.round(value)}%
        </span>
      </div>
      {/* Primary: Line Chart - 높이 증가 */}
      <div className="w-full h-12 flex items-center justify-center">
        <MiniLineChart
          data={history && history.length > 1 ? history : [value, value]}
          width={72}
          height={40}
          color={metricColor}
          fill
          strokeWidth={1.5}
        />
      </div>
    </div>
  );
};

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

const DetailRow = ({ icon, label, value }: DetailRowProps) => (
  <div className="flex items-center gap-1.5 rounded-md bg-black/5 px-2 py-1.5 border border-gray-200/50">
    <div className="text-gray-500">{icon}</div>
    <div className="min-w-0">
      <div className="text-2xs uppercase text-gray-500 font-semibold tracking-wide">
        {label}
      </div>
      <div className="font-medium text-gray-700 truncate text-xs">{value}</div>
    </div>
  </div>
);

/**
 * 🆕 보조 메트릭 표시 (Load Average, Response Time)
 * - Load > 70% 코어 사용 시 경고 색상
 * - Response Time >= 2초 시 경고 색상
 */
const SecondaryMetrics = ({ server }: { server: ServerType }) => {
  // 표시할 메트릭이 없으면 렌더링 안함
  const hasLoad = server.load1 !== undefined && server.cpuCores !== undefined;
  const hasResponse =
    server.responseTime !== undefined && server.responseTime > 0;

  if (!hasLoad && !hasResponse) {
    return null;
  }

  // Load Average 상태 색상 (코어 대비 70% 이상 = 경고)
  const loadPercent =
    hasLoad && server.cpuCores ? (server.load1! / server.cpuCores) * 100 : 0;
  const loadColor = loadPercent >= 70 ? 'text-amber-600' : 'text-gray-500';

  // Response Time 상태 색상 (2000ms 이상 = 경고, 5000ms 이상 = 위험)
  const respMs = server.responseTime ?? 0;
  const respColor =
    respMs >= 5000
      ? 'text-red-500'
      : respMs >= 2000
        ? 'text-amber-600'
        : 'text-gray-500';

  return (
    <div className="mt-2 flex items-center gap-3 text-xs border-t border-gray-200/50 pt-2">
      {hasLoad && (
        <span
          className={loadColor}
          title={`Load Average (1분): ${server.load1?.toFixed(2)} / ${server.cpuCores} cores`}
        >
          Load: {server.load1?.toFixed(1)}/{server.cpuCores}
        </span>
      )}
      {hasResponse && (
        <span className={respColor} title={`응답 시간: ${respMs}ms`}>
          Resp:{' '}
          {respMs >= 1000 ? `${(respMs / 1000).toFixed(1)}s` : `${respMs}ms`}
        </span>
      )}
    </div>
  );
};

const ServiceChip = ({ service }: { service: Service }) => {
  const statusColors =
    service.status === 'running'
      ? 'border-emerald-400/50 bg-emerald-100/80 text-emerald-700'
      : service.status === 'stopped'
        ? 'border-red-400/50 bg-red-100/80 text-red-700'
        : 'border-amber-400/50 bg-amber-100/80 text-amber-700';

  const dotColor =
    service.status === 'running'
      ? 'bg-emerald-500'
      : service.status === 'stopped'
        ? 'bg-red-500'
        : 'bg-amber-500';

  return (
    <div
      className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs-plus font-medium backdrop-blur-sm ${statusColors}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      <span>{service.name}</span>
    </div>
  );
};

ImprovedServerCardInner.displayName = 'ImprovedServerCardInner';

// memo()를 ErrorBoundary 바깥에 적용하여 props 변경 없으면 재렌더 방지
const ImprovedServerCard: FC<ImprovedServerCardProps> = memo((props) => (
  <ServerCardErrorBoundary>
    <ImprovedServerCardInner {...props} />
  </ServerCardErrorBoundary>
));

ImprovedServerCard.displayName = 'ImprovedServerCard';

export default ImprovedServerCard;
