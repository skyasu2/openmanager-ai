import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Server as ServerIcon,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type React from 'react';
import { memo } from 'react';
import type {
  DashboardDataSourceInfo,
  DashboardTimeInfo,
} from '@/lib/dashboard/server-data';
import { cn } from '@/lib/utils';
import {
  DASHBOARD_STATUS_GRADIENTS,
  DASHBOARD_STATUS_RING_CLASSES,
} from '@/styles/design-constants';
import type {
  DashboardStats,
  DashboardTimeRange,
} from './types/dashboard.types';

interface DashboardSummaryProps {
  stats: DashboardStats;
  dataSlotInfo?: DashboardTimeInfo;
  dataSourceInfo?: DashboardDataSourceInfo | null;
  activeFilter?: string | null;
  onFilterChange?: (filter: string | null) => void;
  onOpenAlertHistory?: () => void;
  onOpenLogExplorer?: () => void;
  /** 현재 활성 알림 건수 */
  activeAlertsCount?: number;
  /** 서버 카드 스파크라인 히스토리 범위 */
  timeRange?: DashboardTimeRange;
  onTimeRangeChange?: (range: DashboardTimeRange) => void;
}

function formatSlotLabel(dataSlotInfo: DashboardTimeInfo): string {
  const hours = String(Math.floor(dataSlotInfo.minuteOfDay / 60)).padStart(
    2,
    '0'
  );
  const minutes = String(dataSlotInfo.minuteOfDay % 60).padStart(2, '0');
  return `${hours}:${minutes} KST (slot ${dataSlotInfo.globalSlotIndex}/143)`;
}

function formatDataSourceLabel(
  dataSourceInfo: DashboardDataSourceInfo
): string {
  const generatedAt = dataSourceInfo.catalogGeneratedAt
    ? `${dataSourceInfo.catalogGeneratedAt.slice(0, 16).replace('T', ' ')}Z`
    : 'unknown';
  return `Telemetry catalog v${dataSourceInfo.scopeVersion} · updated ${generatedAt}`;
}

// 상태 카드 컴포넌트 (4개 반복 패턴 추출)
function StatusCard({
  status,
  count,
  label,
  icon,
  activeFilter,
  onFilterChange,
  pulse,
  countColorClass,
  className,
}: {
  status: string;
  count: number;
  label: string;
  icon: React.ReactNode;
  activeFilter?: string | null;
  onFilterChange?: (filter: string | null) => void;
  pulse?: 'ping' | 'pulse' | false;
  countColorClass?: string;
  className?: string;
}) {
  const gradient =
    DASHBOARD_STATUS_GRADIENTS[
      status as keyof typeof DASHBOARD_STATUS_GRADIENTS
    ] ?? DASHBOARD_STATUS_GRADIENTS.online;

  const handleClick = () => {
    if (!onFilterChange) return;
    onFilterChange(activeFilter === status ? null : status);
  };
  const isInteractive = Boolean(onFilterChange);

  return (
    <button
      type="button"
      data-testid={`status-card-${status}`}
      onClick={handleClick}
      disabled={!isInteractive}
      aria-label={`${label} ${count}대 필터`}
      aria-pressed={isInteractive ? activeFilter === status : undefined}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-md p-4 text-left min-h-[84px]',
        'border transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ring-1 ring-white/60',
        gradient.border,
        gradient.glow,
        onFilterChange && 'cursor-pointer active:scale-[0.98]',
        !onFilterChange &&
          'disabled:cursor-default disabled:hover:scale-100 disabled:hover:shadow-none',
        activeFilter === status &&
          `ring-1 ${DASHBOARD_STATUS_RING_CLASSES[status] ?? 'ring-blue-500'} ring-offset-1`,
        className
      )}
    >
      <div
        className={`absolute inset-0 bg-linear-to-br ${gradient.gradient} opacity-0 group-hover:opacity-[0.08] transition-opacity duration-500`}
      />
      {pulse === 'pulse' && count > 0 && (
        <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
      )}
      {pulse === 'ping' && count > 0 && (
        <>
          <div className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
          <div className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-rose-500" />
        </>
      )}
      <div className="relative z-10 flex flex-col">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600/80">
          {icon} {label}
        </span>
        <span
          className={cn(
            'mt-2 text-3xl font-bold tracking-tight tabular-nums leading-none',
            countColorClass && count > 0 ? countColorClass : 'text-slate-700'
          )}
        >
          {count}
        </span>
      </div>
    </button>
  );
}

function StatusHeaderActionGroup({ children }: { children: React.ReactNode }) {
  return (
    <fieldset className="ml-0 inline-flex flex-wrap items-stretch overflow-hidden rounded-xl border border-white/80 bg-white/90 shadow-xs ring-1 ring-slate-200/70 backdrop-blur-sm divide-x divide-slate-200/60 sm:ml-1 sm:flex-nowrap">
      <legend className="sr-only">상태 헤더 도구</legend>
      {children}
    </fieldset>
  );
}

function StatusHeaderActionButton({
  onClick,
  ariaLabel,
  title,
  accentClassName,
  icon,
  label,
  badge,
}: {
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  accentClassName: string;
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        'relative flex h-12 min-w-12 items-center justify-center gap-1.5 bg-transparent px-2.5 text-xs font-medium text-gray-600 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300/70 sm:px-3 cursor-pointer',
        accentClassName
      )}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
      {badge}
    </button>
  );
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = memo(
  function DashboardSummary({
    stats,
    dataSlotInfo,
    dataSourceInfo,
    activeFilter,
    onFilterChange,
    onOpenAlertHistory,
    onOpenLogExplorer,
    activeAlertsCount = 0,
  }) {
    // Null-safe 처리
    const safeStats = {
      total: stats?.total ?? 0,
      online: stats?.online ?? 0,
      offline: stats?.offline ?? 0,
      warning: stats?.warning ?? 0,
      critical: stats?.critical ?? 0,
      unknown: stats?.unknown ?? 0,
    };

    // 시스템 상태에 따른 그라데이션 결정
    const systemHealthGradient =
      safeStats.critical > 0 || safeStats.offline > 0
        ? DASHBOARD_STATUS_GRADIENTS.critical
        : safeStats.warning > 0
          ? DASHBOARD_STATUS_GRADIENTS.warning
          : DASHBOARD_STATUS_GRADIENTS.online;

    // 위험/경고 상태일 때 펄스 활성화
    const showPulse =
      safeStats.critical > 0 || safeStats.warning > 0 || safeStats.offline > 0;

    return (
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* 1. Total Servers - 그라데이션 강화 */}
        <div
          data-testid="dashboard-total-card"
          className="order-3 lg:order-1 group relative flex flex-row items-center justify-between rounded-2xl border border-blue-100/70 bg-white/80 backdrop-blur-md p-5 shadow-sm ring-1 ring-blue-50 transition-all duration-300 hover:shadow-blue-100/60 hover:shadow-lg hover:scale-[1.02] lg:col-span-2 overflow-hidden"
        >
          {/* 그라데이션 배경 */}
          <div
            className={`absolute inset-0 bg-linear-to-br ${DASHBOARD_STATUS_GRADIENTS.total.gradient} opacity-0 group-hover:opacity-[0.08] transition-opacity duration-500`}
          />
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 text-gray-500 mb-1.5">
              <ServerIcon size={14} className="text-blue-500" />
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                전체
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-800 leading-none tracking-tight tabular-nums">
                {safeStats.total}
              </span>
              <span className="text-sm font-medium text-slate-400">대</span>
            </div>
            {dataSlotInfo && (
              <p className="mt-2 text-[11px] font-medium text-gray-500">
                OpenTelemetry snapshot · {formatSlotLabel(dataSlotInfo)}
              </p>
            )}
            {dataSourceInfo && (
              <p className="mt-1 text-[11px] font-medium text-gray-400">
                {formatDataSourceLabel(dataSourceInfo)}
              </p>
            )}
          </div>
          {/* 그라데이션 아이콘 박스 */}
          <div
            className={`relative h-10 w-10 rounded-full bg-linear-to-br ${DASHBOARD_STATUS_GRADIENTS.total.gradient} flex items-center justify-center text-white shadow-md`}
          >
            <Activity size={18} />
          </div>
        </div>

        {/* 2. Status Cards */}
        <div
          data-testid="dashboard-status-grid"
          className="order-2 lg:order-2 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:col-span-4"
        >
          <StatusCard
            status="online"
            count={safeStats.online}
            label="온라인"
            icon={<CheckCircle2 size={13} className="text-emerald-500" />}
            activeFilter={activeFilter}
            onFilterChange={onFilterChange}
            className="order-4 sm:order-none"
          />
          <StatusCard
            status="warning"
            count={safeStats.warning}
            label="경고"
            icon={<AlertTriangle size={13} className="text-amber-500" />}
            activeFilter={activeFilter}
            onFilterChange={onFilterChange}
            pulse="pulse"
            countColorClass="text-amber-600"
            className="order-2 sm:order-none"
          />
          <StatusCard
            status="critical"
            count={safeStats.critical}
            label="위험"
            icon={<AlertOctagon size={13} className="text-rose-500" />}
            activeFilter={activeFilter}
            onFilterChange={onFilterChange}
            pulse="ping"
            countColorClass="text-rose-600"
            className="order-1 sm:order-none"
          />
          <StatusCard
            status="offline"
            count={safeStats.offline}
            label="오프라인"
            icon={<XCircle size={13} className="text-slate-400" />}
            activeFilter={activeFilter}
            onFilterChange={onFilterChange}
            className="order-3 sm:order-none"
          />
        </div>

        {/* 3. 시스템 상태 - 동적 그라데이션 */}
        <div
          data-testid="dashboard-system-status-card"
          className={`order-1 lg:order-3 group relative rounded-2xl border ${systemHealthGradient.border} bg-white/60 backdrop-blur-md p-3 shadow-sm lg:col-span-6 flex flex-col justify-center transition-all duration-300 hover:shadow-lg hover:scale-[1.01] overflow-hidden`}
        >
          {/* 상태 기반 그라데이션 배경 */}
          <div
            className={`absolute inset-0 bg-linear-to-br ${systemHealthGradient.gradient} opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500`}
          />

          {/* 위험/경고 시 글로우 효과 */}
          {showPulse && (
            <div
              className={`absolute inset-0 bg-linear-to-r ${systemHealthGradient.gradient} opacity-[0.02] animate-pulse`}
            />
          )}

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-1 sm:px-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 sm:flex-nowrap">
              {/* 동적 아이콘 박스 */}
              <div
                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md bg-linear-to-br ${systemHealthGradient.gradient} text-white`}
              >
                <ShieldAlert size={20} />
                {/* 상태에 따른 펄스 링 */}
                {showPulse && (
                  <div
                    className={`absolute inset-0 rounded-2xl bg-linear-to-br ${systemHealthGradient.gradient} animate-ping opacity-30`}
                  />
                )}
              </div>
              <div className="whitespace-nowrap">
                <div className="text-2xs font-medium uppercase tracking-wider text-gray-400 leading-tight">
                  상태
                </div>
                <div
                  className={`text-sm font-medium leading-snug ${systemHealthGradient.text}`}
                >
                  {safeStats.critical > 0 || safeStats.offline > 0
                    ? '문제 발생'
                    : safeStats.warning > 0
                      ? '성능 경고'
                      : '정상 운영'}
                </div>
              </div>

              {/* 액션 버튼 그룹 */}
              <StatusHeaderActionGroup>
                {onOpenAlertHistory && (
                  <StatusHeaderActionButton
                    onClick={onOpenAlertHistory}
                    ariaLabel="알림 보기"
                    title="알림"
                    accentClassName="hover:bg-rose-50 hover:text-rose-600"
                    icon={<AlertTriangle size={14} />}
                    label="알림"
                    badge={
                      activeAlertsCount > 0 ? (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white leading-none">
                          {activeAlertsCount}
                        </span>
                      ) : undefined
                    }
                  />
                )}
                {onOpenLogExplorer && (
                  <StatusHeaderActionButton
                    onClick={onOpenLogExplorer}
                    ariaLabel="로그 검색 보기"
                    title="로그 검색"
                    accentClassName="hover:bg-blue-50 hover:text-blue-600"
                    icon={<FileSearch size={16} />}
                    label="로그"
                  />
                )}
              </StatusHeaderActionGroup>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
