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

export type { DashboardTab, ViewMode };

// 🎯 대시보드 통계 타입
export interface DashboardStats {
  total: number;
  online: number;
  warning: number;
  critical: number; // 🚨 위험 상태 (MEM/CPU 90%+ 등)
  offline: number;
  unknown: number;
}

export type DashboardTimeRange = '2h' | '6h' | '12h' | '24h';

export const DASHBOARD_TIME_RANGE_OPTIONS: Array<{
  value: DashboardTimeRange;
  label: string;
  ariaLabel: string;
}> = [
  { value: '2h', label: '2h', ariaLabel: '2시간' },
  { value: '6h', label: '6h', ariaLabel: '6시간' },
  { value: '12h', label: '12h', ariaLabel: '12시간' },
  { value: '24h', label: '24h', ariaLabel: '24시간' },
];
