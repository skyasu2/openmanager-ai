'use client';

import { ArrowUpDown, LayoutGrid, List, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ImprovedServerCard from '@/components/dashboard/ImprovedServerCard';
import ServerDashboardPaginationControls from '@/components/dashboard/ServerDashboardPaginationControls';
import ServerCardErrorBoundary from '@/components/error/ServerCardErrorBoundary';
import { logger } from '@/lib/logging';
import type { DashboardTab } from '@/types/dashboard/server-dashboard.types';
import type { Server } from '@/types/server';
import { usePerformanceTracking } from '@/utils/performance';

const EnhancedServerModal = dynamic(
  () => import('@/components/dashboard/EnhancedServerModal'),
  { ssr: false, loading: () => null }
);

// 🚀 성능 최적화: statusPriority를 컴포넌트 외부로 이동 (매번 새로 생성 방지)
const STATUS_PRIORITY = {
  critical: 0,
  offline: 0,
  warning: 1,
  online: 2,
} as const;

type ServerViewMode = 'list' | 'grid';
type ServerSortKey = 'status' | 'cpu' | 'memory' | 'name';

const SORT_OPTIONS: Array<{ value: ServerSortKey; label: string }> = [
  { value: 'status', label: '상태' },
  { value: 'cpu', label: 'CPU' },
  { value: 'memory', label: 'MEM' },
  { value: 'name', label: '이름' },
];

// 🚀 성능 최적화: 알림 수 계산 로직 분리 및 메모이제이션
const getAlertsCountOptimized = (alerts: unknown): number => {
  if (typeof alerts === 'number') return alerts;
  if (Array.isArray(alerts)) return alerts.length;
  return 0;
};

const compareByStatusPriority = (a: Server, b: Server): number => {
  const statusA = a?.status || 'unknown';
  const statusB = b?.status || 'unknown';

  const priorityA =
    STATUS_PRIORITY[statusA as keyof typeof STATUS_PRIORITY] ?? 3;
  const priorityB =
    STATUS_PRIORITY[statusB as keyof typeof STATUS_PRIORITY] ?? 3;

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  const alertsA = getAlertsCountOptimized(a?.alerts);
  const alertsB = getAlertsCountOptimized(b?.alerts);

  if (alertsA !== alertsB) {
    return alertsB - alertsA;
  }

  return a.name.localeCompare(b.name, 'ko-KR', {
    numeric: true,
    sensitivity: 'base',
  });
};

/**
 * ServerDashboard Props (Phase 4: Props 기반 데이터 흐름)
 * - 중복 fetch 제거: DashboardClient → DashboardContent → ServerDashboard로 props 전달
 * - useServerDashboard() 호출 제거
 */
interface ServerDashboardProps {
  /** 페이지네이션된 서버 목록 (DashboardClient에서 전달) */
  servers: Server[];
  /** 전체 서버 목록 (query param focus 대응) */
  allServers?: Server[];
  /** URL query 기반 초기 포커스 서버 ID */
  initialFocusServerId?: string | null;
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
  /** 통계 업데이트 콜백 */
  onStatsUpdate?: (stats: {
    total: number;
    online: number;
    warning: number;
    critical: number;
    offline: number;
    unknown: number;
  }) => void;
  /** 서버 카드 경고 배지에서 AI 분석 요청 */
  onAskAI?: (server: Server) => void;
}

export default function ServerDashboard({
  servers,
  allServers,
  initialFocusServerId,
  totalServers,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onStatsUpdate: _onStatsUpdate, // Reserved for future stats callback
  onAskAI,
}: ServerDashboardProps) {
  const router = useRouter();
  // 🚀 성능 추적 활성화
  const performanceStats = usePerformanceTracking('ServerDashboard');

  const [activeTab] = useState<DashboardTab>('servers');
  const [viewMode, setViewMode] = useState<ServerViewMode>('list');
  const [serverSortKey, setServerSortKey] = useState<ServerSortKey>('status');

  // 🔧 Phase 4: useServerDashboard() 제거 - props로 데이터 받음
  // 모달 상태만 로컬로 관리
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const consumedInitialFocusServerIdRef = useRef<string | null>(null);

  const handleServerSelect = useCallback(
    (server: Server) => {
      const serverId = server.id ?? server.name;
      router.push(`/dashboard/servers/${encodeURIComponent(serverId)}`);
    },
    [router]
  );

  const handleModalClose = useCallback(() => {
    setSelectedServer(null);
  }, []);

  const focusableServers = useMemo(
    () => (allServers && allServers.length > 0 ? allServers : servers),
    [allServers, servers]
  );

  useEffect(() => {
    if (!initialFocusServerId) {
      return;
    }

    if (consumedInitialFocusServerIdRef.current === initialFocusServerId) {
      return;
    }

    const targetServer = focusableServers.find(
      (server) => (server.id ?? server.name) === initialFocusServerId
    );

    if (!targetServer) {
      return;
    }

    setSelectedServer(targetServer);
    consumedInitialFocusServerIdRef.current = initialFocusServerId;
  }, [focusableServers, initialFocusServerId]);

  // paginatedServers → servers (props)
  // onPageChange → onPageChange (props)
  // changePageSize → onPageSizeChange (props)

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 🚀 서버 정렬 최적화: 외부 상수와 최적화된 함수 사용
  // 🔧 Phase 4: paginatedServers → servers (props로 전달받음)
  const sortedServers = useMemo(() => {
    // 🛡️ AI 교차검증: servers 다층 안전성 검증 (Codex 94.1% 개선)
    if (!servers) {
      logger.warn('⚠️ ServerDashboard: servers가 undefined입니다.');
      return [];
    }
    if (!Array.isArray(servers)) {
      logger.error(
        '⚠️ ServerDashboard: servers가 배열이 아닙니다:',
        typeof servers
      );
      return [];
    }
    if (servers.length === 0) {
      logger.info('ℹ️ ServerDashboard: 표시할 서버가 없습니다.');
      return [];
    }

    // 🛡️ Codex 권장: 각 서버 객체 유효성 검증
    const validatedServers = servers.filter((server, index) => {
      if (!server || typeof server !== 'object') {
        logger.warn(
          `⚠️ ServerDashboard: 서버[${index}]가 유효하지 않음:`,
          server
        );
        return false;
      }
      if (!server.id || typeof server.id !== 'string') {
        logger.warn(
          `⚠️ ServerDashboard: 서버[${index}]의 id가 유효하지 않음:`,
          server.id
        );
        return false;
      }
      return true;
    });

    if (validatedServers.length !== servers.length) {
      logger.warn(
        `⚠️ ServerDashboard: ${servers.length - validatedServers.length}개 서버가 유효하지 않아 제외되었습니다.`
      );
    }

    return [...validatedServers].sort((a, b) => {
      if (serverSortKey === 'cpu') {
        const cpuDiff = (b.cpu ?? 0) - (a.cpu ?? 0);
        return cpuDiff || compareByStatusPriority(a, b);
      }

      if (serverSortKey === 'memory') {
        const memoryDiff = (b.memory ?? 0) - (a.memory ?? 0);
        return memoryDiff || compareByStatusPriority(a, b);
      }

      if (serverSortKey === 'name') {
        return a.name.localeCompare(b.name, 'ko-KR', {
          numeric: true,
          sensitivity: 'base',
        });
      }

      return compareByStatusPriority(a, b);
    });
  }, [servers, serverSortKey]);

  // 페이지네이션 정보 계산 (메모이제이션으로 최적화)
  // 🔧 Phase 4: totalServers props 사용 (전체 서버 수)
  const paginationInfo = useMemo(() => {
    // 🛡️ Codex 권장: 안전한 수치 계산
    const safeServersLength = Math.max(0, totalServers || 0);
    const safeTotalPages = Math.max(1, totalPages || 1);
    const safeCurrentPage = Math.max(
      1,
      Math.min(currentPage || 1, safeTotalPages)
    );
    const safePageSize = Math.max(1, pageSize || 6);

    const startIndex = Math.max(1, (safeCurrentPage - 1) * safePageSize + 1);
    const endIndex = Math.min(
      safeCurrentPage * safePageSize,
      safeServersLength
    );

    // 🎯 이전 AI 리뷰 권장: 계산 결과 유효성 검증
    if (startIndex > endIndex && safeServersLength > 0) {
      logger.warn('⚠️ ServerDashboard: 페이지네이션 계산 오류', {
        startIndex,
        endIndex,
        safeServersLength,
        safeCurrentPage,
        safeTotalPages,
      });
    }

    return {
      pageSize: safePageSize,
      startIndex: Math.min(startIndex, safeServersLength || 1),
      endIndex: Math.max(0, endIndex),
      totalServers: safeServersLength,
    };
  }, [totalServers, totalPages, currentPage, pageSize]);

  if (!isClient) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
        <p className="mt-2">대시보드 로딩 중...</p>
      </div>
    );
  }

  return (
    <div>
      <div>
        {activeTab === 'servers' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <fieldset className="inline-flex w-full rounded-md border border-gray-200 bg-gray-50 p-1 sm:w-auto">
                <legend className="sr-only">서버 보기 방식</legend>
                <button
                  type="button"
                  aria-label="리스트 보기"
                  aria-pressed={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                  className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded px-3 text-xs font-medium transition-colors sm:flex-none ${
                    viewMode === 'list'
                      ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100'
                      : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  <span>리스트</span>
                </button>
                <button
                  type="button"
                  aria-label="그리드 보기"
                  aria-pressed={viewMode === 'grid'}
                  onClick={() => setViewMode('grid')}
                  className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded px-3 text-xs font-medium transition-colors sm:flex-none ${
                    viewMode === 'grid'
                      ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100'
                      : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>그리드</span>
                </button>
              </fieldset>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                <label
                  htmlFor="server-sort"
                  className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-gray-600"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  정렬
                </label>
                <select
                  id="server-sort"
                  aria-label="서버 정렬"
                  value={serverSortKey}
                  onChange={(event) =>
                    setServerSortKey(event.target.value as ServerSortKey)
                  }
                  className="touch-text-safe-xs min-h-9 w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none sm:w-36"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 📊 페이지네이션 정보 헤더 (간소화 - 선택기는 하단에만) */}
            {totalPages > 1 && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-2">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">
                    {paginationInfo.totalServers}개
                  </span>{' '}
                  서버 중{' '}
                  <span className="font-mono">
                    {paginationInfo.startIndex}-{paginationInfo.endIndex}
                  </span>
                  번째 표시
                </p>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {currentPage}/{totalPages} 페이지
                </span>
              </div>
            )}

            {sortedServers.length > 0 ? (
              <div
                data-testid={
                  viewMode === 'grid'
                    ? 'server-dashboard-grid'
                    : 'server-dashboard-list'
                }
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 gap-4 transition-all duration-300 sm:grid-cols-2 sm:gap-6'
                    : 'grid grid-cols-1 gap-3 transition-all duration-300'
                }
              >
                {sortedServers.map((server, index) => {
                  const serverId = server.id || `server-${index}`;

                  return (
                    <ServerCardErrorBoundary
                      key={`boundary-${serverId}`}
                      serverId={serverId}
                    >
                      <ImprovedServerCard
                        key={serverId}
                        server={server}
                        variant="compact"
                        showRealTimeUpdates={true}
                        index={index}
                        onClick={handleServerSelect}
                        onAskAI={onAskAI}
                      />
                    </ServerCardErrorBoundary>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <svg
                      className="h-6 w-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-1 text-sm font-medium text-gray-900">
                    서버 정보 없음
                  </h3>
                  <p className="text-sm text-gray-500">
                    표시할 서버가 없습니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {/* 다른 탭 컨텐츠는 여기에 추가될 수 있습니다. */}
      </div>

      {totalPages > 1 && activeTab === 'servers' && (
        <ServerDashboardPaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalServers={totalServers}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}

      {/* 🎯 통합된 모달 - EnhancedServerModal 사용 */}
      {selectedServer && (
        <EnhancedServerModal
          server={selectedServer}
          onClose={handleModalClose}
        />
      )}

      {/* 🚀 개발 환경 전용: 성능 통계 표시 (좌측 하단 - AI 어시스턴트와 겹침 방지) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 z-40 max-w-xs rounded-lg border border-gray-300 bg-white/90 p-3 text-xs shadow-lg backdrop-blur-sm">
          <div className="mb-2 font-semibold text-gray-800">📊 성능 통계</div>
          <div className="space-y-1 text-gray-600">
            <div>렌더링: {performanceStats.getRenderCount()}회</div>
            <div>
              평균 시간: {performanceStats.getAverageRenderTime().toFixed(1)}ms
            </div>
            <div>서버 수: {sortedServers.length}개</div>
            <div>
              페이지: {currentPage}/{totalPages}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
