'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  calculateTwoRowsLayout,
  generateDisplayInfo,
  getDisplayModeConfig,
  type ServerDisplayMode,
} from '@/config/display-config';
import { useResponsivePageSize } from '@/hooks/dashboard/useResponsivePageSize';
import { useServerDataCache } from '@/hooks/dashboard/useServerDataCache';
import { useServerFilter } from '@/hooks/dashboard/useServerFilter';
import { useServerPagination } from '@/hooks/dashboard/useServerPagination';
import { useServerStats } from '@/hooks/dashboard/useServerStats';
import { useServerQuery } from '@/hooks/useServerQuery';
import type {
  EnhancedServerData,
  ServerWithMetrics,
  UseEnhancedServerDashboardProps,
  UseEnhancedServerDashboardReturn,
  UseServerDashboardOptions,
  ViewMode,
} from '@/types/dashboard/server-dashboard.types';
import type { Server } from '@/types/server';
import { transformServerData } from '@/utils/dashboard/server-transformer';
import { formatUptime } from '@/utils/dashboard/server-utils';

const ONLINE_ALIASES = new Set(['online', 'running', 'active']);
const WARNING_ALIASES = new Set(['warning', 'degraded', 'unstable']);
const CRITICAL_ALIASES = new Set(['critical', 'error', 'failed']);
const OFFLINE_ALIASES = new Set(['offline', 'down', 'disconnected']);

export function normalizeDashboardStatus(status?: string) {
  const normalized = status?.toLowerCase() ?? 'unknown';

  if (ONLINE_ALIASES.has(normalized)) return 'online' as const;
  if (WARNING_ALIASES.has(normalized)) return 'warning' as const;
  if (CRITICAL_ALIASES.has(normalized)) return 'critical' as const;
  if (OFFLINE_ALIASES.has(normalized)) return 'offline' as const;

  return 'unknown' as const;
}

export function matchesStatusFilter(
  status: string | undefined,
  statusFilter: string | null | undefined
) {
  if (!statusFilter) return true;
  return normalizeDashboardStatus(status) === statusFilter;
}

// 🎯 기존 useServerDashboard 훅 (하위 호환성 유지 + 성능 최적화)
export function useServerDashboard(options: UseServerDashboardOptions = {}) {
  const { initialServers, onStatsUpdate, statusFilter = null } = options;

  // React Query로 데이터 가져오기 (Phase 2: SSR 초기 데이터 지원)
  const {
    data: rawServers = [],
    isLoading,
    isError,
    error: queryError,
  } = useServerQuery({ initialData: initialServers });

  const error = queryError ? queryError.message : null;

  // 🛡️ Race Condition 방어: 캐싱 훅 사용
  const { cachedServers } = useServerDataCache(
    rawServers as unknown as EnhancedServerData[],
    {
      keepPreviousOnError: isError,
    }
  );

  // 🚀 화면 크기에 따른 초기 페이지 크기 설정
  const { pageSize: responsivePageSize, setPageSize: setResponsivePageSize } =
    useResponsivePageSize(3);

  // 🎯 서버 설정에 따른 동적 페이지 크기 설정
  const ITEMS_PER_PAGE = useMemo(() => {
    return responsivePageSize;
  }, [responsivePageSize]);

  // 선택된 서버 상태
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);

  // 🚀 React Query가 자동 갱신을 처리하므로 별도 useEffect 제거

  // 실제 서버 데이터 사용 (메모이제이션 + 데이터 변환)
  const actualServers = useMemo(() => {
    return transformServerData(cachedServers);
  }, [cachedServers]);

  // 상태 필터링 (페이지네이션 이전 단계에서 수행)
  const filteredServers = useMemo(() => {
    return actualServers.filter((server) =>
      matchesStatusFilter(server.status, statusFilter)
    );
  }, [actualServers, statusFilter]);

  // 🏗️ Clean Architecture: 페이지네이션 훅 사용
  const {
    paginatedItems: paginatedServers,
    totalPages,
    currentPage,
    setCurrentPage,
  } = useServerPagination(filteredServers, ITEMS_PER_PAGE);
  const previousStatusFilterRef = useRef<string | null>(statusFilter);

  // 상태 필터 변경 시 첫 페이지로 리셋
  useEffect(() => {
    if (previousStatusFilterRef.current === statusFilter) {
      return;
    }
    previousStatusFilterRef.current = statusFilter;
    setCurrentPage(1);
  }, [statusFilter, setCurrentPage]);

  // 필터로 페이지 수가 줄어든 경우 현재 페이지 보정
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, setCurrentPage]);

  const changePageSize = (newSize: number) => {
    setResponsivePageSize(newSize);
    setCurrentPage(1);
  };

  // 🏗️ Clean Architecture: 통계 계산 훅 사용
  const { stats } = useServerStats(actualServers as EnhancedServerData[]);

  // 🚀 통계 업데이트 콜백 호출 (디바운싱 적용)
  useEffect(() => {
    if (onStatsUpdate && stats.total > 0) {
      const timeoutId = setTimeout(() => {
        const statusCounts = actualServers.reduce(
          (acc, server) => {
            const normalized = normalizeDashboardStatus(server.status);
            acc[normalized] += 1;
            return acc;
          },
          { online: 0, warning: 0, critical: 0, offline: 0, unknown: 0 }
        );

        onStatsUpdate({
          total: stats.total,
          online: statusCounts.online,
          warning: statusCounts.warning,
          critical: statusCounts.critical,
          offline: statusCounts.offline,
          unknown: statusCounts.unknown,
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [stats, onStatsUpdate, actualServers]);

  // 서버 선택 핸들러 (useCallback으로 참조 안정화 → memo된 자식 리렌더링 방지)
  const handleServerSelect = useCallback((server: Server) => {
    setSelectedServer(server);
  }, []);

  // 모달 닫기 핸들러 (useCallback으로 참조 안정화)
  const handleModalClose = useCallback(() => {
    setSelectedServer(null);
  }, []);

  // 선택된 서버의 메트릭 계산 (메모이제이션)
  const selectedServerMetrics = useMemo(() => {
    if (!selectedServer) return null;

    const serverWithMetrics = selectedServer as ServerWithMetrics;
    return {
      cpu: serverWithMetrics.cpu || 0,
      memory: serverWithMetrics.memory || 0,
      disk: serverWithMetrics.disk || 0,
      network: serverWithMetrics.network || 0,
      uptime: serverWithMetrics.uptime || 0,
      timestamp: new Date().toISOString(),
    };
  }, [selectedServer]);

  // 🚀 최적화된 로딩 상태
  const optimizedIsLoading = isLoading && actualServers.length === 0;

  return {
    servers: actualServers,
    filteredServers,
    paginatedServers,
    filteredTotal: filteredServers.length,
    isLoading: optimizedIsLoading,
    error,
    stats,
    currentPage,
    totalPages,
    pageSize: responsivePageSize,
    setCurrentPage,
    changePageSize,
    selectedServer,
    selectedServerMetrics,
    handleServerSelect,
    handleModalClose,
    formatUptime,
  };
}

// 🆕 새로운 Enhanced 서버 대시보드 훅 (세로 2줄 + UI/UX 개선)
export function useEnhancedServerDashboard({
  servers,
}: UseEnhancedServerDashboardProps): UseEnhancedServerDashboardReturn {
  // 🎨 뷰 상태
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [displayMode, setDisplayMode] =
    useState<ServerDisplayMode>('SHOW_TWO_ROWS');

  // 🏗️ Clean Architecture: 필터링 훅 사용
  const {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    locationFilter,
    setLocationFilter,
    filteredServers,
    uniqueLocations,
    resetFilters,
  } = useServerFilter(servers);

  // 📄 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);

  // 🔄 로딩 상태
  const [isLoading, setIsLoading] = useState(false);

  // 📱 화면 크기 감지
  const [screenWidth, setScreenWidth] = useState(1280);

  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    if (typeof window !== 'undefined') {
      setScreenWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
    return undefined;
  }, []);

  // 🎯 표시 모드 설정 계산
  const displayConfig = useMemo(() => {
    return getDisplayModeConfig(displayMode, screenWidth);
  }, [displayMode, screenWidth]);

  // 🎛️ 그리드 레이아웃 계산 (세로 2줄)
  const gridLayout = useMemo(() => {
    if (displayMode === 'SHOW_TWO_ROWS') {
      const layout = calculateTwoRowsLayout(screenWidth);
      return {
        className: `grid gap-4 grid-cols-${layout.cols} grid-rows-2`,
        cols: layout.cols,
        rows: layout.rows,
      };
    }

    return {
      className:
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6',
      cols: 4,
      rows: 1,
    };
  }, [displayMode, screenWidth]);

  // 🏗️ Clean Architecture: 페이지네이션 훅 사용
  // useServerPagination을 사용하되, displayConfig.cardsPerPage를 동적으로 반영
  // 여기서는 useServerPagination을 직접 쓰지 않고 내부 로직을 재구현하여 최적화
  // (useServerPagination은 state를 가지므로, props로 전달된 pageSize 변경에 반응하려면 useEffect가 필요함)

  const calculatedTotalPages = useMemo(() => {
    const safeLength =
      filteredServers && Array.isArray(filteredServers)
        ? filteredServers.length
        : 0;
    return Math.ceil(safeLength / displayConfig.cardsPerPage);
  }, [filteredServers, displayConfig.cardsPerPage]);

  const calculatedPaginatedServers = useMemo(() => {
    if (
      !filteredServers ||
      !Array.isArray(filteredServers) ||
      filteredServers.length === 0
    ) {
      return [];
    }

    const startIndex = (currentPage - 1) * displayConfig.cardsPerPage;
    const endIndex = startIndex + displayConfig.cardsPerPage;
    return filteredServers.slice(startIndex, endIndex);
  }, [filteredServers, currentPage, displayConfig.cardsPerPage]);

  // 📊 표시 정보 생성 (UI/UX 개선)
  const displayInfo = useMemo(() => {
    const safeFilteredLength =
      filteredServers && Array.isArray(filteredServers)
        ? filteredServers.length
        : 0;
    return generateDisplayInfo(displayMode, currentPage, safeFilteredLength);
  }, [displayMode, currentPage, filteredServers]);

  // 🔄 페이지 리셋 (필터 변경 시)
  useEffect(() => {
    setCurrentPage(1);
  }, []);

  // 🔄 레이아웃 새로고침
  const refreshLayout = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 300);
  };

  return {
    paginatedServers: calculatedPaginatedServers,
    filteredServers,
    viewMode,
    displayMode,
    searchTerm,
    statusFilter,
    locationFilter,
    uniqueLocations,
    currentPage,
    totalPages: calculatedTotalPages,
    displayInfo,
    gridLayout,
    setViewMode,
    setDisplayMode,
    setSearchTerm,
    setStatusFilter,
    setLocationFilter,
    setCurrentPage,
    resetFilters,
    refreshLayout,
    isLoading,
  };
}

// NOTE: Dashboard 타입은 '@/types/dashboard/server-dashboard.types'에서 직접 import하세요.
// Storybook vitest mock 변환기가 type 재내보내기를 런타임 값으로 취급하므로 제거
