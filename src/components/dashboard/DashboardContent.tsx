'use client';

import { Maximize2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { memo, Suspense, useEffect, useRef, useState } from 'react';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.data';
import { useDashboardStats } from '@/hooks/dashboard/useDashboardStats';
import { useMonitoringReport } from '@/hooks/dashboard/useMonitoringReport';
import type { Server } from '@/types/server';
import debug from '@/utils/debug';
import { safeErrorMessage } from '@/utils/utils-functions';
import { ActiveAlertsModal } from './ActiveAlertsModal';
import { AlertHistoryModal } from './alert-history/AlertHistoryModal';
import { DashboardSummary } from './DashboardSummary';
import { resolveDashboardEmptyState } from './dashboard-empty-state';
import { IncidentExplorerModal } from './incident-explorer/IncidentExplorerModal';
import { LogExplorerModal } from './log-explorer/LogExplorerModal';
import ServerDashboard from './ServerDashboard';
import { SystemOverviewSection } from './SystemOverviewSection';
import { TopologyModal } from './TopologyModal';
import type { DashboardStats } from './types/dashboard.types';

interface DashboardStatus {
  isRunning?: boolean;
  lastUpdate?: string;
  activeConnections?: number;
  type?: string;
}

/**
 * DashboardContent Props
 * 🔧 Phase 4 (2026-01-28): Props 기반 데이터 흐름
 * - DashboardClient → DashboardContent → ServerDashboard로 props 전달
 * - 중복 fetch 제거 (useServerDashboard 호출 최소화)
 */
interface DashboardContentProps {
  showSequentialGeneration: boolean;
  /** 페이지네이션된 서버 목록 */
  servers: Server[];
  /** 전체 서버 목록 (통계 계산용) */
  allServers?: Server[];
  /** 전체 서버 수 (페이지네이션 계산용) */
  totalServers: number;
  /** 현재 페이지 */
  currentPage: number;
  /** 총 페이지 수 */
  totalPages: number;
  /** 페이지당 항목 수 */
  pageSize: number;
  /** 페이지 변경 핸들러 */
  onPageChange: (page: number) => void;
  /** 페이지 크기 변경 핸들러 */
  onPageSizeChange: (size: number) => void;
  status: DashboardStatus;
  onStatsUpdate: (stats: DashboardStats) => void;
  onShowSequentialChange: (show: boolean) => void;
  isAgentOpen: boolean;
  /** 현재 활성 상태 필터 */
  statusFilter?: string | null;
  /** 상태 필터 변경 핸들러 */
  onStatusFilterChange?: (filter: string | null) => void;
}

// P1-9: Topology 데이터를 lazy-load — showTopology=true일 때만 로드
let _cachedTopologyDiagram: ArchitectureDiagram | null = null;

// 동적 임포트로 성능 최적화
const ReactFlowDiagramDynamic = dynamic(
  () => import('@/components/shared/react-flow-diagram'),
  { ssr: false }
);

export default memo(function DashboardContent({
  showSequentialGeneration,
  servers,
  allServers,
  totalServers,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  status,
  onStatsUpdate,
  onShowSequentialChange,
  isAgentOpen,
  statusFilter,
  onStatusFilterChange,
}: DashboardContentProps) {
  // 🛡️ P1-8 Fix: onStatsUpdate를 ref에 저장하여 useEffect 무한 루프 방지
  const onStatsUpdateRef = useRef(onStatsUpdate);
  onStatsUpdateRef.current = onStatsUpdate;

  // 🚀 디버깅 로그 (마운트 시 한 번만 출력)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentional initial mount log
  useEffect(() => {
    debug.log('🔍 DashboardContent 초기 렌더링:', {
      showSequentialGeneration,
      serversCount: servers?.length,
      isAgentOpen,
      status: status?.type,
      timestamp: new Date().toISOString(),
    });
  }, []);

  // MonitoringContext Health Score
  const {
    data: monitoringReport,
    error: monitoringError,
    isError: isMonitoringError,
  } = useMonitoringReport();
  const monitoringErrorMessage = isMonitoringError
    ? safeErrorMessage(
        monitoringError,
        '모니터링 리포트를 불러오지 못했습니다.'
      )
    : null;

  // 모달 상태
  const [alertHistoryOpen, setAlertHistoryOpen] = useState(false);
  const [logExplorerOpen, setLogExplorerOpen] = useState(false);
  const [incidentExplorerOpen, setIncidentExplorerOpen] = useState(false);
  const [activeAlertsOpen, setActiveAlertsOpen] = useState(false);
  const [topologyModalOpen, setTopologyModalOpen] = useState(false);

  // 🎯 서버 데이터에서 직접 통계 계산 (중복 API 호출 제거)
  const statsLoading = false;
  const [showTopology, setShowTopology] = useState(false);

  // P1-9: Topology 데이터 lazy-load (showTopology=true일 때만 로드)
  const [topologyDiagram, setTopologyDiagram] =
    useState<ArchitectureDiagram | null>(_cachedTopologyDiagram);
  useEffect(() => {
    if (!showTopology || _cachedTopologyDiagram) return;
    import('@/data/architecture-diagrams.data').then(
      ({ ARCHITECTURE_DIAGRAMS }) => {
        const diagram = ARCHITECTURE_DIAGRAMS[
          'infrastructure-topology'
        ] as ArchitectureDiagram;
        _cachedTopologyDiagram = diagram;
        setTopologyDiagram(diagram);
      }
    );
  }, [showTopology]);

  // 🛡️ currentTime 제거: 미사용 상태에서 불필요한 interval 실행 (v5.83.13)

  // 🚀 리팩토링: Custom Hook으로 통계 계산 로직 분리
  const serverStats = useDashboardStats(servers, allServers, statsLoading);
  const overallServerCount =
    allServers?.length ?? Math.max(totalServers, servers.length);
  const emptyStateMode = resolveDashboardEmptyState({
    visibleServersCount: servers.length,
    totalServersCount: overallServerCount,
    hasActiveFilter: Boolean(statusFilter),
  });
  const activeFilterLabel =
    statusFilter === 'online'
      ? '온라인'
      : statusFilter === 'warning'
        ? '경고'
        : statusFilter === 'critical'
          ? '위험'
          : statusFilter === 'offline'
            ? '오프라인'
            : statusFilter;

  // F04 fix: isClient 상태 제거 — 'use client' 컴포넌트에서 불필요한 이중 렌더링
  // F05 fix: renderError 상태 제거 — Error Boundary로 위임

  useEffect(() => {
    debug.log('✅ DashboardContent 마운트됨');
    // 🎯 상위 컴포넌트에 통계 업데이트 전달 (ref 사용으로 무한 루프 방지)
    if (onStatsUpdateRef.current && serverStats.total > 0) {
      onStatsUpdateRef.current(serverStats);
    }
  }, [serverStats]);

  // 시퀀셜 생성 모드
  if (showSequentialGeneration) {
    debug.log('🔄 시퀀셜 생성 모드 렌더링');
    return (
      <div className="min-h-screen bg-linear-to-br from-purple-50 to-blue-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">
              🔄 서버 생성 중...
            </h2>
            <p className="text-gray-600">
              시퀀셜 서버 생성 모드가 활성화되었습니다.
            </p>
            <button
              type="button"
              onClick={() => onShowSequentialChange(false)}
              className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              일반 모드로 전환
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 일반 대시보드 모드 - 반응형 그리드 레이아웃
  return (
    <div className="animate-fade-in h-full w-full">
      <div className="mx-auto h-full max-w-none space-y-4 overflow-y-auto overscroll-contain scroll-smooth px-4 pb-6 sm:px-6 lg:px-8 2xl:max-w-[1800px]">
        {monitoringErrorMessage && (
          <div className="rounded-lg border border-amber-200/60 bg-amber-50/80 px-4 py-3 text-xs text-amber-800">
            모니터링 리포트 조회 실패: {monitoringErrorMessage}
          </div>
        )}

        <DashboardSummary
          stats={serverStats}
          activeFilter={statusFilter}
          onFilterChange={onStatusFilterChange}
          onOpenAlertHistory={() => setAlertHistoryOpen(true)}
          onOpenLogExplorer={() => setLogExplorerOpen(true)}
          onOpenIncidentExplorer={() => setIncidentExplorerOpen(true)}
          showTopology={showTopology}
          onToggleTopology={() => setShowTopology((prev) => !prev)}
          activeAlertsCount={monitoringReport?.firingAlerts?.length ?? 0}
          onOpenActiveAlerts={() => setActiveAlertsOpen(true)}
        />

        {/* Infrastructure Topology (Summary 버튼으로 토글) */}
        {showTopology && topologyDiagram && servers.length > 0 && (
          <div className="group relative rounded-xl border border-gray-200/80 bg-white/70 px-2 pb-4 pt-2 shadow-xs backdrop-blur-md">
            <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => setTopologyModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900/80 px-2.5 py-1.5 text-[10px] font-bold text-white backdrop-blur-sm transition-all hover:bg-slate-800 cursor-pointer shadow-lg"
              >
                <Maximize2 size={12} />
                FULL VIEW
              </button>
            </div>
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                </div>
              }
            >
              <ReactFlowDiagramDynamic
                diagram={topologyDiagram}
                compact
                showControls
                servers={servers}
              />
            </Suspense>
          </div>
        )}

        {/* 🎯 메인 컨텐츠 영역 */}
        {servers.length > 0 ? (
          <>
            {/* ======== System Overview: 리소스 평균 + 주요 경고 통합 ======== */}
            <SystemOverviewSection servers={servers} />

            {/* 서버 카드 목록 */}
            <Suspense
              fallback={
                <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-6 shadow-lg">
                  <div className="animate-pulse">
                    <div className="mb-4 h-4 rounded bg-white/10"></div>
                    <div className="mb-4 h-4 rounded bg-white/10"></div>
                    <div className="h-4 w-5/6 rounded bg-white/10"></div>
                  </div>
                </div>
              }
            >
              {/* 🔧 Phase 4 (2026-01-28): Props 기반 데이터 흐름
                    - DashboardClient → DashboardContent → ServerDashboard로 전달
                    - 중복 fetch 제거 (useServerDashboard 호출 1회로 최적화) */}
              <ServerDashboard
                servers={servers}
                totalServers={totalServers}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                onStatsUpdate={onStatsUpdate}
              />
            </Suspense>
          </>
        ) : (
          // biome-ignore lint/a11y/useSemanticElements: <output> is form-associated per HTML spec; role="status" on <div> is the correct WCAG 4.1.3 pattern for non-form status regions
          <div
            role="status"
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
          >
            <div className="text-center text-gray-500">
              {emptyStateMode === 'filtered-empty' ? (
                <>
                  <p className="mb-2 text-lg">
                    필터 조건에 맞는 서버가 없습니다
                  </p>
                  <p className="text-sm">
                    선택한 필터를 해제하거나 다른 상태 필터를 선택해 주세요.
                  </p>
                  {activeFilterLabel && (
                    <p className="mt-2 text-xs text-gray-400">
                      현재 필터: {activeFilterLabel}
                    </p>
                  )}
                  {onStatusFilterChange && (
                    <button
                      type="button"
                      onClick={() => onStatusFilterChange(null)}
                      className="mt-4 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                      aria-label="상태 필터 초기화"
                    >
                      필터 초기화
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="mb-2 text-lg">등록된 서버가 없습니다</p>
                  <p className="text-sm">
                    서버를 추가하여 모니터링을 시작하세요
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Active Alerts Modal */}
        {activeAlertsOpen && (
          <ActiveAlertsModal
            open={activeAlertsOpen}
            onClose={() => setActiveAlertsOpen(false)}
            alerts={monitoringReport?.firingAlerts ?? []}
          />
        )}

        {/* Topology Modal */}
        {topologyModalOpen && (
          <TopologyModal
            open={topologyModalOpen}
            onClose={() => setTopologyModalOpen(false)}
            servers={allServers?.length ? allServers : servers}
          />
        )}

        {/* Alert History Modal */}
        {alertHistoryOpen && (
          <AlertHistoryModal
            open={alertHistoryOpen}
            onClose={() => setAlertHistoryOpen(false)}
            serverIds={(allServers?.length ? allServers : servers).map(
              (s) => s.id
            )}
          />
        )}

        {/* Log Explorer Modal */}
        {logExplorerOpen && (
          <LogExplorerModal
            open={logExplorerOpen}
            onClose={() => setLogExplorerOpen(false)}
            servers={allServers?.length ? allServers : servers}
          />
        )}

        {/* Incident Explorer Modal */}
        {incidentExplorerOpen && (
          <IncidentExplorerModal
            open={incidentExplorerOpen}
            onClose={() => setIncidentExplorerOpen(false)}
            initialSeverity={
              statusFilter === 'warning' ||
              statusFilter === 'critical' ||
              statusFilter === 'offline'
                ? statusFilter
                : 'all'
            }
          />
        )}
      </div>
    </div>
  );
});
