'use client';

import { CheckCircle2 } from 'lucide-react';
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
import type { Server } from '@/types/server';
import debug from '@/utils/debug';
import { safeConsoleError, safeErrorMessage } from '@/utils/utils-functions';
import { DashboardSummary } from './DashboardSummary';
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

  // 🎯 서버 데이터에서 직접 통계 계산 (중복 API 호출 제거)
  const [statsLoading, _setStatsLoading] = useState(false);
  const [showTopology, setShowTopology] = useState(false);

  // 🛡️ currentTime 제거: 미사용 상태에서 불필요한 interval 실행 (v5.83.13)

  // 폴백 통계 계산 (v5.83.13: critical 상태 분리)
  // allServers(전체 서버)가 있으면 전체 기반으로 계산, 없으면 페이지네이션된 servers 사용
  const statsSource =
    allServers && allServers.length > 0 ? allServers : servers;
  const calculateFallbackStats = useCallback((): DashboardStats => {
    if (!statsSource || statsSource.length === 0) {
      return {
        total: 0,
        online: 0,
        offline: 0,
        warning: 0,
        critical: 0,
        unknown: 0,
      };
    }

    const stats = statsSource.reduce(
      (acc, server) => {
        acc.total += 1;
        const normalizedStatus = server.status?.toLowerCase() || 'unknown';

        // 🎯 상호 배타적 카운팅: 각 서버는 정확히 하나의 상태에만 속함
        // total = online + warning + critical + offline + unknown
        switch (normalizedStatus) {
          // 오프라인/비가용
          case 'offline':
          case 'down':
          case 'disconnected':
            acc.offline += 1;
            break;

          // 🚨 위험 상태 (critical 별도 분리)
          case 'critical':
          case 'error':
          case 'failed':
            acc.critical += 1;
            break;

          // ⚠️ 경고 상태
          case 'warning':
          case 'degraded':
          case 'unstable':
            acc.warning += 1;
            break;

          // Unknown/Maintenance
          case 'unknown':
          case 'maintenance':
            acc.unknown += 1;
            break;

          // 정상 온라인
          case 'online':
          case 'running':
          case 'active':
            acc.online += 1;
            break;

          // 정의되지 않은 상태
          default:
            acc.unknown += 1;
            break;
        }

        return acc;
      },
      { total: 0, online: 0, offline: 0, warning: 0, critical: 0, unknown: 0 }
    );

    return stats;
  }, [statsSource]);

  // 최종 서버 통계 (서버 데이터에서 직접 계산)
  const serverStats = useMemo(() => {
    if (statsLoading) {
      return {
        total: 0,
        online: 0,
        offline: 0,
        warning: 0,
        critical: 0,
        unknown: 0,
      };
    }

    // 서버 데이터에서 직접 통계 계산
    const stats = calculateFallbackStats();
    debug.log('📊 서버 통계 계산:', stats);
    return stats;
  }, [statsLoading, calculateFallbackStats]);

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
              <DashboardSummary
                stats={serverStats}
                activeFilter={statusFilter}
                onFilterChange={onStatusFilterChange}
              />

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

// ======== System Overview Section (Stitch Screen A 기반) ========
// 화이트 테마, indigo monochromatic 게이지 + amber 경고 배지

const GAUGE_COLORS = {
  cpu: '#6366f1',
  memory: '#818cf8',
  disk: '#a78bfa',
} as const;

function SystemOverviewSection({ servers }: { servers: Server[] }) {
  const averages = useMemo(() => {
    if (!servers || servers.length === 0) {
      return { cpu: 0, memory: 0, disk: 0 };
    }
    const sum = servers.reduce(
      (acc, s) => ({
        cpu: acc.cpu + (s.cpu ?? 0),
        memory: acc.memory + (s.memory ?? 0),
        disk: acc.disk + (s.disk ?? 0),
      }),
      { cpu: 0, memory: 0, disk: 0 }
    );
    const count = servers.length;
    return {
      cpu: Math.round(sum.cpu / count),
      memory: Math.round(sum.memory / count),
      disk: Math.round(sum.disk / count),
    };
  }, [servers]);

  const topAlerts = useMemo(() => {
    if (!servers || servers.length === 0) return [];
    return [...servers]
      .map((s) => ({
        id: s.id ?? s.name,
        name: s.name,
        maxUsage: Math.max(s.cpu ?? 0, s.memory ?? 0, s.disk ?? 0),
        status: s.status,
      }))
      .sort((a, b) => b.maxUsage - a.maxUsage)
      .slice(0, 5);
  }, [servers]);

  const gauges: {
    key: 'cpu' | 'memory' | 'disk';
    label: string;
    value: number;
  }[] = [
    { key: 'cpu', label: 'CPU', value: averages.cpu },
    { key: 'memory', label: 'Memory', value: averages.memory },
    { key: 'disk', label: 'Disk', value: averages.disk },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 좌: 시스템 리소스 평균 게이지 */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
            시스템 리소스
          </p>
          <div className="flex items-center justify-around">
            {gauges.map((g) => (
              <MiniGauge
                key={g.key}
                value={g.value}
                label={g.label}
                color={GAUGE_COLORS[g.key]}
              />
            ))}
          </div>
        </div>

        {/* 우: 주요 경고 Top 5 */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
            주요 경고 (Top 5)
          </p>
          <div className="space-y-0">
            {topAlerts.map((alert, idx) => {
              const isWarning = alert.maxUsage >= 70;
              const isCritical = alert.maxUsage >= 85;
              return (
                <div
                  key={alert.id}
                  className={`flex min-w-0 items-center justify-between gap-2 px-2 py-2 ${
                    idx < topAlerts.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <span
                    className="truncate text-sm text-slate-700"
                    title={alert.name}
                  >
                    {alert.name}
                  </span>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                      isCritical
                        ? 'bg-red-50 text-red-700'
                        : isWarning
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {alert.maxUsage}%
                  </span>
                </div>
              );
            })}
            {topAlerts.length === 0 && (
              <div className="flex items-center gap-2 px-2 py-3 text-sm text-slate-400">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                경고 없음
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 미니 원형 게이지 (indigo monochromatic)
function MiniGauge({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  const size = 72;
  const strokeWidth = 5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.max(0, Math.min(100, value));
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90 transform"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-900">{value}%</span>
        </div>
      </div>
      <span className="mt-1.5 text-xs text-slate-500">{label}</span>
    </div>
  );
}
