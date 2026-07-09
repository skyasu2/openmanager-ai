'use client';

import {
  ArrowUpDown,
  ChevronDown,
  LayoutGrid,
  List,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ImprovedServerCard from '@/components/dashboard/ImprovedServerCard';
import { logger } from '@/lib/logging';
import type { Server } from '@/types/server';
import { usePerformanceTracking } from '@/utils/performance';
import {
  compareByStatusPriority,
  DEFAULT_VISIBLE_ROWS,
  getServerCardColumns,
  matchesServerSearch,
  normalizeServerSearchValue,
  runDashboardViewTransition,
  type ServerSortKey,
  type ServerViewMode,
  type ServerVisualizationMode,
  SORT_OPTIONS,
  VISUALIZATION_OPTIONS,
} from './ServerDashboard.utils';
import { ServerDashboardDevStats } from './ServerDashboardDevStats';
import { ServerDashboardEmptyState } from './ServerDashboardEmptyState';
import { HexagonalHostMap } from './ServerDashboardHostMap';
import type { DashboardTimeRange } from './types/dashboard.types';

/**
 * ServerDashboard Props (Phase 4: Props 기반 데이터 흐름)
 * - 중복 fetch 제거: DashboardClient → DashboardContent → ServerDashboard로 props 전달
 * - useServerDashboard() 호출 제거
 */
interface ServerDashboardProps {
  /** 페이지네이션된 서버 목록 (DashboardClient에서 전달) */
  servers: Server[];
  /** 현재 화면에서 표시 대상이 되는 전체 서버 목록. 정렬은 이 배열 기준으로 수행한다. */
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
  /** 통계 업데이트 콜백 */
  onStatsUpdate?: (stats: {
    total: number;
    online: number;
    warning: number;
    critical: number;
    offline: number;
    unknown: number;
  }) => void;
  /** 최초 화면에서 노출할 서버 카드 줄 수 */
  initialVisibleRows?: number;
  /** 서버 카드가 놓인 화면 맥락. 개요와 전체 서버 목록의 카운트 문구를 분리한다. */
  surface?: 'overview' | 'server-list';
  /** 서버 카드 스파크라인 히스토리 범위 */
  metricsTimeRange?: DashboardTimeRange;
}

export default function ServerDashboard({
  servers,
  allServers,
  totalServers,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onStatsUpdate: _onStatsUpdate, // Reserved for future stats callback
  initialVisibleRows = DEFAULT_VISIBLE_ROWS,
  surface = 'server-list',
  metricsTimeRange = '24h',
}: ServerDashboardProps) {
  const router = useRouter();
  // 🚀 성능 추적 활성화
  const performanceStats = usePerformanceTracking('ServerDashboard');

  const [viewMode, setViewMode] = useState<ServerViewMode>('list');
  const [visualizationMode, setVisualizationMode] =
    useState<ServerVisualizationMode>('cards');
  const [serverSortKey, setServerSortKey] = useState<ServerSortKey>('status');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleRows, setVisibleRows] = useState(initialVisibleRows);
  const [serverGridWidth, setServerGridWidth] = useState(1280);
  const [serverGridElement, setServerGridElement] =
    useState<HTMLDivElement | null>(null);

  // 🔧 Phase 4: useServerDashboard() 제거 - props로 데이터 받음

  const handleServerSelect = useCallback(
    (server: Server) => {
      const serverId = server.id ?? server.name;
      router.push(`/dashboard/servers/${encodeURIComponent(serverId)}`);
    },
    [router]
  );

  const handleOpenLogs = useCallback(
    (server: Server) => {
      const serverId = server.id ?? server.name;
      router.push(`/dashboard/logs?server=${encodeURIComponent(serverId)}`);
    },
    [router]
  );

  const handleVisualizationModeChange = useCallback(
    (nextMode: ServerVisualizationMode) => {
      if (nextMode === visualizationMode) {
        return;
      }

      runDashboardViewTransition(() => setVisualizationMode(nextMode));
    },
    [visualizationMode]
  );

  // paginatedServers → servers (props)
  // onPageChange → onPageChange (props)
  // changePageSize → onPageSizeChange (props)

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const serverSource = allServers?.length ? allServers : servers;
  const hasCompleteServerSource = serverSource.length >= (totalServers || 0);

  const validatedServers = useMemo(() => {
    // 🛡️ AI 교차검증: servers 다층 안전성 검증 (Codex 94.1% 개선)
    if (!serverSource) {
      logger.warn('⚠️ ServerDashboard: servers가 undefined입니다.');
      return [];
    }
    if (!Array.isArray(serverSource)) {
      logger.error(
        '⚠️ ServerDashboard: servers가 배열이 아닙니다:',
        typeof serverSource
      );
      return [];
    }
    if (serverSource.length === 0) {
      logger.info('ℹ️ ServerDashboard: 표시할 서버가 없습니다.');
      return [];
    }

    const validServers = serverSource.filter((server, index) => {
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

    if (validServers.length !== serverSource.length) {
      logger.warn(
        `⚠️ ServerDashboard: ${serverSource.length - validServers.length}개 서버가 유효하지 않아 제외되었습니다.`
      );
    }

    return validServers;
  }, [serverSource]);

  const normalizedSearchQuery = useMemo(
    () => normalizeServerSearchValue(searchQuery),
    [searchQuery]
  );
  const isSearching = normalizedSearchQuery.length > 0;
  const filteredServers = useMemo(
    () =>
      validatedServers.filter((server) =>
        matchesServerSearch(server, normalizedSearchQuery)
      ),
    [normalizedSearchQuery, validatedServers]
  );

  // 🚀 서버 정렬 최적화: 외부 상수와 최적화된 함수 사용
  // 🔧 Phase 4: paginatedServers → servers (props로 전달받음)
  const sortedServers = useMemo(() => {
    return [...filteredServers].sort((a, b) => {
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
  }, [filteredServers, serverSortKey]);

  const cardsPerRow = useMemo(
    () => getServerCardColumns(viewMode, serverGridWidth),
    [serverGridWidth, viewMode]
  );

  const rowStep = Math.max(1, initialVisibleRows);
  const visibleLimit = Math.max(1, visibleRows * cardsPerRow);
  const displayedServers = useMemo(
    () => sortedServers.slice(0, visibleLimit),
    [sortedServers, visibleLimit]
  );

  useEffect(() => {
    setVisibleRows(initialVisibleRows);
  }, [initialVisibleRows]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateGridWidth = () => {
      const measuredWidth = serverGridElement?.getBoundingClientRect().width;
      setServerGridWidth(
        measuredWidth && measuredWidth > 0 ? measuredWidth : window.innerWidth
      );
    };

    updateGridWidth();

    if (!serverGridElement || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateGridWidth);
      return () => window.removeEventListener('resize', updateGridWidth);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      setServerGridWidth(width && width > 0 ? width : window.innerWidth);
    });

    resizeObserver.observe(serverGridElement);
    window.addEventListener('resize', updateGridWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateGridWidth);
    };
  }, [serverGridElement]);

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

  const hasMoreLoadedServers = visibleLimit < sortedServers.length;
  const hasMorePagedServers =
    !isSearching &&
    !hasCompleteServerSource &&
    (paginationInfo.pageSize < paginationInfo.totalServers ||
      currentPage < totalPages);
  const effectiveTotalServers = isSearching
    ? sortedServers.length
    : paginationInfo.totalServers;
  const canShowMoreServers = hasMoreLoadedServers || hasMorePagedServers;
  const hiddenServerCount = Math.max(
    0,
    effectiveTotalServers - displayedServers.length
  );
  const isOverviewSurface = surface === 'overview';
  const nextVisibleServerLimit = (visibleRows + rowStep) * cardsPerRow;
  const nextLoadedVisibleCount = Math.min(
    nextVisibleServerLimit,
    sortedServers.length
  );
  const nextPagedServerCount = Math.min(
    paginationInfo.totalServers,
    paginationInfo.pageSize + rowStep * cardsPerRow
  );
  const willShowAllServersOnNextClick =
    hiddenServerCount > 0 &&
    (hasMoreLoadedServers
      ? nextLoadedVisibleCount >= effectiveTotalServers
      : paginationInfo.pageSize < paginationInfo.totalServers
        ? nextPagedServerCount >= paginationInfo.totalServers
        : false);
  const showMoreServersButtonText =
    isOverviewSurface || !willShowAllServersOnNextClick
      ? '더 보기'
      : '모든 서버 보기';
  const showMoreServersButtonAriaLabel = `${
    showMoreServersButtonText === '모든 서버 보기'
      ? `더 보기 - ${showMoreServersButtonText}`
      : showMoreServersButtonText
  }${hiddenServerCount > 0 ? ` (${hiddenServerCount}대 남음)` : ''}`;

  const handleShowMoreServers = useCallback(() => {
    const nextRows = visibleRows + rowStep;
    const nextVisibleLimit = nextRows * cardsPerRow;

    if (visibleLimit < sortedServers.length) {
      setVisibleRows(nextRows);
      return;
    }

    if (
      !hasCompleteServerSource &&
      paginationInfo.pageSize < paginationInfo.totalServers
    ) {
      const nextPageSize = Math.min(
        paginationInfo.totalServers,
        paginationInfo.pageSize + rowStep * cardsPerRow
      );
      setVisibleRows(Math.ceil(nextPageSize / cardsPerRow));
      onPageSizeChange(nextPageSize);
      return;
    }

    if (currentPage < totalPages) {
      setVisibleRows(Math.ceil(nextVisibleLimit / cardsPerRow));
      onPageChange(currentPage + 1);
    }
  }, [
    cardsPerRow,
    currentPage,
    hasCompleteServerSource,
    onPageChange,
    onPageSizeChange,
    paginationInfo.pageSize,
    paginationInfo.totalServers,
    rowStep,
    sortedServers.length,
    totalPages,
    visibleLimit,
    visibleRows,
  ]);

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
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white/80 px-3 py-3 shadow-sm backdrop-blur-sm sm:px-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div
                role="tablist"
                aria-label="서버 표시 방식"
                className="inline-flex w-full rounded-md border border-gray-200 bg-gray-50 p-1 sm:w-auto"
              >
                {VISUALIZATION_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = visualizationMode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() =>
                        handleVisualizationModeChange(option.value)
                      }
                      className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded px-3 text-xs font-medium transition-colors sm:flex-none ${
                        selected
                          ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100'
                          : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative min-w-0 flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="server-search"
                  type="search"
                  aria-label="서버 검색"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="서버 이름, ID, IP, 위치 검색"
                  className="min-h-10 w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-10 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="서버 검색어 지우기"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {visualizationMode === 'cards' && (
                <fieldset className="inline-flex w-full rounded-md border border-gray-200 bg-gray-50 p-1 sm:w-auto">
                  <legend className="sr-only">서버 보기 방식</legend>
                  <button
                    type="button"
                    aria-label="목록 보기"
                    aria-pressed={viewMode === 'list'}
                    onClick={() => setViewMode('list')}
                    className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded px-3 text-xs font-medium transition-colors sm:flex-none ${
                      viewMode === 'list'
                        ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100'
                        : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'
                    }`}
                  >
                    <List className="h-3.5 w-3.5" />
                    <span>목록</span>
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
              )}

              <div className="flex w-full items-center gap-2 sm:w-auto">
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-gray-600">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  정렬
                </span>
                <fieldset className="inline-flex w-full rounded-md border border-gray-200 bg-gray-50 p-1 sm:w-auto">
                  <legend className="sr-only">서버 정렬</legend>
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={`${option.label} 정렬`}
                      aria-pressed={serverSortKey === option.value}
                      onClick={() => setServerSortKey(option.value)}
                      className={`inline-flex min-h-9 flex-1 items-center justify-center rounded px-3 text-xs font-medium transition-colors sm:flex-none ${
                        serverSortKey === option.value
                          ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100'
                          : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </fieldset>
              </div>
            </div>
          </div>

          {/* 📊 서버 노출 정보 헤더 */}
          {paginationInfo.totalServers > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white/70 px-4 py-2 backdrop-blur-sm">
              <p className="text-sm text-slate-700">
                {isSearching ? (
                  <>
                    검색 결과{' '}
                    <span className="font-mono">{displayedServers.length}</span>
                    대 표시
                    <span className="ml-1 text-slate-500">
                      (전체 {paginationInfo.totalServers}대 중{' '}
                      {sortedServers.length}대)
                    </span>
                  </>
                ) : isOverviewSurface ? (
                  <>
                    상위 알림 서버{' '}
                    <span className="font-mono">{displayedServers.length}</span>
                    개 표시
                    <span className="ml-1 text-slate-500">
                      (전체 {paginationInfo.totalServers}대)
                    </span>
                  </>
                ) : (
                  <>
                    전체 서버{' '}
                    <span className="font-medium">
                      {paginationInfo.totalServers}대
                    </span>{' '}
                    중{' '}
                    <span className="font-mono">{displayedServers.length}</span>
                    대 표시
                  </>
                )}
              </p>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {isSearching
                  ? sortedServers.length === 0
                    ? '결과 없음'
                    : displayedServers.length === effectiveTotalServers
                      ? '검색 결과 전체'
                      : `${hiddenServerCount}대 남음`
                  : isOverviewSurface
                    ? '위험도 우선'
                    : displayedServers.length === effectiveTotalServers
                      ? '모든 서버 표시'
                      : `${hiddenServerCount}대 남음`}
              </span>
            </div>
          )}

          {sortedServers.length > 0 ? (
            <div
              data-testid="server-dashboard-peek-container"
              className="relative"
              style={{ viewTransitionName: 'dashboard-server-visualization' }}
            >
              {visualizationMode === 'host-map' ? (
                <HexagonalHostMap
                  servers={displayedServers}
                  onSelect={handleServerSelect}
                />
              ) : (
                <div
                  ref={setServerGridElement}
                  data-testid={
                    viewMode === 'grid'
                      ? 'server-dashboard-grid'
                      : 'server-dashboard-list'
                  }
                  className={
                    viewMode === 'grid'
                      ? 'mx-auto grid max-w-[1352px] grid-cols-1 justify-center gap-4 transition-all duration-300 sm:grid-cols-[repeat(auto-fill,minmax(320px,320px))] sm:gap-6'
                      : 'mx-auto grid max-w-[1196px] grid-cols-1 justify-center gap-3 transition-all duration-300 sm:grid-cols-[repeat(auto-fill,minmax(290px,290px))]'
                  }
                >
                  {displayedServers.map((server, index) => {
                    const serverId = server.id || `server-${index}`;

                    return (
                      <ImprovedServerCard
                        key={serverId}
                        server={server}
                        variant="compact"
                        showRealTimeUpdates={true}
                        index={index}
                        onClick={handleServerSelect}
                        onOpenLogs={handleOpenLogs}
                        metricsTimeRange={metricsTimeRange}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <ServerDashboardEmptyState isSearching={isSearching} />
          )}

          {canShowMoreServers && (
            <div
              data-testid="server-dashboard-more-fade"
              aria-hidden="true"
              className="h-6 rounded-b-xl bg-linear-to-b from-transparent via-white/80 to-white"
            />
          )}

          {canShowMoreServers && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm sm:flex-row sm:justify-between">
              <span className="text-slate-600">
                {isOverviewSurface
                  ? `상위 알림 서버 ${displayedServers.length}개 표시`
                  : `${displayedServers.length}/${paginationInfo.totalServers}대 서버 표시`}
              </span>
              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  type="button"
                  aria-label={showMoreServersButtonAriaLabel}
                  onClick={handleShowMoreServers}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 sm:flex-none"
                >
                  <ChevronDown className="h-4 w-4" />
                  {showMoreServersButtonText}
                  {hiddenServerCount > 0 && (
                    <span className="text-blue-100">
                      ({hiddenServerCount}대 남음)
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
        {/* 다른 탭 컨텐츠는 여기에 추가될 수 있습니다. */}
      </div>

      <ServerDashboardDevStats
        displayedServerCount={displayedServers.length}
        performanceStats={performanceStats}
        sortedServerCount={sortedServers.length}
        totalServerCount={paginationInfo.totalServers}
      />
    </div>
  );
}
