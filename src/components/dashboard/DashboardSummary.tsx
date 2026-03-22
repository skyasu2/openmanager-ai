import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Bell,
  CheckCircle2,
  FileSearch,
  Network,
  Server as ServerIcon,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type React from 'react';
import { memo } from 'react';
import type { DashboardTimeInfo } from '@/lib/dashboard/server-data';
import { cn } from '@/lib/utils';
import type { DashboardStats } from './types/dashboard.types';

interface DashboardSummaryProps {
  stats: DashboardStats;
  dataSlotInfo?: DashboardTimeInfo;
  activeFilter?: string | null;
  onFilterChange?: (filter: string | null) => void;
  onOpenAlertHistory?: () => void;
  onOpenLogExplorer?: () => void;
  showTopology?: boolean;
  onToggleTopology?: () => void;
  /** 현재 활성 알림 건수 */
  activeAlertsCount?: number;
  /** Active Alerts 모달 열기 */
  onOpenActiveAlerts?: () => void;
}

function formatSlotLabel(dataSlotInfo: DashboardTimeInfo): string {
  const hours = String(Math.floor(dataSlotInfo.minuteOfDay / 60)).padStart(
    2,
    '0'
  );
  const minutes = String(dataSlotInfo.minuteOfDay % 60).padStart(2, '0');
  return `${hours}:${minutes} KST (slot ${dataSlotInfo.slotIndex}/143)`;
}

// 🎨 상태별 그라데이션 설정 (ImprovedServerCard와 통일)
const statusGradients = {
  online: {
    gradient: 'from-emerald-500 via-green-500 to-emerald-600',
    border: 'border-emerald-200/50',
    bg: 'bg-emerald-50/30',
    text: 'text-emerald-600',
    glow: 'hover:shadow-emerald-200/50',
  },
  warning: {
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    border: 'border-amber-200/50',
    bg: 'bg-amber-50/30',
    text: 'text-amber-600',
    glow: 'hover:shadow-amber-200/50',
  },
  critical: {
    gradient: 'from-red-500 via-rose-500 to-red-600',
    border: 'border-rose-200/50',
    bg: 'bg-rose-50/30',
    text: 'text-rose-600',
    glow: 'hover:shadow-rose-200/50',
  },
  offline: {
    gradient: 'from-gray-500 via-slate-500 to-gray-600',
    border: 'border-slate-200/60',
    bg: 'bg-slate-50/50',
    text: 'text-slate-600',
    glow: 'hover:shadow-slate-200/50',
  },
  total: {
    gradient: 'from-blue-500 via-indigo-500 to-blue-600',
    border: 'border-blue-200/50',
    bg: 'bg-blue-50/30',
    text: 'text-blue-600',
    glow: 'hover:shadow-blue-200/50',
  },
};

// 링 색상 매핑
const ringColors: Record<string, string> = {
  online: 'ring-emerald-500',
  warning: 'ring-amber-500',
  critical: 'ring-rose-500',
  offline: 'ring-slate-500',
};

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
    statusGradients[status as keyof typeof statusGradients] ??
    statusGradients.online;

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
        'group relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-md p-4 text-left min-h-[84px]',
        'transition-all duration-300 hover:shadow-lg hover:scale-[1.02]',
        gradient.border,
        gradient.glow,
        onFilterChange && 'cursor-pointer active:scale-[0.98]',
        !onFilterChange &&
          'disabled:cursor-default disabled:hover:scale-100 disabled:hover:shadow-none',
        activeFilter === status &&
          `ring-2 ${ringColors[status] ?? 'ring-blue-500'} ring-offset-1`,
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
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600/80">
          {icon} {label}
        </span>
        <span
          className={cn(
            'mt-2 text-2xl font-bold tracking-tight',
            countColorClass && count > 0 ? countColorClass : 'text-gray-800'
          )}
        >
          {count}
        </span>
      </div>
    </button>
  );
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = memo(
  function DashboardSummary({
    stats,
    dataSlotInfo,
    activeFilter,
    onFilterChange,
    onOpenAlertHistory,
    onOpenLogExplorer,
    showTopology = false,
    onToggleTopology,
    activeAlertsCount = 0,
    onOpenActiveAlerts,
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
      safeStats.critical > 0
        ? statusGradients.critical
        : safeStats.warning > 0
          ? statusGradients.warning
          : statusGradients.online;

    // 위험/경고 상태일 때 펄스 활성화
    const showPulse = safeStats.critical > 0 || safeStats.warning > 0;

    return (
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* 1. Total Servers - 그라데이션 강화 */}
        <div
          data-testid="dashboard-total-card"
          className="order-3 lg:order-1 group relative flex flex-row items-center justify-between rounded-2xl border border-white/60 bg-white/60 backdrop-blur-md p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.02] lg:col-span-2 overflow-hidden"
        >
          {/* 그라데이션 배경 */}
          <div
            className={`absolute inset-0 bg-linear-to-br ${statusGradients.total.gradient} opacity-0 group-hover:opacity-[0.08] transition-opacity duration-500`}
          />
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 text-gray-500 mb-1.5">
              <ServerIcon size={14} className="text-blue-500" />
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                전체
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-800 leading-none tracking-tight">
                {safeStats.total}
              </span>
            </div>
            {dataSlotInfo && (
              <p className="mt-2 text-[11px] font-medium text-gray-500">
                Synthetic OTel snapshot · {formatSlotLabel(dataSlotInfo)}
              </p>
            )}
          </div>
          {/* 그라데이션 아이콘 박스 */}
          <div
            className={`relative h-10 w-10 rounded-full bg-linear-to-br ${statusGradients.total.gradient} flex items-center justify-center text-white shadow-md`}
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
                <div className="text-2xs font-bold uppercase tracking-wider text-gray-400 leading-tight">
                  상태
                </div>
                <div
                  className={`text-sm font-bold leading-snug ${systemHealthGradient.text}`}
                >
                  {safeStats.critical > 0 || safeStats.offline > 0
                    ? '문제 발생'
                    : safeStats.warning > 0
                      ? '성능 경고'
                      : '정상 운영'}
                </div>
              </div>

              {/* 액션 버튼 그룹 */}
              <div className="ml-0 sm:ml-1 flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
                {/* Active Alerts 버튼 */}
                {onOpenActiveAlerts && (
                  <button
                    type="button"
                    onClick={onOpenActiveAlerts}
                    aria-label="활성 알림 보기"
                    className="relative flex h-12 min-w-12 items-center gap-1.5 rounded-lg border border-rose-100/80 bg-white/90 px-2.5 sm:px-3 text-xs font-semibold text-gray-600 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 hover:shadow-sm active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60 cursor-pointer"
                  >
                    <AlertTriangle size={14} />
                    <span className="hidden sm:inline">알림</span>
                    {activeAlertsCount > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white leading-none">
                        {activeAlertsCount}
                      </span>
                    )}
                  </button>
                )}
                {onOpenAlertHistory && (
                  <button
                    type="button"
                    onClick={onOpenAlertHistory}
                    aria-label="알림 이력 보기"
                    className="flex h-12 min-w-12 items-center gap-1.5 rounded-lg border border-amber-100/80 bg-white/90 px-2.5 sm:px-3 text-xs font-semibold text-gray-600 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600 hover:shadow-sm active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 cursor-pointer"
                    title="알림 이력"
                  >
                    <Bell size={16} />
                    <span className="hidden sm:inline">이력</span>
                  </button>
                )}
                {onOpenLogExplorer && (
                  <button
                    type="button"
                    onClick={onOpenLogExplorer}
                    aria-label="로그 검색 보기"
                    className="flex h-12 min-w-12 items-center gap-1.5 rounded-lg border border-blue-100/80 bg-white/90 px-2.5 sm:px-3 text-xs font-semibold text-gray-600 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 cursor-pointer"
                    title="로그 검색"
                  >
                    <FileSearch size={16} />
                    <span className="hidden sm:inline">로그</span>
                  </button>
                )}
              </div>
            </div>

            {/* 오른쪽: 위험/경고 카운트 */}
            <div className="flex flex-1 shrink-0 flex-wrap items-center justify-end gap-3 text-center pr-1 sm:gap-4 sm:pr-4">
              <div className="flex flex-col items-center">
                <div
                  className={`text-3xl font-bold leading-none tabular-nums ${safeStats.critical > 0 ? 'text-rose-500' : 'text-gray-400'}`}
                >
                  {safeStats.critical}
                </div>
                <div className="mt-1 text-xs font-semibold uppercase text-gray-500 tracking-wide">
                  위험
                </div>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              <div className="flex flex-col items-center">
                <div
                  className={`text-3xl font-bold leading-none tabular-nums ${safeStats.warning > 0 ? 'text-amber-500' : 'text-gray-400'}`}
                >
                  {safeStats.warning}
                </div>
                <div className="mt-1 text-xs font-semibold uppercase text-gray-500 tracking-wide">
                  경고
                </div>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              <div className="flex flex-col items-center">
                <div
                  className={`text-3xl font-bold leading-none tabular-nums ${safeStats.offline > 0 ? 'text-slate-600' : 'text-gray-400'}`}
                >
                  {safeStats.offline}
                </div>
                <div className="mt-1 text-xs font-semibold uppercase text-gray-500 tracking-wide">
                  오프라인
                </div>
              </div>
              {onToggleTopology && (
                <>
                  <div className="h-10 w-px bg-gray-200 mx-2" />
                  <button
                    type="button"
                    onClick={onToggleTopology}
                    aria-pressed={showTopology}
                    className={cn(
                      'inline-flex h-12 items-center gap-2 rounded-xl border bg-white/85 px-4 sm:px-6 text-sm font-bold shadow-xs transition-all duration-200',
                      'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 cursor-pointer',
                      showTopology
                        ? 'border-indigo-300 text-indigo-700 hover:bg-indigo-50 focus-visible:ring-indigo-300/60'
                        : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 focus-visible:ring-indigo-300/60'
                    )}
                    title="시스템 토폴로지"
                  >
                    <Network size={18} />
                    <span>토폴로지 맵</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
