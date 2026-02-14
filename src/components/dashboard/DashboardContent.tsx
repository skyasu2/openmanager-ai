'use client';

import { AlertTriangle } from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ARCHITECTURE_DIAGRAMS,
  type ArchitectureDiagram,
} from '@/data/architecture-diagrams.data';
import { useDashboardStats } from '@/hooks/dashboard/useDashboardStats';
import { useMonitoringReport } from '@/hooks/dashboard/useMonitoringReport';
import type { MonitoringAlert } from '@/schemas/api.monitoring-report.schema';
import type { Server } from '@/types/server';
import debug from '@/utils/debug';
import { safeConsoleError, safeErrorMessage } from '@/utils/utils-functions';
import { AlertHistoryModal } from './alert-history/AlertHistoryModal';
import { DashboardSummary } from './DashboardSummary';
import { LogExplorerModal } from './log-explorer/LogExplorerModal';
import { SystemOverviewSection } from './SystemOverviewSection';
import type { DashboardStats } from './types/dashboard.types';

const severityBadge: Record<MonitoringAlert['severity'], string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
};

function ActiveAlertsSection({ alerts }: { alerts: MonitoringAlert[] }) {
  const [expanded, setExpanded] = useState(true);
  const sorted = [...alerts].sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return b.value - a.value;
  });

  return (
    <div className="rounded-xl border border-rose-200/40 bg-white/60 backdrop-blur-md overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-rose-50/30"
      >
        <span className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-rose-500" />
          Active Alerts ({alerts.length})
        </span>
        <span
          aria-hidden="true"
          className={`transition-transform duration-200 text-gray-400 ${expanded ? 'rotate-180' : ''}`}
        >
          &#9660;
        </span>
      </button>
      {expanded && (
        <div className="border-t border-rose-100/50 px-5 py-3 space-y-2">
          {sorted.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${severityBadge[alert.severity]}`}
                >
                  {alert.severity}
                </span>
                <span className="font-medium text-gray-800">
                  {alert.instance}
                </span>
                <span className="text-gray-500">
                  {alert.metric} = {alert.value}%
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {alert.duration > 0
                  ? `${Math.round(alert.duration / 60)}분 경과`
                  : 'just now'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

// Infrastructure Topology 다이어그램 데이터 (컴포넌트 외부 상수)
const TOPOLOGY_DIAGRAM = ARCHITECTURE_DIAGRAMS[
  'infrastructure-topology'
] as ArchitectureDiagram;

// 동적 임포트로 성능 최적화
const ReactFlowDiagramDynamic = dynamic(
  () => import('@/components/shared/react-flow-diagram'),
  { ssr: false }
);

const ServerDashboardDynamic = dynamic(() => import('./ServerDashboard'), {
  loading: () => (
    <div className="flex items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
    </div>
  ),
});

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
  // 🛡️ 렌더링 로그 스팸 방지 (useRef로 HMR/테스트 시 안전)
  const hasLoggedRenderRef = useRef(false);
  const hasLoggedModeRef = useRef(false);

  // 🚀 디버깅 로그 (한 번만 출력 - 리렌더링 스팸 방지)
  if (!hasLoggedRenderRef.current) {
    hasLoggedRenderRef.current = true;
    debug.log('🔍 DashboardContent 초기 렌더링:', {
      showSequentialGeneration,
      serversCount: servers?.length,
      isAgentOpen,
      status: status?.type,
      timestamp: new Date().toISOString(),
    });
  }

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

  // Alert History / Log Explorer 모달 상태
  const [alertHistoryOpen, setAlertHistoryOpen] = useState(false);
  const [logExplorerOpen, setLogExplorerOpen] = useState(false);

  // 🎯 서버 데이터에서 직접 통계 계산 (중복 API 호출 제거)
  const [statsLoading, _setStatsLoading] = useState(false);
  const [showTopology, setShowTopology] = useState(false);

  // 🛡️ currentTime 제거: 미사용 상태에서 불필요한 interval 실행 (v5.83.13)

  // 폴백 통계 계산 (v5.83.13: critical 상태 분리)
  // allServers(전체 서버)가 있으면 전체 기반으로 계산, 없으면 페이지네이션된 servers 사용
  const statsSource =
    allServers && allServers.length > 0 ? allServers : servers;

  // 🚀 리팩토링: Custom Hook으로 통계 계산 로직 분리
  const serverStats = useDashboardStats(servers, allServers, statsLoading);

  // 🚀 에러 상태 추가
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  // 🚨 _currentTime 제거됨: 사용하지 않으면서 1초마다 리렌더링 유발 (서버 카드 그래프 깜빡임 원인)
  const [_screenSize, setScreenSize] = useState<string>('알 수 없음');

  // 🛡️ 클라이언트 사이드 확인 및 실시간 업데이트
  useEffect(() => {
    setIsClient(true);

    // 서버 사이드에서는 실행하지 않음
    if (typeof window === 'undefined') {
      return;
    }

    // 화면 크기 감지 함수
    const updateScreenSize = () => {
      if (typeof window === 'undefined') return;

      const width = window.innerWidth;
      if (width >= 1536) {
        setScreenSize('2K 최적화');
      } else if (width >= 1280) {
        setScreenSize('XL 최적화');
      } else if (width >= 1024) {
        setScreenSize('LG 최적화');
      } else if (width >= 768) {
        setScreenSize('태블릿 최적화');
      } else {
        setScreenSize('모바일 최적화');
      }
    };

    // 초기 화면 크기 설정
    updateScreenSize();

    // 🚨 1초 interval 제거됨 - 사용하지 않는 상태 업데이트로 인한 불필요한 리렌더링 방지
    // 실시간 시계는 RealTimeDisplay 컴포넌트에서 독립적으로 관리됨

    // 화면 크기 변경 감지
    const resizeHandler = () => {
      updateScreenSize();
    };

    // 안전하게 이벤트 리스너 추가
    if (window?.addEventListener) {
      window.addEventListener('resize', resizeHandler);
    }

    return () => {
      if (window?.removeEventListener) {
        window.removeEventListener('resize', resizeHandler);
      }
    };
  }, []);

  useEffect(() => {
    try {
      debug.log('✅ DashboardContent 마운트됨');
      setRenderError(null);
      // 🎯 상위 컴포넌트에 통계 업데이트 전달
      if (onStatsUpdate && serverStats.total > 0) {
        onStatsUpdate(serverStats);
      }
    } catch (error) {
      safeConsoleError('❌ DashboardContent 마운트 에러', error);
      setRenderError(safeErrorMessage(error, '알 수 없는 마운트 에러'));
    }
  }, [serverStats, onStatsUpdate]); // onStatsUpdate 함수 의존성 복구

  // 🛡️ 서버 사이드 렌더링 방지
  if (!isClient) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  // 🚀 렌더링 에러 처리
  if (renderError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-red-50 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
          <div className="text-center">
            <div className="mb-4 text-4xl text-red-500">⚠️</div>
            <h2 className="mb-2 text-xl font-semibold text-gray-900">
              렌더링 오류
            </h2>
            <p className="mb-4 text-gray-600">{renderError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              새로고침
            </button>
          </div>
        </div>
      </div>
    );
  }

  try {
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

    // 일반 대시보드 모드 - 반응형 그리드 레이아웃 (로그 한 번만)
    if (!hasLoggedModeRef.current) {
      hasLoggedModeRef.current = true;
      debug.log('📊 일반 대시보드 모드 렌더링');
    }
    return (
      <div className="animate-fade-in h-full w-full">
        <div className="mx-auto h-full max-w-none space-y-4 overflow-y-auto overscroll-contain scroll-smooth px-4 pb-6 sm:px-6 lg:px-8 2xl:max-w-[1800px]">
          {/* 🎯 메인 컨텐츠 영역 */}
          {servers && servers.length > 0 ? (
            <>
              {/* 인프라 전체 현황 (Simple Grid) */}
              {monitoringErrorMessage && (
                <div className="rounded-lg border border-amber-200/60 bg-amber-50/80 px-4 py-3 text-xs text-amber-800">
                  모니터링 리포트 조회 실패: {monitoringErrorMessage}
                </div>
              )}
              <DashboardSummary
                stats={serverStats}
                activeFilter={statusFilter}
                onFilterChange={onStatusFilterChange}
                healthScore={monitoringReport?.health?.score}
                healthGrade={monitoringReport?.health?.grade}
                onOpenAlertHistory={() => setAlertHistoryOpen(true)}
                onOpenLogExplorer={() => setLogExplorerOpen(true)}
              />

              {/* Active Alerts (접이식, 0건일 때 숨김) */}
              {monitoringReport?.firingAlerts &&
                monitoringReport.firingAlerts.length > 0 && (
                  <ActiveAlertsSection alerts={monitoringReport.firingAlerts} />
                )}

              {/* Infrastructure Topology (Collapsible) */}
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setShowTopology((prev) => !prev)}
                  aria-expanded={showTopology}
                  className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-gray-300 transition-colors hover:text-white"
                >
                  <span>Infrastructure Topology (15 Servers)</span>
                  <span
                    aria-hidden="true"
                    className={`transition-transform duration-200 ${showTopology ? 'rotate-180' : ''}`}
                  >
                    &#9660;
                  </span>
                </button>
                {showTopology && (
                  <div className="border-t border-white/10 px-2 pb-4">
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center py-12">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                        </div>
                      }
                    >
                      <ReactFlowDiagramDynamic
                        diagram={TOPOLOGY_DIAGRAM}
                        compact
                        showControls
                      />
                    </Suspense>
                  </div>
                )}
              </div>

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
                <ServerDashboardDynamic
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

              {/* Alert History Modal */}
              {alertHistoryOpen && (
                <AlertHistoryModal
                  open={alertHistoryOpen}
                  onClose={() => setAlertHistoryOpen(false)}
                  serverIds={(statsSource ?? []).map((s) => s.id)}
                />
              )}

              {/* Log Explorer Modal */}
              {logExplorerOpen && (
                <LogExplorerModal
                  open={logExplorerOpen}
                  onClose={() => setLogExplorerOpen(false)}
                  servers={statsSource ?? []}
                />
              )}
            </>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
              <div className="text-center text-gray-500">
                <p className="mb-2 text-lg">등록된 서버가 없습니다</p>
                <p className="text-sm">서버를 추가하여 모니터링을 시작하세요</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  } catch (renderError) {
    debug.error('📱 DashboardContent 렌더링 오류:', renderError);
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
        <div className="text-center text-gray-500">
          <p>대시보드를 불러올 수 없습니다.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 rounded bg-blue-500 px-3 py-1 text-sm text-white"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }
});
