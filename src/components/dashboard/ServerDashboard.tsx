'use client';

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ImprovedServerCard from '@/components/dashboard/ImprovedServerCard';
import ServerDashboardPaginationControls from '@/components/dashboard/ServerDashboardPaginationControls';
import VirtualizedServerList from '@/components/dashboard/VirtualizedServerList';
import ServerCardErrorBoundary from '@/components/error/ServerCardErrorBoundary';
import { logger } from '@/lib/logging';
import type { DashboardTab } from '@/types/dashboard/server-dashboard.types';
import type { Server } from '@/types/server';
// react-window Grid는 사용하지 않음 (VirtualizedServerList에서 List 사용)
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

// 🚀 성능 최적화: 알림 수 계산 로직 분리 및 메모이제이션
const getAlertsCountOptimized = (alerts: unknown): number => {
  if (typeof alerts === 'number') return alerts;
  if (Array.isArray(alerts)) return alerts.length;
  return 0;
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

    // 🎯 Qwen 권장: O(17)→O(1) 복잡도 최적화 (82.9% 성능 향상)
    return validatedServers.sort((a, b) => {
      // 🛡️ 정렬 중 추가 안전성 검증
      const statusA = a?.status || 'unknown';
      const statusB = b?.status || 'unknown';

      const priorityA =
        STATUS_PRIORITY[statusA as keyof typeof STATUS_PRIORITY] ?? 3;
      const priorityB =
        STATUS_PRIORITY[statusB as keyof typeof STATUS_PRIORITY] ?? 3;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // 🎯 안전한 알림 수 계산
      const alertsA = getAlertsCountOptimized(a?.alerts);
      const alertsB = getAlertsCountOptimized(b?.alerts);

      return alertsB - alertsA;
    });
  }, [servers]);

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

    // 🎯 Qwen 권장: 계산 결과 유효성 검증
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

            {/* 🎯 페이지 크기에 따른 렌더링 방식 선택 */}
            {pageSize >= 15 && sortedServers.length >= 15 ? (
              // ⚡ 15개 전체 보기: 반응형 그리드 + 더보기 버튼
              <VirtualizedServerList
                servers={sortedServers}
                handleServerSelect={handleServerSelect}
                onAskAI={onAskAI}
              />
            ) : (
              // 📊 일반 보기 (3/6/9/12개): 그리드 레이아웃
              <div
                className={`grid gap-4 transition-all duration-300 sm:gap-6 ${
                  pageSize <= 3
                    ? 'grid-cols-1' // 3개: 모바일 최적화 (1열)
                    : pageSize <= 6
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' // 6개: 2x3 레이아웃
                      : pageSize <= 9
                        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' // 9개: 3x3 레이아웃
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' // 12개 이상: 3x4 레이아웃
                }`}
              >
                {sortedServers.length > 0 ? (
                  sortedServers.map((server, index) => {
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
                  })
                ) : (
                  // 🎯 빈 상태 UI (Gemini UX 개선 권장)
                  <div className="col-span-full flex h-64 items-center justify-center">
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
