import type { ServerDisplayMode } from '@/config/display-config';
import type {
  Server,
  ServerEnvironment,
  ServerRole,
  ServerStatus,
  Service,
} from '@/types/server';

// 🏗️ Clean Architecture: 도메인 레이어 - 순수 비즈니스 로직
export interface ServerStats {
  total: number;
  online: number;
  unknown: number;
  warning: number;
  critical: number;
  avgCpu: number;
  avgMemory: number;
  avgDisk: number;
  averageCpu?: number; // 🚀 Web Worker 호환성
  averageMemory?: number; // 🚀 Web Worker 호환성
  averageUptime?: number; // 🚀 Web Worker 추가 메트릭
  totalBandwidth?: number; // 🚀 Web Worker 추가 메트릭
  typeDistribution?: Record<string, number>; // 🚀 Web Worker 추가 메트릭
  performanceMetrics?: {
    calculationTime: number;
    serversProcessed: number;
  };
}

/**
 * 🔧 서버 데이터 변환용 통합 인터페이스
 *
 * API 호환성 참고:
 * - cpu/cpu_usage: 다양한 API 응답 형식 지원 (Supabase vs Mock vs Prometheus)
 * - memory/memory_usage: 동일
 * - disk/disk_usage: 동일
 * - network/network_in/network_out/bandwidth: 네트워크 메트릭 다양한 표현 지원
 */
export interface EnhancedServerData {
  id: string;
  name?: string;
  hostname?: string;
  status: ServerStatus;
  /** CPU 사용률 (0-100) - 표준 필드 */
  cpu?: number;
  /** CPU 사용률 (0-100) - API 호환성용 별칭 */
  cpu_usage?: number;
  /** 메모리 사용률 (0-100) - 표준 필드 */
  memory?: number;
  /** 메모리 사용률 (0-100) - API 호환성용 별칭 */
  memory_usage?: number;
  /** 디스크 사용률 (0-100) - 표준 필드 */
  disk?: number;
  /** 디스크 사용률 (0-100) - API 호환성용 별칭 */
  disk_usage?: number;
  /** 네트워크 사용률 (0-100) - 표준 필드 */
  network?: number;
  /** 네트워크 수신량 (bytes/sec) */
  network_in?: number;
  /** 네트워크 송신량 (bytes/sec) */
  network_out?: number;
  /** 총 대역폭 사용량 (Mbps) */
  bandwidth?: number;
  uptime?: number;
  location?: string;
  alerts?: Array<unknown> | number;
  ip?: string;
  os?: string;
  type?: string;
  role?: ServerRole | string;
  environment?: ServerEnvironment | string;
  provider?: string;
  specs?: {
    cpu_cores: number;
    memory_gb: number;
    disk_gb: number;
    network_speed?: string;
  };
  lastUpdate?: Date | string;
  services?: Service[] | Array<unknown>;
  systemInfo?: {
    os: string;
    uptime: string;
    processes: number;
    zombieProcesses: number;
    loadAverage: string;
    lastUpdate: string;
  };
  networkInfo?: {
    interface: string;
    receivedBytes: string;
    sentBytes: string;
    receivedUtilizationPercent?: number;
    sentUtilizationPercent?: number;
    receivedErrors: number;
    sentErrors: number;
    status: 'online' | 'offline' | 'warning' | 'critical';
  };
}

export interface ServerWithMetrics extends Server {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  uptime: number;
}

export type DashboardTab = 'servers' | 'network' | 'clusters' | 'applications';
export type ViewMode = 'grid' | 'list';

// 🎯 기존 useServerDashboard 인터페이스 유지 (v5.83.13: critical 추가)
export interface UseServerDashboardOptions {
  /** Pre-fetched servers from Server Component (Phase 2: SSR) */
  initialServers?: Server[];
  /** 상태 필터 (DashboardSummary 연동) */
  statusFilter?: string | null;
  onStatsUpdate?: (stats: {
    total: number;
    online: number;
    warning: number;
    critical: number; // 🚨 위험 상태
    offline: number;
    unknown: number;
  }) => void;
}

/**
 * 🆕 Enhanced 서버 대시보드 훅 Props
 */
export interface UseEnhancedServerDashboardProps {
  servers: Server[];
}

export interface UseEnhancedServerDashboardReturn {
  // 🎯 서버 데이터
  paginatedServers: Server[];
  filteredServers: Server[];

  // 🎨 뷰 설정
  viewMode: ViewMode;
  displayMode: ServerDisplayMode;

  // 🔍 필터링
  searchTerm: string;
  statusFilter: string;
  locationFilter: string;
  uniqueLocations: string[];

  // 📄 페이지네이션
  currentPage: number;
  totalPages: number;

  // 📊 표시 정보 (UI/UX 개선)
  displayInfo: {
    totalServers: number;
    displayedCount: number;
    statusMessage: string;
    paginationMessage: string;
    modeDescription: string;
    displayRange: string;
  };

  // 🎛️ 그리드 레이아웃 (세로 2줄)
  gridLayout: {
    className: string;
    cols: number;
    rows: number;
  };

  // 🎯 액션 함수들
  setViewMode: (mode: ViewMode) => void;
  setDisplayMode: (mode: ServerDisplayMode) => void;
  setSearchTerm: (term: string) => void;
  setStatusFilter: (status: string) => void;
  setLocationFilter: (location: string) => void;
  setCurrentPage: (page: number) => void;
  resetFilters: () => void;

  // 🔄 유틸리티
  refreshLayout: () => void;
  isLoading: boolean;
}
