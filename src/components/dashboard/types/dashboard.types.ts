/**
 * 📊 ServerDashboard 타입 정의
 *
 * ⚠️ 중요: 이 파일은 ServerDashboard 핵심 모듈입니다 - 수정 시 신중히 검토하세요!
 *
 * SOLID 원칙에 따른 타입 분리
 * - Single Responsibility: 타입 정의만 담당
 * - Open/Closed: 확장 가능한 인터페이스 구조
 *
 * 📍 사용처:
 * - src/components/dashboard/ServerDashboard.tsx (메인 컴포넌트)
 * - src/components/dashboard/hooks/useServerData.ts
 * - src/components/dashboard/hooks/useServerFilters.ts
 * - src/hooks/useServerDashboard.ts (기존 훅 호환)
 *
 * 🔄 의존성: src/types/server.ts
 * 📅 생성일: 2025.06.14 (ServerDashboard 1522줄 분리 작업)
 */

import type {
  DashboardTab,
  ViewMode,
} from '@/types/dashboard/server-dashboard.types';
import type { Server } from '@/types/server';

export type { DashboardTab, ViewMode };

// 🎯 서버 필터 타입
export interface ServerFilters {
  status?: 'online' | 'offline' | 'warning' | 'critical' | 'unknown' | 'all';
  location?: string;
  searchTerm?: string;
}

// 🎯 대시보드 통계 타입
export interface DashboardStats {
  total: number;
  online: number;
  warning: number;
  critical: number; // 🚨 위험 상태 (MEM/CPU 90%+ 등)
  offline: number;
  unknown: number;
}

// 🎯 서버 인스턴스 타입 (기존 코드에서 추출)
export interface ServerInstance {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'critical' | 'unknown';
  location: string;
  cpu: number;
  memory: number;
  disk: number;
  uptime: string;
  lastUpdate: Date;
  alerts: number;
  services: Array<{
    name: string;
    status: string;
    port: number;
  }>;
}

// 🎯 서버 클러스터 타입
export interface ServerCluster {
  id: string;
  name: string;
  servers: ServerInstance[];
}

// 🎯 애플리케이션 메트릭 타입
export interface ApplicationMetrics {
  id: string;
  name: string;
  status: string;
  responseTime: number;
  throughput: number;
}

// 🎯 대시보드 Props 타입
export interface ServerDashboardProps {
  onStatsUpdate?: (stats: DashboardStats) => void;
}

// 🎯 서버 액션 타입
export interface ServerAction {
  id: string;
  type: 'restart' | 'stop' | 'start' | 'configure';
  label: string;
  icon?: string;
  dangerous?: boolean;
}

// 🎯 네트워크 상태 타입
export interface NetworkStatus {
  latency: number;
  bandwidth: number;
  packetLoss: number;
  status: 'excellent' | 'good' | 'poor' | 'offline';
}

// 🎯 실시간 데이터 타입
export interface RealtimeData {
  timestamp: Date;
  servers: Server[];
  networkStatus: NetworkStatus;
  systemLoad: number;
}
